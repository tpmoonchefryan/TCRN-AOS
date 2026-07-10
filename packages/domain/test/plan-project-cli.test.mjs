import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, PLAN_PROJECTION_SCHEMA_VERSION } from "../../../dist/packages/domain/src/index.js";
import { parsePlanProjectCliArguments } from "../../../scripts/plan-project-cli-core.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const cli = join(repoRoot, "scripts/plan-project.mjs");

test("plan projection CLI persists an arbitrary manifest and reuses records on a second invocation", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-plan-cli-test-"));
  const profileRoot = join(root, "profile");
  const manifestPath = join(root, "manifest.json");
  const markerPath = join(root, "owner-marker.json");
  const readbackPath = join(profileRoot, "projection-readback.json");
  try {
    await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
    await writeFile(markerPath, JSON.stringify(ownerMarker()), "utf8");
    const first = invokePackageScript(manifestPath, profileRoot, markerPath, readbackPath);
    assert.equal(first.status, 0, first.stderr);
    const firstReadback = JSON.parse(await readFile(readbackPath, "utf8"));
    assert.equal(firstReadback.ok, true);
    assert.equal(firstReadback.projectionReadback.counts.created, 3);
    assert.equal(firstReadback.restartPersistence.ok, true);
    assert.equal(firstReadback.profile.rawPathRecorded, false);
    const second = invoke(manifestPath, profileRoot, markerPath, readbackPath);
    assert.equal(second.status, 0, second.stderr);
    const secondReadback = JSON.parse(await readFile(readbackPath, "utf8"));
    assert.equal(secondReadback.projectionReadback.counts.created, 0);
    assert.equal(secondReadback.projectionReadback.counts.reused, 3);
    assert.equal(secondReadback.restartPersistence.ok, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plan projection CLI fails closed for missing arguments, invalid marker, invalid manifest, and unsafe readback location", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-plan-cli-negative-"));
  const profileRoot = join(root, "profile");
  const manifestPath = join(root, "manifest.json");
  const markerPath = join(root, "owner-marker.json");
  try {
    await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
    await writeFile(markerPath, JSON.stringify({ profileId: "missing-fields" }), "utf8");
    const missing = spawnSync("node", [cli], { cwd: repoRoot, encoding: "utf8" });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /cli_required_argument_missing:manifest/);
    const invalidMarker = invoke(manifestPath, profileRoot, markerPath, join(profileRoot, "readback.json"));
    assert.notEqual(invalidMarker.status, 0);
    assert.match(invalidMarker.stderr, /cli_owner_marker_invalid/);
    await writeFile(markerPath, JSON.stringify(ownerMarker()), "utf8");
    const unsafeReadback = invoke(manifestPath, profileRoot, markerPath, join(root, "outside.json"));
    assert.notEqual(unsafeReadback.status, 0);
    assert.match(unsafeReadback.stderr, /cli_readback_must_be_inside_profile_root/);
    await writeFile(manifestPath, "{not-json", "utf8");
    const invalidManifest = invoke(manifestPath, profileRoot, markerPath, join(profileRoot, "readback.json"));
    assert.notEqual(invalidManifest.status, 0);
    assert.match(invalidManifest.stderr, /cli_manifest_invalid_json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plan projection CLI contract rejects pnpm's standalone separator and accepts direct forwarded flags", () => {
  const flags = [
    "--manifest", "/tmp/manifest.json",
    "--profile-root", "/tmp/profile",
    "--owner-marker", "/tmp/marker.json",
    "--readback", "/tmp/profile/readback.json"
  ];
  assert.deepEqual(parsePlanProjectCliArguments(flags), {
    manifest: "/tmp/manifest.json",
    "profile-root": "/tmp/profile",
    "owner-marker": "/tmp/marker.json",
    readback: "/tmp/profile/readback.json"
  });
  assert.throws(
    () => parsePlanProjectCliArguments(["--", ...flags]),
    /cli_argument_invalid/
  );
});

function invoke(manifestPath, profileRoot, markerPath, readbackPath) {
  return spawnSync("node", [cli, "--manifest", manifestPath, "--profile-root", profileRoot, "--owner-marker", markerPath, "--readback", readbackPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function invokePackageScript(manifestPath, profileRoot, markerPath, readbackPath) {
  return spawnSync("pnpm", [
    "--dir", repoRoot,
    "plan:project",
    "--manifest", manifestPath,
    "--profile-root", profileRoot,
    "--owner-marker", markerPath,
    "--readback", readbackPath
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function ownerMarker() {
  return {
    profileId: "plan-projection-cli-test-profile",
    routeId: "route_tcrn_total_repair_aos_generic_plan_projection_cli_followup_20260710",
    runContext: "plan-projection-cli-test",
    owner: "Ilya, Full-Stack Implementer"
  };
}

function manifest() {
  const projectId = "TCRN-DESIGN-SYSTEM";
  return {
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    projectionId: "ds2-cli-test",
    sourceDigest: digest({ source: "ds2-cli-test", revision: 1 }),
    project: { id: projectId, name: "TCRN Design System", registryStatus: "active", repoRegistryId: "TCRN-DESIGN-SYSTEM", repoPathReference: "../TCRN-Design-System", status: "in_progress", gateState: "pending_role" },
    initiatives: [item({ externalKey: "ds2-cli-initiative", projectId, title: "CLI projected initiative", problem: "A manifest needs durable projection.", expectedOutcome: "AOS creates stable work records." })],
    epics: [item({ externalKey: "ds2-cli-epic", projectId, initiativeKey: "ds2-cli-initiative", title: "CLI projected epic", goal: "Persist a projected epic.", estimate: estimate(2) })],
    stories: [item({ externalKey: "ds2-cli-story", projectId, epicKey: "ds2-cli-epic", title: "CLI projected story", problem: "A story needs a deterministic ID.", user: "Workflow architect", expectedBehavior: "Restart preserves the projected story.", estimate: estimate(1) })]
  };
}

function item(overrides) {
  return { externalKey: "missing-key", projectId: "missing-project", title: "Projected work item", status: "proposed", dependencies: [], owners: ["Minerva, Workflow Architect"], writeScopes: ["TCRN-DESIGN-SYSTEM/packages/**"], acceptanceCriteria: ["AOS stores metadata-only projection state."], gateRequirements: ["evidence_proof"], ...overrides };
}

function estimate(effortPoints) {
  return { effortPoints, complexity: "low", risk: "L1", verificationCost: "low", confidence: "high" };
}
