import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { digest } from "../dist/packages/domain/src/index.js";
import { runExecutionLedgerCli } from "./execution-ledger-cli-core.mjs";
import { runPlanProjectionCli } from "./plan-project-cli-core.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const workflowRoot = fileURLToPath(new URL("../../TCRN Workflow", import.meta.url));
const migrationsDir = fileURLToPath(new URL("../packages/db/migrations/sqlite", import.meta.url));
const evidenceRoot = join(repoRoot, "evidence/workflow-plan-projection");
const route = "route_tcrn_aos_execution_ledger_transition_cli_for_ds2_G0_after_identity_adoption_20260710";
const workflowBasis = "bb9c8a1a4676318afcc296c10684cea83c427f16";
const expectedStoryId = "story_0166649b9d7fd061";

await main();

async function main() {
  mkdirSync(evidenceRoot, { recursive: true });
  const root = await mkdtemp(join(await realpath(tmpdir()), "tcrn-aos-execution-ledger-proof-"));
  const profileRoot = join(root, "profile");
  const markerPath = join(root, "owner-marker.json");
  const commandPath = join(root, "command.json");
  const projectionReadbackPath = join(profileRoot, "projection-readback.json");
  const ledgerReadbackPath = join(profileRoot, "execution-ledger-readback.json");
  const manifestPath = join(workflowRoot, ".context/platform/plans/evidence/2026-07-10-workflow-aos-execution-control-repair/ds2-plan-projection-manifest.json");
  const marker = {
    profileId: "aos-ds2-g0-execution-ledger-proof-v1",
    routeId: route,
    runContext: "ds2-g0-execution-ledger-proof",
    owner: "Ilya, Full-Stack Implementer"
  };
  try {
    await writeFile(markerPath, JSON.stringify(marker), "utf8");
    const projection = await runPlanProjectionCli([
      "--manifest", manifestPath,
      "--profile-root", profileRoot,
      "--owner-marker", markerPath,
      "--readback", projectionReadbackPath
    ]);
    const targetId = Object.values(projection.projectionReadback.recordIds.stories).find((id) => id === expectedStoryId);
    if (targetId !== expectedStoryId) throw new Error("execution_ledger_expected_g0_story_missing");
    const beforeStatuses = await projectedStoryStatuses(profileRoot);
    await writeFile(commandPath, JSON.stringify(command(targetId)), "utf8");
    const first = await runExecutionLedgerCli([
      "--command", commandPath,
      "--profile-root", profileRoot,
      "--owner-marker", markerPath,
      "--readback", ledgerReadbackPath
    ]);
    const afterFirstStatuses = await projectedStoryStatuses(profileRoot);
    const second = await runExecutionLedgerCli([
      "--command", commandPath,
      "--profile-root", profileRoot,
      "--owner-marker", markerPath,
      "--readback", ledgerReadbackPath
    ]);
    const negatives = await proveNegativeCases(profileRoot, markerPath, commandPath, ledgerReadbackPath);
    const noArtifact = noTrackedRuntimeArtifacts();
    const privacy = receiptPrivacy(first) && receiptPrivacy(second);
    const otherStoriesUnchanged = [...beforeStatuses.entries()]
      .filter(([id]) => id !== targetId)
      .every(([id, status]) => afterFirstStatuses.get(id) === status);
    const readback = {
      schema: "tcrn.aos.executionLedgerProofReadback.v1",
      receiptName: "ds2-g0-execution-ledger-readback.json",
      ok: first.ok && second.ok && first.executionReadback.status.after === "in_progress"
        && second.executionReadback.status.replayed === true
        && first.executionReadback.eventReadbacks.length === 4
        && second.executionReadback.eventReadbacks.every((event) => event.replayed)
        && otherStoriesUnchanged && negatives.ok && noArtifact.ok && privacy,
      generatedAt: new Date().toISOString(),
      route,
      workflowBasis,
      sourceHead: gitHead(),
      incomingAosBasis: "5909743c8992517660971aa1c0e1bcf2fca5c967",
      command: "pnpm --dir TCRN-AOS execution:ledger --command <json> --profile-root <dir> --owner-marker <json-or-file> --readback <json>",
      g0Readback: {
        initiativeId: "init_a445e087614fa8af",
        epicId: "epic_02ce1f8f7bec2d2f",
        storyId: targetId,
        beforeStatus: first.executionReadback.status.before,
        afterStatus: first.executionReadback.status.after,
        otherStoryCount: beforeStatuses.size - 1,
        otherStoriesUnchanged,
        eventTypes: first.executionReadback.eventReadbacks.map((event) => event.eventType),
        eventIds: first.executionReadback.eventReadbacks.map((event) => ({
          eventType: event.eventType,
          eventKey: event.eventKey,
          auditEventId: event.auditEventId,
          commentId: event.commentId
        })),
        firstAuditEventCount: first.restartPersistence.auditEventsForTarget,
        firstCommentCount: first.restartPersistence.commentsForTarget,
        replayAuditEventCount: second.restartPersistence.auditEventsForTarget,
        replayCommentCount: second.restartPersistence.commentsForTarget
      },
      restartPersistence: second.restartPersistence,
      eventKeyReplay: {
        identicalReplayReused: second.executionReadback.status.replayed,
        noDuplicateAuditRows: first.restartPersistence.auditEventsForTarget === second.restartPersistence.auditEventsForTarget,
        noDuplicateCommentRows: first.restartPersistence.commentsForTarget === second.restartPersistence.commentsForTarget,
        conflictingReplayRejected: negatives.conflictingReplayRejected
      },
      negativeReadback: negatives,
      profile: { ownerMarkerDigest: digest(marker), rawPathRecorded: false, rawDatabaseDumpRecorded: false },
      noGitArtifact: noArtifact,
      privacy,
      noOverclaim: {
        workflowMutation: false,
        designSystemMutation: false,
        tmsMutation: false,
        frontendImplemented: false,
        liveDispatch: false,
        ownerIntentExecuted: false,
        g0AcceptanceClaimed: false,
        readinessClaimed: false,
        releaseClaimed: false,
        publicationClaimed: false,
        pushExecuted: false,
        rawDatabaseDumpRecorded: false,
        committedDatabaseArtifact: false
      },
      failures: [],
      negativeFailures: []
    };
    const summary = {
      schema: "tcrn.aos.executionLedgerProofSummary.v1",
      receiptName: "ds2-g0-execution-ledger-proof-summary.json",
      ok: readback.ok,
      generatedAt: readback.generatedAt,
      route,
      sourceHead: readback.sourceHead,
      workflowBasis,
      incomingAosBasis: readback.incomingAosBasis,
      receiptInventory: [readback.receiptName],
      allChildReceiptsOk: readback.ok,
      g0StoryId: targetId,
      transition: "proposed_to_in_progress",
      eventCount: readback.g0Readback.eventTypes.length,
      otherStoriesUnchanged,
      identicalReplayReused: readback.eventKeyReplay.identicalReplayReused,
      noDuplicateAuditRows: readback.eventKeyReplay.noDuplicateAuditRows,
      noDuplicateCommentRows: readback.eventKeyReplay.noDuplicateCommentRows,
      failures: [],
      negativeFailures: [],
      noOverclaim: readback.noOverclaim
    };
    if (!readback.ok) throw new Error("execution_ledger_proof_readback_not_ok");
    await writeReceipt(readback.receiptName, readback);
    await writeReceipt(summary.receiptName, summary);
    console.log(JSON.stringify({ ok: true, receipts: [summary.receiptName, readback.receiptName], storyId: targetId }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function command(targetId) {
  return {
    schemaVersion: "tcrn.aos.executionLedger.v1",
    projectId: "TCRN-DESIGN-SYSTEM",
    routeId: route,
    targetType: "story",
    targetId,
    expectedStatus: "proposed",
    nextStatus: "in_progress",
    actor: {
      employeeId: "employee-ilya",
      role: "implementation",
      threadId: "019f4b52-e331-7481-8c13-372928cc4e6c",
      sessionId: "ds2-g0-execution-ledger-proof"
    },
    events: ["route_sent", "first_output", "interrupted", "recovery_started"].map((type, index) => ({
      type,
      eventKey: "ds2-g0-" + type + "-v1",
      occurredAt: "2026-07-10T0" + index + ":00:00.000Z",
      sourceEvidenceDigest: digest({ route, type, source: "workflow_route_history" })
    }))
  };
}

async function projectedStoryStatuses(profileRoot) {
  const readback = JSON.parse(await readFile(join(profileRoot, "projection-readback.json"), "utf8"));
  const { AosSqliteRepository } = await import("../dist/packages/db/src/index.js");
  const { AosStore, createDefaultSeed } = await import("../dist/packages/domain/src/index.js");
  const repository = new AosSqliteRepository({
    databasePath: join(profileRoot, "db", "aos-plan-projection.sqlite"),
    migrationsDir
  });
  repository.applyMigrations();
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  const expectedIds = new Set(Object.values(readback.projectionReadback.recordIds.stories));
  const statuses = new Map(store.listStories().filter((story) => expectedIds.has(story.id)).map((story) => [story.id, story.status]));
  repository.close();
  return statuses;
}

async function proveNegativeCases(profileRoot, markerPath, commandPath, ledgerReadbackPath) {
  const original = JSON.parse(await readFile(commandPath, "utf8"));
  const stalePath = join(dirname(commandPath), "stale-command.json");
  const conflictPath = join(dirname(commandPath), "conflict-command.json");
  await writeFile(stalePath, JSON.stringify({
    ...original,
    events: original.events.map((event) => ({ ...event, eventKey: event.eventKey + "-stale" }))
  }), "utf8");
  await writeFile(conflictPath, JSON.stringify({
    ...original,
    events: original.events.map((event, index) => index === 0
      ? { ...event, sourceEvidenceDigest: digest("conflicting-source-evidence") }
      : event)
  }), "utf8");
  const staleExpectedStatusRejected = await rejects(
    () => runExecutionLedgerCli(["--command", stalePath, "--profile-root", profileRoot, "--owner-marker", markerPath, "--readback", ledgerReadbackPath]),
    "execution_ledger_expected_status_stale"
  );
  const conflictingReplayRejected = await rejects(
    () => runExecutionLedgerCli(["--command", conflictPath, "--profile-root", profileRoot, "--owner-marker", markerPath, "--readback", ledgerReadbackPath]),
    "execution_ledger_event_key_conflict"
  );
  const unsafeRootRejected = await rejects(
    () => runExecutionLedgerCli([
      "--command", commandPath,
      "--profile-root", join(repoRoot, ".unsafe-execution-ledger-root"),
      "--owner-marker", markerPath,
      "--readback", join(repoRoot, ".unsafe-execution-ledger-root", "readback.json")
    ]),
    "runtime_root_inside_git_tree"
  );
  return {
    ok: staleExpectedStatusRejected && conflictingReplayRejected && unsafeRootRejected,
    staleExpectedStatusRejected,
    conflictingReplayRejected,
    unsafeRootRejected
  };
}

async function rejects(operation, expected) {
  try {
    await operation();
    return false;
  } catch (error) {
    return error instanceof Error && error.message === expected;
  }
}

function noTrackedRuntimeArtifacts() {
  const output = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  const matches = output.split("\n").filter((path) => /\.(sqlite|sqlite3|db|db-wal|db-shm|jsonl|bak|backup)$/i.test(path));
  return { ok: matches.length === 0, trackedArtifactCount: matches.length };
}

function receiptPrivacy(value) {
  const serialized = JSON.stringify(value);
  return !serialized.includes("/Users/") && !serialized.includes("BEGIN PRIVATE") && !serialized.includes("-----BEGIN");
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function writeReceipt(name, value) {
  const serialized = JSON.stringify(value, null, 2) + "\n";
  if (serialized.includes("/Users/") || serialized.includes("BEGIN PRIVATE") || serialized.includes("-----BEGIN")) {
    throw new Error("execution_ledger_receipt_privacy_violation");
  }
  await writeFile(join(evidenceRoot, name), serialized, "utf8");
}
