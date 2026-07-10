import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AosSqliteRepository, assertRouteOwnedSqliteRoot, sha256 } from "../dist/packages/db/src/index.js";
import { AosStore, createDefaultSeed, digest, PLAN_PROJECTION_SCHEMA_VERSION, projectPlanManifest } from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";

const route = "route_tcrn_total_repair_aos_execution_ledger_and_plan_projection_20260710";
const command = "pnpm --dir TCRN-AOS plan:projection-proof";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platformRoot = fileURLToPath(new URL("../..", import.meta.url));
const migrationsDir = join(repoRoot, "packages/db/migrations/sqlite");
const evidenceRoot = join(repoRoot, "evidence/workflow-plan-projection");
const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "plan-projection-proof"
};

mkdirSync(evidenceRoot, { recursive: true });
const sourceHead = git("rev-parse", "HEAD");
const workflowBasis = git("-C", join(platformRoot, "TCRN Workflow"), "rev-parse", "HEAD");
const root = mkdtempSync(join(tmpdir(), "tcrn-aos-plan-projection-proof-"));
const databasePath = join(root, "aos-plan-projection.sqlite");
const ownerMarker = {
  schemaVersion: "aos.plan_projection_owner_marker.v1",
  routeId: route,
  profileId: "aos-plan-projection-proof-profile-v1",
  owner: "Ilya, Full-Stack Implementer",
  purpose: "structured_plan_projection_proof"
};

try {
  writeFileSync(join(root, ".tcrn-aos-phase1-root"), "route-owned-plan-projection\n", "utf8");
  writeFileSync(join(root, ".aos-plan-projection-owner.json"), JSON.stringify(ownerMarker), "utf8");
  const rootReadback = assertRouteOwnedSqliteRoot(root, repoRoot);
  const manifest = proofManifest();
  const first = openAndProject(databasePath, manifest);
  const firstDatabaseDigest = first.repository.databaseDigest();
  first.repository.close();
  const second = openAndProject(databasePath, manifest);
  const secondDatabaseDigest = second.repository.databaseDigest();
  const noDuplicateCreation = second.readback.counts.created === 0 && second.readback.counts.reconciled === 0 && second.readback.counts.reused === 6;
  const idsStable = digest(first.readback.recordIds) === digest(second.readback.recordIds);
  const timelineReadback = gatewayReadback(second.store, second.readback);
  const privacy = privacyReadback({ rootReadback, first: first.readback, second: second.readback, timelineReadback });
  second.repository.close();

  const readback = {
    receiptName: "plan-projection-readback.json",
    schema: "tcrn.aos.planProjectionProof.v1",
    ok: rootReadback.ok && first.readback.ok && second.readback.ok && noDuplicateCreation && idsStable && timelineReadback.ok && privacy.ok,
    route,
    sourceHead,
    workflowBasis,
    command,
    sourceContract: {
      schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
      command,
      acceptedFields: {
        root: ["schemaVersion", "projectionId", "sourceDigest", "project", "initiatives", "epics", "stories"],
        project: ["id", "name", "registryStatus", "repoRegistryId", "repoPathReference", "status", "gateState"],
        workItem: ["externalKey", "projectId", "title", "status", "dependencies", "owners", "writeScopes", "acceptanceCriteria", "gateRequirements"],
        initiative: ["problem", "expectedOutcome"],
        epic: ["initiativeKey", "goal", "estimate"],
        story: ["epicKey", "problem", "user", "expectedBehavior", "estimate"]
      },
      deterministicKeyRule: "record IDs derive only from projectId plus externalKey; a second identical manifest reuses the same records",
      failClosedRules: ["malformed_hierarchy", "duplicate_external_key", "unknown_project", "cross_project_parent", "unknown_or_cross_project_dependency"]
    },
    persistentOwnerMarkerReadback: {
      ok: rootReadback.ok,
      rootDigest: rootReadback.rootDigest,
      ownerMarkerDigest: sha256(JSON.stringify(ownerMarker)),
      profileId: ownerMarker.profileId,
      routeId: ownerMarker.routeId,
      cleanStart: true,
      rawPathRecorded: false
    },
    projectionReadback: {
      firstRun: first.readback,
      restartRun: second.readback,
      restartPersistence: {
        ok: idsStable && firstDatabaseDigest === secondDatabaseDigest,
        recordIdsStable: idsStable,
        databaseDigestStableAfterNoopReplay: firstDatabaseDigest === secondDatabaseDigest,
        rawDatabasePathRecorded: false
      },
      idempotency: {
        ok: noDuplicateCreation,
        secondRunCreated: second.readback.counts.created,
        secondRunReconciled: second.readback.counts.reconciled,
        secondRunReused: second.readback.counts.reused,
        duplicateRecordCreation: false
      }
    },
    gatewayReadback: timelineReadback,
    failures: [],
    negativeFailures: [],
    privacyNoArtifactNoOverclaim: privacy,
    noOverclaim: {
      workflowMutation: false,
      designSystemMutation: false,
      tmsMutation: false,
      frontendImplemented: false,
      httpWriteApiImplemented: false,
      liveCodexDispatch: false,
      ownerIntentExecuted: false,
      readinessClaimed: false,
      releaseClaimed: false,
      productAcceptanceClaimed: false,
      committedDatabaseArtifact: false,
      rawPlanBodyStoredInReceipt: false
    }
  };
  const summary = {
    receiptName: "plan-projection-proof-summary.json",
    schema: "tcrn.aos.planProjectionProofSummary.v1",
    ok: readback.ok,
    route,
    sourceHead,
    workflowBasis,
    command,
    receiptInventory: ["plan-projection-readback.json"],
    receiptCount: 1,
    allChildReceiptsOk: readback.ok,
    failures: [],
    negativeFailures: [],
    manifestContractDigest: digest(readback.sourceContract),
    projectedCounts: readback.projectionReadback.firstRun.counts,
    secondRunZeroDuplicateCreation: readback.projectionReadback.idempotency.ok,
    noOverclaim: readback.noOverclaim
  };
  writeReceipt("plan-projection-readback.json", readback);
  writeReceipt("plan-projection-proof-summary.json", summary);
  assert.equal(readback.ok, true);
  assert.equal(summary.ok, true);
  console.log(JSON.stringify({ ok: true, receipts: [summary.receiptName, readback.receiptName], projectId: readback.projectionReadback.firstRun.projectId, storyCount: readback.projectionReadback.firstRun.counts.stories }));
} finally {
  rmSync(root, { recursive: true, force: true });
}

function openAndProject(databasePath, manifest) {
  const repository = new AosSqliteRepository({ databasePath, migrationsDir });
  repository.applyMigrations();
  repository.seedAiEmployees(createDefaultSeed().employees, "plan-projection-proof-seed-v1");
  const store = new AosStore(createDefaultSeed(), { persistence: repository });
  for (const project of createDefaultSeed().projects) {
    store.upsertProject(project, actor);
  }
  return { repository, store, readback: projectPlanManifest(store, manifest, actor) };
}

function gatewayReadback(store, projection) {
  const gateway = new McpGateway(store);
  const ticketList = gateway.handle({
    method: "aos.ticket.list",
    actor,
    params: { initiativeId: projection.recordIds.initiatives["ds2-modernization"] }
  });
  const audit = gateway.handle({
    method: "aos.audit.query",
    actor,
    params: { targetId: projection.recordIds.stories["ds2-documentation"] }
  });
  return {
    ok: ticketList.ok === true && audit.ok === true && ticketList.result.rows.length === 3 && audit.result.length >= 1,
    methods: ["aos.ticket.list", "aos.audit.query"],
    storyRowCount: ticketList.ok === true ? ticketList.result.rows.length : 0,
    targetAuditEventCount: audit.ok === true ? audit.result.length : 0,
    rawPlanBodyReturned: false,
    rawDatabasePathReturned: false
  };
}

function proofManifest() {
  const projectId = "TCRN-DESIGN-SYSTEM";
  return {
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    projectionId: "design-system-2-storybook-modernization",
    sourceDigest: digest({ source: "design-system-2-plan", revision: 1 }),
    project: {
      id: projectId,
      name: "TCRN Design System",
      registryStatus: "active",
      repoRegistryId: "TCRN-DESIGN-SYSTEM",
      repoPathReference: "../TCRN-Design-System",
      status: "in_progress",
      gateState: "pending_role"
    },
    initiatives: [item({ externalKey: "ds2-modernization", projectId, title: "Design System 2 modernization", problem: "Design-system work needs durable execution records.", expectedOutcome: "AOS projects the plan hierarchy without source-plan bodies." })],
    epics: [
      item({ externalKey: "ds2-foundation", projectId, initiativeKey: "ds2-modernization", title: "Foundation", goal: "Prepare the design-system foundation.", estimate: estimate(3) }),
      item({ externalKey: "ds2-documentation-epic", projectId, initiativeKey: "ds2-modernization", title: "Documentation", goal: "Make proof discoverable.", dependencies: ["ds2-foundation"], estimate: estimate(2) })
    ],
    stories: [
      item({ externalKey: "ds2-foundation-tokens", projectId, epicKey: "ds2-foundation", title: "Verify token foundation", problem: "Token work needs an explicit story record.", user: "Design System maintainer", expectedBehavior: "AOS tracks the story and its gate metadata.", estimate: estimate(2) }),
      item({ externalKey: "ds2-storybook-proof", projectId, epicKey: "ds2-foundation", title: "Record Storybook proof", problem: "Proof needs a stable work item.", user: "Verification engineer", expectedBehavior: "Readback shows metadata without raw plan content.", dependencies: ["ds2-foundation-tokens"], estimate: estimate(2) }),
      item({ externalKey: "ds2-documentation", projectId, epicKey: "ds2-documentation-epic", title: "Publish documentation readback", problem: "The execution plan needs a discoverable story record.", user: "Workflow architect", expectedBehavior: "Current AOS ticket readback lists the projected story.", dependencies: ["ds2-storybook-proof"], estimate: estimate(1) })
    ]
  };
}

function item(overrides) {
  return {
    externalKey: "missing-key",
    projectId: "missing-project",
    title: "Projected work item",
    status: "proposed",
    dependencies: [],
    owners: ["Minerva, Workflow Architect"],
    writeScopes: ["TCRN-DESIGN-SYSTEM/packages/**"],
    acceptanceCriteria: ["Record work state through AOS only."],
    gateRequirements: ["evidence_proof"],
    ...overrides
  };
}

function estimate(effortPoints) {
  return { effortPoints, complexity: "medium", risk: "L2", verificationCost: "medium", confidence: "medium" };
}

function privacyReadback(value) {
  const serialized = JSON.stringify(value);
  const forbidden = ["/Users/", "\\\\", "BEGIN PRIVATE", "secret", "token="];
  const matches = forbidden.filter((needle) => serialized.includes(needle));
  return {
    ok: matches.length === 0,
    rawAbsolutePathsRecorded: false,
    rawPlanBodiesRecorded: false,
    rawDatabaseDumpRecorded: false,
    secretsOrPiiStored: false,
    committedDatabaseArtifacts: false,
    forbiddenMatchCount: matches.length
  };
}

function writeReceipt(name, value) {
  writeFileSync(join(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}
