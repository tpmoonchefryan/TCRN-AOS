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
    const headTime = headCommitTime(root);
    const indexTime = codegraphIndexTime(root);
    if (headTime === null) { stale.push({ repo, why: "HEAD commit time unreadable" }); continue; }
    if (indexTime === null) { stale.push({ repo, why: "no .codegraph index found (unproven)" }); continue; }
    if (indexTime < headTime) stale.push({ repo, headTime, indexTime, why: "index older than last commit" });
  }
  if (stale.length > 0) return { status: "stale", self: stale.map((s) => `${s.repo}:${s.why}`).join("; "), reason: "codegraph index behind repo HEAD" };
  return { status: "fresh", self: "all indexed repos have index >= HEAD", reason: null };
}

function headCommitTime(repoRoot) {
  try {
    const out = execFileSync("git", ["-C", repoRoot, "log", "-1", "--format=%ct"], { encoding: "utf8" });
    const secs = Number(out.trim());
    return Number.isFinite(secs) ? secs * 1000 : null;
  } catch { return null; }
}

function codegraphIndexTime(repoRoot) {
  const cg = join(repoRoot, ".codegraph");
  if (!existsSync(cg)) return null;
  const entries = readdirSync(cg).filter((name) => /\.(db|sqlite|json|bin)$/u.test(name));
  if (entries.length === 0) return null;
  const times = entries.map((name) => statSync(join(cg, name)).mtimeMs);
  return Math.max(...times);
}

function checkWebProjection() {
  // The cockpit data stamp is produced by scripts/build-cockpit-data.mjs. When the
  // built module is present locally, its generatedAt is the self version.
  const candidate = join(REPO_ROOT, "dist/apps/web/src/cockpit-data.generated.js");
  if (!existsSync(candidate)) {
    return { status: "unproven", self: null, reason: "no local cockpit-data.generated.js; run pnpm cockpit:data" };
  }
  const text = readFileSync(candidate, "utf8");
  const stamp = text.match(/generatedAt["']?\s*[:=]\s*["']([^"']+)["']/u)?.[1] ?? null;
  if (stamp === null) return { status: "unproven", self: null, reason: "generatedAt stamp not found" };
  const ageDays = (Date.now() - Date.parse(stamp)) / 86_400_000;
  return {
    status: ageDays <= 7 ? "fresh" : "stale",
    self: stamp,
    reason: ageDays <= 7 ? null : `projection stamp ${ageDays.toFixed(1)} days old (max 7)`
  };
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
  const web = checkWebProjection();
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
