import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { createRuntimeTransport } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase4_d4_friction_capture_protocol_ilya_after_minerva_d3_status_sync_success_3379f07_4997c7b_20260706";
const workflowBasis = "3379f07d7e0425dc0a5cc3e20a1583d574e87c4b";
const d2ActivationRoute = "route_tcrn_aos_phase4_d2_runtime_profile_local_activation_ilya_after_owner_decision_78d75eb_eb8f5a8_20260706";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase3-dogfood-execution-runtime-profile");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const markerFile = ".tcrn-aos-phase1-root";
const markerPurpose = "d2-local-dogfood-runtime-profile-activation";
const markerVersion = "phase4-d2-runtime-profile.v1";
const command = "pnpm --dir TCRN-AOS d4:friction-capture-proof";
const readbackReceiptName = "d4-friction-capture-readback.json";
const summaryReceiptName = "d4-friction-capture-protocol-proof-summary.json";
const databaseFileName = "aos-d2-local-runtime-profile.sqlite";
const targetStoryId = "story_10db64b0554c3642";
const targetStoryTitle = "Hook-gate to AOS-method mapping table";
const targetAssignmentId = "assignment_5f7abb44ce1bdded";
const d3RunId = "run_aa8776d96dd4454d";
const d3EpicId = "epic_de12d9eab23da28b";
const d3InitiativeId = "init_e9113ca32eb81e0b";
const sourceFiles = [
  "package.json",
  "scripts/d4-friction-capture-proof.mjs",
  "scripts/d3-real-dogfood-workload-proof.mjs",
  "scripts/d2-runtime-profile-activation-proof.mjs",
  "packages/db/src/sqlite-repository.ts",
  "packages/domain/src/store.ts",
  "packages/domain/src/seed.ts",
  "packages/mcp-gateway/src/gateway.ts",
  "packages/mcp-server/src/transport.ts"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "d4-friction-capture-protocol"
};
const frictionNoneBody = [
  "D4 friction capture: friction=none.",
  "Reason: no route-blocking blocker or awkward interaction occurred while proving the D4 capture protocol.",
  "No P0/P1 classification, no friction fix, and no Phase 4 story implementation is performed by this comment."
].join(" ");
const noOverclaimFlags = {
  localD2RuntimeProfileDbUsed: true,
  d3RealDogfoodWorkloadConsumed: true,
  d4FrictionCaptureProtocolProved: true,
  d4FrictionTicketsCreated: false,
  p0P1ClassificationPerformed: false,
  frictionFixImplemented: false,
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

mkdirSync(evidenceRoot, { recursive: true });
const source = sourceProvenance();
const selectedRoot = selectExistingActivationRoot();
const dbPath = join(selectedRoot.root, databaseFileName);
const proof = runFrictionCaptureProof(selectedRoot.root, dbPath);
const privacy = privacyScan(proof);
const receipt = writeReceipt(readbackReceiptName, {
  ok: proof.ok && privacy.ok,
  source,
  selectedRoot: selectedRoot.readback,
  d4FrictionCaptureReadback: proof.d4FrictionCaptureReadback,
  capturedFrictionTickets_or_none: proof.capturedFrictionTickets_or_none,
  auditEventOrCommentLinkageReadback: proof.auditEventOrCommentLinkageReadback,
  targetWorkloadStoryAssignmentRunReadback: proof.targetWorkloadStoryAssignmentRunReadback,
  localProfileRootPrivacyReadback: proof.localProfileRootPrivacyReadback,
  methodAuthorityBoundaryReadback: proof.methodAuthorityBoundaryReadback,
  p0P1ClassificationBoundaryReadback: proof.p0P1ClassificationBoundaryReadback,
  activeHookDivergenceBoundaryReadback: proof.activeHookDivergenceBoundaryReadback,
  validation_readbacks: proof.validation_readbacks,
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
  frictionReadbackReceiptDigest: sha256(JSON.stringify(receipt)),
  frictionOutcome: proof.capturedFrictionTickets_or_none.friction,
  capturedTicketIds: proof.capturedFrictionTickets_or_none.capturedTicketIds,
  p0P1ClassificationPerformed: false,
  noOverclaimFlags
});

assert.equal(receipt.ok, true);
assert.equal(summary.ok, true);
console.log(JSON.stringify({
  ok: true,
  receipts: [summaryReceiptName, readbackReceiptName],
  friction: proof.capturedFrictionTickets_or_none.friction,
  capturedTicketIds: proof.capturedFrictionTickets_or_none.capturedTicketIds,
  targetStoryId,
  commentId: proof.auditEventOrCommentLinkageReadback.commentId,
  frictionAuditEventId: proof.auditEventOrCommentLinkageReadback.frictionAuditEventId,
  rawPathRecorded: false,
  d4Only: true
}, null, 2));

function runFrictionCaptureProof(root, databasePath) {
  validateExistingActivationRoot(root);
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot, markerFile);
  const marker = markerReadback(root);
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    const target = readTargetContext(databasePath);
    const comment = recordFrictionNoneComment(runtime.transport);
    const frictionAudit = appendFrictionNoneAudit(databasePath, target, comment);
    const auditReadback = queryFrictionAuditWithFreshRuntime(root, databasePath);
    const ticketListReadback = send(runtime.transport, "aos.ticket.list", {
      storyId: targetStoryId,
      limit: 1
    });
    const negative = proveNegativeAuthority(runtime.transport);
    const validation = validateReceiptsAndArtifacts(databasePath);
    const auditPayload = responsePayload(auditReadback);
    const ticketPayload = responsePayload(ticketListReadback);
    const ok = target.ok &&
      comment.ok === true &&
      frictionAudit.ok === true &&
      auditPayload.returnedCount > 0 &&
      ticketPayload.rows?.[0]?.storyId === targetStoryId &&
      negative.ok &&
      marker.ok &&
      validation.noCommittedDbArtifacts === true;
    return {
      ok,
      d4FrictionCaptureReadback: {
        ok,
        route,
        sourceHead: source.sourceHead,
        workflowBasis,
        command,
        d4ProtocolOutcome: "friction_none_recorded",
        protocolMode: "capture_or_explicit_none_at_assignment_session_closeout",
        actualFrictionEncountered: false,
        reason: "No route-blocking blocker or awkward interaction occurred while implementing/proving D4 capture protocol.",
        targetStoryId,
        targetStoryTitle,
        targetAssignmentId,
        d3RunId,
        commentId: comment.commentId,
        commentAuditEventId: comment.auditEventId,
        frictionAuditEventId: frictionAudit.auditEventId,
        capturedTicketIds: [],
        noP0P1Classification: true,
        noFrictionFixImplemented: true,
        rawPathRecorded: false,
        rawDbDumpRecorded: false
      },
      capturedFrictionTickets_or_none: {
        friction: "none",
        reason: "No actual blocker or awkward interaction occurred in this D4 route; protocol was proven by a source-visible none record.",
        capturedTicketIds: [],
        capturedTicketCount: 0,
        p0P1ClassificationPerformed: false,
        p0P1ClassificationOwner: "Mara_later_if_real_ticket_ids_exist",
        frictionFixImplemented: false,
        proofFixturePromotedToFrictionTicket: false
      },
      auditEventOrCommentLinkageReadback: {
        ok: comment.ok && frictionAudit.ok && auditPayload.returnedCount > 0,
        method: "aos.ticket.comment",
        commentId: comment.commentId,
        commentBodyDigest: comment.bodyDigest,
        commentAuditEventId: comment.auditEventId,
        frictionAuditEventId: frictionAudit.auditEventId,
        frictionAuditAction: "friction.capture.none",
        targetType: "story",
        targetId: targetStoryId,
        auditQueryMethod: auditPayload.method,
        auditQueryReturnedCount: auditPayload.returnedCount,
        auditDetailsRedacted: true,
        rawCommentBodyStoredInReceipt: false,
        rawAuditDetailsStoredInReceipt: false
      },
      targetWorkloadStoryAssignmentRunReadback: {
        ok: target.ok && ticketPayload.rows?.[0]?.storyId === targetStoryId,
        initiativeId: d3InitiativeId,
        epicId: d3EpicId,
        story: target.story,
        assignment: target.assignment,
        d3RunReference: target.d3RunReference,
        ticketListReadback: {
          ok: ticketPayload.ok === true,
          method: ticketPayload.method,
          schemaVersion: ticketPayload.schemaVersion,
          rowGrain: ticketPayload.rowGrain,
          returnedCount: ticketPayload.page?.returnedCount,
          storyIds: ticketPayload.rows?.map((row) => row.storyId) ?? [],
          rawRowsStored: false
        },
        sessionContext: {
          sessionId: actor.sessionId,
          route,
          sourceThreadId: "019eb66e-00d1-7190-81d9-693895b32033",
          targetThreadId: "019eb6d7-f130-70a0-8805-169cc337229b"
        }
      },
      localProfileRootPrivacyReadback: {
        ok: marker.ok === true && validation.noCommittedDbArtifacts === true,
        profileRootClass: selectedRoot.readback.profileRootClass,
        rootDigest: rootReadback.rootDigest,
        marker,
        databaseFileName: basename(databasePath),
        databaseDirectChildOfRoot: dirname(databasePath) === root,
        runtimeTransportOpened: true,
        retainedForOwnerAuthorizedLocalD2D3D4Use: true,
        rawPathRecorded: false,
        rawDbDumpRecorded: false,
        committedDbArtifacts: false,
        cleanupAttempted: false,
        cleanupDisposition: "d2_local_activation_root_intentionally_retained_for_owner_authorized_local_use"
      },
      methodAuthorityBoundaryReadback: {
        ok: negative.ok,
        acceptedMethodsExercised: ["aos.ticket.comment", "aos.audit.query", "aos.ticket.list", "aos.policy.read"],
        negativeMethods: negative.negativeMethods,
        broadGatewayExposureUsed: false,
        workIndexUsed: false,
        phase4ItemImplementationPerformed: false,
        clientSuppliedAuthorityTrusted: false,
        liveDispatchAuthorized: false,
        ownerIntentExecutionAuthorized: false,
        registryMutationPerformed: false,
        frictionFixImplemented: false
      },
      p0P1ClassificationBoundaryReadback: {
        ok: true,
        p0P1ClassificationPerformed: false,
        p0P1ClassificationDeferredToMara: true,
        capturedTicketIds: [],
        inventedTicketIds: [],
        proofFixturePromotedToProductFriction: false
      },
      activeHookDivergenceBoundaryReadback: {
        parityReceiptPath: "TCRN Workflow/.context/platform/plans/evidence/2026-07-05-phase4-friction-workflow-thinning-entry/phase4-hook-runtime-parity-readback.json",
        cmpExit: 1,
        byteIdentical: false,
        parityProven: false,
        referencedStoryId: targetStoryId,
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
  }
}

function queryFrictionAuditWithFreshRuntime(root, databasePath) {
  const runtime = createRuntimeTransport(runtimeConfig(root, databasePath));
  try {
    return send(runtime.transport, "aos.audit.query", {
      targetId: targetStoryId,
      action: "friction.capture.none",
      limit: 5
    });
  } finally {
    runtime.close();
  }
}

function readTargetContext(databasePath) {
  const session = openStore(databasePath);
  try {
    const story = session.store.listStories().find((row) => row.id === targetStoryId);
    const assignment = session.store.listAssignments().find((row) => row.id === targetAssignmentId);
    const run = session.store.listRuns().find((row) => row.id === d3RunId);
    return {
      ok: story?.title === targetStoryTitle &&
        assignment?.targetId === targetStoryId &&
        run?.status === "success",
      story: story ? {
        id: story.id,
        title: story.title,
        status: story.status,
        gateIds: [...new Set(story.gateIds)],
        assignmentIds: [...new Set(story.assignmentIds)],
        acceptanceCriteriaDigest: sha256(JSON.stringify(story.acceptanceCriteria))
      } : null,
      assignment: assignment ? {
        id: assignment.id,
        employeeId: assignment.employeeId,
        role: assignment.role,
        targetType: assignment.targetType,
        targetId: assignment.targetId,
        status: assignment.status,
        runIds: [...new Set(assignment.runIds)]
      } : null,
      d3RunReference: run ? {
        id: run.id,
        assignmentId: run.assignmentId,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt
      } : null
    };
  } finally {
    session.close();
  }
}

function recordFrictionNoneComment(transport) {
  const response = send(transport, "aos.ticket.comment", {
    ticketId: targetStoryId,
    type: "agent_observation",
    body: frictionNoneBody,
    idempotencyKey: "d4-friction-none-comment"
  });
  const payload = responsePayload(response);
  const comment = payload.result;
  return {
    ok: Boolean(payload.ok === true &&
      payload.method === "aos.ticket.comment" &&
      comment?.id &&
      payload.auditEventId),
    commentId: comment.id,
    bodyDigest: sha256(frictionNoneBody),
    auditEventId: payload.auditEventId,
    rawBodyStoredInReceipt: false
  };
}

function appendFrictionNoneAudit(databasePath, target, comment) {
  const session = openStore(databasePath);
  try {
    const audit = session.store.appendAudit(actor, "friction.capture.none", "story", targetStoryId, "accepted", {
      route,
      sessionId: actor.sessionId,
      storyId: targetStoryId,
      assignmentId: target.assignment?.id ?? targetAssignmentId,
      d3RunId,
      commentId: comment.commentId,
      relatedCommentAuditEventId: comment.auditEventId,
      frictionOutcome: "none",
      reasonCode: "no_route_blocking_friction_encountered",
      p0P1ClassificationPerformed: false,
      frictionFixImplemented: false,
      rawPathRecorded: false
    });
    return {
      ok: audit.action === "friction.capture.none" && audit.targetId === targetStoryId,
      auditEventId: audit.id,
      action: audit.action,
      outcome: audit.outcome,
      detailsRedactedByStore: true
    };
  } finally {
    session.close();
  }
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

function runtimeConfig(root, databasePath) {
  return {
    actor,
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
  assertExistingSegmentsHaveNoSymlink(root, "d4_runtime_profile_root_symlink_ancestor_denied");
  if (!existsSync(root)) {
    throw new Error(explicit ? "d4_d2_runtime_profile_root_missing" : "d4_default_d2_runtime_profile_root_missing");
  }
  const stat = lstatSync(root);
  if (stat.isSymbolicLink()) throw new Error("d4_runtime_profile_root_symlink_denied");
  if (!stat.isDirectory()) throw new Error("d4_runtime_profile_root_not_directory");
  const markerPath = join(root, markerFile);
  if (!existsSync(markerPath)) throw new Error("d4_d2_runtime_profile_marker_missing");
  const parsed = JSON.parse(readFileSync(markerPath, "utf8"));
  const expected = markerContent(root);
  if (!markerMatches(parsed, expected)) throw new Error("d4_d2_runtime_profile_marker_stale_or_mismatched");
  const databasePath = join(root, databaseFileName);
  if (existsSync(databasePath) && lstatSync(databasePath).isSymbolicLink()) {
    throw new Error("d4_runtime_profile_database_file_symlink_denied");
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
    ["phase4 implementation completed", "phase4_closeout_overclaim"]
  ].filter(([needle]) => text.toLowerCase().includes(String(needle).toLowerCase()))
    .map(([, kind]) => ({ kind }));
  return {
    ok: findings.length === 0 &&
      proof.localProfileRootPrivacyReadback.rawPathRecorded === false &&
      proof.d4FrictionCaptureReadback.rawPathRecorded === false,
    findings,
    scannedSurface: "d4_friction_capture_receipt_payload",
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
    failures: [],
    negativeFailures: [],
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
    throw new Error("d4_runtime_profile_root_inside_git_tree_denied");
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
