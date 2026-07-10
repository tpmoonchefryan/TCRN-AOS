import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, PLAN_PROJECTION_SCHEMA_VERSION } from "../../../dist/packages/domain/src/index.js";
import { runPlanProjectionCli } from "../../../scripts/plan-project-cli-core.mjs";
import { parseExecutionLedgerCliArguments, runExecutionLedgerCli } from "../../../scripts/execution-ledger-cli-core.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const routeId = "route_tcrn_aos_execution_ledger_transition_cli_for_ds2_G0_after_identity_adoption_20260710";

test("execution ledger CLI persists a guarded projected-story transition and reuses event records after restart", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-execution-ledger-cli-"));
  const profileRoot = join(root, "profile");
  const manifestPath = join(root, "manifest.json");
  const markerPath = join(root, "owner-marker.json");
  const projectionReadbackPath = join(profileRoot, "projection-readback.json");
  const commandPath = join(root, "command.json");
  const readbackPath = join(profileRoot, "execution-readback.json");
  try {
    await writeFile(manifestPath, JSON.stringify(manifest()), "utf8");
    await writeFile(markerPath, JSON.stringify(ownerMarker()), "utf8");
    const projection = await runPlanProjectionCli([
      "--manifest", manifestPath,
      "--profile-root", profileRoot,
      "--owner-marker", markerPath,
      "--readback", projectionReadbackPath
    ]);
    const targetId = projection.projectionReadback.recordIds.stories["ds2-ledger-cli-story"];
    await writeFile(commandPath, JSON.stringify(command(targetId)), "utf8");
    const first = await runExecutionLedgerCli([
      "--command", commandPath,
      "--profile-root", profileRoot,
      "--owner-marker", markerPath,
      "--readback", readbackPath
    ]);
    assert.equal(first.ok, true);
    assert.equal(first.executionReadback.status.after, "in_progress");
    assert.equal(first.executionReadback.eventReadbacks.length, 4);
    assert.equal(first.restartPersistence.ok, true);
    const firstCounts = {
      audit: first.restartPersistence.auditEventsForTarget,
      comment: first.restartPersistence.commentsForTarget
    };

    const second = await runExecutionLedgerCli([
      "--command", commandPath,
      "--profile-root", profileRoot,
      "--owner-marker", markerPath,
      "--readback", readbackPath
    ]);
    assert.equal(second.executionReadback.status.replayed, true);
    assert.equal(second.restartPersistence.auditEventsForTarget, firstCounts.audit);
    assert.equal(second.restartPersistence.commentsForTarget, firstCounts.comment);
    const receipt = JSON.parse(await readFile(readbackPath, "utf8"));
    assert.equal(receipt.profile.rawPathRecorded, false);
    assert.equal(receipt.noOverclaim.liveDispatch, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("execution ledger CLI argument parser rejects separators, incomplete input, and duplicate flags", () => {
  const flags = [
    "--command", "/tmp/command.json",
    "--profile-root", "/tmp/profile",
    "--owner-marker", "/tmp/marker.json",
    "--readback", "/tmp/profile/readback.json"
  ];
  assert.deepEqual(parseExecutionLedgerCliArguments(flags), {
    command: "/tmp/command.json",
    "profile-root": "/tmp/profile",
    "owner-marker": "/tmp/marker.json",
    readback: "/tmp/profile/readback.json"
  });
  assert.throws(() => parseExecutionLedgerCliArguments(["--", ...flags]), /execution_ledger_cli_argument_invalid/);
  assert.throws(() => parseExecutionLedgerCliArguments(flags.slice(0, -2)), /execution_ledger_cli_required_argument_missing:readback/);
  assert.throws(() => parseExecutionLedgerCliArguments([...flags, "--command", "/tmp/other.json"]), /execution_ledger_cli_argument_invalid/);
});

function ownerMarker() {
  return {
    profileId: "execution-ledger-cli-test-profile",
    routeId,
    runContext: "execution-ledger-cli-test",
    owner: "Ilya, Full-Stack Implementer"
  };
}

function command(targetId) {
  return {
    schemaVersion: "tcrn.aos.executionLedger.v1",
    projectId: "TCRN-DESIGN-SYSTEM",
    routeId,
    targetType: "story",
    targetId,
    expectedStatus: "proposed",
    nextStatus: "in_progress",
    actor: {
      employeeId: "employee-ilya",
      role: "implementation",
      threadId: "019f4b52-e331-7481-8c13-372928cc4e6c",
      sessionId: "execution-ledger-cli-test"
    },
    events: ["route_sent", "first_output", "interrupted", "recovery_started"].map((type, index) => ({
      type,
      eventKey: `ds2-g0-${type}-v1`,
      occurredAt: `2026-07-10T0${index}:00:00.000Z`,
      sourceEvidenceDigest: digest({ type, revision: 1 })
    }))
  };
}

function manifest() {
  const projectId = "TCRN-DESIGN-SYSTEM";
  return {
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    projectionId: "execution-ledger-cli-test-projection",
    sourceDigest: digest({ source: "execution-ledger-cli-test", revision: 1 }),
    project: {
      id: projectId,
      name: "TCRN Design System",
      registryStatus: "active",
      repoRegistryId: projectId,
      repoPathReference: "../TCRN-Design-System",
      status: "in_progress",
      gateState: "pending_role"
    },
    initiatives: [item({
      externalKey: "ds2-ledger-cli-initiative",
      projectId,
      title: "CLI execution ledger initiative",
      problem: "Projected work needs a persistent lifecycle.",
      expectedOutcome: "AOS preserves replay-safe transitions."
    })],
    epics: [item({
      externalKey: "ds2-ledger-cli-epic",
      projectId,
      initiativeKey: "ds2-ledger-cli-initiative",
      title: "CLI execution ledger epic",
      goal: "Persist transition records."
    })],
    stories: [item({
      externalKey: "ds2-ledger-cli-story",
      projectId,
      epicKey: "ds2-ledger-cli-epic",
      title: "CLI execution ledger story",
      problem: "The CLI must refuse stale transitions.",
      user: "Implementation engineer",
      expectedBehavior: "Events replay without duplicate storage.",
      estimate: estimate(1)
    })]
  };
}

function item(overrides) {
  return {
    externalKey: "missing-key",
    projectId: "missing-project",
    title: "Projected record",
    status: "proposed",
    dependencies: [],
    owners: ["Ilya, Full-Stack Implementer"],
    writeScopes: ["TCRN-AOS/packages/**"],
    acceptanceCriteria: ["Use guarded persistent execution state."],
    gateRequirements: ["evidence_proof"],
    ...overrides
  };
}

function estimate(effortPoints) {
  return { effortPoints, complexity: "low", risk: "L1", verificationCost: "low", confidence: "high" };
}
