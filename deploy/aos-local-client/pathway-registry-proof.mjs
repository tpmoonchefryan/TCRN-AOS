#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-076 — engine pathway registry proof. Every way this
// repository reaches a governed engine is declared in topology.mjs
// (ENGINE_PATHWAYS). This gate scans the deploy/ tree for engine-invoking files
// and reds on any that are NOT registered — the machine form of "a switch story's
// scope is decided by a roster, not by memory."
//
// RED LEG: plant an engine call in an unregistered file → this reds. S185's
// "switched the two MCP faces" left ceremony.mjs / projection-freshness /
// fallback-cli / apply / emit-evidence on the SSH+file surface; the registry now
// declares each, and INC-082 moves the ceremony write onto the facade.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Engine-call tokens: a file that reaches a governed engine names one of these.
const ENGINE_TOKENS = [
  "VM_ENGINE_CLI",
  "scripts/tcrn-workflow.mjs",
  "remoteEngine",
  "readChainHead",
  "facadeRead",
  "/api/engine/",
  "/api/ceremony",
  "tcrn_remote_read",
  "tcrn_remote_read_status",
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === ".codegraph") continue;
    if (entry.name === "evidence" || entry.name === "payloads" || entry.name === "receipts") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.(mjs|js|ts)$/u.test(entry.name)) out.push(full);
  }
  return out;
}

export async function judgePathwayRegistry({ repoRoot = REPO_ROOT, extraScanFiles = [] } = {}) {
  const problems = [];
  let pathways;
  try {
    const module = await import(resolve(repoRoot, "deploy/aos-local-client/topology.mjs"));
    pathways = module.ENGINE_PATHWAYS ?? [];
  } catch (error) {
    return { ok: false, reasonCode: "PATHWAY_REGISTRY_UNREADABLE", error: String(error?.message ?? error) };
  }
  const registeredFiles = new Set();
  for (const pathway of pathways) {
    for (const file of pathway.files ?? []) {
      const full = resolve(repoRoot, file);
      let exists = false;
      try { statSync(full); exists = true; } catch { exists = false; }
      if (!exists) problems.push(`registry entry ${pathway.id} names a missing file: ${file}`);
      registeredFiles.add(file);
    }
    if (typeof pathway.surface !== "string" || pathway.surface.length === 0) {
      problems.push(`registry entry ${pathway.id} declares no surface`);
    }
  }
  // Scan deploy/ for engine-invoking files; each must be registered.
  const scanned = [];
  const sourceByPath = new Map();
  for (const base of ["deploy"]) {
    for (const path of walk(join(repoRoot, base))) {
      const rel = relative(repoRoot, path);
      if (rel.endsWith(".test.mjs")) continue;
      // The registry proof itself names the scan tokens; the registry's own home
      // (topology.mjs) DECLARES the constants other files invoke — both exempt.
      if (rel.endsWith("pathway-registry-proof.mjs")) continue;
      if (rel === "deploy/aos-local-client/topology.mjs") continue;
      let text;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      if (ENGINE_TOKENS.some((token) => text.includes(token))) {
        scanned.push(rel);
        sourceByPath.set(rel, text);
      }
    }
  }
  for (const extra of extraScanFiles) {
    const rel = relative(repoRoot, extra);
    scanned.push(rel);
  }
  const unregistered = scanned.filter((path) => !registeredFiles.has(path)).sort();
  if (unregistered.length > 0) {
    problems.push(`unregistered engine invocations: ${unregistered.join(", ")}`);
  }
  // INC-076: a registry row that merely repeats a self-reported label is not
  // evidence. For every registered pathway, inspect the implementation bytes of
  // its whole file set. Launchers and manifests are deliberately grouped with
  // the runtime they configure, so the check measures the surface rather than a
  // filename's comments or an environment variable in isolation.
  for (const pathway of pathways) {
    const source = (pathway.files ?? []).map((path) => {
      try { return readFileSync(resolve(repoRoot, path), "utf8"); } catch { return ""; }
    }).join("\n");
    const surfaces = String(pathway.surface).split("+");
    const checks = {
      "local-engine": /localEngine|localChainHead/u.test(source),
      "facade-read": /facadeRead|\/api\/engine\/|FACADE_PORT|runEngineCli/u.test(source),
      "facade-write": /facadeCeremony|\/api\/ceremony|performFacadeWrite|FACADE_WRITE_PORT/u.test(source),
      "ssh-probe": /\/api\/health/u.test(source),
      "ssh-file": /\bssh\b|execFile|readFile|writeFile|scp/u.test(source),
      "ssh-rsync": /\brsync\b/u.test(source),
    };
    for (const surface of surfaces) {
      if (surface in checks && !checks[surface]) {
        problems.push(`${pathway.id}: declared ${surface} surface has no matching implementation token in its registered file set`);
      }
    }
  }
  return {
    ok: problems.length === 0,
    reasonCode: problems.length === 0 ? "PATHWAY_REGISTRY_VERIFIED" : "PATHWAY_REGISTRY_UNREGISTERED",
    registered: registeredFiles.size,
    scanned,
    unregistered,
    problems,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("pathway-registry-proof.mjs")) {
  const result = await judgePathwayRegistry();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const p of result.problems ?? []) process.stderr.write(`  PROBLEM: ${p}\n`);
  if (!result.ok) process.exitCode = 1;
}
