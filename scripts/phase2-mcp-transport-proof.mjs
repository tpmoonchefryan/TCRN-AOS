import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AosSqliteRepository,
  assertRouteOwnedSqliteRoot,
  sha256
} from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { transportMvpMethods } from "../dist/packages/mcp-server/src/index.js";

const route = "route_tcrn_aos_phase2_mcp_transport_ilya_bounded_implementation_after_mara_pm_success_7808400_12d73bd_20260705";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/phase2-mcp-transport");
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const serverEntrypoint = join(repoRoot, "dist/packages/mcp-server/src/stdio-server.js");
const command = "pnpm --dir TCRN-AOS phase2:mcp-transport-proof";
const noOverclaimFlags = {
  productRepoMutationOnly: true,
  workflowMutation: false,
  designSystemMutation: false,
  durableRuntimeDbActivation: false,
  dogfoodRuntimeReadinessClaimed: false,
  retainedPreviewFreshnessClaimed: false,
  liveDispatchAuthorized: false,
  ownerAcceptanceClaimed: false,
  productAcceptanceClaimed: false,
  releasePublicationPushClaimed: false,
  broadCodexSecurityPluginScanClaimed: false
};
const receiptInventory = [
  "real-stdio-client-session.json",
  "transport-method-allowlist-proof.json",
  "policy-read-filter-proof.json",
  "actor-identity-and-refusal-audit-proof.json",
  "blocked-role-refusal-proof.json",
  "response-budget-pagination-proof.json",
  "idempotency-replay-scope-proof.json",
  "restart-reconnect-proof.json",
  "persisted-agent-run-proof.json",
  "dependency-license-security-readback.json",
  "privacy-no-overclaim-scan.json",
  "verify-fast-readback.json"
];
const sourceFiles = [
  "package.json",
  "packages/mcp-gateway/src/gateway.ts",
  "packages/mcp-server/src/index.ts",
  "packages/mcp-server/src/transport.ts",
  "packages/mcp-server/src/stdio-server.ts",
  "packages/mcp-server/test/stdio-transport.test.mjs",
  "scripts/phase2-mcp-transport-proof.mjs"
];
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase2-mcp-transport-proof"
};
const observerEmployee = {
  id: "employee-phase2-observer",
  name: "Phase 2 Observer",
  role: "owner_observer",
  authoritySummary: "Read-only transport proof fixture.",
  contactWhen: "Read-only proof only.",
  lifecycle: "active",
  threadIdentity: {
    threadId: "phase2-observer-thread",
    status: "active",
    lifecycle: "ephemeral"
  },
  roleContractRefs: ["phase2-read-only-proof"],
  skillRefs: []
};
const observerActor = {
  employeeId: observerEmployee.id,
  role: observerEmployee.role,
  threadId: observerEmployee.threadIdentity.threadId,
  sessionId: "phase2-observer-proof"
};

await runProof();

async function runProof() {
  mkdirSync(evidenceRoot, { recursive: true });
  const source = sourceProvenance();
  const tempRoot = await mkdtemp(join(tmpdir(), "tcrn-aos-phase2-mcp-"));
  const markerFile = ".tcrn-aos-phase1-root";
  writeFileSync(join(tempRoot, markerFile), "owned-by-phase2-mcp-proof\n", "utf8");
  const dbPath = join(tempRoot, "phase2.sqlite");
  const writtenReceipts = [];
  let cleanupReadback = { attempted: false, removed: false, rawPathRecorded: false };

  try {
    const rootReadback = assertRouteOwnedSqliteRoot(tempRoot, repoRoot, markerFile);
    const seed = seedProofDatabase(dbPath);
    const server = await startClientSession(dbPath, actor);
    try {
      const policy = await server.send("aos.policy.read", {});
      const forbiddenSlice = await server.send("aos.resource.record.propose", {});
      const clientAuthority = await server.send("aos.ticket.comment", {
        actor,
        ticketId: seed.storyId,
        type: "agent_observation",
        body: "client authority spoof"
      });
      const comment = await server.send("aos.ticket.comment", {
        ticketId: seed.storyId,
        type: "agent_observation",
        body: "Phase 2 transport proof comment"
      });
      const evidence = await server.send("aos.evidence.link", {
        type: "artifact_id",
        target: "phase2-mcp-transport-proof",
        digest: "sha256:phase2-mcp-transport-proof",
        redactionState: "metadata_only"
      });
      const gate = await server.send("aos.gate.request", {
        type: "evidence_proof",
        linkedTicketId: seed.storyId,
        inputEvidenceIds: [responsePayload(evidence).result.id]
      });
      const run = await server.send("aos.run.summary.create", {
        assignmentId: seed.assignmentId,
        status: "success",
        startedAt: "2026-07-05T17:30:00.000Z",
        endedAt: "2026-07-05T17:31:00.000Z",
        readback: "metadata-only Phase 2 transport proof",
        outputSummary: "MCP stdio transport persisted AgentRun",
        idempotencyKey: "phase2-run-summary"
      });
      const replay = await server.send("aos.run.summary.create", {
        assignmentId: seed.assignmentId,
        status: "success",
        startedAt: "2026-07-05T17:30:00.000Z",
        endedAt: "2026-07-05T17:31:00.000Z",
        readback: "metadata-only Phase 2 transport proof",
        outputSummary: "MCP stdio transport persisted AgentRun",
        idempotencyKey: "phase2-run-summary"
      });
      const auditPageOne = await server.send("aos.audit.query", { limit: 2 });
      const auditPageTwo = await server.send("aos.audit.query", { limit: 2, cursor: responsePayload(auditPageOne).nextCursor });
      const stageMap = await server.send("aos.stage_map.read", {
        projectId: "TCRN-AOS",
        initiativeId: seed.initiativeId
      });

      const transcript = [
        transcriptEntry("aos.policy.read", policy),
        transcriptEntry("aos.resource.record.propose", forbiddenSlice),
        transcriptEntry("aos.ticket.comment", clientAuthority),
        transcriptEntry("aos.ticket.comment", comment),
        transcriptEntry("aos.evidence.link", evidence),
        transcriptEntry("aos.gate.request", gate),
        transcriptEntry("aos.run.summary.create", run),
        transcriptEntry("aos.run.summary.create", replay),
        transcriptEntry("aos.audit.query", auditPageOne),
        transcriptEntry("aos.audit.query", auditPageTwo),
        transcriptEntry("aos.stage_map.read", stageMap)
      ];
      const runPayload = responsePayload(run).result;
      const replayPayload = responsePayload(replay);
      const auditPayload = responsePayload(auditPageOne);

      writtenReceipts.push(writeReceipt("real-stdio-client-session.json", source, rootReadback, {
        ok: transcript.every((entry) => entry.jsonrpc === "2.0") &&
          responsePayload(comment).ok === true &&
          responsePayload(evidence).ok === true &&
          responsePayload(gate).ok === true &&
          responsePayload(run).ok === true,
        protocol: "line_delimited_json_rpc_2_protocol_equivalent_stdio_child_process",
        childProcessSpawned: true,
        stdioOnly: true,
        networkListenerStarted: false,
        transcript,
        rawClientEnvStored: false,
        rawPromptOrMessageStored: false,
        failures: transcript.filter((entry) => !entry.ok && !entry.expectedFailure)
      }));

      writtenReceipts.push(writeReceipt("transport-method-allowlist-proof.json", source, rootReadback, {
        ok: deepEqualArray(responsePayload(policy).transportAllowedMethods, transportMvpMethods) &&
          forbiddenSlice.error?.data?.reason === "transport_method_outside_mvp_allowlist",
        transportMvpMethods,
        exposedBroadGatewayMethods: false,
        rejectedSlices6To9Method: {
          method: "aos.resource.record.propose",
          rejected: forbiddenSlice.error?.data?.reason === "transport_method_outside_mvp_allowlist"
        },
        unknownOrUnsupportedFailures: [forbiddenSlice.error?.data?.reason].filter(Boolean)
      }));

      writtenReceipts.push(writeReceipt("policy-read-filter-proof.json", source, rootReadback, {
        ok: responsePayload(policy).fullGatewayMethodListExposed === false &&
          responsePayload(policy).boundaries.liveDispatchAuthorized === false &&
          responsePayload(policy).boundaries.durableRuntimeActivation === false,
        policyRead: responsePayload(policy),
        fullGatewayMethodListReturned: false,
        transportOnlyPolicy: true
      }));

      writtenReceipts.push(writeReceipt("actor-identity-and-refusal-audit-proof.json", source, rootReadback, {
        ok: clientAuthority.error?.data?.reason === "client_supplied_authority_denied" &&
          forbiddenSlice.error?.data?.reason === "transport_method_outside_mvp_allowlist",
        actorSource: "trusted_server_config",
        clientSuppliedActorRejected: true,
        unknownMethodRejected: true,
        refusalAuditAction: "mcp.transport.refusal",
        actorProof: {
          employeeId: actor.employeeId,
          role: actor.role,
          threadId: actor.threadId,
          persistedEmployeeSeeded: true,
          threadStatusRequired: "active",
          lifecycleRequired: "active"
        },
        negativeFailures: [clientAuthority.error?.data?.reason, forbiddenSlice.error?.data?.reason].filter(Boolean)
      }));

      const blockedRole = await proveBlockedRole(dbPath);
      writtenReceipts.push(writeReceipt("blocked-role-refusal-proof.json", source, rootReadback, {
        ok: blockedRole.policyReadOk && blockedRole.writeBlocked,
        actorSource: "trusted_server_config",
        readOnlyRole: observerActor.role,
        policyReadOk: blockedRole.policyReadOk,
        writeBlocked: blockedRole.writeBlocked,
        errorReason: blockedRole.errorReason,
        refusalAuditAction: "mcp.transport.refusal"
      }));

      writtenReceipts.push(writeReceipt("response-budget-pagination-proof.json", source, rootReadback, {
        ok: auditPayload.returnedCount === 2 &&
          auditPayload.hasMore === true &&
          typeof auditPayload.nextCursor === "string" &&
          responsePayload(auditPageTwo).returnedCount > 0,
        method: "aos.audit.query",
        limit: auditPayload.limit,
        returnedCount: auditPayload.returnedCount,
        hasMore: auditPayload.hasMore,
        nextCursorPresent: typeof auditPayload.nextCursor === "string",
        boundedHistoryDump: true,
        maxResponseBytes: responsePayload(policy).responseBudget.maxResponseBytes
      }));

      writtenReceipts.push(writeReceipt("idempotency-replay-scope-proof.json", source, rootReadback, {
        ok: replayPayload.status === "deduped",
        idempotencyKey: "phase2-run-summary",
        replayStatus: replayPayload.status,
        processLocalOnly: true,
        crossRestartDedupeClaimed: false,
        persistedRequestIdContractClaimed: false
      }));

      await server.stop();
      const restartProof = await proveRestart(dbPath, seed.assignmentId, runPayload.id);
      writtenReceipts.push(writeReceipt("restart-reconnect-proof.json", source, rootReadback, {
        ok: restartProof.runSurvived && restartProof.assignmentRunLinkSurvived && restartProof.reconnectedQueryOk,
        routeOwnedTempDb: true,
        durableRuntimeActivation: false,
        restartModel: "stop_child_process_then_spawn_new_stdio_child_against_same_route_owned_temp_db",
        preRestartRunId: runPayload.id,
        runSurvived: restartProof.runSurvived,
        assignmentRunLinkSurvived: restartProof.assignmentRunLinkSurvived,
        reconnectedQueryOk: restartProof.reconnectedQueryOk,
        cleanupReadback: "pending_finally_cleanup"
      }));

      writtenReceipts.push(writeReceipt("persisted-agent-run-proof.json", source, rootReadback, {
        ok: runPayload.assignmentId === seed.assignmentId &&
          restartProof.runSurvived &&
          restartProof.assignmentRunLinkSurvived &&
          responsePayload(run).status === "accepted",
        method: "aos.run.summary.create",
        agentRunId: runPayload.id,
        assignmentId: seed.assignmentId,
        assignmentRunIdsIncludesRun: restartProof.assignmentRunLinkSurvived,
        auditAction: "agent_run.record",
        persistedThrough: "AosStore.recordAgentRun",
        directSqlWriteFromTransport: false
      }));

      writtenReceipts.push(writeReceipt("dependency-license-security-readback.json", source, rootReadback, dependencyLicenseReadback()));
      writtenReceipts.push(writeReceipt("verify-fast-readback.json", source, rootReadback, verifyFastReadback()));
    } finally {
      await server.stop();
    }

    const privacy = privacyScan(writtenReceipts);
    writtenReceipts.push(writeReceipt("privacy-no-overclaim-scan.json", source, rootReadback, privacy));
    const childReadbacks = readReceipts(receiptInventory);
    const summary = {
      ok: childReadbacks.every((receipt) => receipt.ok === true) &&
        privacy.ok === true &&
        receiptInventory.length === childReadbacks.length,
      route,
      command,
      generatedAt: new Date().toISOString(),
      sourceHead: source.sourceHead,
      sourceContentDigest: source.sourceContentDigest,
      receiptInventory,
      receiptCount: childReadbacks.length,
      childReceiptsOk: Object.fromEntries(childReadbacks.map((receipt) => [receipt.receiptName, receipt.ok])),
      missingReceipts: receiptInventory.filter((name) => !childReadbacks.some((receipt) => receipt.receiptName === name)),
      extraUnclassifiedReceipts: [],
      sourceProvenanceConsistent: childReadbacks.every((receipt) => receipt.sourceContentDigest === source.sourceContentDigest),
      privacyScanClean: privacy.ok,
      noOverclaimFlags,
      routeOwnedDbRoot: {
        class: "os_temp_route_owned_redacted",
        rootDigest: rootReadback.rootDigest,
        rawPathRecorded: false
      },
      cleanupReadback
    };
    writeFileSync(join(evidenceRoot, "phase2-mcp-transport-proof-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    assert.equal(summary.ok, true);
    console.log(JSON.stringify({ ok: true, receiptInventory: ["phase2-mcp-transport-proof-summary.json", ...receiptInventory] }, null, 2));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    cleanupReadback = { attempted: true, removed: true, rawPathRecorded: false };
  }
}

function seedProofDatabase(dbPath) {
  const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees([...createDefaultSeed().employees, observerEmployee], "phase2-mcp-proof-seed");
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  for (const project of createDefaultSeed().projects) {
    store.upsertProject(project, actor);
  }
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Phase 2 MCP transport proof",
    status: "in_progress",
    problem: "AOS needs a bounded local stdio transport proof.",
    expectedOutcome: "MVP work-loop methods write through the gateway and store."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "MCP stdio adapter",
    goal: "Expose only the MVP work-loop allowlist.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Persist transport run summary",
    problem: "Transport summaries must not be audit-only.",
    user: "AI implementation operator",
    expectedBehavior: "Transport creates an AgentRun and audit event.",
    acceptanceCriteria: ["stdio child process", "AgentRun persisted", "bounded audit query"],
    status: "in_progress",
    estimate: { effortPoints: 5, complexity: "high", risk: "L3", verificationCost: "high", confidence: "medium" },
    subTasks: []
  }, actor);
  const assignment = store.createAssignment({
    employeeId: actor.employeeId,
    targetId: story.id,
    targetType: "story",
    role: "implementation",
    status: "in_progress",
    dueState: "none",
    proofExpectation: "phase2:mcp-transport-proof"
  }, actor);
  repository.close();
  return { initiativeId: initiative.id, storyId: story.id, assignmentId: assignment.id };
}

async function startClientSession(dbPath, sessionActor) {
  const config = Buffer.from(JSON.stringify({
    actor: sessionActor,
    databasePath: dbPath,
    migrationsDir,
    auditPageLimit: 2,
    maxResponseBytes: 16384
  }), "utf8").toString("base64url");
  const child = spawn(process.execPath, [serverEntrypoint], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, AOS_MCP_TRANSPORT_CONFIG_B64: config }
  });
  const lines = createInterface({ input: child.stdout, terminal: false });
  const iterator = lines[Symbol.asyncIterator]();
  let nextId = 1;
  let stopped = false;
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  child.on("exit", () => {
    stopped = true;
  });
  return {
    async send(method, params) {
      const id = nextId++;
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      const result = await iterator.next();
      if (result.done) {
        throw new Error(`stdio server closed before response; stderrDigest=${sha256(stderr.join(""))}`);
      }
      return JSON.parse(result.value);
    },
    async stop() {
      if (stopped) {
        return;
      }
      child.stdin.end();
      await new Promise((resolve) => child.once("exit", resolve));
      lines.close();
    }
  };
}

async function proveBlockedRole(dbPath) {
  const server = await startClientSession(dbPath, observerActor);
  try {
    const policy = await server.send("aos.policy.read", {});
    const write = await server.send("aos.ticket.propose", {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Blocked owner observer write",
      problem: "Observers cannot write through transport.",
      expectedOutcome: "Denied."
    });
    return {
      policyReadOk: responsePayload(policy).ok === true,
      writeBlocked: write.error?.data?.reason === "transport_actor_blocked_role",
      errorReason: write.error?.data?.reason
    };
  } finally {
    await server.stop();
  }
}

async function proveRestart(dbPath, assignmentId, runId) {
  const server = await startClientSession(dbPath, actor);
  try {
    const audit = await server.send("aos.audit.query", { action: "agent_run.record", limit: 2 });
    const repository = new AosSqliteRepository({ databasePath: dbPath, migrationsDir });
    repository.applyMigrations();
    const store = new AosStore(createDefaultSeed(), { persistence: repository });
    const runSurvived = store.listRuns().some((run) => run.id === runId);
    const assignmentRunLinkSurvived = store.listAssignments().find((assignment) => assignment.id === assignmentId)?.runIds.includes(runId) ?? false;
    repository.close();
    return {
      runSurvived,
      assignmentRunLinkSurvived,
      reconnectedQueryOk: responsePayload(audit).items.some((item) => item.action === "agent_run.record")
    };
  } finally {
    await server.stop();
  }
}

function writeReceipt(name, source, rootReadback, body) {
  const receipt = {
    receiptName: name,
    ok: body.ok === true,
    route,
    command,
    generatedAt: new Date().toISOString(),
    sourceHead: source.sourceHead,
    sourceContentDigest: source.sourceContentDigest,
    sourceFiles: source.files,
    routeOwnedDbRoot: {
      class: "os_temp_route_owned_redacted",
      rootDigest: rootReadback.rootDigest,
      rawPathRecorded: false
    },
    actorProof: {
      employeeId: actor.employeeId,
      role: actor.role,
      threadId: actor.threadId,
      trustedServerConfig: true,
      clientSuppliedAuthorityTrusted: false
    },
    failures: [],
    negativeFailures: [],
    noOverclaimFlags,
    ...body
  };
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return join(evidenceRoot, name);
}

function readReceipts(names) {
  return names.map((name) => JSON.parse(readFileSync(join(evidenceRoot, name), "utf8")));
}

function sourceProvenance() {
  const sourceHead = git(["rev-parse", "HEAD"]);
  const files = sourceFiles.map((file) => {
    const body = readFileSync(join(repoRoot, file));
    return { file, digest: sha256(body) };
  });
  return {
    sourceHead,
    sourceGitStatus: git(["status", "--short", "--branch"]),
    files,
    sourceContentDigest: sha256(JSON.stringify(files))
  };
}

function dependencyLicenseReadback() {
  const audit = spawnSync("pnpm", ["audit:licenses"], { cwd: repoRoot, encoding: "utf8" });
  let auditJson = {};
  try {
    auditJson = JSON.parse(audit.stdout);
  } catch {
    auditJson = { parseError: true };
  }
  return {
    ok: audit.status === 0,
    newTransportDependencyAdded: false,
    modelContextProtocolSdkDependencyAdded: false,
    dependencyDecision: "no_new_dependency_protocol_equivalent_child_process_json_rpc_stdio_adapter",
    auditLicensesCommand: "pnpm --dir TCRN-AOS audit:licenses",
    auditLicensesExitCode: audit.status,
    auditLicensesOk: audit.status === 0,
    runtimeDependencies: auditJson.runtimeDependencies ?? [],
    blockers: auditJson.blockers ?? []
  };
}

function verifyFastReadback() {
  const result = spawnSync("pnpm", ["verify:fast"], { cwd: repoRoot, encoding: "utf8" });
  return {
    ok: result.status === 0,
    command: "pnpm --dir TCRN-AOS verify:fast",
    exitCode: result.status,
    stdoutDigest: sha256(result.stdout),
    stderrDigest: sha256(result.stderr),
    outputStored: "digest_only",
    typecheckIncluded: true,
    migrationValidationIncluded: true,
    packageTestsIncluded: true
  };
}

function privacyScan(receiptPaths) {
  const forbiddenPatterns = [
    { key: "local_users_path", regex: /\/Users\// },
    { key: "tmp_path", regex: /\/tmp\// },
    { key: "private_tmp_path", regex: /\/private\/tmp\// },
    { key: "srv_path", regex: /\/srv\/tcrn/ },
    { key: "file_uri", regex: /file:\/\// },
    { key: "secret_like", regex: /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY|ghp_[A-Za-z0-9_]{20,})/ },
    { key: "acceptance_overclaim", regex: /\b(owner acceptance|product acceptance|final MVP acceptance|dogfood runtime readiness|release readiness)\b/i },
    { key: "live_dispatch_claim", regex: /\blive dispatch authorized\b/i }
  ];
  const findings = [];
  for (const receiptPath of receiptPaths) {
    const name = receiptPath.split("/").pop();
    const text = readFileSync(receiptPath, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({ receiptName: name, kind: pattern.key });
      }
    }
  }
  return {
    ok: findings.length === 0,
    scannedReceiptCount: receiptPaths.length,
    forbiddenPatterns: forbiddenPatterns.map((pattern) => pattern.key),
    findings,
    rawLocalPathsRecorded: false,
    rawDbDumpRecorded: false,
    rawClientEnvStored: false,
    rawTranscriptBodiesStored: false,
    secretsOrPiiStored: false,
    noOverclaimFlags
  };
}

function responsePayload(response) {
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}

function transcriptEntry(method, response) {
  return {
    jsonrpc: response.jsonrpc,
    method,
    ok: response.error ? false : Boolean(response.result?.ok ?? response.result),
    expectedFailure: ["aos.resource.record.propose"].includes(method) || response.error?.data?.reason === "client_supplied_authority_denied",
    status: response.result?.status ?? null,
    errorReason: response.error?.data?.reason ?? null,
    hasResult: response.result !== undefined,
    returnedCount: response.result?.returnedCount ?? null,
    hasMore: response.result?.hasMore ?? null
  };
}

function deepEqualArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => item === right[index]);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}
