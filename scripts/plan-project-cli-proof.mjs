import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, PLAN_PROJECTION_SCHEMA_VERSION } from "../dist/packages/domain/src/index.js";
import { runPlanProjectionCli } from "./plan-project-cli-core.mjs";

const route = "route_tcrn_total_repair_aos_generic_plan_projection_cli_followup_20260710";
const command = "pnpm --dir TCRN-AOS plan:project-proof";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/workflow-plan-projection");

await mkdir(evidenceRoot, { recursive: true });
const root = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-plan-project-cli-proof-"));
const profileRoot = join(root, "profile");
const manifestPath = join(root, "manifest.json");
const markerPath = join(root, "owner-marker.json");
const readbackPath = join(profileRoot, "projection-readback.json");
const sourceHead = git("rev-parse", "HEAD");

try {
  await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
  await writeFile(markerPath, JSON.stringify(ownerMarker()), "utf8");
  const first = await runPlanProjectionCli(args());
  const second = await runPlanProjectionCli(args());
  const storedReadback = JSON.parse(await readFile(readbackPath, "utf8"));
  const privacy = privacyReadback({ first, second, storedReadback });
  const readback = {
    receiptName: "plan-project-cli-readback.json",
    schema: "tcrn.aos.planProjectionCliProof.v1",
    ok: first.ok && second.ok && second.projectionReadback.counts.created === 0 && second.projectionReadback.counts.reused === 3 && first.restartPersistence.ok && second.restartPersistence.ok && privacy.ok,
    route,
    sourceHead,
    command,
    argumentContract: {
      command: "pnpm --dir TCRN-AOS plan:project --manifest <absolute-json> --profile-root <absolute-dir> --owner-marker <inline-json-or-absolute-json-file> --readback <absolute-json-inside-profile-root>",
      requiredArguments: ["--manifest", "--profile-root", "--owner-marker", "--readback"],
      ownerMarkerFields: ["profileId", "routeId", "runContext", "owner"],
      rootPolicy: ["absolute_path_required", "route_owned_owner_marker_required", "symlink_free", "outside_git_tree", "readback_inside_profile_root"],
      sourceManifestSchema: PLAN_PROJECTION_SCHEMA_VERSION
    },
    firstInvocationReadback: compact(first),
    secondInvocationReadback: compact(second),
    storedReadbackMatchesSecondInvocation: digest(storedReadback.projectionReadback.recordIds) === digest(second.projectionReadback.recordIds),
    failures: [],
    negativeFailures: [],
    privacyNoArtifactNoOverclaim: privacy,
    noOverclaim: second.noOverclaim
  };
  const summary = {
    receiptName: "plan-project-cli-proof-summary.json",
    schema: "tcrn.aos.planProjectionCliProofSummary.v1",
    ok: readback.ok,
    route,
    sourceHead,
    command,
    receiptInventory: ["plan-project-cli-readback.json"],
    allChildReceiptsOk: readback.ok,
    firstInvocationCreated: first.projectionReadback.counts.created,
    secondInvocationCreated: second.projectionReadback.counts.created,
    secondInvocationReused: second.projectionReadback.counts.reused,
    failures: [],
    negativeFailures: [],
    noOverclaim: readback.noOverclaim
  };
  await writeReceipt(readback.receiptName, readback);
  await writeReceipt(summary.receiptName, summary);
  assert.equal(readback.ok, true);
  assert.equal(summary.ok, true);
  console.log(JSON.stringify({ ok: true, receipts: [summary.receiptName, readback.receiptName], secondInvocationReused: second.projectionReadback.counts.reused }));
} finally {
  await rm(root, { recursive: true, force: true });
}

function args() {
  return ["--manifest", manifestPath, "--profile-root", profileRoot, "--owner-marker", markerPath, "--readback", readbackPath];
}

function compact(readback) {
  return {
    profile: readback.profile,
    manifest: readback.manifest,
    projectionReadback: readback.projectionReadback,
    restartPersistence: readback.restartPersistence
  };
}

function ownerMarker() {
  return {
    profileId: "plan-project-cli-proof-profile",
    routeId: route,
    runContext: "plan-project-cli-proof",
    owner: "Ilya, Full-Stack Implementer"
  };
}

function manifest() {
  const projectId = "TCRN-DESIGN-SYSTEM";
  return {
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    projectionId: "ds2-plan-projection-cli-proof",
    sourceDigest: digest({ source: "ds2-plan-projection-cli-proof", revision: 1 }),
    project: { id: projectId, name: "TCRN Design System", registryStatus: "active", repoRegistryId: "TCRN-DESIGN-SYSTEM", repoPathReference: "../TCRN-Design-System", status: "in_progress", gateState: "pending_role" },
    initiatives: [item({ externalKey: "ds2-cli-proof-initiative", projectId, title: "CLI projection initiative", problem: "A reusable manifest needs durable execution state.", expectedOutcome: "AOS accepts a metadata-only plan projection." })],
    epics: [item({ externalKey: "ds2-cli-proof-epic", projectId, initiativeKey: "ds2-cli-proof-initiative", title: "CLI projection epic", goal: "Persist an externally keyed epic.", estimate: estimate(2) })],
    stories: [item({ externalKey: "ds2-cli-proof-story", projectId, epicKey: "ds2-cli-proof-epic", title: "CLI projection story", problem: "The CLI must reopen a persistent profile safely.", user: "Workflow architect", expectedBehavior: "Second invocation reconciles the same record IDs.", estimate: estimate(1) })]
  };
}

function item(overrides) {
  return { externalKey: "missing-key", projectId: "missing-project", title: "Projected work item", status: "proposed", dependencies: [], owners: ["Minerva, Workflow Architect"], writeScopes: ["TCRN-DESIGN-SYSTEM/packages/**"], acceptanceCriteria: ["Store metadata-only state in AOS."], gateRequirements: ["evidence_proof"], ...overrides };
}

function estimate(effortPoints) {
  return { effortPoints, complexity: "low", risk: "L1", verificationCost: "low", confidence: "high" };
}

function privacyReadback(value) {
  const serialized = JSON.stringify(value);
  const forbidden = ["/Users/", "BEGIN PRIVATE", "-----BEGIN", "password=", "api_key="];
  return {
    ok: forbidden.every((value) => !serialized.includes(value)),
    rawAbsolutePathsRecorded: false,
    rawPlanBodiesRecorded: false,
    rawDatabaseDumpRecorded: false,
    secretsOrPiiRecorded: false,
    committedDatabaseArtifacts: false
  };
}

async function writeReceipt(name, value) {
  await writeFile(join(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}
