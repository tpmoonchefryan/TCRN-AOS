import assert from "node:assert/strict";
import test from "node:test";
import {
  AosStore,
  applyExecutionLedgerCommand,
  createDefaultSeed,
  digest,
  EXECUTION_LEDGER_SCHEMA_VERSION,
  ExecutionLedgerValidationError,
  PLAN_PROJECTION_SCHEMA_VERSION,
  projectPlanManifest
} from "../../../dist/packages/domain/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019f4b52-e331-7481-8c13-372928cc4e6c",
  sessionId: "execution-ledger-test"
};

const ownerMarker = {
  profileId: "execution-ledger-test-profile",
  routeId: "route_tcrn_aos_execution_ledger_transition_cli_for_ds2_G0_after_identity_adoption_20260710",
  runContext: "execution-ledger-test",
  owner: "Ilya, Full-Stack Implementer"
};

test("execution ledger transitions a projected story once and replays lifecycle records without duplicates", () => {
  const { store, ids } = projectedStore();
  const command = ledgerCommand(ids.storyId);
  const first = applyExecutionLedgerCommand(store, command, ownerMarker);
  assert.equal(first.status.before, "proposed");
  assert.equal(first.status.after, "in_progress");
  assert.equal(first.status.transitionApplied, true);
  assert.equal(first.eventReadbacks.length, 4);
  assert.equal(store.listStories().find((story) => story.id === ids.storyId)?.comments.length, 4);
  const auditCount = store.queryAudit({ targetId: ids.storyId }).length;

  const replay = applyExecutionLedgerCommand(store, command, ownerMarker);
  assert.equal(replay.status.replayed, true);
  assert.equal(replay.status.transitionApplied, false);
  assert.equal(store.listStories().find((story) => story.id === ids.storyId)?.comments.length, 4);
  assert.equal(store.queryAudit({ targetId: ids.storyId }).length, auditCount);
  assert.ok(replay.eventReadbacks.every((event) => event.replayed));
  assert.ok(store.listStories().filter((story) => story.id !== ids.storyId).every((story) => story.status === "proposed"));
});

test("execution ledger fails closed for unknown, cross-project, invalid, stale, and conflicting requests", () => {
  const { store, ids } = projectedStore();
  const command = ledgerCommand(ids.storyId);
  assert.throws(
    () => applyExecutionLedgerCommand(store, { ...command, targetId: "story_unknown" }, ownerMarker),
    (error) => error instanceof ExecutionLedgerValidationError && error.code === "execution_ledger_target_unknown"
  );
  assert.throws(
    () => applyExecutionLedgerCommand(store, { ...command, projectId: "TCRN-AOS" }, ownerMarker),
    (error) => error instanceof ExecutionLedgerValidationError && error.code === "execution_ledger_cross_project_target"
  );
  assert.throws(
    () => applyExecutionLedgerCommand(store, { ...command, nextStatus: "verified" }, ownerMarker),
    (error) => error instanceof ExecutionLedgerValidationError && error.code === "execution_ledger_transition_invalid"
  );
  applyExecutionLedgerCommand(store, command, ownerMarker);
  assert.throws(
    () => applyExecutionLedgerCommand(store, { ...command, events: command.events.map((event, index) => index === 0 ? { ...event, sourceEvidenceDigest: digest("conflict") } : event) }, ownerMarker),
    (error) => error instanceof ExecutionLedgerValidationError && error.code === "execution_ledger_event_key_conflict"
  );
  assert.throws(
    () => applyExecutionLedgerCommand(store, { ...command, events: command.events.map((event) => ({ ...event, eventKey: `${event.eventKey}-stale` })) }, ownerMarker),
    (error) => error instanceof ExecutionLedgerValidationError && error.code === "execution_ledger_expected_status_stale"
  );
});

test("execution ledger supports projected initiative transitions using an existing story comment anchor", () => {
  const { store, ids } = projectedStore();
  const readback = applyExecutionLedgerCommand(store, ledgerCommand(ids.initiativeId, "initiative"), ownerMarker);
  assert.equal(readback.status.after, "in_progress");
  assert.equal(readback.eventReadbacks.length, 4);
  assert.equal(store.listStories().find((story) => story.id === ids.storyId)?.comments.length, 4);
});

function projectedStore() {
  const store = new AosStore(createDefaultSeed());
  const projection = projectPlanManifest(store, manifest(), actor);
  return {
    store,
    ids: {
      initiativeId: projection.recordIds.initiatives["ds2-ledger-initiative"],
      storyId: projection.recordIds.stories["ds2-ledger-story"]
    }
  };
}

function ledgerCommand(targetId, targetType = "story") {
  return {
    schemaVersion: EXECUTION_LEDGER_SCHEMA_VERSION,
    projectId: "TCRN-DESIGN-SYSTEM",
    routeId: ownerMarker.routeId,
    targetType,
    targetId,
    expectedStatus: "proposed",
    nextStatus: "in_progress",
    actor,
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
    projectionId: "execution-ledger-test-projection",
    sourceDigest: digest({ source: "execution-ledger-test", revision: 1 }),
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
      externalKey: "ds2-ledger-initiative",
      projectId,
      title: "Execution ledger initiative",
      problem: "Projected work needs execution truth.",
      expectedOutcome: "AOS records guarded lifecycle transitions."
    })],
    epics: [item({
      externalKey: "ds2-ledger-epic",
      projectId,
      initiativeKey: "ds2-ledger-initiative",
      title: "Execution ledger epic",
      goal: "Persist a replay-safe lifecycle."
    })],
    stories: [item({
      externalKey: "ds2-ledger-story",
      projectId,
      epicKey: "ds2-ledger-epic",
      title: "Execution ledger story",
      problem: "The projected story needs a guarded status.",
      user: "Implementation engineer",
      expectedBehavior: "Replay does not duplicate lifecycle records.",
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
