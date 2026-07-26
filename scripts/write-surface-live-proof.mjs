#!/usr/bin/env node
// Live proof for the safe write surface (TCRN-AOS-STORY-010).
//
// Exercises the surface against the AOS chain itself — dogfood rather than a
// scratch workspace, because the thing being proven is that ceremony supplied by
// the cockpit is accepted by the real engine on a real governed chain.
//
// It writes. That is the point, and it is why the records it creates are
// deliberate: one Subtask under a story of this very Initiative, moved through
// its states, annotated, and left in a terminal state with its scope explaining
// that it exists as evidence. Nothing is deleted afterwards, because the chain
// is append-only and pretending otherwise would be theatre.

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const engine = resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
const serverPath = resolve(engine, "scripts/tcrn-workflow-mcp.mjs");
const platform = resolve(process.cwd(), "..");
const workspacePath = resolve(platform, ".tcrn-workspace/TCRN-AOS/workspace");
const attestDir = resolve(platform, ".tcrn-workspace/TCRN-AOS/attestations");
const outPath = resolve(process.cwd(), "evidence/aos-write-surface-live-proof.json");

const { ChainClient, SafeWriteSurface, WriteRefused } =
  await import("../dist/packages/projection/src/index.js");

// Writes need pinned operator authority — reads do not. That asymmetry is the
// point of the supply mechanism, so the proof exercises it rather than routing
// around it: without these pins the very first create is refused with
// OPERATOR_AUTHORITY_REQUIRED, which is the system working.
const authorityPins = resolve(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/operator-authority-pins.json");
const authorityPinsDigest = process.env.TCRN_AUTHORITY_PINS_DIGEST
  ?? "d25ebfc1cb47310d27bdeba4749fe5728b089188a7338d6a89cfe86f1c5d5ce9";
const client = new ChainClient({ serverPath, authorityPins, authorityPinsDigest });
const receipt = {
  schemaVersion: "aos.write-surface-live-proof.v1",
  ok: false,
  chain: "TCRN-AOS",
  authoritySupplied: true,
  steps: [],
  notClaimed: [
    "the actor field is an attribution claim the engine records, not proof of identity",
    "ceremonial writes (conference, gate, attestation, delete) are not exercised and remain explicit",
    "records created here are permanent; the chain is append-only"
  ]
};

const step = (name, detail) => {
  receipt.steps.push({ name, ...detail });
  process.stderr.write(`  ${name}: ${JSON.stringify(detail).slice(0, 120)}\n`);
};

try {
  await client.start();
  const surface = new SafeWriteSurface(client, {
    workspacePath,
    actor: "agent:fable",
    attestDir
  });

  // Find a parent Story on this Initiative's tree. A Subtask needs one, and
  // reading it rather than hard-coding an id keeps the proof valid as the tree grows.
  const listed = await client.callTool("tcrn_workflow_work_list", {
    workspace: workspacePath, kind: "Story", limit: 200
  });
  const parent = (listed.records ?? []).find((row) => row.status === "done");
  if (!parent) throw new Error("no completed Story available to parent the proof subtask");

  const stamp = new Date().toISOString().replace(/[^0-9]/gu, "").slice(0, 14);
  const externalKey = `TCRN-AOS-SUBTASK-${stamp.slice(-3)}`;

  const created = await surface.createWork({
    projectId: parent.projectId,
    externalKey,
    kind: "Subtask",
    parentId: parent.id,
    title: `写面实证:本记录由 AOS 安全写面创建,CAS、时间戳与 actor 由客户端自动补齐(${stamp})`
  });
  step("create", { externalKey, id: created.id, parentId: parent.id });

  await surface.transition({ id: created.id, status: "ready" });
  step("transition", { to: "ready" });
  await surface.transition({ id: created.id, status: "active" });
  step("transition", { to: "active" });

  await surface.annotate({
    id: created.id,
    scope: `写面实证:创建、流转、注解三类安全写面均经受治 MCP 成功;时间戳与 actor 自动补齐;仪式类写面未行使(${stamp})`
  });
  step("annotate", { ok: true });

  // The engine must refuse an illegal move. A write surface that has never been
  // refused has never been shown to be governed by anything.
  let refusal = null;
  try {
    await surface.transition({ id: created.id, status: "planned" });
  } catch (error) {
    if (error instanceof WriteRefused) refusal = error.reasonCode;
    else throw error;
  }
  if (refusal !== "INVALID_TRANSITION") {
    throw new Error(`expected INVALID_TRANSITION on active→planned, got ${String(refusal)}`);
  }
  step("refusal", { attempted: "active->planned", reasonCode: refusal });

  await surface.transition({ id: created.id, status: "done" });
  step("transition", { to: "done" });

  const shown = await client.callTool("tcrn_workflow_work_show", {
    workspace: workspacePath, id: created.id
  });
  if (shown.record?.status !== "done") {
    throw new Error(`readback says ${String(shown.record?.status)}, expected done`);
  }
  step("readback", { status: shown.record.status, scopeRecorded: Boolean(shown.advisory?.scope) });

  receipt.ok = true;
  receipt.externalKey = externalKey;
  console.log(JSON.stringify({ ok: true, externalKey, steps: receipt.steps.length, refusal }));
} catch (error) {
  receipt.error = String(error?.message ?? error);
  console.error(JSON.stringify({ ok: false, error: receipt.error }));
  process.exitCode = 1;
} finally {
  await client.stop();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
}
