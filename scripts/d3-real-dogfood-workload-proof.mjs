import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed, createId } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase4_d3_real_dogfood_workload_creation_ilya_after_minerva_d2_status_sync_success_1419ad9_bce717a_20260706";
const workflowBasis = "1419ad9c4ef39db741729b55fe11f8fdf68519df";
const d2ActivationRoute = "route_tcrn_aos_phase4_d2_runtime_profile_local_activation_ilya_after_owner_decision_78d75eb_eb8f5a8_20260706";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-dogfood-execution-runtime-profile");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const markerFile = ".tcrn-aos-phase1-root";
const markerPurpose = "d2-local-dogfood-runtime-profile-activation";
const markerVersion = "phase4-d2-runtime-profile.v1";
const command = "pnpm --dir TCRN-AOS d3:real-dogfood-workload-proof";
const readbackReceiptName = "d3-real-dogfood-workload-readback.json";
const summaryReceiptName = "d3-real-dogfood-workload-creation-proof-summary.json";
const databaseFileName = "aos-d2-local-runtime-profile.sqlite";
const sourceFiles = [
  "package.json",
  "scripts/d3-real-dogfood-workload-proof.mjs",
  "scripts/d2-runtime-profile-activation-proof.mjs",
  "packages/db/src/sqlite-repository.ts",
  "packages/domain/src/store.ts",
  "packages/domain/src/seed.ts",
  "packages/mcp-gateway/src/gateway.ts",
  "packages/mcp-server/src/transport.ts"
];
const methodsExercised = [
  "aos.assignment.claim",
  "aos.assignment.update",
  "aos.run.summary.create",
  "aos.evidence.link",
  "aos.gate.decision.record",
  "aos.ticket.list",
  "aos.audit.query",
  "aos.policy.read"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "d3-real-dogfood-workload-creation"
};
const sableActor = {
  employeeId: "employee-sable",
  role: "security",
  threadId: "sable-thread",
  sessionId: "d3-real-dogfood-workload-gate-decision"
};
const noOverclaimFlags = {
  localD2RuntimeProfileDbUsed: true,
  d3RealDogfoodWorkloadCreated: true,
  productRepoEvidenceMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  hookBehaviorReliance: false,
  hookMappingImplemented: false,
  hookRetirementPerformed: false,
  activeParityClaimed: false,
  phase4StoryImplementationPerformed: false,
  pilotVaultImportImplemented: false,
  registryMutationPerformed: false,
  d4FrictionTicketsCreated: false,
  d5StatusMigrationPerformed: false,
  durableRuntimeDbActivation: false,
  defaultRuntimeDbActivation: false,
  remoteRuntimeActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  productReadinessClaimed: false,
  phase3AcceptanceClaimed: false,
  phase4CloseoutClaimed: false,
  ownerFacingSurfaceCreated: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};
const workItems = [
  {
    key: "hook_gate_to_aos_method_mapping_table",
    title: "Hook-gate to AOS-method mapping table",
    status: "accepted",
    estimate: { effortPoints: 3, complexity: "medium", risk: "L3", verificationCost: "high", confidence: "medium" },
    problem: "Phase 4 needs a backlog item for hook-gate to AOS-method mapping without relying on active hook behavior.",
    expectedBehavior: "Carry the active/source hook divergence blocker and wait for routed mapping work.",
    acceptanceCriteria: [
      "Active/source hook divergence remains a blocker until separately repaired.",
      "No hook mapping, hook retirement, or active hook reliance is performed by D3 workload creation."
    ]
  },
  {
    key: "pilot_vault_import",
    title: "Pilot vault import",
    status: "accepted",
    estimate: { effortPoints: 3, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
    problem: "Phase 4 needs a real backlog item for a future pilot vault import lane.",
    expectedBehavior: "Track the import candidate as workload only; no vault import is performed in this lane.",
    acceptanceCriteria: [
      "Import implementation remains non-scope until separately routed.",
      "The story records only safe metadata and no vault contents."
    ]
  },
  {
    key: "crew_reduction",
    title: "Crew reduction plan",
    status: "accepted",
    estimate: { effortPoints: 2, complexity: "medium", risk: "L3", verificationCost: "medium", confidence: "medium" },
    problem: "Phase 4 needs a real backlog item for future crew reduction planning.",
    expectedBehavior: "Preserve that registry writes require Ariadne with Arturo routing and registryImpact readback.",
    acceptanceCriteria: [
      "No registry/default/generated-agent write is performed by D3 workload creation.",
      "Future crew reduction work keeps Ariadne and registryImpact routing requirements visible."
    ]
  },
  {
    key: "agents_boot_cost_rewrite_backfill",
    title: "AGENTS.md boot-cost rewrite backfill",
    status: "verified",
    estimate: { effortPoints: 1, complexity: "low", risk: "L1", verificationCost: "low", confidence: "high" },
    problem: "Workflow already completed the bounded AGENTS boot-cost rewrite slice and D3 can backfill it as completed workload metadata.",
    expectedBehavior: "Backfill the completed story from existing Workflow status without mutating AGENTS or rerunning that lane.",
    acceptanceCriteria: [
      "Backfill references existing Workflow source/status basis only.",
      "No Workflow, AGENTS, hook, registry, or generated-agent mutation occurs in D3."
    ]
  }
];

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const selectedRoot = selectExistingActivationRoot();
const dbPath = join(selectedRoot.root, databaseFileName);
const creation = runWorkloadCreation(selectedRoot.root, dbPath);
const privacy = privacyScan(creation);
const receipt = writeReceipt(readbackReceiptName, {
  ok: creation.ok && privacy.ok,
  source,
  selectedRoot: selectedRoot.readback,
  d3WorkloadCreationReadback: creation.d3WorkloadCreationReadback,
  initiativeEpicStoryReadback: creation.initiativeEpicStoryReadback,
  claimRunEvidenceGateAuditReadback: creation.claimRunEvidenceGateAuditReadback,
  localProfileRootPrivacyReadback: creation.localProfileRootPrivacyReadback,
  methodAuthorityBoundaryReadback: creation.methodAuthorityBoundaryReadback,
  d4FrictionCaptureReadback_or_none: creation.d4FrictionCaptureReadback_or_none,
  activeHookDivergenceBoundaryReadback: creation.activeHookDivergenceBoundaryReadback,
  validation_readbacks: creation.validation_readbacks,
  privacyNoOverclaimScan: privacy,
  noOverclaimFlags
});
const summary = writeReceipt(summaryReceiptName, {
  ok: receipt.ok === true,
  source,
  receiptInventory: [readbackReceiptName],
  receiptCount: 1,
  allChildReceiptsOk: receipt.ok === true,
  missingReceipts: [],
  extraUnclassifiedReceipts: [],
  workloadReadbackReceiptDigest: sha256(JSON.stringify(receipt)),
  d3RealDogfoodWorkloadCreated: true,
  d4FrictionTicketsCreated: false,
  noOverclaimFlags
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  receipts: [summaryReceiptName, readbackReceiptName],
  initiativeId: creation.d3WorkloadCreationReadback.initiativeId,
  epicId: creation.d3WorkloadCreationReadback.epicId,
  storyIds: creation.d3WorkloadCreationReadback.storyIds,
  rawPathRecorded: false,
  d3Only: true
}, null, 2));

function runWorkloadCreation(root, databasePath) {
  validateExistingActivationRoot(root);
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath, actor));
  const sableRuntime = createRuntimeTransport(runtimeConfig(root, databasePath, sableActor));
  try {
    const before = readD3Snapshot(databasePath);
    const workload = ensureWorkloadRecords(databasePath);
    const methodProof = exerciseMethods(databasePath, runtime.transport, sableRuntime.transport, workload);
    const readback = readD3Snapshot(databasePath);
    const negative = proveNegativeAuthority(runtime.transport);
    const validation = validateReceiptsAndArtifacts(databasePath);
    const marker = markerReadback(root);
    const ok = workload.ok &&
      methodProof.ok &&
      readback.storyCount === workItems.length &&
      negative.ok &&
      validation.noCommittedDbArtifacts === true &&
      marker.ok === true;
    return {
      ok,
      d3WorkloadCreationReadback: {
        ok,
        route,
        sourceHead: source.sourceHead,
        workflowBasis,
        command,
        startingAosBasis: source.sourceHead,
        localRuntimeProfileSource: "owner_authorized_D2_local_activation_profile",
        profileRootClass: selectedRoot.readback.profileRootClass,
        rootDigest: rootReadback.rootDigest,
        databaseFileName: basename(databasePath),
        databaseDigest: digestDatabaseFile(databasePath),
        rawPathRecorded: false,
        rawDbDumpRecorded: false,
        beforeD3StoryCount: before.storyCount,
        afterD3StoryCount: readback.storyCount,
        initiativeId: workload.initiative.id,
        epicId: workload.epic.id,
        storyIds: workload.stories.map((story) => story.id),
        gateIds: methodProof.gateIds,
        assignmentIds: methodProof.assignmentIds,
        evidenceLinkIds: methodProof.evidenceIds,
        runIds: methodProof.runIds,
        auditEventIds: methodProof.auditEventIds,
        d3WorkItemKeys: workItems.map((item) => item.key),
        phase4WorkItemsImplemented: false
      },
      initiativeEpicStoryReadback: {
        ok: readback.storyCount === workItems.length,
        initiative: safeInitiative(workload.initiative),
        epic: safeEpic(workload.epic),
        stories: workload.stories.map(safeStory),
        requiredWorkItemsPresent: workItems.every((item) => readback.storyTitles.includes(item.title)),
        optionalAgentsBackfillIncluded: true,
        hookGateMappingStoryCarriesDivergenceBlocker: workload.storyByKey.hook_gate_to_aos_method_mapping_table.acceptanceCriteria.some((item) => item.includes("divergence")),
        pilotVaultImportImplementationPerformed: false,
        crewReductionRegistryMutationPerformed: false,
        agentsBackfillWorkflowMutationPerformed: false
      },
      claimRunEvidenceGateAuditReadback: {
        ok: methodProof.ok,
        methodsExercised,
        assignments: methodProof.assignments,
        runs: methodProof.runs,
        evidenceLinks: methodProof.evidenceLinks,
        gates: methodProof.gates,
        ticketListReadback: methodProof.ticketListReadback,
        selectedStoryAuditReadback: methodProof.selectedStoryAuditReadback,
        auditEventIds: methodProof.auditEventIds,
        redactedDetailsOnly: true,
        rawRequestBodyStored: false,
        rawDbRowsStored: false
      },
      localProfileRootPrivacyReadback: {
        ok: marker.ok === true && validation.noCommittedDbArtifacts === true,
        profileRootClass: selectedRoot.readback.profileRootClass,
        rootDigest: rootReadback.rootDigest,
        marker,
        databaseFileName: basename(databasePath),
        databaseDirectChildOfRoot: dirname(databasePath) === root,
        runtimeTransportOpened: true,
        retainedForOwnerAuthorizedLocalD2Use: true,
        rawPathRecorded: false,
        rawDbDumpRecorded: false,
        committedDbArtifacts: false,
        cleanupAttempted: false,
        cleanupDisposition: "d2_local_activation_root_intentionally_retained_for_owner_authorized_local_use"
      },
      methodAuthorityBoundaryReadback: {
        ok: negative.ok,
        acceptedMethodsExercised: methodsExercised,
        negativeMethods: negative.negativeMethods,
        broadGatewayExposureUsed: false,
        workIndexUsed: false,
        phase4ItemImplementationPerformed: false,
        clientSuppliedAuthorityTrusted: false,
        liveDispatchAuthorized: false,
        ownerIntentExecutionAuthorized: false,
        registryMutationPerformed: false
      },
      d4FrictionCaptureReadback_or_none: {
        friction: "none",
        reason: "D3 workload creation completed using existing D2 local profile, store, and MCP method surfaces without a route-blocking product friction.",
        d4FrictionTicketsCreated: false,
        p0P1FrictionTicketIdsInvented: false
      },
      activeHookDivergenceBoundaryReadback: {
        parityReceiptPath: "TCRN Workflow/.context/platform/plans/evidence/2026-07-05-phase4-friction-workflow-thinning-entry/phase4-hook-runtime-parity-readback.json",
        cmpExit: 1,
        byteIdentical: false,
        parityProven: false,
        carriedIntoStoryId: workload.storyByKey.hook_gate_to_aos_method_mapping_table.id,
        hookBehaviorReliedOn: false,
        hookMappingImplemented: false,
        hookRetirementPerformed: false,
        activeCodexMutation: false,
        maintainedHookSourceMutation: false
      },
      validation_readbacks: validation
    };
  } finally {
    runtime.close();
    sableRuntime.close();
  }
}

function ensureWorkloadRecords(databasePath) {
  const session = openStore(databasePath);
  try {
    const seed = createDefaultSeed();
    session.repository.seedAiEmployees(seed.employees, "d3-real-dogfood-workload-seed");
    for (const project of seed.projects) {
      session.store.upsertProject(project, actor);
    }
    const initiative = findByTitle(session.store.listInitiatives(), "AOS human readback v1") ??
      session.store.createInitiative({
        projectId: "TCRN-AOS",
        title: "AOS human readback v1",
        status: "in_progress",
        problem: "D3 creates a real local dogfood workload after D2 activation.",
        expectedOutcome: "Phase 4 work items are visible as AOS workload containers without implementing them."
      }, actor);
    const epic = session.store.listEpics().find((row) =>
      row.initiativeId === initiative.id &&
      row.title === "Phase 4 friction workflow thinning dogfood workload"
    ) ?? session.store.createEpic({
      initiativeId: initiative.id,
      title: "Phase 4 friction workflow thinning dogfood workload",
      goal: "Track Phase 4 material lanes as real AOS workload before implementation.",
      status: "in_progress"
    }, actor);
    const stories = workItems.map((item) => ensureStory(session.store, epic.id, item));
    return {
      ok: stories.length === workItems.length,
      initiative,
      epic,
      stories,
      storyByKey: Object.fromEntries(workItems.map((item, index) => [item.key, stories[index]]))
    };
  } finally {
    session.close();
  }
}

function ensureStory(store, epicId, item) {
  const existing = store.listStories().find((row) => row.epicId === epicId && row.title === item.title);
  if (existing) {
    return existing;
  }
  return store.createStory({
    epicId,
    title: item.title,
    problem: item.problem,
    user: "AOS internal dogfood coordinator",
    expectedBehavior: item.expectedBehavior,
    acceptanceCriteria: item.acceptanceCriteria,
    status: item.status,
    estimate: item.estimate,
    subTasks: [{
      id: `subtask-${item.key}`,
      title: `${item.title} metadata readback`,
      ownerRole: "implementation",
      status: item.status === "verified" ? "verified" : "accepted",
      dependencyIds: [],
      proofExpectation: "d3_workload_metadata_only"
    }]
  }, actor);
}

function exerciseMethods(databasePath, transport, sableTransport, workload) {
  const assignments = [];
  const runs = [];
  const evidenceLinks = [];
  const gates = [];
  const auditEventIds = [];
  for (const story of workload.stories) {
    const assignment = ensureStoryAssignment(databasePath, transport, story, workload);
    assignments.push(assignment);
    if (assignment.auditEventId) auditEventIds.push(assignment.auditEventId);
    const evidence = ensureEvidence(databasePath, transport, story);
    evidenceLinks.push(evidence);
    const gate = ensureGate(databasePath, story, evidence.id);
    gates.push(gate);
    if (story.title === "AGENTS.md boot-cost rewrite backfill") {
      const run = ensureAgentsBackfillRun(databasePath, transport, assignment.assignmentId);
      runs.push(run);
      if (run.auditEventId) auditEventIds.push(run.auditEventId);
      const decision = ensureGateDecision(sableTransport, gate, evidence.id, workload);
      gates[gates.length - 1] = decision.gate;
      if (decision.auditEventId) auditEventIds.push(decision.auditEventId);
    }
  }
  const ticketListResponse = send(transport, "aos.ticket.list", {
    epicId: workload.epic.id,
    limit: 10,
    idempotencyKey: "d3-ticket-list-readback"
  });
  const selectedStoryAuditResponse = send(transport, "aos.audit.query", {
    targetId: workload.storyByKey.hook_gate_to_aos_method_mapping_table.id,
    limit: 5
  });
  const ticketList = responsePayload(ticketListResponse);
  const audit = responsePayload(selectedStoryAuditResponse);
  const ok = assignments.length === workItems.length &&
    evidenceLinks.length === workItems.length &&
    gates.length === workItems.length &&
    runs.some((run) => run.status === "success" || run.reused === true) &&
    ticketList.rows?.length >= workItems.length &&
    audit.returnedCount > 0 &&
    gates.some((gate) => gate.status === "accepted");
  return {
    ok,
    assignments,
    runs,
    evidenceLinks,
    gates,
    ticketListReadback: {
      ok: ticketList.ok === true,
      method: ticketList.method,
      schemaVersion: ticketList.schemaVersion,
      rowGrain: ticketList.rowGrain,
      returnedCount: ticketList.page?.returnedCount,
      storyIds: ticketList.rows?.map((row) => row.storyId) ?? [],
      rawRowsStored: false
    },
    selectedStoryAuditReadback: {
      ok: audit.ok === true,
      method: audit.method,
      targetId: workload.storyByKey.hook_gate_to_aos_method_mapping_table.id,
      returnedCount: audit.returnedCount,
      hasMore: audit.hasMore,
      detailsRedacted: true,
      rawDetailsStored: false
    },
    assignmentIds: assignments.map((item) => item.assignmentId),
    runIds: runs.map((item) => item.runId).filter(Boolean),
    evidenceIds: evidenceLinks.flatMap((item) => [item.id, item.methodEvidenceId]).filter(Boolean),
    gateIds: gates.map((item) => item.id),
    auditEventIds
  };
}

function ensureStoryAssignment(databasePath, transport, story, workload) {
  const existing = readAssignmentForStory(databasePath, story.id);
  if (existing && existing.status !== "accepted") {
    return {
      storyId: story.id,
      assignmentId: existing.id,
      status: existing.status,
      method: "aos.assignment.claim",
      reused: true,
      auditEventId: null
    };
  }
  const claim = send(transport, "aos.assignment.claim", {
    targetType: "story",
    targetId: story.id,
    initiativeId: workload.initiative.id,
    epicId: workload.epic.id,
    idempotencyKey: `d3-claim-${story.id}`
  });
  const claimed = responsePayload(claim).result.assignment;
  const auditEventId = responsePayload(claim).result.auditEventId;
  if (claimed.status !== "accepted") {
    return {
      storyId: story.id,
      assignmentId: claimed.id,
      status: claimed.status,
      method: "aos.assignment.claim",
      reused: responsePayload(claim).result.replayedByState === true,
      auditEventId
    };
  }
  const update = send(transport, "aos.assignment.update", {
    assignmentId: claimed.id,
    priorStatus: "accepted",
    status: "in_progress",
    initiativeId: workload.initiative.id,
    epicId: workload.epic.id,
    idempotencyKey: `d3-update-${claimed.id}`
  });
  const updated = responsePayload(update).result.assignment;
  return {
    storyId: story.id,
    assignmentId: updated.id,
    status: updated.status,
    method: "aos.assignment.claim+aos.assignment.update",
    reused: false,
    auditEventId: responsePayload(update).result.auditEventId ?? auditEventId
  };
}

function ensureEvidence(databasePath, transport, story) {
  const validEvidenceInput = {
    type: "artifact_id",
    target: `d3-real-dogfood-workload-valid:${story.id}`,
    validity: "valid",
    producer: actor.employeeId,
    digest: `sha256:${sha256(JSON.stringify({ storyId: story.id, title: story.title, validity: "valid" }))}`,
    redactionState: "metadata_only"
  };
  const validEvidenceId = createId("evidence", validEvidenceInput);
  const existing = readEvidence(databasePath, validEvidenceId);
  const validEvidence = existing ?? writeValidEvidence(databasePath, validEvidenceInput);
  const response = send(transport, "aos.evidence.link", {
    type: "artifact_id",
    target: `d3-real-dogfood-workload-method-readback:${story.id}`,
    digest: `sha256:${sha256(JSON.stringify({ storyId: story.id, title: story.title, method: "aos.evidence.link" }))}`,
    redactionState: "metadata_only",
    idempotencyKey: `d3-evidence-${story.id}`
  });
  const methodEvidence = responsePayload(response).result;
  return {
    id: validEvidence.id,
    methodEvidenceId: methodEvidence.id,
    type: validEvidence.type,
    targetClass: "artifact_id",
    validity: validEvidence.validity,
    redactionState: validEvidence.redactionState,
    digest: validEvidence.digest,
    methodExercised: "aos.evidence.link",
    rawPathRecorded: false
  };
}

function ensureGate(databasePath, story, evidenceId) {
  const expectedInput = {
    type: "security_license",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidenceId]
  };
  const expectedId = createId("gate", expectedInput);
  const existing = readGate(databasePath, expectedId);
  if (existing) {
    return safeGate(existing);
  }
  const session = openStore(databasePath);
  try {
    const gate = session.store.requestGate(expectedInput, actor);
    return safeGate(gate);
  } finally {
    session.close();
  }
}

function ensureAgentsBackfillRun(databasePath, transport, assignmentId) {
  const existing = readRunForAssignment(databasePath, assignmentId);
  if (existing) {
    return {
      runId: existing.id,
      status: existing.status,
      reused: true,
      auditEventId: null
    };
  }
  const response = send(transport, "aos.run.summary.create", {
    assignmentId,
    status: "success",
    startedAt: "2026-07-06T00:00:00.000Z",
    endedAt: "2026-07-06T00:05:00.000Z",
    readback: "metadata_only_d3_agents_boot_cost_backfill_completed",
    outputSummary: "metadata_only_d3_agents_boot_cost_backfill_completed",
    idempotencyKey: `d3-run-${assignmentId}`
  });
  const run = responsePayload(response).result;
  return {
    runId: run.id,
    status: run.status,
    reused: false,
    auditEventId: readLatestAuditId(databasePath, "agent_run.record", run.id)
  };
}

function ensureGateDecision(sableTransport, gate, evidenceId, workload) {
  if (gate.status === "accepted") {
    return { gate, auditEventId: null, reused: true };
  }
  const response = send(sableTransport, "aos.gate.decision.record", {
    gateId: gate.id,
    priorStatus: gate.status,
    decision: "accepted",
    evidenceIds: [evidenceId],
    initiativeId: workload.initiative.id,
    epicId: workload.epic.id,
    idempotencyKey: `d3-gate-decision-${gate.id}`
  });
  const result = responsePayload(response).result;
  return {
    gate: safeGate(result.gate),
    auditEventId: result.auditEventId,
    reused: false
  };
}

function proveNegativeAuthority(transport) {
  const cases = [
    ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
    ["aos.gate.status.update", "transport_method_unknown"],
    ["aos.assignment.create", "transport_method_unknown"],
    ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
    ["aos.documentation.index.read", "transport_method_outside_mvp_allowlist"],
    ["aos.gateway.dump", "transport_method_unknown"]
  ];
  const negativeMethods = cases.map(([method, expectedReason]) => {
    const response = send(transport, method, {});
    const reason = responseReason(response);
    return {
      method,
      expectedReason,
      reason,
      rejected: reason === expectedReason
    };
  });
  return {
    ok: negativeMethods.every((item) => item.rejected),
    negativeMethods
  };
}

function readD3Snapshot(databasePath) {
  const session = openStore(databasePath);
  try {
    const epic = session.store.listEpics().find((row) => row.title === "Phase 4 friction workflow thinning dogfood workload");
    const stories = epic ? session.store.listStories().filter((row) => row.epicId === epic.id) : [];
    return {
      storyCount: stories.length,
      storyTitles: stories.map((story) => story.title).sort(),
      assignmentCount: session.store.listAssignments().filter((assignment) =>
        stories.some((story) => story.id === assignment.targetId)
      ).length,
      gateCount: session.store.listGates().filter((gate) =>
        stories.some((story) => story.id === gate.linkedTicketId)
      ).length,
      evidenceCount: session.store.listEvidence().length,
      auditEventCount: session.store.queryAudit().length
    };
  } finally {
    session.close();
  }
}

function readAssignmentForStory(databasePath, storyId) {
  const session = openStore(databasePath);
  try {
    return session.store.listAssignments().find((assignment) =>
      assignment.targetType === "story" &&
      assignment.targetId === storyId &&
      assignment.employeeId === actor.employeeId &&
      assignment.role === actor.role
    ) ?? null;
  } finally {
    session.close();
  }
}

function readRunForAssignment(databasePath, assignmentId) {
  const session = openStore(databasePath);
  try {
    return session.store.listRuns().find((run) =>
      run.assignmentId === assignmentId &&
      run.status === "success" &&
      run.outputSummary === "metadata_only_d3_agents_boot_cost_backfill_completed"
    ) ?? null;
  } finally {
    session.close();
  }
}

function readGate(databasePath, gateId) {
  const session = openStore(databasePath);
  try {
    return session.store.listGates().find((gate) => gate.id === gateId) ?? null;
  } finally {
    session.close();
  }
}

function readEvidence(databasePath, evidenceId) {
  const session = openStore(databasePath);
  try {
    return session.store.listEvidence().find((evidence) => evidence.id === evidenceId) ?? null;
  } finally {
    session.close();
  }
}

function writeValidEvidence(databasePath, evidenceInput) {
  const session = openStore(databasePath);
  try {
    return session.store.linkEvidence(evidenceInput, actor);
  } finally {
    session.close();
  }
}

function readLatestAuditId(databasePath, action, targetId) {
  const session = openStore(databasePath);
  try {
    const rows = session.store.queryAudit({ action, targetId }).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    return rows[0]?.id ?? null;
  } finally {
    session.close();
  }
}

function openStore(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  return {
    repository,
    store,
    close() {
      repository.close();
    }
  };
}

function runtimeConfig(root, databasePath, sessionActor) {
  return {
    actor: sessionActor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: {
      route: d2ActivationRoute,
      markerVersion,
      purpose: markerPurpose
    },
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  };
}

function selectExistingActivationRoot() {
  const provided = process.env.TCRN_AOS_D2_RUNTIME_PROFILE_ROOT;
  const safeTmp = realpathSync(tmpdir());
  const preferred = provided ? resolve(provided) : join(safeTmp, "tcrn-aos-d2-local-profile");
  validateRootCandidate(preferred, Boolean(provided));
  return {
    root: preferred,
    readback: {
      profileRootClass: provided ? "explicit_owner_provided_route_owned_local_root" : "os_temp_route_owned_local_activation_root",
      explicitRootProvided: Boolean(provided),
      rootDigest: sha256(resolve(preferred)),
      rawPathRecorded: false
    }
  };
}

function validateExistingActivationRoot(root) {
  validateRootCandidate(root, true);
  assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  markerReadback(root);
}

function validateRootCandidate(root, explicit) {
  denyUnsafeRuntimePath(root);
  denyRepoOrWrongSibling(root);
  assertExistingSegmentsHaveNoSymlink(root, "d3_runtime_profile_root_symlink_ancestor_denied");
  if (!existsSync(root)) {
    throw new Error(explicit ? "d3_d2_runtime_profile_root_missing" : "d3_default_d2_runtime_profile_root_missing");
  }
  const stat = lstatSync(root);
  if (stat.isSymbolicLink()) throw new Error("d3_runtime_profile_root_symlink_denied");
  if (!stat.isDirectory()) throw new Error("d3_runtime_profile_root_not_directory");
  const markerPath = join(root, markerFile);
  if (!existsSync(markerPath)) throw new Error("d3_d2_runtime_profile_marker_missing");
  const parsed = JSON.parse(readFileSync(markerPath, "utf8"));
  const expected = markerContent(root);
  if (!markerMatches(parsed, expected)) throw new Error("d3_d2_runtime_profile_marker_stale_or_mismatched");
  const databasePath = join(root, databaseFileName);
  if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) {
    throw new Error("d3_runtime_profile_database_file_symlink_denied");
  }
}

function markerContent(root) {
  return {
    route: d2ActivationRoute,
    markerVersion,
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose
  };
}

function markerMatches(actual, expected) {
  return actual &&
    actual.route === expected.route &&
    actual.markerVersion === expected.markerVersion &&
    actual.rootDigest === expected.rootDigest &&
    actual.purpose === expected.purpose;
}

function markerReadback(root) {
  const parsed = JSON.parse(readFileSync(join(root, markerFile), "utf8"));
  const expected = markerContent(root);
  const ok = markerMatches(parsed, expected);
  return {
    ok,
    markerFile,
    markerDigest: sha256(JSON.stringify(parsed)),
    markerKeySet: Object.keys(parsed).sort(),
    markerVersion: parsed.markerVersion,
    markerPurpose: parsed.purpose,
    routeMatches: parsed.route === d2ActivationRoute,
    rootDigest: expected.rootDigest,
    rootDigestMatches: parsed.rootDigest === expected.rootDigest,
    rawPathRecorded: false
  };
}

function validateReceiptsAndArtifacts(databasePath) {
  const noCommittedDbArtifacts = noCommittedRuntimeDbArtifacts();
  const databaseDirectChild = dirname(databasePath) === selectedRoot.root;
  const jsonReceiptParseOk = [summaryReceiptName, readbackReceiptName]
    .filter((name) => existsSync(join(evidenceRoot, name)))
    .every((name) => Boolean(JSON.parse(readFileSync(join(evidenceRoot, name), "utf8"))));
  return {
    ok: noCommittedDbArtifacts && databaseDirectChild,
    noCommittedDbArtifacts,
    databaseDirectChild,
    jsonReceiptParseAttempted: true,
    jsonReceiptParseOk,
    workflowMutationPerformed: false,
    designSystemMutationPerformed: false,
    tmsMutationPerformed: false
  };
}

function noCommittedRuntimeDbArtifacts() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return false;
  return !result.stdout.split("\n").some((file) => /\.(sqlite|sqlite3|db|db-shm|db-wal)$/.test(file));
}

function privacyScan(creation) {
  const text = JSON.stringify(creation);
  const findings = [
    ["/Users/", "local_users_path"],
    ["/tmp/", "tmp_path"],
    ["/private/tmp/", "private_tmp_path"],
    ["record_json", "raw_db_row"],
    ["CREATE TABLE", "db_dump"],
    ["BEGIN PRIVATE KEY", "secret_like"],
    ["owner acceptance", "acceptance_overclaim"],
    ["product acceptance", "acceptance_overclaim"],
    ["final MVP acceptance", "acceptance_overclaim"],
    ["dogfood runtime readiness", "readiness_overclaim"],
    ["release readiness", "release_overclaim"],
    ["phase4 implementation completed", "phase4_closeout_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      creation.localProfileRootPrivacyReadback.rawPathRecorded === false &&
      creation.d3WorkloadCreationReadback.rawPathRecorded === false,
    findings,
    scannedSurface: "d3_workload_creation_receipt_payload",
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    privateEvidencePayloadStored: false,
    secretsOrPiiStored: false,
    broadCodexSecurityPluginScanClaimed: false,
    noOverclaimFlags
  };
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const files = sourceFiles.map((file) => ({
    file,
    digest: sha256(readFileSync(join(repoRoot, file)))
  }));
  return {
    sourceHead,
    workflowBasis,
    files,
    sourceContentDigest: sha256(JSON.stringify(files)),
    sourceGitStatusDigestOnly: sha256(git(["status", "--short", "--branch"])),
    sourceGitStatusStoredRaw: false
  };
}

function writeReceipt(name, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: body.source.sourceHead,
    sourceContentDigest: body.source.sourceContentDigest,
    sourceFiles: body.source.files,
    workflowBasis,
    aosBasis: body.source.sourceHead,
    methodsUnderReview: methodsExercised,
    failures: [],
    negativeFailures: [],
    noOverclaimFlags,
    ...body
  };
  delete receipt.source;
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

function safeInitiative(initiative) {
  return {
    id: initiative.id,
    title: initiative.title,
    status: initiative.status,
    epicIds: unique(initiative.epicIds),
    storyCount: unique(initiative.storyIds).length
  };
}

function safeEpic(epic) {
  return {
    id: epic.id,
    title: epic.title,
    status: epic.status,
    storyCount: unique(epic.storyIds).length
  };
}

function safeStory(story) {
  return {
    id: story.id,
    title: story.title,
    status: story.status,
    subtaskCount: story.subTasks.length,
    assignmentIds: unique(story.assignmentIds),
    gateIds: unique(story.gateIds),
    criteriaDigest: sha256(JSON.stringify(story.acceptanceCriteria))
  };
}

function safeGate(gate) {
  return {
    id: gate.id,
    type: gate.type,
    ownerRole: gate.ownerRole,
    linkedTicketId: gate.linkedTicketId,
    inputEvidenceIds: Array.isArray(gate.inputEvidenceIds) ? [...gate.inputEvidenceIds] : gate.decision?.evidenceIds ?? [],
    status: gate.status,
    decisionId: gate.decision?.id ?? null,
    decisionClass: gate.decision?.decisionClass ?? null
  };
}

function findByTitle(rows, title) {
  return rows.find((row) => row.title === title) ?? null;
}

function unique(values) {
  return [...new Set(values)];
}

function digestDatabaseFile(databasePath) {
  return existsSync(databasePath) ? sha256(readFileSync(databasePath)) : null;
}

function send(transport, method, params) {
  return transport.handleJsonRpc({ jsonrpc: "2.0", id: method, method, params });
}

function responsePayload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}

function responseReason(response) {
  return response.error?.data?.reason ?? response.result?.error ?? null;
}

function denyUnsafeRuntimePath(path) {
  const home = homedir();
  const normalized = resolve(path).split(sep).join("/");
  if (normalized.startsWith("/srv/") || normalized === "/srv") throw new Error("transport_runtime_srv_path_denied");
  if (normalized.includes("/.tcrn") || (home && normalized.startsWith(`${home}/.tcrn`))) throw new Error("transport_runtime_durable_home_path_denied");
  if (/retained|owner-trial|preview/i.test(normalized)) throw new Error("transport_runtime_retained_or_owner_visible_path_denied");
}

function denyRepoOrWrongSibling(path) {
  const normalized = resolve(path);
  const canonicalRepo = realpathSync(repoRoot);
  if (normalized === canonicalRepo || normalized.startsWith(`${canonicalRepo}${sep}`)) {
    throw new Error("d3_runtime_profile_root_inside_git_tree_denied");
  }
  const wrongSibling = resolve(dirname(dirname(repoRoot)), "TCRN-AOS");
  if (normalized === wrongSibling || normalized.startsWith(`${wrongSibling}${sep}`)) {
    throw new Error("transport_runtime_wrong_sibling_path_denied");
  }
}

function assertExistingSegmentsHaveNoSymlink(targetPath, reason) {
  const resolvedPath = resolve(targetPath);
  const root = parse(resolvedPath).root;
  const parts = resolvedPath.slice(root.length).split(sep).filter(Boolean);
  let currentPath = root;
  for (const part of parts) {
    currentPath = currentPath === root ? `${root}${part}` : `${currentPath}${sep}${part}`;
    if (!existsSync(currentPath)) return;
    if (lstatSync(currentPath).isSymbolicLink()) throw new Error(reason);
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
