#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-075 — single-truth tip gate. The machine form of the
// S190 tip-remeasure protocol: every registered pathway that serves a partition
// must answer the SAME chain head (version + headEventHash, full 64-hex), or the
// gate reds naming each pathway's reading.
//
// WHY IT EXISTS. During the INIT-020 window the cross chain forked for 15 versions
// with no machine noticing: the ceremony write path (engine CLI via SSH, no PG env)
// answered the file track while the facade answered Postgres, and nothing compared
// the two. "Verify something reached elsewhere by asking that elsewhere itself"
// had no standing instrument.
//
// PATHWAYS. For each partition:
//   A. the authoritative PG head, served by the facade read service (127.0.0.1:4320
//      through an SSH tunnel) — the same bytes the read MCP face answers;
//   B. the ceremony head-read pathway, now routed through that same facade read
//      service — a second client call, not a second backend;
//   C. the retained file tree, which is compared only while it is unsealed. Once
//      INC-074 seals it, its old head is an archive witness and must not compete
//      with the PG authority.
//
// RED LEG (the acceptance): fixture mode (`--fixture <file>`) injects a fabricated
// divergence and expects red. The live gate becomes green only after all five file
// tracks are sealed or provably equal to the PG head; a stale unsealed track still
// names the fork instead of being silently treated as an archive.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect as netConnect } from "node:net";
import { resolve } from "node:path";

import { FACADE_PORT } from "../aos-resident-cockpit/facade-read-manifest.mjs";
import { shellQuote, ssh } from "../aos-resident-cockpit/resident-lib.mjs";
import { VM_ENGINE_CLI, VM_HOST, VM_WORKSPACE } from "./topology.mjs";
import { aosPartition } from "./aos-partitions.mjs";
import { readChainHead } from "./ceremony.mjs";

const PARTITIONS = ["TCRN-AOS", "cross-project", "TCRN-Design-System", "TCRN-TMS", "Joi-Button"];

/**
 * The file-track head (engine CLI status via SSH, file backend) plus whether the
 * tree carries the INC-074 storage-home sentinel. A sealed tree's stale head is
 * EXPECTED — the sentinel declares the tree is no longer the home, so its head
 * is not compared. An UNSEALED tree whose head disagrees with the authority is
 * the fork this gate exists to catch.
 */
async function readFileTrackHead(workspace) {
  const sentinelProbe = await ssh(
    [`test -f ${shellQuote(`${workspace}/.tcrn-workflow/storage-home.json`)} && echo SENTINEL_PRESENT || echo SENTINEL_ABSENT`],
    { allowFailure: true },
  );
  const sentinelText = sentinelProbe.stdout ?? "";
  const sealed = sentinelProbe.code === 0 && sentinelText.includes("SENTINEL_PRESENT")
    ? true
    : sentinelProbe.code === 0 && sentinelText.includes("SENTINEL_ABSENT")
      ? false
      : null;
  const remote = ["node", VM_ENGINE_CLI, "status", "--workspace", workspace].map(shellQuote).join(" ");
  const result = await ssh([remote], { allowFailure: true });
  let json = null;
  try { json = JSON.parse(result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim())); } catch { json = null; }
  return {
    sealed,
    head: json?.version !== undefined ? { version: json.version, headEventHash: json.headEventHash, workspaceId: json.workspaceId } : null,
    error: sealed === null
      ? (sentinelProbe.stderr?.trim() || sentinelText.trim() || `sentinel probe exit ${sentinelProbe.code}`).slice(0, 200)
      : json === null ? (result.stderr?.trim() || result.stdout?.trim() || `exit ${result.code}`).slice(0, 200) : null,
 };
}

async function curlJson(url, body) {
  const { execFileSync } = await import("node:child_process");
  const stdout = execFileSync("curl", [
    "-s", "-m", "60", "-X", "POST", "-H", "content-type: application/json",
    "-d", JSON.stringify(body), url,
  ], { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  return JSON.parse(stdout);
}

async function establishReadTunnel() {
  const child = spawn("ssh", ["-N", "-L", `${FACADE_PORT}:127.0.0.1:${FACADE_PORT}`, VM_HOST],
    { stdio: "ignore", detached: true });
  child.unref();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((done) => setTimeout(done, 250));
    try {
      const ok = await new Promise((resolved) => {
        const socket = netConnect(FACADE_PORT, "127.0.0.1", () => { socket.destroy(); resolved(true); });
        socket.on("error", () => resolved(false));
      });
      if (ok) return { port: FACADE_PORT, pid: child.pid };
    } catch { /* retry */ }
  }
  child.kill("SIGTERM");
  throw new Error("facade read tunnel did not come up");
}

async function reclaimTunnel(tunnel) {
  if (tunnel === null) return;
  try { process.kill(-tunnel.pid, "SIGTERM"); } catch { /* gone */ }
  try { process.kill(tunnel.pid, "SIGTERM"); } catch { /* gone */ }
}

function headReading(label, head) {
  return { pathway: label, version: head?.version ?? null, headEventHash: head?.headEventHash ?? null };
}

export async function judgeTip({ fixturePath = null, tunnelPort = null, live = true } = {}) {
  let fixture = null;
  if (fixturePath !== null) {
    fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    // Fixture mode is hermetic: both pathways come from the fixture, so the red
    // leg is constructible without the VM (parity-proof's red-harness pattern —
    // fixture mode never emits a live claim). `live` is forced off.
    live = false;
  }
  const tunnel = live ? (tunnelPort === null ? await establishReadTunnel() : { port: tunnelPort, pid: null }) : null;
  const rows = [];
  const divergent = [];
  try {
    for (const partition of PARTITIONS) {
      const workspace = partition === "TCRN-AOS" ? VM_WORKSPACE : aosPartition(partition).workspace;
      // Pathway A: the authoritative PG head via the facade read service.
      let facadeHead = null;
      let facadeError = null;
      if (live) {
        try {
          const response = await curlJson(`http://127.0.0.1:${tunnel.port}/api/engine/status`, { partition, arguments: {} });
          const inner = response?.result ?? response;
          facadeHead = { version: inner?.version, headEventHash: inner?.headEventHash, workspaceId: inner?.workspaceId };
        } catch (error) {
          facadeError = String(error?.message ?? error).slice(0, 200);
        }
      }
      if (fixture !== null && fixture[partition]?.version !== undefined) {
        facadeHead = { version: fixture[partition].version, headEventHash: fixture[partition].headEventHash, workspaceId: "fixture" };
      }
      // Pathway B: the ceremony head-read pathway (now the facade read, PG).
      let ceremonyHead = null;
      let ceremonyError = null;
      if (live) {
        try {
          ceremonyHead = await readChainHead(workspace ?? undefined);
        } catch (error) {
          ceremonyError = String(error?.message ?? error).slice(0, 200);
        }
      }
      if (fixture !== null && fixture[partition]?.ceremonyVersion !== undefined) {
        ceremonyHead = { version: fixture[partition].ceremonyVersion, headEventHash: fixture[partition].ceremonyHeadEventHash, workspaceId: "fixture-b" };
      }
      // Pathway C: the file-track head (SSH, file backend) + sentinel state. A
      // SEALED tree's stale head is expected and not compared; an UNSEALED tree
      // whose head disagrees is the fork (the INIT-020 cross defect).
      let fileTrack = null;
      let fileTrackError = null;
      if (live) {
        try {
          fileTrack = await readFileTrackHead(workspace);
        } catch (error) {
          fileTrackError = String(error?.message ?? error).slice(0, 200);
        }
      } else if (fixture !== null && fixture[partition]?.fileVersion !== undefined) {
        fileTrack = {
          sealed: fixture[partition].fileSealed ?? false,
          head: { version: fixture[partition].fileVersion, headEventHash: fixture[partition].fileHeadEventHash, workspaceId: "fixture-c" },
          error: null,
        };
      }
      const readingA = facadeHead === null
        ? { pathway: "facade-read(pg)", error: facadeError ?? "no answer" }
        : headReading("facade-read(pg)", facadeHead);
      const readingB = ceremonyHead === null
        ? { pathway: "ceremony-read(pg)", error: ceremonyError ?? "no answer" }
        : headReading("ceremony-read(pg)", ceremonyHead);
      const readingC = fileTrack?.head === null || fileTrack?.head === undefined
        ? { pathway: "file-track(ssh)", error: fileTrack?.error ?? fileTrackError ?? "no answer" }
        : headReading(`file-track(ssh)${fileTrack?.sealed ? ",sealed" : ",unsealed"}`, fileTrack.head);
      rows.push({ partition, facade: readingA, ceremony: readingB, fileTrack: readingC });
      const aVersion = facadeHead?.version;
      const bVersion = ceremonyHead?.version;
      const agreeLive = facadeHead !== null && ceremonyHead !== null
        && aVersion === bVersion
        && facadeHead.headEventHash === ceremonyHead.headEventHash;
      // The file track participates ONLY when it is unsealed — a sealed archive's
      // stale head is expected, not a divergence.
      const agreeFile = !agreeLive
        ? false
        : fileTrack?.sealed === true
          ? true
          : fileTrack?.sealed === false && fileTrack.head !== null && facadeHead !== null
            && fileTrack.head.version === facadeHead.version
            && fileTrack.head.headEventHash === facadeHead.headEventHash;
      if (!agreeFile || !agreeLive) {
        divergent.push({ partition, readingA, readingB, readingC, sealed: fileTrack?.sealed ?? false });
      }
    }
  } finally {
    if (tunnel !== null && tunnelPort === null) await reclaimTunnel(tunnel);
  }
  return {
    ok: divergent.length === 0,
    reasonCode: divergent.length === 0 ? "TIP_SINGLE_TRUTH_VERIFIED" : "TIP_TRUTH_DIVERGED",
    partitions: PARTITIONS.length,
    rows,
    divergent,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("tip-gate.mjs")) {
  const fixturePath = process.argv.includes("--fixture")
    ? resolve(process.argv[process.argv.indexOf("--fixture") + 1])
    : null;
  const result = await judgeTip({ fixturePath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const entry of result.divergent ?? []) {
    process.stderr.write(`  DIVERGED ${entry.partition}: A=${JSON.stringify(entry.readingA)} B=${JSON.stringify(entry.readingB)}\n`);
  }
  if (!result.ok) process.exitCode = 1;
}
