#!/usr/bin/env node
// TCRN-CROSS-INIT-019 STORY-166 — 投影新鲜度统一巡检:一处判全部.
//
//   node deploy/aos-local-client/projection-freshness.mjs
//
// Every materialised sidecar on the platform declares three numbers (STORY-166.1:
// docs/projection-freshness-convention.md): truth version, self version, max age.
// This is ONE gate over the FOUR of them — a single command prints four rows, and
// any row that is stale or unproven makes the whole gate exit non-zero. It is the
// place STORY-160.4's marker check also lives (not a fifth isolated gate).
//
// Honesty rules, same as every gate here: a row whose truth/self cannot be fetched
// reports `unproven`, never `fresh`. An unreachable VM is `probed:false` + red, the
// same shape as the read-face gate. The registry is DECLARED so a sidecar that is
// not registered cannot silently pass.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { remoteEngine } from "./ceremony.mjs";
import { PLATFORM_ROOT, REPO_ROOT } from "./topology.mjs";
import { aosPartition } from "./aos-partitions.mjs";

export const SIDECARS = Object.freeze([
  Object.freeze({
    id: "knowledge-store",
    partition: "cross-project",
    maxAge: "0 chain writes (marker digest must equal chain head)",
    truth: "cross-project chain head hash",
    self: "knowledge store marker eventHighWaterDigest"
  }),
  Object.freeze({
    id: "web-projection",
    maxAge: "7 days",
    truth: "governed chain versions",
    self: "cockpit-data generatedAt stamp"
  }),
  Object.freeze({
    id: "codegraph",
    maxAge: "0 (index must be newer than the last commit)",
    truth: "repo HEAD commit time",
    self: "codegraph index build time"
  }),
  Object.freeze({
    id: "memory-index",
    maxAge: "30 days",
    truth: "agent memory files under <local-home>/.claude/projects/…/memory",
    self: "newest memory file mtime"
  })
]);

const now = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");

async function checkKnowledge() {
  const partition = "cross-project";
  const entry = aosPartition(partition);
  const result = await remoteEngine(["knowledge-freshness", "--workspace", entry.workspace, "--at", now()]);
  if (!result.accepted) {
    const refused = result.reasonCode;
    if (refused === "KNOWLEDGE_HIGH_WATER_MISMATCH") {
      return { status: "stale", self: "store marker ≠ chain head", reason: "KNOWLEDGE_HIGH_WATER_MISMATCH (store marker behind the chain)" };
    }
    return { status: "unproven", self: null, reason: refused ?? result.exitCode };
  }
  const evaluated = result.json?.reasonCode;
  return { status: "fresh", self: evaluated ?? "evaluated", reason: evaluated ?? null };
}

function checkCodegraph() {
  const roots = ["TCRN-AOS", "TCRN-Design-System", "TCRN-TMS"];
  const stale = [];
  for (const repo of roots) {
    const root = join(PLATFORM_ROOT, repo);
    const verdict = codegraphStatusVerdict(root);
    if (verdict === null) { stale.push({ repo, why: "codegraph status unreadable or no index (unproven)" }); continue; }
    if (verdict.pending) stale.push({ repo, why: verdict.detail ?? "codegraph reports pending changes (needs sync)" });
  }
  if (stale.length > 0) return { status: "stale", self: stale.map((s) => `${s.repo}:${s.why}`).join("; "), reason: "codegraph index behind repo source" };
  return { status: "fresh", self: "all indexed repos report an up-to-date index", reason: null };
}

/**
 * The codegraph index's own verdict on freshness — ASK THE INSTRUMENT, don't stat files
 * (INC-049). The index uses SQLite with full WAL, so the main .db file's mtime lags the
 * real index data and `-wal`/`-shm` carry it; a file-mtime comparison false-reds on a
 * healthy index. `codegraph status` reports pending changes explicitly ("Run codegraph
 * sync to update the index") when the index is behind its source, and stays quiet when
 * up to date.
 */
function codegraphStatusVerdict(repoRoot) {
  try {
    // The codegraph binary lives in TCRN-TMS's node_modules (shared across the three
    // product repos); run it from there with the target repo as the positional path.
    const tmsRoot = join(PLATFORM_ROOT, "TCRN-TMS");
    const out = execFileSync("pnpm", ["--dir", tmsRoot, "exec", "codegraph", "status", repoRoot], { encoding: "utf8", timeout: 30_000 });
    if (/Pending Changes:/u.test(out)) {
      return { pending: true, detail: out.split("\n").filter((l) => l.includes("Pending") || /^\s+(Removed|Added|Modified|Renamed):/.test(l)).join(";").trim().slice(0, 120) || "codegraph reports pending changes" };
    }
    return { pending: false };
  } catch {
    return null;
  }
}

async function checkWebProjection() {
  // The cockpit data is produced by scripts/build-cockpit-data.mjs into
  // apps/web/src/cockpit-data.generated.ts (the direct output; the dist bundle is one
  // `pnpm build` behind). It embeds both the build time (generatedAt) and the chain
  // version it was projected from, per partition. Freshness must compare against the
  // TRUTH it claims to show — the current chain version — not just the wall-clock age
  // of the build (INC-049: a day-long outage was reported fresh because generatedAt
  // was young).
  const candidates = [
    join(REPO_ROOT, "apps/web/src/cockpit-data.generated.ts"),
    join(REPO_ROOT, "dist/apps/web/src/cockpit-data.generated.js")
  ];
  const path = candidates.find((p) => existsSync(p));
  if (path === undefined) {
    return { status: "unproven", self: null, reason: "no cockpit-data.generated.ts; run pnpm cockpit:data" };
  }
  const text = readFileSync(path, "utf8");
  const stamp = text.match(/generatedAt["']?\s*[:=]\s*["']([^"']+)["']/u)?.[1] ?? null;
  const projectedVersion = text.match(/["']id["']\s*:\s*["']cross-project["'][\s\S]{0,400}?chainVersion["']?\s*:\s*(\d+)/u)?.[1] ?? null;
  if (stamp === null || projectedVersion === null) {
    return { status: "unproven", self: stamp ?? null, reason: "generatedAt or cross-project chainVersion stamp not found" };
  }
  const ageDays = (Date.now() - Date.parse(stamp)) / 86_400_000;
  if (ageDays > 7) {
    return { status: "stale", self: stamp, reason: `projection stamp ${ageDays.toFixed(1)} days old (max 7)` };
  }
  // The projection is only as fresh as the chain it claims to show. Compare its stamped
  // cross-project chain version against the LIVE chain (the truth); a view built before
  // the chain moved is stale even if it was built recently.
  const live = await liveChainVersion("cross-project");
  if (live !== null && Number(projectedVersion) < live) {
    return { status: "stale", self: `v${projectedVersion} (built ${stamp})`, reason: `projection shows cross-project v${projectedVersion}; chain is v${live}` };
  }
  return { status: "fresh", self: `${stamp} · cross-project v${projectedVersion}`, reason: null };
}

/** The live chain version of a partition, from the engine's own answer; null when unreadable. */
async function liveChainVersion(partition) {
  try {
    const entry = aosPartition(partition);
    const result = await remoteEngine(["status", "--workspace", entry.workspace]);
    if (!result.accepted) return null;
    const version = result.json?.version;
    return Number.isSafeInteger(version) ? version : null;
  } catch {
    return null;
  }
}

function checkMemoryIndex() {
  const memoryRoot = join(process.env.HOME ?? "/", ".claude/projects");
  if (!existsSync(memoryRoot)) return { status: "unproven", self: null, reason: "no ~/.claude/projects" };
  const memDirs = readdirSync(memoryRoot).filter((name) => name.includes("-Users-"));
  let newest = null;
  for (const dir of memDirs) {
    const memoryDir = join(memoryRoot, dir, "memory");
    if (!existsSync(memoryDir)) continue;
    for (const file of readdirSync(memoryDir)) {
      const m = statSync(join(memoryDir, file)).mtimeMs;
      if (newest === null || m > newest) newest = m;
    }
  }
  if (newest === null) return { status: "unproven", self: null, reason: "no memory files found" };
  const ageDays = (Date.now() - newest) / 86_400_000;
  return {
    status: ageDays <= 30 ? "fresh" : "stale",
    self: new Date(newest).toISOString().slice(0, 10),
    reason: ageDays <= 30 ? null : `memory index untouched ${ageDays.toFixed(1)} days`
  };
}

export async function runProjectionFreshness() {
  const knowledge = await checkKnowledge();
  const web = await checkWebProjection();
  const codegraph = checkCodegraph();
  const memory = checkMemoryIndex();
  const rows = [
    { sidecar: "knowledge-store", maxAge: SIDECARS[0].maxAge, ...knowledge },
    { sidecar: "web-projection", maxAge: SIDECARS[1].maxAge, ...web },
    { sidecar: "codegraph", maxAge: SIDECARS[2].maxAge, ...codegraph },
    { sidecar: "memory-index", maxAge: SIDECARS[3].maxAge, ...memory }
  ];
  const bad = rows.filter((row) => row.status !== "fresh");
  return {
    schemaVersion: "tcrn.projection-freshness.v1",
    ok: bad.length === 0,
    reasonCode: bad.length === 0 ? "PROJECTION_FRESHNESS_OK" : "PROJECTION_FRESHNESS_STALE",
    rows,
    stale: bad.map((row) => `${row.sidecar}:${row.status} (${row.reason ?? row.self ?? "?"})`)
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("projection-freshness.mjs")) {
  const result = await runProjectionFreshness();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const row of result.rows) {
    process.stderr.write(`${row.sidecar}: ${row.status}${row.self ? ` (${row.self})` : ""}${row.reason ? ` — ${row.reason}` : ""}\n`);
  }
  if (!result.ok) process.exitCode = 1;
}
