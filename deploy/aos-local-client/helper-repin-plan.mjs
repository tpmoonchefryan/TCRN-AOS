#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-104 — read-only helper repin plan. The helper trust
// gate is deliberately not a convenience installer: this command measures the
// installed/provenance state and consumes the separately recorded Owner ruling;
// it never mutates helper-owned control or provenance files.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HELPER_ROOT = join(homedir(), ".tcrn-workflow");
/**
 * INC-133 item 6. This used to be `candidates/qa4-inc098-O0SToT` — a scratch directory
 * named after a one-off QA session. No documented install step creates it, so a machine
 * that had merely followed the published instructions failed this probe forever, and
 * INIT-024's clean install only went green after recreating a directory whose name is
 * an accident of history. The question the probe is actually asking is "is the helper
 * pinned to the engine that is deployed here", so it now reads the deployed engine.
 */
const DEPLOYED_ENGINE = join(HELPER_ROOT, "tcrn-workflow");
const CANDIDATE = join(HELPER_ROOT, "candidates", "qa4-inc098-O0SToT");
const AOS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OWNER_AUTHORIZATION = join(
  AOS_ROOT,
  "docs",
  "reports",
  "init-020",
  "AUTHORIZATION-2026-08-09-owner-prod.md",
);

const OWNER_APPROVAL_MARKERS = Object.freeze([
  "## 裁定三 · helper 重钉（INC-113）",
  "Owner：「**批准，tag 铸成即执行（推荐）**」。",
  "v0.11.8 annotated tag 铸成后立即重钉",
  "`HELPER_REPIN_OWNER_APPROVAL_REQUIRED` 必停点就此清偿，无需再问。",
]);

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function readText(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function ownerApproval(path) {
  const text = readText(path);
  const present = text !== null;
  const matchedMarkers = present
    ? OWNER_APPROVAL_MARKERS.filter((marker) => text.includes(marker))
    : [];
  return {
    path,
    present,
    granted: matchedMarkers.length === OWNER_APPROVAL_MARKERS.length,
    matchedMarkers,
    requiredMarkers: [...OWNER_APPROVAL_MARKERS],
  };
}

export function buildHelperRepinPlan({
  helperRoot = HELPER_ROOT,
  candidateRoot = CANDIDATE,
  deployedEngineRoot = DEPLOYED_ENGINE,
  ownerAuthorizationPath = OWNER_AUTHORIZATION,
} = {}) {
  const provenance = readJson(join(helperRoot, "complete-skill-archive.provenance.json"));
  const claude = readJson(join(helperRoot, "installed-copy-claude.json"));
  const codex = readJson(join(helperRoot, "installed-copy-codex.json"));
  const state = readJson(join(helperRoot, "state.json"));
  // The deployed engine is the basis; the legacy staging directory is still consulted
  // so a machine that has one is not suddenly judged against a different number, but
  // its ABSENCE is no longer a failure.
  const deployed = readJson(join(deployedEngineRoot, "package.json"));
  const candidate = readJson(join(candidateRoot, "package.json"));
  const approval = ownerApproval(ownerAuthorizationPath);
  const candidatePresent = existsSync(candidateRoot);
  const current = {
    provenanceVersion: provenance?.predicate?.buildDefinition?.externalParameters?.version ?? null,
    provenanceTag: provenance?.predicate?.buildDefinition?.externalParameters?.tag ?? null,
    claudeInstalledVersion: claude?.version ?? null,
    codexInstalledVersion: codex?.version ?? null,
    stateArchiveSha256: state?.verifiedArchiveSha256 ?? null,
    candidatePresent,
    candidateVersion: candidate?.version ?? null,
    deployedEngineVersion: deployed?.version ?? null,
  };
  const expectedVersion = deployed?.version ?? candidate?.version ?? null;
  const repinVerified = expectedVersion !== null
    && current.provenanceVersion === expectedVersion
    && current.claudeInstalledVersion === `v${expectedVersion}`
    && current.codexInstalledVersion === `v${expectedVersion}`
    && typeof current.stateArchiveSha256 === "string"
    && current.stateArchiveSha256.length === 64;
  const ready = approval.granted && repinVerified;
  return {
    schemaVersion: "tcrn.helper-repin-plan.v1",
    reasonCode: ready
      ? "HELPER_REPIN_VERIFIED"
      : approval.granted
        ? "HELPER_REPIN_EXECUTION_UNVERIFIED"
        : "HELPER_REPIN_OWNER_APPROVAL_REQUIRED",
    ready,
    current,
    expectedVersion,
    ownerApproval: approval,
    repinVerified,
    requiredActions: [
      ...(approval.granted ? [] : [
        "obtain explicit Owner approval for the helper mutation and any required plan-network dependency step",
      ]),
      ...(repinVerified ? [] : [
        "run the tcrn-workflow-helper trust/preflight checks against the exact rewritten candidate head",
        "repin both Claude and Codex installed-copy markers through the helper engine",
        "rerun installed-copy, provenance, candidate privacy, and fifth-acceptance proofs",
      ]),
    ],
    forbiddenUntilApproval: ready ? [] : [
      "do not edit ~/.tcrn-workflow control or provenance files by hand",
      "do not activate Codex hooks or alter the user-level config as part of this plan",
      "do not transition governed work items or publish a tag/remote",
    ],
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("helper-repin-plan.mjs")) {
  process.stdout.write(`${JSON.stringify(buildHelperRepinPlan(), null, 2)}\n`);
}
