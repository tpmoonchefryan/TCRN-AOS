#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-101 — proof for governed artifacts that live outside
// the platform checkout. A candidate outside the registered repositories is not
// accepted merely because its directory exists: its purpose, lifecycle, exact
// head, clean worktree, public-origin posture, and targeted historical privacy
// surface are all part of the roster.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_REGISTRY = join(REPO_ROOT, "docs/reports/init-020/inc-101-off-repo-artifact-registry.json");
const PLATFORM_ROOT = resolve(REPO_ROOT, "..");

function runGit(repo, args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function isPathInside(parent, child) {
  const base = resolve(parent);
  const target = resolve(child);
  return target === base || target.startsWith(`${base}/`);
}

function historicalTopologyFindings(candidate, paths) {
  const findings = [];
  const commits = runGit(candidate, ["rev-list", "--all"]).split("\n").filter(Boolean);
  const dangerous = [
    /tcrn[-]platform[-]dev/iu,
    /192[.]168[.]51[.]249/u,
    /(?:^|["'`])\/?srv\/?tcrn(?:\/|\\)/iu,
    /PRIVATE_(?:VM_HOST|RUNTIME_ROOT|GOVERNANCE_ROOT|LOOPBACK|FACADE_IP)[^\n]*(?:\.join\s*\(|String\.fromCharCode|atob\s*\(|base64|\\x|\\u)/u,
    /"pattern"\s*:[^\n]*(?:\\x|\\u|\[-\]|\.join\s*\()/u,
  ];
  for (const commit of commits) {
    for (const path of paths) {
      const content = runGit(candidate, ["show", `${commit}:${path}`], { allowFailure: true });
      if (content === null) continue;
      for (const pattern of dangerous) {
        if (pattern.test(content)) {
          findings.push(`${commit}:${path}:${pattern}`);
          break;
        }
      }
    }
  }
  return { commits: commits.length, findings };
}

export function judgeOffRepoArtifact({ registryPath = DEFAULT_REGISTRY } = {}) {
  const problems = [];
  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (error) {
    return { ok: false, reasonCode: "OFF_REPO_REGISTRY_UNREADABLE", problems: [String(error?.message ?? error)] };
  }
  if (registry?.schemaVersion !== "tcrn.off-repo-artifact-registry.v1") problems.push("registry schemaVersion is invalid");
  if (!Array.isArray(registry?.entries) || registry.entries.length === 0) problems.push("registry has no entries");
  const entry = registry?.entries?.[0];
  if (!entry || typeof entry.path !== "string" || typeof entry.purpose !== "string" || typeof entry.lifecycle !== "string") {
    problems.push("registry entry must declare path, purpose, and lifecycle");
  }
  const candidate = entry?.path;
  if (typeof candidate !== "string" || !candidate.startsWith("/")) {
    problems.push("candidate path must be absolute");
  } else {
    if (isPathInside(PLATFORM_ROOT, candidate)) problems.push("candidate must remain outside the platform checkout");
    if (!existsSync(candidate)) problems.push("candidate path does not exist");
    else if (!statSync(candidate).isDirectory()) problems.push("candidate path is not a directory");
  }

  if (typeof candidate === "string" && existsSync(candidate)) {
    const top = runGit(candidate, ["rev-parse", "--show-toplevel"], { allowFailure: true });
    if (top !== resolve(candidate)) problems.push(`candidate git top-level mismatch: ${top ?? "unreadable"}`);
    const status = runGit(candidate, ["status", "--porcelain=v1", "--untracked-files=all"], { allowFailure: true });
    if (status !== "") problems.push("candidate worktree is not clean");
    const head = runGit(candidate, ["rev-parse", "HEAD"], { allowFailure: true });
    if (entry?.expectedHead && head !== entry.expectedHead) problems.push(`candidate HEAD mismatch: expected ${entry.expectedHead}, got ${head ?? "unreadable"}`);

    const origin = runGit(candidate, ["remote", "get-url", "origin"], { allowFailure: true });
    const hookPath = runGit(candidate, ["rev-parse", "--git-path", "hooks"], { allowFailure: true });
    const prePush = hookPath ? join(hookPath, "pre-push") : null;
    const hasPrePushBlocker = prePush !== null && existsSync(prePush) && statSync(prePush).isFile() && readFileSync(prePush, "utf8").length > 0;
    if (origin !== null && !hasPrePushBlocker) problems.push("public origin is present without a pre-push blocker");
    if (origin !== null && origin !== entry?.originBeforeRemoval) problems.push("origin before-removal evidence does not match registry");
    if (origin === null && entry?.originAfterRemediation !== "absent") problems.push("origin remediation is not recorded as absent");

    const history = historicalTopologyFindings(candidate, ["scripts/ssh-write-observer.mjs", "scripts/policy/ssh-breakglass-allowlist.json"]);
    if (history.findings.length > 0) problems.push(`historical topology privacy findings: ${history.findings.join(", ")}`);
    if (entry?.historyRewrite?.status !== "complete") problems.push("candidate history rewrite is not marked complete");
    if (entry?.historyRewrite?.commitsObserved !== history.commits) problems.push("history commit count is not measured against this candidate");
  }

  return {
    ok: problems.length === 0,
    reasonCode: problems.length === 0 ? "OFF_REPO_ARTIFACT_VERIFIED" : "OFF_REPO_ARTIFACT_UNRESOLVED",
    registryPath,
    candidate,
    problems,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("off-repo-artifact-proof.mjs")) {
  const registryPath = process.argv[2] ?? DEFAULT_REGISTRY;
  const result = judgeOffRepoArtifact({ registryPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const problem of result.problems ?? []) process.stderr.write(`  PROBLEM: ${problem}\n`);
  if (!result.ok) process.exitCode = 1;
}
