// STORY-183 — the facade downtime drill, driven deterministically on this machine.
//
// The drill is the outage cycle this platform rehearses on purpose (you cannot
// discover the outage answer while the outage is happening):
//   UP → DOWN (facade stopped) → break-glass read-only (allowlisted, reason recorded)
//   → governed write buffered to the shadow queue → RECOVER → replay through the
//   facade's one ceremony endpoint, trimmed only when written AND read back.
//
// This file drives runDowntimeDrill with a recorded break-glass stub (no VM, no
// network) and asserts every invariant of the cycle:
//   - the break-glass command used is the allowlisted one, and its usage is recorded
//     WITH the reason (a break-glass without a reason is un-auditable);
//   - a write offered while the face is down is queued, never dropped;
//   - after recovery the replay lands the write through the facade and trims the
//     queue exactly as far as what was replayed.
//
// The operator-facing drill (node facade-downtime-drill.mjs) performs the real
// allowlisted SSH status read against the AOS host; everything else is identical.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { startFacadeWriteService } from "./facade-write-service.mjs";
import { LOCAL_ENGINE } from "../switch-rehearsal/rehearsal-lib.mjs";
import { readQueueFile } from "../aos-local-client/fallback-cli.mjs";
import { sshCommandAllowlisted } from "../aos-local-client/doc-topology-predicates.mjs";
import {
  runDowntimeDrill
} from "./facade-downtime-drill.mjs";
import {
  liveCatalogueIndex, makeScratchFixture, recordScope
} from "./facade-write-rejection-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const READ_PARTITION = "cross-project"; // the real AOS partition the break-glass read inspects
const WRITE_PARTITION = "P1";            // the local scratch chain the facade replay targets
const ACTOR = "agent:fable";
const SCOPE = "STORY-183 facade downtime drill replay";

test("the downtime drill: DOWN → break-glass (reason recorded) → QUEUE → RECOVER → replay through the facade", async () => {
  const fixture = makeScratchFixture();
  const queueFile = join(fixture.base, "shadow-queue.json");
  const writeRoot = mkdtempSync(join(tmpdir(), "facade-183-drill-"));
  const catalogue = await liveCatalogueIndex();
  const anchor = { workspace: fixture.workspace, workId: fixture.workId, externalKey: "FACADE-183-INIT" };

  // The break-glass executor is a stub that RECORDS the command it was handed (the
  // test's claim is "the drill used the allowlisted command and recorded why", not
  // "the VM answered"), and answers as the engine's status would.
  const breakglassCalls = [];
  const breakglassExec = async (command) => {
    breakglassCalls.push(command);
    return { ok: true, version: 4242, workspaceId: "stub-ws" };
  };

  const facadeFactory = async () => {
    const attestDir = join(fixture.base, "attest");
    mkdirSync(attestDir, { recursive: true });
    return startFacadeWriteService({
      engineRoot: LOCAL_ENGINE,
      workspaces: { [WRITE_PARTITION]: fixture.workspace },
      attestDirs: { [WRITE_PARTITION]: attestDir },
      // INC-084: startup requires pgSchemas coverage.
      pgSchemas: { [WRITE_PARTITION]: "chain_write_test" },
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1", "localhost"],
      catalogTtlMs: 5 * 60_000,
      writeRoot,
      actor: ACTOR
    });
  };

  let report;
  try {
    report = await runDowntimeDrill({
      readPartition: READ_PARTITION, writePartition: WRITE_PARTITION,
      facadeFactory, queueFile, anchor, catalogue,
      breakglassExec, writeRoot, actor: ACTOR, scope: SCOPE
    });

    // ── the whole cycle completed, in order ─────────────────────────────────
    assert.equal(report.phase, "complete");
    assert.equal(report.phases.up.health, true, "the face came up");
    assert.equal(report.phases.down.health, false, "and was stopped for the outage");
    assert.equal(report.phases.recovered.health, true, "and came back up");

    // ── the break-glass read was the ALLOWLISTED command, reason recorded ────
    assert.equal(breakglassCalls.length, 1, "exactly one break-glass read during the outage");
    const allowlist = JSON.parse(readFileSync(join(HERE, "..", "aos-local-client", "ssh-breakglass-allowlist.json"), "utf8")).entries ?? [];
    assert.equal(sshCommandAllowlisted(breakglassCalls[0], allowlist), true,
      "the drill's read command must be the allowlisted break-glass status command");
    const record = report.breakglass;
    assert.equal(record.allowlisted, true);
    assert.ok(typeof record.reason === "string" && record.reason.length > 0,
      "the break-glass usage must be recorded WITH a reason");
    assert.ok(record.reason.includes("break-glass"), "and the reason must say it is break-glass");
    assert.equal(record.chainVersion, 4242, "the recorded read reports the chain position");

    // ── a write offered while DOWN was buffered, not dropped ────────────────
    assert.equal(report.queue.route, "queued");
    assert.equal(report.queue.backlog, 1, "one governed write queued during the outage");

    // ── after recovery the replay landed the write THROUGH the facade ───────
    assert.equal(report.replay.route, "facade");
    assert.equal(report.replay.reasonCode, "CEREMONY_COMPLETED_AND_READ_BACK");
    assert.equal(report.replay.replayed, 1);
    assert.equal(report.replay.remaining, 0, "the queue is trimmed exactly as far as what was replayed");
    assert.equal(report.replay.scopeLanded, SCOPE, "the replayed write reached the chain, read back full-value");
    assert.equal(recordScope(fixture.workspace, fixture.workId), SCOPE,
      "independent engine read confirms the scope landed");
    assert.equal(readQueueFile(queueFile).length, 0, "the shadow queue is empty after replay");
  } finally {
    rmSync(writeRoot, { recursive: true, force: true });
    rmSync(fixture.base, { recursive: true, force: true });
  }
});
