// STORY-183 — the facade downtime drill: break-glass read + shadow-queue replay.
//
// The drill proves the platform's outage answer for the facade WRITE face, end to
// end, as a local cycle (a VM chain is never touched by the replay half):
//
//   1. UP     — the facade write service answers /api/health.
//   2. DOWN   — the facade is stopped (the outage this drill exists for).
//   3. READ   — while the write face is down, read-only verification goes through
//               the break-glass path: the allowlisted `ssh … engine status` command
//               (ssh-breakglass-allowlist.json, class mcp-unreachable-fallback).
//               The usage is RECORDED with its reason — a break-glass used without a
//               recorded reason is a break-glass the platform cannot audit.
//   4. QUEUE  — a governed write offered while the face is down is NOT dropped: it
//               is buffered verbatim into the partition's shadow queue, exactly as
//               fallback-cli.mjs does during an outage.
//   5. RECOVER — the facade is restarted.
//   6. REPLAY — the backlog is replayed THROUGH the facade's one ceremony endpoint:
//               the queued argv is turned back into a ceremony payload with the host
//               engine's own catalogue (flagsFromQueuedArgv, the authoritative parse),
//               POSTed to /api/ceremony, and trimmed only when the write landed and
//               was read back.
//
// The drill is a script AND a testable core: runDowntimeDrill(options) takes the
// break-glass executor and the facade factory as injectables, so the test drives the
// whole cycle with a recorded stub read while the operator-facing CLI performs the
// real allowlisted SSH read against the AOS host.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  acquireQueueLock, assertQueueEntry, flagsFromQueuedArgv, readQueueFile, writeQueueAtomic
} from "../aos-local-client/fallback-cli.mjs";
import { sshCommandAllowlisted } from "../aos-local-client/doc-topology-predicates.mjs";
import { aosPartition } from "../aos-local-client/aos-partitions.mjs";
import { VM_ENGINE, VM_HOST } from "../aos-local-client/topology.mjs";
import { liveCatalogueIndex, makeScratchFixture, recordScope } from "./facade-write-rejection-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Why the break-glass read is being used — a break-glass without a reason is un-auditable. */
export const BREAKGLASS_REASON =
  "AOS 主机门面(facade-read-service / facade-write-service)不可达 → 经 SSH 直驱引擎 CLI 做只读 status 核查(break-glass,白名单 mcp-unreachable-fallback; STORY-186 收缩后触发条件=门面不可达; STORY-183 宕机演练)";

export const DRILL_LOG_SCHEMA = "aos.facade-downtime-drill.v1";
export const DRILL_SCOPE = "STORY-183 facade downtime drill replay";

/** The allowlisted break-glass read command for a partition, exactly as the allowlist matches it. */
export function buildBreakglassStatusCommand(partition) {
  const workspace = aosPartition(partition).workspace;
  const remote = `node ${VM_ENGINE}/scripts/tcrn-workflow.mjs status --workspace ${workspace}`;
  return `ssh ${VM_HOST} "${remote}"`;
}

function readAllowlist() {
  const path = join(HERE, "..", "aos-local-client", "ssh-breakglass-allowlist.json");
  return JSON.parse(readFileSync(path, "utf8")).entries ?? [];
}

/** Persist one break-glass usage with its reason, so the outage is auditable. */
export function recordBreakglassUsage({ command, reason, allowlisted, at, partition, chainVersion, outputPath }) {
  const record = {
    schemaVersion: DRILL_LOG_SCHEMA,
    phase: "breakglass-read",
    partition,
    reason,
    command,
    allowlisted,
    at,
    chainVersion: chainVersion ?? null
  };
  mkdirSync(join(outputPath, "drill-logs"), { recursive: true });
  const file = join(outputPath, "drill-logs", `breakglass-${at.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return { record, file };
}

/** Buffer one governed action into a scratch shadow queue, mirroring fallback-cli.appendQueue. */
export function queueGovernedAction(queueFile, { args, actor }) {
  assertQueueEntry({ verb: args[0], args, actor }, `drill queue for ${queueFile}`);
  const release = acquireQueueLock(queueFile);
  try {
    const queue = readQueueFile(queueFile);
    queue.push({ verb: args[0], args, actor, queuedAt: new Date().toISOString() });
    writeQueueAtomic(queueFile, queue);
    return queue.length;
  } finally {
    release();
  }
}

/**
 * The replay payload for the drill: each queued argv becomes a ceremony step via the
 * host engine's own catalogue parse, and the read-back anchors on the drill's own
 * record (the scratch work the write targets) — the same shape buildReplayPayload
 * produces for real partitions, here without the partition-anchor requirement.
 */
export function buildDrillReplayPayload({ queue, catalogue, anchor, actor }) {
  const steps = queue.map((queued, index) => {
    const where = `drill shadow queue entry [${index}]`;
    assertQueueEntry(queued, where);
    const verb = queued.args[0];
    const command = catalogue.get(verb);
    if (!command) throw new Error(`${where}: the host engine's catalogue declares no verb ${verb}`);
    const flags = flagsFromQueuedArgv(queued.args, command, where);
    if (command.flags.has("actor")) flags.actor = queued.actor;
    for (const [name, value] of Object.entries(flags)) {
      if (typeof value !== "string") throw new Error(`${where}: --${name} did not parse to a string`);
    }
    return { verb, flags };
  });
  return {
    schemaVersion: "aos.local-client-ceremony.v1",
    story: "TCRN-CROSS-STORY-183",
    intent: "shadow replay through the facade after AOS recovery (drill)",
    actor,
    steps,
    readback: [{
      verb: "work-show",
      flags: { id: anchor.workId },
      recordFields: ["externalKey", "scope"],
      expect: { externalKey: anchor.externalKey },
      expectSameAs: [{ field: "scope", step: 0, flag: "scope" }]
    }]
  };
}

async function probeHealth(facade) {
  try {
    const response = await fetch(`${facade.url}/api/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Run the whole downtime drill. Every injectable keeps the cycle deterministic and
 * local: the facade factory starts a write service on a scratch workspace, the
 * break-glass executor is the operator's real SSH read (or a recorded stub in test).
 *
 * Two partitions, deliberately: the break-glass READ targets a real AOS partition's
 * chain (that is the point of the read), while the facade REPLAY serves a local
 * scratch chain (the replay half must never touch a real governed chain in a drill).
 *
 * @param {object} opts
 * @param {string} opts.readPartition A real AOS partition whose chain the break-glass read inspects.
 * @param {string} opts.writePartition Facade partition id served by the factory (the replay target).
 * @param {() => Promise<{url, close}>} opts.facadeFactory
 * @param {string} opts.queueFile Scratch shadow-queue file.
 * @param {{workId: string, externalKey: string}} opts.anchor The record the queued write targets.
 * @param {Map} opts.catalogue hostCatalogue's catalogueIndex.
 * @param {(command: string) => Promise<{ok: boolean, version: number, workspaceId: string}>} opts.breakglassExec
 * @param {string} opts.writeRoot Where the drill log lands.
 * @param {string} opts.actor Attributed actor for the queued write.
 * @param {string} [opts.scope] The scope the queued annotate writes.
 */
export async function runDowntimeDrill({
  readPartition, writePartition, facadeFactory, queueFile, anchor, catalogue, breakglassExec, writeRoot, actor,
  scope = DRILL_SCOPE
}) {
  const report = { phases: {} };

  // 1. UP.
  const up = await facadeFactory();
  report.phases.up = { health: await probeHealth(up), at: new Date().toISOString() };
  if (!report.phases.up.health) throw new Error("drill: the facade did not come up; the UP phase is the baseline");
  await up.close();

  // 2. DOWN — the outage.
  report.phases.down = { health: await probeHealth(up), at: new Date().toISOString() };

  // 3. READ — break-glass read-only, used AND recorded with its reason.
  const command = buildBreakglassStatusCommand(readPartition);
  const allowlist = readAllowlist();
  const allowlisted = sshCommandAllowlisted(command, allowlist);
  const at = new Date().toISOString();
  const read = await breakglassExec(command);
  report.breakglass = recordBreakglassUsage({
    command, reason: BREAKGLASS_REASON, allowlisted, at, partition: readPartition,
    chainVersion: read.ok ? read.version : null, outputPath: writeRoot
  }).record;
  if (!allowlisted) throw new Error(`drill: the break-glass command is not allowlisted: ${command}`);

  // 4. QUEUE — a governed write offered while the face is down is buffered, not dropped.
  const depth = queueGovernedAction(queueFile, {
    args: ["work-annotate", "--id", anchor.workId, "--scope", scope],
    actor
  });
  report.queue = { route: "queued", backlog: depth, at: new Date().toISOString() };

  // 5. RECOVER.
  const recovered = await facadeFactory();
  report.phases.recovered = { health: await probeHealth(recovered), at: new Date().toISOString() };
  if (!report.phases.recovered.health) throw new Error("drill: the facade did not come back up");

  // 6. REPLAY — the backlog goes through the facade's ONE ceremony endpoint, read back.
  const release = acquireQueueLock(queueFile);
  try {
    const queue = readQueueFile(queueFile);
    const payload = buildDrillReplayPayload({ queue, catalogue, anchor, actor });
    const response = await fetch(`${recovered.url}/api/ceremony`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ partition: writePartition, payload })
    });
    const json = await response.json();
    if (json.ok !== true || json.reasonCode !== "CEREMONY_COMPLETED_AND_READ_BACK") {
      throw new Error(`drill: replay through the facade failed: ${json.reasonCode} ${json.receipt?.error ?? ""}`);
    }
    const landed = recordScope(anchor.workspace, anchor.workId);
    if (landed !== scope) {
      throw new Error(`drill: the replayed write did not land on the chain (scope=${JSON.stringify(landed)})`);
    }
    // Trim exactly the entries replayed — never a blind [].
    const remaining = readQueueFile(queueFile).slice(queue.length);
    writeQueueAtomic(queueFile, remaining);
    report.replay = {
      route: "facade", replayed: queue.length, remaining: remaining.length,
      reasonCode: json.reasonCode, scopeLanded: landed
    };
  } finally {
    release();
    await recovered.close();
  }

  report.phase = "complete";
  return report;
}

/** The operator-facing entry: real facade, real break-glass SSH read against the AOS host. */
async function main() {
  const readPartition = "cross-project";
  const writePartition = "cross-project";
  const fixture = makeScratchFixture();
  const queueFile = join(fixture.base, "shadow-queue.json");
  const writeRoot = join(fixture.base, "drill-output");
  const catalogue = await liveCatalogueIndex();
  const actor = "agent:fable";
  const anchor = { workspace: fixture.workspace, workId: fixture.workId, externalKey: "FACADE-183-INIT" };

  const facadeFactory = async () => {
    const { startFacadeWriteService } = await import("./facade-write-service.mjs");
    const { LOCAL_ENGINE } = await import("../switch-rehearsal/rehearsal-lib.mjs");
    return startFacadeWriteService({
      engineRoot: LOCAL_ENGINE,
      workspaces: { [writePartition]: fixture.workspace },
      attestDirs: { [writePartition]: join(fixture.base, "attest") },
      host: "127.0.0.1",
      port: 0,
      allowedHosts: ["127.0.0.1", "localhost"],
      catalogTtlMs: 5 * 60_000,
      writeRoot,
      actor
    });
  };

  // The break-glass read, performed as the allowlisted command string IS (no flags
  // inserted between ssh and the host, so the executed command matches the allowlist).
  const breakglassExec = async (command) => {
    try {
      const stdout = execFileSync("sh", ["-c", command], { encoding: "utf8" });
      const json = JSON.parse(stdout);
      return {
        ok: json.reasonCode === "WORKSPACE_COMMAND_COMPLETED",
        version: json.version ?? null,
        workspaceId: json.workspaceId ?? null
      };
    } catch {
      return { ok: false, version: null, workspaceId: null };
    }
  };

  try {
    const report = await runDowntimeDrill({
      readPartition, writePartition, facadeFactory, queueFile, anchor, catalogue,
      breakglassExec, writeRoot, actor
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    const { rmSync } = await import("node:fs");
    rmSync(fixture.base, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`drill failed: ${error.message}`);
    process.exit(1);
  });
}
