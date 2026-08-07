#!/usr/bin/env node
// The local-side remote governance ceremony, as a recipe (TCRN-AOS-STORY-133).
//
//   node deploy/aos-local-client/ceremony.mjs --payload <file.json> [--receipt <file.json>] [--dry-run]
//
// WHY THIS EXISTS. The AOS chain's truth is on tcrn-platform-dev. A governance write
// from this laptop is therefore five values (host, engine CLI, workspace root,
// attest-dir, actor), a head sentinel read moments before, an RFC3339 instant, and a
// remote shell that re-parses every argument. The first such write was performed by
// hand-assembling that ssh command line. It worked; it is also the shape where an
// operator attests into the wrong sidecar, drives the wrong chain, or sends a flag the
// verb does not define — and STORY-131 did send three such flags and had to re-run.
//
// So the write is now a RECIPE with a FILE PAYLOAD (CONF-007 ruling ①: 文件载荷批驱动
// 仪式). The operator writes what they want recorded; this reads where and how from
// one place (topology.mjs) and refuses anything the host engine's own catalogue does
// not define.
//
// WHAT IT WILL NOT DO, and both refusals are derived rather than remembered:
//   - it will not drive a verb that requires a per-invocation authority file. Those are
//     the relocation and gate-identity families; the test is the catalogue's own shape,
//     the same derivation ADR 0003 uses for the MCP facade;
//   - it will not accept a payload that names --workspace, --attest-dir or
//     --expected-version. The first two belong to the topology and the third must come
//     from a live read or it enforces nothing.
//
// The remote quoting is not this file's invention either: `shellQuote` comes from the
// switch rehearsal's library, where it was written because ssh re-joins the remote argv
// with spaces and hands the result to a login shell, so a `--scope` carrying
// parentheses became a remote syntax error. Imported, not copied.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { connect as netConnect } from "node:net";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { shellQuote, ssh } from "../aos-resident-cockpit/resident-lib.mjs";
import { FACADE_PORT } from "../aos-resident-cockpit/facade-read-manifest.mjs";
import { FACADE_WRITE_PORT } from "../aos-resident-cockpit/facade-write-manifest.mjs";
import { VM_ENGINE_CLI, VM_HOST, VM_WORKSPACE } from "./topology.mjs";
import { aosPartition } from "./aos-partitions.mjs";
import {
  assertPayload
} from "./ceremony-plan.mjs";
import { scrubHostPathsInText } from "../../scripts/lib/evidence-hygiene.mjs";
import { emitCeremonySpan } from "./ceremony-spans.mjs";

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");

// ── INC-082 write-path unification ──────────────────────────────────────────
// STORY-185 moved the write MCP face onto the facade write service, but the
// ceremony CLI recipe still drove the engine over SSH with no TCRN_PG_* env — so
// its writes landed in the file track while the facade answered Postgres. That is
// the direct mechanism of the INIT-020 cross fork. These transports route the
// ceremony's reads and writes through the facades (PG). A facade outage is a named
// stop; the governed ceremony never falls back to an SSH/file-track write.
let readTunnel = null;
let writeTunnel = null;

async function establishTunnel(port) {
  const child = spawn("ssh", ["-N", "-L", `${port}:127.0.0.1:${port}`, VM_HOST],
    { stdio: "ignore", detached: true });
  child.unref();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((done) => setTimeout(done, 250));
    try {
      const ok = await new Promise((resolved) => {
        const socket = netConnect(port, "127.0.0.1", () => { socket.destroy(); resolved(true); });
        socket.on("error", () => resolved(false));
      });
      if (ok) return { port, pid: child.pid };
    } catch { /* retry */ }
  }
  child.kill("SIGTERM");
  throw new Error(`facade tunnel to :${port} did not come up`);
}

async function readTunnelFor() {
  if (readTunnel === null) readTunnel = await establishTunnel(FACADE_PORT);
  return readTunnel;
}

async function writeTunnelFor() {
  if (writeTunnel === null) writeTunnel = await establishTunnel(FACADE_WRITE_PORT);
  return writeTunnel;
}

export async function reclaimFacadeTunnels() {
  for (const tunnel of [readTunnel, writeTunnel]) {
    if (tunnel === null) continue;
    try { process.kill(-tunnel.pid, "SIGTERM"); } catch { /* gone */ }
    try { process.kill(tunnel.pid, "SIGTERM"); } catch { /* gone */ }
  }
  readTunnel = null;
  writeTunnel = null;
}

/** POST a verb to the facade read service (PG-backed) and parse the engine answer. */
export async function facadeReadEngine(verb, partition, arguments_) {
  const tunnel = await readTunnelFor();
  const { execFileSync } = await import("node:child_process");
  const stdout = execFileSync("curl", [
    "-s", "-m", "60", "-X", "POST", "-H", "content-type: application/json",
    "-d", JSON.stringify({ partition, arguments: arguments_ }),
    `http://127.0.0.1:${tunnel.port}/api/engine/${verb}`,
  ], { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  const json = JSON.parse(stdout);
  const inner = json?.result ?? json;
  return {
    accepted: json?.ok === true,
    exitCode: json?.ok === true ? 0 : 1,
    reasonCode: inner?.reasonCode ?? json?.reasonCode ?? "FACADE_READ_REFUSED",
    json: inner,
    raw: undefined,
  };
}

/**
 * One engine verb on the host that owns the chain. A refusal is data, not a throw.
 *
 * This is an explicit break-glass read primitive for the fallback queue and
 * projection proofs. The governed ceremony path below never calls it: after
 * STORY-192, a facade outage is a named stop, never an implicit file-track write.
 */
export async function remoteEngine(argv) {
  const remote = ["node", VM_ENGINE_CLI, ...argv].map(shellQuote).join(" ");
  const result = await ssh([remote], { allowFailure: true });
  const emitted = result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim());
  let json = null;
  try { json = JSON.parse(emitted); } catch { json = null; }
  return {
    accepted: result.code === 0 && json !== null,
    exitCode: result.code,
    reasonCode: json?.reasonCode ?? json?.error ?? (json === null ? "NON_JSON_OUTPUT" : null),
    json,
    raw: json === null ? emitted.slice(0, 400) : undefined
  };
}

/** The live head, read immediately before each mutating step. */
export async function readChainHead(workspace = VM_WORKSPACE) {
  // INC-082: the authoritative head is Postgres via the facade read service.
  // Reading it through the facade makes the ceremony's chainBefore equal the MCP
  // read face's status — the single-truth tip gate (INC-075) checks exactly this.
  const partition = partitionForWorkspace(workspace);
  try {
    const status = await facadeReadEngine("status", partition, {});
    if (!status.accepted) {
      const error = new Error(`the facade refused to report status for ${partition}: ${status.reasonCode ?? status.exitCode}`);
      error.reasonCode = status.reasonCode ?? "FACADE_READ_REFUSED";
      throw error;
    }
    return {
      workspaceId: status.json.workspaceId,
      version: status.json.version,
      headEventHash: status.json.headEventHash,
      work: status.json.work
    };
  } catch (error) {
    if (typeof error?.reasonCode === "string") throw error;
    const refused = new Error(`the facade read service was unavailable for ${partition}: ${String(error?.message ?? error)}`);
    refused.reasonCode = "FACADE_READ_UNREACHABLE";
    throw refused;
  }
}

function partitionForWorkspace(workspace) {
  if (workspace === VM_WORKSPACE) return "TCRN-AOS";
  for (const id of ["TCRN-AOS", "cross-project", "TCRN-Design-System", "TCRN-TMS", "Joi-Button"]) {
    try {
      if (aosPartition(id).workspace === workspace) return id;
    } catch { /* not a known partition */ }
  }
  throw new Error(`workspace is not registered to a governed partition: ${workspace}`);
}

/**
 * The knowledge-store marker is intentionally not read by this local client. After
 * the PG switch it is an authority-owned value and the facade write service is the
 * only authenticated read seam for it.
 */
export async function readKnowledgeMarker(workspace = VM_WORKSPACE) {
  // INC-082: the marker is PG data after the switch window. This legacy helper
  // has no authenticated PG read seam, so refusing is safer than reading the
  // sealed file archive and supplying a stale CAS value to a write.
  const error = new Error(`knowledge marker for ${workspace} must be read through the PG facade`);
  error.reasonCode = "FACADE_KNOWLEDGE_MARKER_UNAVAILABLE";
  throw error;
}

/** POST the whole ceremony to the facade write service (PG-backed), the same
 * recipe the write MCP face uses. The facade performs the batch, read-backs, CAS
 * and receipt; the ceremony client adapts the facade receipt to its own shape. */
async function facadeCeremony({ payload, dryRun, partition }) {
  const tunnel = await writeTunnelFor();
  const { execFileSync } = await import("node:child_process");
  const request = { partition, dryRun, payload };
  if (!dryRun) request.idempotencyKey = sha256Text(JSON.stringify({ partition, payload }));
  const stdout = execFileSync("curl", [
    "-s", "-m", "120", "-X", "POST", "-H", "content-type: application/json",
    "-d", JSON.stringify(request),
    `http://127.0.0.1:${tunnel.port}/api/ceremony`,
  ], { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  const response = JSON.parse(stdout);
  const receipt = response?.receipt ?? response;
  return {
    schemaVersion: "aos.local-client-ceremony-receipt.v1",
    ok: response?.ok === true,
    reasonCode: receipt?.reasonCode ?? (response?.ok === true ? "CEREMONY_COMPLETED_AND_READ_BACK" : "CEREMONY_REFUSED"),
    dryRun,
    host: VM_HOST,
    partition,
    facade: true,
    chainBefore: receipt?.chainBefore ?? null,
    chainAfter: receipt?.chainAfter ?? null,
    steps: receipt?.steps ?? [],
    readback: receipt?.readback ?? [],
    eventsAppended: receipt?.chainAfter?.version != null && receipt?.chainBefore?.version != null
      ? receipt.chainAfter.version - receipt.chainBefore.version
      : null,
    finishedAt: instant(),
  };
}

async function runCeremonyOnce({ payloadPath, dryRun = false, partition = "TCRN-AOS" }) {
  const payloadText = readFileSync(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);
  emitCeremonySpan({ span: "ceremony.start", partition, outcome: "started" });
  const admission = assertPayload(payload);
  if (!admission.ok) {
    emitCeremonySpan({ span: "ceremony.refused", partition, outcome: "refused", reasonCode: admission.reasonCode });
    return { ok: false, reasonCode: admission.reasonCode, problems: admission.problems };
  }

  // INC-082: facade-only after the switch window. A facade outage is a named
  // stop; it must never fall through to a file-backend SSH write.
  try {
    const facadeResult = await facadeCeremony({ payload, dryRun, partition });
    emitCeremonySpan({ span: "ceremony.end", partition, outcome: facadeResult.ok ? "ok" : "refused", reasonCode: facadeResult.reasonCode });
    return facadeResult;
  } catch (error) {
    const refusal = {
      schemaVersion: "aos.local-client-ceremony-receipt.v1",
      story: payload.story,
      intent: payload.intent,
      startedAt: instant(),
      finishedAt: instant(),
      dryRun,
      host: VM_HOST,
      partition,
      facade: true,
      ok: false,
      reasonCode: "FACADE_WRITE_UNREACHABLE",
      error: scrubHostPathsInText(String(error?.message ?? error)).slice(0, 500),
      chainBefore: null,
      chainAfter: null,
      steps: [],
      readback: []
    };
    emitCeremonySpan({ span: "ceremony.refused", partition, outcome: "refused", reasonCode: refusal.reasonCode });
    return refusal;
  }
}


export async function runCeremony(args) {
  try {
    return await runCeremonyOnce(args);
  } finally {
    // A ceremony owns every tunnel it opens. Reclaim on validation failures,
    // facade refusals and transport errors as well as success.
    await reclaimFacadeTunnels();
  }
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const payloadPath = argument("payload");
  if (!payloadPath) {
    process.stderr.write("usage: ceremony.mjs --payload <file.json> [--receipt <file.json>] [--dry-run] [--partition <id>]\n");
    process.exit(2);
  }
  const receipt = await runCeremony({
    payloadPath: resolve(payloadPath),
    dryRun: process.argv.includes("--dry-run"),
    partition: argument("partition") ?? "TCRN-AOS"
  });
  const receiptPath = argument("receipt");
  if (receiptPath) {
    mkdirSync(dirname(resolve(receiptPath)), { recursive: true });
    writeFileSync(resolve(receiptPath), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.ok !== true) process.exitCode = 1;
}
