import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";
import { createWorkReadbackApiResponse } from "../dist/apps/api/src/work-readback.js";

const route = "route_tcrn_conditional_dogfood_start_df04_friction_backfill_implementation_ilya_after_plan_pm_acceptance_64383fe_d31045_20260707";
const workflowBasis = "64383fe37bf6d852ad13d06b819497a9add42e97";
const planBasis = workflowBasis;
const incomingAosBasis = "d31045be79dd30a8a6aaeb47253b6a1aaf49795a";
const p1Route = "route_tcrn_conditional_dogfood_start_p1_durable_runtime_profile_root_migration_ilya_after_owner_decision_949a58_8aa904_20260707";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/conditional-dogfood-start-df04-friction-backfill");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const command = "pnpm --dir TCRN-AOS df04:friction-backfill-proof";
const markerFile = ".tcrn-aos-phase1-root";
const ownerMarkerFile = ".aos-persistent-runtime-owner.json";
const markerPurpose = "p1-clean-start-durable-runtime-profile-root";
const markerVersion = "conditional-dogfood-start-p1-runtime-profile.v1";
const databaseFileName = "aos-p1-durable-runtime-profile.sqlite";
const summaryReceiptName = "df04-friction-backfill-proof-summary.json";
const readbackReceiptName = "df04-friction-backfill-readback.json";
const captureKeyPrefix = "conditional-dogfood-start-df04-friction-backfill";
const sourceFiles = [
  "package.json",
  "scripts/df04-friction-backfill-proof.mjs",
  "scripts/df04-live-friction-capture-proof.mjs",
  "packages/domain/src/store.ts",
  "packages/mcp-server/src/transport.ts",
  "apps/api/src/work-readback.ts"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "df04-friction-backfill"
};
const noOverclaimFlags = {
  df04FrictionBackfillImplemented: true,
  fr001Fr002TicketLevelOnly: true,
  fr003StandaloneTicketCreated: false,
  fr003LinkedUnderFr001: true,
  p0P1ClassificationPerformed: false,
  frictionFixImplemented: false,
  phase3ReevaluationStarted: false,
  phase3AcceptanceClaimed: false,
  df04FullCompletionClaimed: false,
  universalNoFrictionClaimed: false,
  readinessClaimed: false,
  releasePublicationPushClaimed: false,
  ownerFacingAcceptanceClaimed: false,
  phase4BroadCloseoutClaimed: false,
  phase5Started: false,
  workflowMutation: false,
  designSystemMutation: false,
  tmsMutation: false,
  activeCodexMutation: false,
  maintainedHookSourceMutation: false,
  registryDefaultMutation: false,
  generatedAgentMutation: false,
  liveDispatchAuthorized: false,
  ownerIntentExecutionAuthorized: false,
  hookBehaviorReliedOn: false,
  hookRetirementPerformed: false,
  broadActiveParityClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};
const sourceEvidence = {
  "FR-001": {
    label: "FR-001",
    category: "DF-01 active/source hook digest divergence blocked materialization",
    summaryDigest: sha256("active/source hook digest mismatch blocked materialization and required Minerva adjudication plus Verity recheck before Ilya no-op retry"),
    evidenceKeys: [
      "df01_initial_ilya_divergence_stop",
      "df01_minerva_hook_divergence_adjudication",
      "df01_verity_recheck_digest_identity",
      "df01_ilya_noop_retry",
      "df01_mara_pm_status_classification"
    ],
    digestFacts: {
      initialActiveHookDigest: "042cb1ae83cca69f6bfbcd62805e5b6d1a4dcaf13081ffda36784eab826d179d",
      acceptedMaintainedHookDigest: "cf4fe5133f52794ac55b40b87727a184c2251ec57d04ef70665ef95dec169404",
      initialCmpExit: 1,
      recheckCmpExit: 0
    }
  },
  "FR-002": {
    label: "FR-002",
    category: "DF-02 status ownership/checkpoint authority mismatch",
    summaryDigest: sha256("wrong-owner Minerva status sync, Mara checkpoint block, Minerva enforcement repair, and Mara retry checkpoint were required before the generated status checkpoint could become durable"),
    evidenceKeys: [
      "df02_wrong_owner_status_sync_block",
      "df02_status_sync_ownership_policy_repair",
      "df02_mara_generated_checkpoint_block",
      "df02_minerva_checkpoint_enforcement_repair",
      "df02_mara_retry_checkpoint"
    ],
    basisFacts: {
      policyRepairWorkflowBasis: "3dffde7f5a101ef552b13bb775a34f075e9109b3",
      checkpointEnforcementRepairWorkflowBasis: "3f4d82d5d52ad8fcc4551db9bdbda4e662408fec",
      durableCheckpointWorkflowBasis: "1dcb1265ec3845feb9d51cd5f377ddce0a5aedb0",
      generatedStatusFileCount: 5
    }
  },
  "FR-003": {
    label: "FR-003",
    category: "DF-01 implementation-start routing inflation",
    summaryDigest: sha256("DF-01 implementation-start routing inflated beyond one direct route because the divergence stop required adjudication, recheck, retry, no-op proof, review, and PM classification"),
    evidenceKeys: [
      "df01_ilya_targeted_adjudication_required",
      "df01_minerva_repair",
      "df01_verity_recheck",
      "df01_ilya_retry_noop",
      "df01_review_and_pm_status_chain"
    ],
    firstPassDisposition: "linked_subfinding_under_FR-001_not_standalone_ticket"
  }
};
const frictionDefinitions = [
  {
    label: "FR-001",
    title: "FR-001: DF-01 hook digest divergence blocked materialization",
    category: sourceEvidence["FR-001"].category,
    problem: "DF-01 materialization was blocked by active/source hook digest divergence before Minerva adjudication and Verity recheck.",
    expectedBehavior: "Hook/source divergence that blocks materialization is captured as a real AOS friction ticket with digest-backed evidence and no fix or classification claim.",
    acceptanceCriteria: [
      "FR-001 ticket id is durable and idempotent",
      "source evidence digest is recorded without raw hook content",
      "FR-003 subfinding is linked under this ticket",
      "Mara P0/P1 classification remains downstream"
    ],
    evidence: sourceEvidence["FR-001"]
  },
  {
    label: "FR-002",
    title: "FR-002: DF-02 status ownership/checkpoint authority mismatch",
    category: sourceEvidence["FR-002"].category,
    problem: "DF-02 generated status became durable only after wrong-owner and checkpoint-authority repairs.",
    expectedBehavior: "Status ownership and checkpoint authority friction is captured as a real AOS friction ticket with durable comment and audit readback.",
    acceptanceCriteria: [
      "FR-002 ticket id is durable and idempotent",
      "status ownership and checkpoint repair basis values are represented",
      "no generated Workflow status files are mutated by this AOS lane",
      "Mara P0/P1 classification remains downstream"
    ],
    evidence: sourceEvidence["FR-002"]
  }
];
const fr003SubtaskId = `subtask_${sha256("FR-003:DF-01 implementation-start routing inflation").slice(0, 16)}`;

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const selectedRoot = selectP1DurableRoot();
const databasePath = join(selectedRoot.root, databaseFileName);
const proof = runBackfillProof(selectedRoot.root, databasePath);
const privacy = privacyScan(proof);
const receipt = writeReceipt(readbackReceiptName, {
  ok: proof.ok && privacy.ok,
  source,
  selectedRoot: selectedRoot.readback,
  materializedFrictionRecords: proof.materializedFrictionRecords,
  fr003LinkedSubfindingReadback: proof.fr003LinkedSubfindingReadback,
  workReadbackTimelineVisibilityReadback: proof.workReadbackTimelineVisibilityReadback,
  idempotencyReplayReadback: proof.idempotencyReplayReadback,
  privacyNoArtifactNoOverclaimReadback: proof.privacyNoArtifactNoOverclaimReadback,
  methodAuthorityBoundaryReadback: proof.methodAuthorityBoundaryReadback,
  localProfileRootPrivacyReadback: proof.localProfileRootPrivacyReadback,
  sourceEvidenceMappingReadback: proof.sourceEvidenceMappingReadback,
  validation_readbacks: proof.validation_readbacks,
  privacyNoOverclaimScan: privacy,
  failures: [...proof.failures, ...privacy.findings.map((finding) => finding.kind)],
  negativeFailures: proof.negativeFailures,
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
  readbackReceiptDigest: sha256(JSON.stringify(receipt)),
  frLabelToAosIdTable: receipt.materializedFrictionRecords.map((record) => ({
    label: record.label,
    ticketId: record.ticketId ?? null,
    commentId: record.commentId,
    auditEventId: record.auditEventId,
    linkage: record.linkage
  })),
  fr003LinkedUnderFr001: receipt.fr003LinkedSubfindingReadback.ok,
  noOverclaimFlags,
  failures: receipt.ok === true ? [] : ["df04_friction_backfill_readback_not_ok"],
  negativeFailures: proof.negativeFailures
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  route,
  command,
  receipts: [summaryReceiptName, readbackReceiptName],
  materializedFrictionRecords: receipt.materializedFrictionRecords.map((record) => ({
    label: record.label,
    ticketId: record.ticketId ?? null,
    commentId: record.commentId,
    auditEventId: record.auditEventId,
    linkage: record.linkage
  })),
  workReadbackVisible: receipt.workReadbackTimelineVisibilityReadback.ok,
  idempotentReplayNoDuplicate: receipt.idempotencyReplayReadback.ok,
  rawPathRecorded: false,
  p0P1ClassificationPerformed: false,
  phase3ReevaluationStarted: false
}, null, 2));

function runBackfillProof(root, databasePath) {
  validateP1DurableRoot(root, databasePath);
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  seedAuthorityRows(databasePath);

  const firstEnsure = ensureFrictionBackfillRecords(root, databasePath);
  const secondEnsure = ensureFrictionBackfillRecords(root, databasePath);
  const restart = readRestartReadback(databasePath, firstEnsure.records);
  const workReadback = createBackfillReadbackVisibility(databasePath, [...firstEnsure.records, firstEnsure.fr003]);
  const negative = proveNegativeAuthority(root, databasePath);
  const validation = validateReceiptsAndArtifacts(databasePath);
  const marker = markerReadback(root);
  const idempotency = compareBackfillEnsures(firstEnsure, secondEnsure);
  const ok = firstEnsure.ok &&
    secondEnsure.ok &&
    restart.ok &&
    workReadback.ok &&
    idempotency.ok &&
    negative.ok &&
    validation.noCommittedDbArtifacts &&
    marker.ok;
  const failures = [
    firstEnsure.ok ? null : "df04_backfill_first_ensure_not_ok",
    secondEnsure.ok ? null : "df04_backfill_second_ensure_not_ok",
    restart.ok ? null : "df04_backfill_restart_readback_not_ok",
    workReadback.ok ? null : "df04_backfill_work_readback_not_visible",
    idempotency.ok ? null : "df04_backfill_idempotency_not_ok",
    negative.ok ? null : "df04_backfill_negative_authority_not_ok",
    validation.noCommittedDbArtifacts ? null : "df04_backfill_committed_db_artifact_found",
    marker.ok ? null : "df04_backfill_p1_marker_not_ok"
  ].filter(Boolean);

  return {
    ok,
    failures,
    negativeFailures: negative.negativeMethods.filter((item) => !item.rejected).map((item) => item.method),
    materializedFrictionRecords: [
      ...firstEnsure.records.map((record) => ({
        label: record.label,
        ticketId: record.ticketId,
        storyTitle: record.storyTitle,
        category: record.category,
        commentId: record.commentId,
        commentAuditEventId: record.commentAuditEventId,
        auditEventId: record.auditEventId,
        auditAction: record.auditAction,
        sourceEvidenceDigest: record.sourceEvidenceDigest,
        capturedTicketIds: [record.ticketId],
        capturedTicketCount: 1,
        p0P1ClassificationClaimed: false,
        frictionFixImplemented: false,
        phase3ReevaluationStarted: false,
        linkage: record.linkage,
        rawCommentBodyStoredInReceipt: false,
        rawAuditDetailsStoredInReceipt: false
      })),
      {
        label: "FR-003",
        ticketId: null,
        parentTicketId: firstEnsure.fr003.parentTicketId,
        subfindingId: firstEnsure.fr003.subtaskId,
        category: firstEnsure.fr003.category,
        commentId: firstEnsure.fr003.commentId,
        commentAuditEventId: firstEnsure.fr003.commentAuditEventId,
        auditEventId: firstEnsure.fr003.auditEventId,
        auditAction: firstEnsure.fr003.auditAction,
        sourceEvidenceDigest: firstEnsure.fr003.sourceEvidenceDigest,
        capturedTicketIds: [],
        capturedTicketCount: 0,
        p0P1ClassificationClaimed: false,
        frictionFixImplemented: false,
        phase3ReevaluationStarted: false,
        linkage: firstEnsure.fr003.linkage,
        standaloneTicketCreated: false,
        rawCommentBodyStoredInReceipt: false,
        rawAuditDetailsStoredInReceipt: false
      }
    ],
    fr003LinkedSubfindingReadback: firstEnsure.fr003,
    workReadbackTimelineVisibilityReadback: workReadback,
    idempotencyReplayReadback: idempotency,
    privacyNoArtifactNoOverclaimReadback: {
      ok: validation.noCommittedDbArtifacts,
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      committedDbArtifacts: false,
      secretsOrPiiStored: false,
      privateOwnerPayloadStored: false,
      p0P1ClassificationPerformed: false,
      phase3ReevaluationStarted: false,
      readinessClaimed: false,
      releasePublicationPushClaimed: false,
      ownerFacingAcceptanceClaimed: false
    },
    methodAuthorityBoundaryReadback: {
      ok: negative.ok,
      acceptedMethodsExercised: ["aos.ticket.comment", "aos.ticket.list", "aos.audit.query"],
      storeActionsExercised: ["story.create", "story.subtask.add", "friction.backfill.record", "friction.backfill.subfinding.link"],
      negativeMethods: negative.negativeMethods,
      broadGatewayExposureUsed: false,
      workIndexUsed: false,
      rawDbExportUsed: false,
      clientSuppliedAuthorityTrusted: false,
      liveDispatchAuthorized: false,
      ownerIntentExecutionAuthorized: false
    },
    localProfileRootPrivacyReadback: {
      ok: marker.ok && validation.noCommittedDbArtifacts,
      profileRootClass: selectedRoot.readback.profileRootClass,
      selectedRootDigest: selectedRoot.readback.selectedRootDigest,
      sqliteRootDigest: rootReadback.rootDigest,
      marker,
      databaseFileName: basename(databasePath),
      databaseDigest: digestDatabaseFile(databasePath),
      databaseDirectChildOfRoot: dirname(databasePath) === root,
      rawPathRecorded: false,
      rawDbDumpRecorded: false,
      committedDbArtifacts: false,
      cleanupAttempted: false,
      cleanupDisposition: "p1_durable_profile_retained_for_owner_authorized_conditional_dogfood_start"
    },
    sourceEvidenceMappingReadback: buildSourceEvidenceMappingReadback([...firstEnsure.records, firstEnsure.fr003]),
    validation_readbacks: validation
  };
}

function ensureFrictionBackfillRecords(root, databasePath) {
  const base = ensureBackfillContainers(databasePath);
  const ticketStories = new Map(frictionDefinitions.map((definition) => [
    definition.label,
    ensureFrictionStory(databasePath, base.epic.id, definition)
  ]));
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    const records = frictionDefinitions.map((definition) => ensureFrictionTicket(runtime.transport, databasePath, definition, ticketStories.get(definition.label)));
    const fr001 = records.find((record) => record.label === "FR-001");
    const fr003 = ensureFr003Subfinding(runtime.transport, databasePath, fr001);
    const counts = backfillCounts(databasePath, records, fr003);
    return {
      ok: records.every((record) => record.ok) &&
        fr003.ok &&
        counts.storyDuplicateCount === 0 &&
        counts.commentDuplicateCount === 0 &&
        counts.auditDuplicateCount === 0 &&
        counts.fr003StandaloneStoryCount === 0,
      initiativeId: base.initiative.id,
      epicId: base.epic.id,
      records,
      fr003,
      counts
    };
  } finally {
    runtime.close();
  }
}

function ensureBackfillContainers(databasePath) {
  const session = openStore(databasePath);
  try {
    const seed = createDefaultSeed();
    const project = seed.projects.find((item) => item.id === "TCRN-AOS");
    session.store.upsertProject(project, actor);
    const initiative = session.store.listInitiatives().find((item) => item.title === "Conditional dogfood start") ??
      session.store.createInitiative({
        projectId: "TCRN-AOS",
        title: "Conditional dogfood start",
        status: "in_progress",
        problem: "Conditional dogfood start needs durable AOS records for live work, status, and friction capture.",
        expectedOutcome: "Backfilled friction items are real AOS tickets with redacted readback and downstream PM classification boundaries."
      }, actor);
    const epic = session.store.listEpics().find((item) => item.initiativeId === initiative.id && item.title === "DF-04 friction backfill") ??
      session.store.createEpic({
        initiativeId: initiative.id,
        title: "DF-04 friction backfill",
        goal: "Materialize accepted DF-04 friction findings as AOS ticket records without fixing or classifying them.",
        status: "in_progress"
      }, actor);
    return { ok: true, initiative, epic };
  } finally {
    session.close();
  }
}

function ensureFrictionTicket(transport, databasePath, definition, story) {
  const comment = ensureFrictionComment(transport, databasePath, story.id, definition);
  const audit = ensureFrictionAudit(databasePath, story.id, definition, comment);
  return {
    ok: Boolean(story?.id && comment.ok && audit.ok),
    label: definition.label,
    category: definition.category,
    ticketId: story.id,
    storyTitle: story.title,
    commentId: comment.commentId,
    commentAuditEventId: comment.commentAuditEventId,
    auditEventId: audit.auditEventId,
    auditAction: "friction.backfill.record",
    sourceEvidenceDigest: sourceEvidenceDigest(definition.evidence),
    linkage: "ticket_level_friction_record",
    reusedExistingStory: story.reusedExistingStory,
    reusedExistingComment: comment.reusedExistingComment,
    reusedExistingAudit: audit.reusedExistingAudit
  };
}

function ensureFrictionStory(databasePath, epicId, definition) {
  const session = openStore(databasePath);
  try {
    const existing = session.store.listStories().find((item) => item.epicId === epicId && item.title === definition.title);
    if (existing) {
      return { ...existing, reusedExistingStory: true };
    }
    const story = session.store.createStory({
      epicId,
      title: definition.title,
      problem: definition.problem,
      user: "conditional dogfood start participants and reviewers",
      expectedBehavior: definition.expectedBehavior,
      acceptanceCriteria: definition.acceptanceCriteria,
      status: "accepted",
      estimate: { effortPoints: 2, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" },
      subTasks: []
    }, actor);
    return { ...story, reusedExistingStory: false };
  } finally {
    session.close();
  }
}

function ensureFrictionComment(transport, databasePath, ticketId, definition) {
  const body = frictionCommentBody(definition);
  const existing = findCommentByBodyDigest(databasePath, ticketId, body);
  if (existing) {
    return { ...existing, ok: true, reusedExistingComment: true };
  }
  const response = send(transport, "aos.ticket.comment", {
    ticketId,
    type: "agent_observation",
    body,
    idempotencyKey: `${captureKeyPrefix}-${definition.label.toLowerCase()}`
  });
  const payload = responsePayload(response);
  const comment = payload.result;
  const persisted = findCommentByBodyDigest(databasePath, ticketId, body);
  return {
    ok: Boolean(payload.ok === true && comment?.id && persisted?.commentId === comment.id),
    commentId: comment.id,
    commentAuditEventId: persisted?.commentAuditEventId ?? null,
    reusedExistingComment: false
  };
}

function ensureFrictionAudit(databasePath, ticketId, definition, comment) {
  const captureKey = `${captureKeyPrefix}-${definition.label.toLowerCase()}`;
  const existing = findBackfillAudit(databasePath, ticketId, captureKey, "friction.backfill.record");
  if (existing) {
    return { ...existing, ok: true, reusedExistingAudit: true };
  }
  const session = openStore(databasePath);
  try {
    const audit = session.store.appendAudit(actor, "friction.backfill.record", "story", ticketId, "accepted", {
      captureKey,
      frictionLabel: definition.label,
      category: definition.category,
      commentId: comment.commentId,
      commentAuditEventId: comment.commentAuditEventId,
      workflowBasis,
      planBasis,
      route,
      sourceEvidenceDigest: sourceEvidenceDigest(definition.evidence),
      sourceEvidenceKeys: definition.evidence.evidenceKeys,
      ticketLevelRecord: true,
      p0P1ClassificationPerformed: false,
      p0P1ClassificationPendingMara: true,
      frictionFixImplemented: false,
      phase3ReevaluationStarted: false,
      rawPathRecorded: false
    });
    return {
      ok: audit.action === "friction.backfill.record" && audit.targetId === ticketId,
      auditEventId: audit.id,
      reusedExistingAudit: false
    };
  } finally {
    session.close();
  }
}

function ensureFr003Subfinding(transport, databasePath, fr001) {
  if (!fr001?.ticketId) {
    return { ok: false, label: "FR-003", blocker: "missing_fr001_parent_ticket" };
  }
  const subtask = ensureFr003Subtask(databasePath, fr001.ticketId);
  const comment = ensureFr003Comment(transport, databasePath, fr001.ticketId);
  const audit = ensureFr003Audit(databasePath, fr001.ticketId, subtask.subtaskId, comment);
  const standaloneStoryCount = countStoriesByTitle(databasePath, "FR-003: DF-01 implementation-start routing inflation");
  return {
    ok: Boolean(subtask.ok && comment.ok && audit.ok && standaloneStoryCount === 0),
    label: "FR-003",
    category: sourceEvidence["FR-003"].category,
    parentLabel: "FR-001",
    parentTicketId: fr001.ticketId,
    subtaskId: subtask.subtaskId,
    commentId: comment.commentId,
    commentAuditEventId: comment.commentAuditEventId,
    auditEventId: audit.auditEventId,
    auditAction: "friction.backfill.subfinding.link",
    linkage: "linked_subfinding_under_FR-001",
    standaloneTicketCreated: false,
    standaloneStoryCount,
    sourceEvidenceDigest: sourceEvidenceDigest(sourceEvidence["FR-003"]),
    p0P1ClassificationPerformed: false,
    frictionFixImplemented: false,
    reusedExistingSubtask: subtask.reusedExistingSubtask,
    reusedExistingComment: comment.reusedExistingComment,
    reusedExistingAudit: audit.reusedExistingAudit,
    rawCommentBodyStoredInReceipt: false,
    rawAuditDetailsStoredInReceipt: false
  };
}

function ensureFr003Subtask(databasePath, parentTicketId) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === parentTicketId);
    const existing = story?.subTasks.find((item) => item.id === fr003SubtaskId);
    if (existing) {
      return { ok: true, subtaskId: existing.id, reusedExistingSubtask: true };
    }
    const subtask = session.store.addSubTask(parentTicketId, {
      id: fr003SubtaskId,
      title: "FR-003: DF-01 implementation-start routing inflation",
      ownerRole: "implementation",
      status: "accepted",
      dependencyIds: [],
      proofExpectation: "Represented as linked subfinding under FR-001; not a standalone first-pass ticket; pending Mara classification."
    }, actor);
    return { ok: subtask.id === fr003SubtaskId, subtaskId: subtask.id, reusedExistingSubtask: false };
  } finally {
    session.close();
  }
}

function ensureFr003Comment(transport, databasePath, parentTicketId) {
  const body = fr003CommentBody();
  const existing = findCommentByBodyDigest(databasePath, parentTicketId, body);
  if (existing) {
    return { ...existing, ok: true, reusedExistingComment: true };
  }
  const response = send(transport, "aos.ticket.comment", {
    ticketId: parentTicketId,
    type: "agent_observation",
    body,
    idempotencyKey: `${captureKeyPrefix}-fr-003-linked-subfinding`
  });
  const payload = responsePayload(response);
  const comment = payload.result;
  const persisted = findCommentByBodyDigest(databasePath, parentTicketId, body);
  return {
    ok: Boolean(payload.ok === true && comment?.id && persisted?.commentId === comment.id),
    commentId: comment.id,
    commentAuditEventId: persisted?.commentAuditEventId ?? null,
    reusedExistingComment: false
  };
}

function ensureFr003Audit(databasePath, parentTicketId, subtaskId, comment) {
  const captureKey = `${captureKeyPrefix}-fr-003-linked-subfinding`;
  const existing = findBackfillAudit(databasePath, parentTicketId, captureKey, "friction.backfill.subfinding.link");
  if (existing) {
    return { ...existing, ok: true, reusedExistingAudit: true };
  }
  const session = openStore(databasePath);
  try {
    const audit = session.store.appendAudit(actor, "friction.backfill.subfinding.link", "story", parentTicketId, "accepted", {
      captureKey,
      frictionLabel: "FR-003",
      parentLabel: "FR-001",
      parentTicketId,
      subtaskId,
      commentId: comment.commentId,
      commentAuditEventId: comment.commentAuditEventId,
      workflowBasis,
      planBasis,
      route,
      sourceEvidenceDigest: sourceEvidenceDigest(sourceEvidence["FR-003"]),
      sourceEvidenceKeys: sourceEvidence["FR-003"].evidenceKeys,
      standaloneTicketCreated: false,
      p0P1ClassificationPerformed: false,
      frictionFixImplemented: false,
      phase3ReevaluationStarted: false,
      rawPathRecorded: false
    });
    return {
      ok: audit.action === "friction.backfill.subfinding.link" && audit.targetId === parentTicketId,
      auditEventId: audit.id,
      reusedExistingAudit: false
    };
  } finally {
    session.close();
  }
}

function frictionCommentBody(definition) {
  return [
    `${definition.label} DF-04 friction backfill.`,
    `Category: ${definition.category}.`,
    `Source evidence digest: ${sourceEvidenceDigest(definition.evidence)}.`,
    "Captured as a real AOS ticket record for downstream Mara classification.",
    "No P0/P1 classification, friction fix, readiness, release, owner-facing acceptance, or broad closeout claim is made."
  ].join(" ");
}

function fr003CommentBody() {
  return [
    "FR-003 DF-04 friction backfill linked subfinding under FR-001.",
    `Category: ${sourceEvidence["FR-003"].category}.`,
    `Source evidence digest: ${sourceEvidenceDigest(sourceEvidence["FR-003"])}.`,
    "This is not a standalone first-pass ticket; downstream Mara classification may revisit promotion only from source-visible evidence.",
    "No P0/P1 classification, friction fix, readiness, release, owner-facing acceptance, or broad closeout claim is made."
  ].join(" ");
}

function findCommentByBodyDigest(databasePath, storyId, body) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((item) => item.id === storyId);
    const comment = story?.comments.find((item) => sha256(item.body) === sha256(body));
    if (!comment) return null;
    const commentAudit = session.store.queryAudit({ targetId: storyId, action: "comment.create" })
      .find((event) => event.details.commentId === comment.id);
    return {
      commentId: comment.id,
      commentAuditEventId: commentAudit?.id ?? null
    };
  } finally {
    session.close();
  }
}

function findBackfillAudit(databasePath, storyId, captureKey, action) {
  const session = openStore(databasePath);
  try {
    const audit = session.store.queryAudit({ targetId: storyId, action })
      .find((event) => event.details.captureKey === captureKey);
    return audit ? { auditEventId: audit.id } : null;
  } finally {
    session.close();
  }
}

function backfillCounts(databasePath, records, fr003) {
  const session = openStore(databasePath);
  try {
    const stories = session.store.listStories();
    const storyDuplicateCount = records.reduce((count, record) => {
      const titleCount = stories.filter((item) => item.title === record.storyTitle).length;
      return count + Math.max(0, titleCount - 1);
    }, 0);
    const commentDuplicateCount = records.reduce((count, record) => {
      const story = stories.find((item) => item.id === record.ticketId);
      const body = frictionCommentBody(frictionDefinitions.find((item) => item.label === record.label));
      const duplicates = story?.comments.filter((item) => sha256(item.body) === sha256(body)).length ?? 0;
      return count + Math.max(0, duplicates - 1);
    }, 0) + Math.max(0, (stories.find((item) => item.id === fr003.parentTicketId)?.comments.filter((item) => sha256(item.body) === sha256(fr003CommentBody())).length ?? 0) - 1);
    const auditDuplicateCount = records.reduce((count, record) => {
      const audits = session.store.queryAudit({ targetId: record.ticketId, action: "friction.backfill.record" })
        .filter((event) => event.details.frictionLabel === record.label);
      return count + Math.max(0, audits.length - 1);
    }, 0) + Math.max(0, session.store.queryAudit({ targetId: fr003.parentTicketId, action: "friction.backfill.subfinding.link" })
      .filter((event) => event.details.frictionLabel === "FR-003").length - 1);
    return {
      storyDuplicateCount,
      commentDuplicateCount,
      auditDuplicateCount,
      fr003StandaloneStoryCount: countStoriesByTitle(databasePath, "FR-003: DF-01 implementation-start routing inflation")
    };
  } finally {
    session.close();
  }
}

function countStoriesByTitle(databasePath, title) {
  const session = openStore(databasePath);
  try {
    return session.store.listStories().filter((item) => item.title === title).length;
  } finally {
    session.close();
  }
}

function readRestartReadback(databasePath, records) {
  const session = openStore(databasePath);
  try {
    const storyIds = records.map((record) => record.ticketId);
    const storiesPresent = storyIds.every((storyId) => session.store.listStories().some((story) => story.id === storyId));
    const commentsPresent = records.every((record) => {
      const story = session.store.listStories().find((item) => item.id === record.ticketId);
      return story?.comments.some((comment) => comment.id === record.commentId);
    });
    const auditsPresent = records.every((record) => session.store.queryAudit({ targetId: record.ticketId, action: record.auditAction })
      .some((event) => event.id === record.auditEventId));
    return {
      ok: storiesPresent && commentsPresent && auditsPresent,
      storyIds,
      storiesPresent,
      commentsPresent,
      auditsPresent,
      rawRowsStoredInReceipt: false
    };
  } finally {
    session.close();
  }
}

function createBackfillReadbackVisibility(databasePath, records) {
  const session = openStore(databasePath);
  try {
    const ticketChecks = records
      .filter((record) => record.label !== "FR-003")
      .map((record) => {
        const ticketResponse = createWorkReadbackApiResponse(
          session.store,
          "/api/work/readback/tickets",
          new URLSearchParams({ storyId: record.ticketId, limit: "1" })
        );
        const auditResponse = createWorkReadbackApiResponse(
          session.store,
          "/api/work/readback/audit",
          new URLSearchParams({ targetId: record.ticketId, action: record.auditAction, limit: "5" })
        );
        const rows = Array.isArray(ticketResponse.body.rows) ? ticketResponse.body.rows : [];
        const items = Array.isArray(auditResponse.body.items) ? auditResponse.body.items : [];
        return {
          label: record.label,
          ticketId: record.ticketId,
          ticketStatusCode: ticketResponse.statusCode,
          auditStatusCode: auditResponse.statusCode,
          ticketVisible: rows.some((row) => row.storyId === record.ticketId),
          auditVisible: items.some((item) => item.id === record.auditEventId),
          ticketMethod: ticketResponse.body.method,
          ticketSchemaVersion: ticketResponse.body.schemaVersion,
          rowGrain: ticketResponse.body.rowGrain,
          auditMethod: auditResponse.body.method,
          targetScoped: true,
          rawRowsStoredInReceipt: false,
          rawAuditDetailsStoredInReceipt: false
        };
      });
    const fr003 = records.find((record) => record.label === "FR-003");
    const fr003AuditResponse = createWorkReadbackApiResponse(
      session.store,
      "/api/work/readback/audit",
      new URLSearchParams({ targetId: fr003.parentTicketId, action: fr003.auditAction, limit: "5" })
    );
    const fr003AuditItems = Array.isArray(fr003AuditResponse.body.items) ? fr003AuditResponse.body.items : [];
    const fr003Check = {
      label: "FR-003",
      parentTicketId: fr003.parentTicketId,
      subtaskId: fr003.subtaskId,
      standaloneTicketCreated: false,
      auditStatusCode: fr003AuditResponse.statusCode,
      auditVisible: fr003AuditItems.some((item) => item.id === fr003.auditEventId),
      targetScoped: true,
      rawAuditDetailsStoredInReceipt: false
    };
    return {
      ok: ticketChecks.every((check) => check.ticketVisible && check.auditVisible) && fr003Check.auditVisible,
      ticketChecks,
      fr003Check,
      workReadbackRoute: "/work/readback",
      backingApiRoutes: ["/api/work/readback/tickets", "/api/work/readback/audit"]
    };
  } finally {
    session.close();
  }
}

function compareBackfillEnsures(firstEnsure, secondEnsure) {
  const firstRecords = new Map(firstEnsure.records.map((record) => [record.label, record]));
  const labels = ["FR-001", "FR-002"];
  const recordsReused = labels.every((label) => {
    const first = firstRecords.get(label);
    const second = secondEnsure.records.find((record) => record.label === label);
    return first?.ticketId === second?.ticketId &&
      first?.commentId === second?.commentId &&
      first?.auditEventId === second?.auditEventId;
  });
  const fr003Reused = firstEnsure.fr003.parentTicketId === secondEnsure.fr003.parentTicketId &&
    firstEnsure.fr003.subtaskId === secondEnsure.fr003.subtaskId &&
    firstEnsure.fr003.commentId === secondEnsure.fr003.commentId &&
    firstEnsure.fr003.auditEventId === secondEnsure.fr003.auditEventId;
  return {
    ok: recordsReused &&
      fr003Reused &&
      secondEnsure.counts.storyDuplicateCount === 0 &&
      secondEnsure.counts.commentDuplicateCount === 0 &&
      secondEnsure.counts.auditDuplicateCount === 0 &&
      secondEnsure.counts.fr003StandaloneStoryCount === 0,
    recordsReused,
    fr003Reused,
    firstTicketIds: Object.fromEntries(firstEnsure.records.map((record) => [record.label, record.ticketId])),
    secondTicketIds: Object.fromEntries(secondEnsure.records.map((record) => [record.label, record.ticketId])),
    firstCommentIds: Object.fromEntries(firstEnsure.records.map((record) => [record.label, record.commentId])),
    secondCommentIds: Object.fromEntries(secondEnsure.records.map((record) => [record.label, record.commentId])),
    firstAuditEventIds: Object.fromEntries(firstEnsure.records.map((record) => [record.label, record.auditEventId])),
    secondAuditEventIds: Object.fromEntries(secondEnsure.records.map((record) => [record.label, record.auditEventId])),
    duplicateCountsAfterReplay: secondEnsure.counts,
    secondEnsureNoop: secondEnsure.records.every((record) => record.reusedExistingStory && record.reusedExistingComment && record.reusedExistingAudit) &&
      secondEnsure.fr003.reusedExistingSubtask &&
      secondEnsure.fr003.reusedExistingComment &&
      secondEnsure.fr003.reusedExistingAudit
  };
}

function buildSourceEvidenceMappingReadback(records) {
  return {
    ok: true,
    sourceEvidenceStoredAsDigestsOnly: true,
    rawPlanBodyStoredInReceipt: false,
    rawThreadTranscriptStoredInReceipt: false,
    mapping: records.map((record) => ({
      label: record.label,
      category: record.category,
      sourceEvidenceDigest: record.sourceEvidenceDigest,
      ticketId: record.ticketId ?? record.parentTicketId,
      commentId: record.commentId,
      auditEventId: record.auditEventId,
      evidenceKeys: sourceEvidence[record.label]?.evidenceKeys ?? sourceEvidence["FR-003"].evidenceKeys
    }))
  };
}

function proveNegativeAuthority(root, databasePath) {
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    const cases = [
      ["aos.work_index.drill_through.read", "transport_method_outside_mvp_allowlist"],
      ["aos.gate.status.update", "transport_method_unknown"],
      ["aos.resource.record.propose", "transport_method_outside_mvp_allowlist"],
      ["aos.documentation.index.read", "transport_method_outside_mvp_allowlist"],
      ["aos.gateway.dump", "transport_method_unknown"]
    ];
    const negativeMethods = cases.map(([method, expectedReason]) => {
      const response = send(runtime.transport, method, {});
      const reason = responseReason(response);
      return { method, expectedReason, reason, rejected: reason === expectedReason };
    });
    return { ok: negativeMethods.every((item) => item.rejected), negativeMethods };
  } finally {
    runtime.close();
  }
}

function seedAuthorityRows(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  try {
    repository.applyMigrations();
    const sourceDigest = sha256(JSON.stringify({
      workflowBasis,
      route,
      employeeCount: createDefaultSeed().employees.length
    }));
    repository.seedAiEmployees(createDefaultSeed().employees, sourceDigest);
  } finally {
    repository.close();
  }
}

function openStore(databasePath) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  const store = new AosStore(undefined, { persistence: repository });
  return {
    repository,
    store,
    close() {
      repository.close();
    }
  };
}

function selectP1DurableRoot() {
  const explicit = process.env.TCRN_AOS_P1_DURABLE_RUNTIME_PROFILE_ROOT;
  const root = resolve(explicit || join(homedir(), "Library", "Application Support", "TCRN-AOS", "conditional-dogfood-start-p1-runtime-profile"));
  return {
    root,
    readback: {
      profileRootClass: explicit ? "explicit_owner_marker_durable_local_profile_root" : "owner_marker_durable_local_profile_root",
      explicitRootProvided: Boolean(explicit),
      selectedRootDigest: sha256(resolve(root)),
      rawPathRecorded: false,
      cleanStartDisposition: "clean_start_declared"
    }
  };
}

function validateP1DurableRoot(root, databasePath) {
  denyUnsafeRuntimePath(root);
  assertExistingSegmentsHaveNoSymlink(root, "df04_backfill_p1_runtime_profile_root_symlink_ancestor_denied");
  if (!existsSync(root)) throw new Error("df04_backfill_p1_durable_profile_root_missing");
  if (lstatSync(root).isSymbolicLink()) throw new Error("df04_backfill_p1_durable_profile_root_symlink_denied");
  if (!existsSync(join(root, markerFile))) throw new Error("df04_backfill_p1_route_owned_marker_missing");
  if (!existsSync(join(root, ownerMarkerFile))) throw new Error("df04_backfill_p1_owner_marker_missing");
  assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  const marker = markerReadback(root);
  if (!marker.ok) throw new Error("df04_backfill_p1_marker_mismatch");
  if (dirname(databasePath) !== root) throw new Error("df04_backfill_database_not_direct_child");
  if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) {
    throw new Error("df04_backfill_database_symlink_denied");
  }
}

function markerReadback(root) {
  const routeMarker = JSON.parse(readFileSync(join(root, markerFile), "utf8"));
  const ownerMarker = JSON.parse(readFileSync(join(root, ownerMarkerFile), "utf8"));
  const expectedRouteMarker = {
    route: p1Route,
    markerVersion,
    rootDigest: sha256(resolve(root)),
    purpose: markerPurpose
  };
  const ok = routeMarker.route === expectedRouteMarker.route &&
    routeMarker.markerVersion === expectedRouteMarker.markerVersion &&
    routeMarker.rootDigest === expectedRouteMarker.rootDigest &&
    routeMarker.purpose === expectedRouteMarker.purpose &&
    ownerMarker.profileId === "conditional-dogfood-start-p1-clean-start-runtime-profile-v1" &&
    ownerMarker.routeId === p1Route &&
    ownerMarker.runContext === "conditional-dogfood-start-p1-clean-start-v1";
  return {
    ok,
    routeOwnedMarkerFile: markerFile,
    routeOwnedMarkerDigest: sha256(JSON.stringify(routeMarker)),
    ownerMarkerFile,
    ownerMarkerDigest: sha256(JSON.stringify(ownerMarker)),
    routeMatches: routeMarker.route === p1Route,
    markerVersionMatches: routeMarker.markerVersion === markerVersion,
    purposeMatches: routeMarker.purpose === markerPurpose,
    rootDigestMatches: routeMarker.rootDigest === expectedRouteMarker.rootDigest,
    ownerMarkerProfileMatches: ownerMarker.profileId === "conditional-dogfood-start-p1-clean-start-runtime-profile-v1",
    ownerMarkerRouteMatches: ownerMarker.routeId === p1Route,
    rawPathRecorded: false
  };
}

function runtimeConfig(root, databasePath) {
  return {
    actor,
    databasePath,
    databaseRoot: root,
    repoRoot,
    routeOwnedMarkerFile: markerFile,
    runtimeProfileMarker: {
      route: p1Route,
      markerVersion,
      purpose: markerPurpose
    },
    migrationsDir,
    auditPageLimit: 5,
    maxResponseBytes: 16_384
  };
}

function validateReceiptsAndArtifacts(databasePath) {
  const noCommittedDbArtifacts = noCommittedRuntimeDbArtifacts();
  const databaseDirectChild = dirname(databasePath) === selectedRoot.root;
  return {
    ok: noCommittedDbArtifacts && databaseDirectChild,
    noCommittedDbArtifacts,
    databaseDirectChild,
    workflowMutationPerformed: false,
    designSystemMutationPerformed: false,
    tmsMutationPerformed: false,
    activeCodexMutationPerformed: false,
    maintainedHookSourceMutationPerformed: false,
    rawPathRecorded: false
  };
}

function noCommittedRuntimeDbArtifacts() {
  const result = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return false;
  return !result.stdout.split("\n").some((file) => /\.(sqlite|sqlite3|db|db-shm|db-wal)$/.test(file) && !file.includes(".codegraph/"));
}

function privacyScan(proof) {
  const text = JSON.stringify(proof);
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
    ["phase 3 acceptance", "phase3_acceptance_overclaim"],
    ["phase 4 closeout", "phase4_closeout_overclaim"],
    ["full DF-04 completion", "df04_completion_overclaim"],
    ["universal no-friction", "universal_no_friction_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      proof.privacyNoArtifactNoOverclaimReadback.rawPathRecorded === false &&
      proof.localProfileRootPrivacyReadback.rawPathRecorded === false &&
      proof.fr003LinkedSubfindingReadback.standaloneTicketCreated === false,
    findings,
    scannedSurface: "df04_friction_backfill_receipt_payload",
    rawPathRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    privateOwnerPayloadStored: false,
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
    planBasis,
    incomingAosBasis,
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
    planBasis,
    aosBasis: body.source.sourceHead,
    incomingAosBasis,
    failures: body.failures ?? [],
    negativeFailures: body.negativeFailures ?? [],
    noOverclaimFlags,
    ...body
  };
  delete receipt.source;
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
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

function sourceEvidenceDigest(evidence) {
  return sha256(JSON.stringify(evidence));
}

function digestDatabaseFile(databasePath) {
  return existsSync(databasePath) ? sha256(readFileSync(databasePath)) : null;
}

function denyUnsafeRuntimePath(path) {
  const normalized = resolve(path).split(sep).join("/");
  if (normalized.startsWith("/srv/") || normalized === "/srv") throw new Error("df04_backfill_runtime_srv_path_denied");
  if (/retained|owner-trial|preview/i.test(normalized)) throw new Error("df04_backfill_runtime_retained_or_owner_visible_path_denied");
}

function assertExistingSegmentsHaveNoSymlink(path, reason) {
  const absolute = resolve(path);
  let current = resolve(sep);
  for (const part of absolute.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) return;
    if (lstatSync(current).isSymbolicLink()) throw new Error(reason);
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}
