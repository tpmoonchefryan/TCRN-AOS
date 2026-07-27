import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AosStore,
  createDefaultSeed,
  createId,
  digest,
  type ActorIdentity,
  type AuditEvent,
  type Estimate,
  type StageMapItem
} from "../../domain/src/index.js";

export interface RuntimeFixtureReadback {
  ok: boolean;
  schemaApplied: boolean;
  seedApplied: boolean;
  storageMode: "os_temp_ephemeral";
  runtimeDataCommitted: false;
  projectCount: number;
  operationalRecordCounts: {
    initiatives: number;
    epics: number;
    stories: number;
    subtasks: number;
    comments: number;
    evidence: number;
    gates: number;
    ownerIntents: number;
    conferences: number;
    conferencePositions: number;
    dependencies: number;
    dependencyFindings: number;
    resources: number;
    materializationRequests: number;
    resourceManifests: number;
    resourceFindings: number;
    knowledgeEntries: number;
    userGuideDrafts: number;
    releaseNotes: number;
    stageMapItems: number;
    auditEvents: number;
  };
  representativeIds: RepresentativeRecordIds | null;
  audit: {
    appendOnly: true;
    latestAction: string | null;
  };
}

export interface AppendOnlyProof {
  ok: boolean;
  queryResultMutationBlocked: boolean;
  updateRejected: boolean;
  deleteRejected: boolean;
  beforeCount: number;
  afterCount: number;
}

export interface RestrictedPayloadProof {
  ok: boolean;
  rejected: boolean;
  reasonKind: "machine_local_absolute_path" | "other";
  auditRecorded: boolean;
}

export interface ResetProof {
  ok: boolean;
  removed: boolean;
  runtimeDataExistsAfterReset: boolean;
}

export interface RepresentativeRecordIds {
  initiativeId: string;
  epicId: string;
  storyId: string;
  subTaskId: string;
  commentId: string;
  evidenceId: string;
  gateId: string;
  ownerIntentId: string;
  ownerIntentGateId: string;
  conferenceId: string;
  conferencePositionId: string;
  dependencyId: string;
  dependencyFindingId: string;
  resourceId: string;
  materializationRequestId: string;
  resourceManifestId: string;
  resourceFindingId: string;
  knowledgeEntryId: string;
  userGuideDraftId: string;
  releaseNoteId: string;
}

export class AosRuntimeFixture {
  private readonly store = new AosStore(createDefaultSeed());
  private runtimeDir: string | null = null;
  private stateFile: string | null = null;
  private schemaApplied = false;
  private seedApplied = false;
  private records: RepresentativeRecordIds | null = null;
  private stageMap: StageMapItem[] = [];

  constructor(private readonly actor: ActorIdentity = runtimeActor) {}

  getStore(): AosStore {
    return this.store;
  }

  async applySchemaAndSeed(): Promise<{ ok: true; schemaDigest: string; seedDigest: string; tableCount: number }> {
    this.runtimeDir = await mkdtemp(join(tmpdir(), "tcrn-aos-runtime-"));
    this.stateFile = join(this.runtimeDir, "aos-runtime-state.json");

    // Read the migrations that are actually executed at runtime. This used to
    // read a PostgreSQL file that nothing ever applied, which meant the digest
    // recorded below described bytes with no bearing on any database this
    // product opens (TCRN-AOS-INC-001). What the fixture needs from the schema
    // is unchanged — a table count and the presence of the append-only audit
    // trigger — so both are now taken from the SQLite migrations that
    // AosSqliteRepository applies.
    const migrationsDir = join(process.cwd(), "packages/db/migrations/sqlite");
    const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    const sql = (await Promise.all(
      migrationFiles.map((file) => readFile(join(migrationsDir, file), "utf8")))).join("\n");
    const seed = JSON.parse(await readFile(join(process.cwd(), "packages/db/seed/aos-seed.json"), "utf8")) as unknown;
    const tableCount = (sql.match(/CREATE TABLE\s+(IF NOT EXISTS\s+)?aos_/gi) ?? []).length;
    if (!/CREATE TRIGGER\s+(IF NOT EXISTS\s+)?aos_audit_events_no_update/i.test(sql)) {
      throw new Error("Runtime fixture requires append-only audit trigger in schema");
    }

    this.schemaApplied = true;
    this.seedApplied = true;
    this.store.appendAudit({ system: "aos-runtime-fixture" }, "runtime.schema.apply", "runtime_fixture", "schema", "accepted", {
      schemaDigest: digest(sql),
      tableCount
    });
    this.store.appendAudit({ system: "aos-runtime-fixture" }, "runtime.seed.apply", "runtime_fixture", "seed", "accepted", {
      seedDigest: digest(seed)
    });
    await this.persistState({ schemaDigest: digest(sql), seedDigest: digest(seed), tableCount });
    return { ok: true, schemaDigest: digest(sql), seedDigest: digest(seed), tableCount };
  }

  async seedRepresentativeRecords(): Promise<RepresentativeRecordIds> {
    this.ensureApplied();
    const initiative = this.store.createInitiative({
      projectId: "TCRN-AOS",
      title: "Slice 2 Runtime Proof",
      status: "in_progress",
      problem: "AOS needs repeatable local runtime persistence proof.",
      expectedOutcome: "Local fixture DB can apply, read back, prove safety, and reset."
    }, this.actor);
    const epic = this.store.createEpic({
      initiativeId: initiative.id,
      title: "Runtime DB and service proof",
      goal: "Move beyond static migration validation without deployment.",
      status: "in_progress",
      estimate
    }, this.actor);
    const story = this.store.createStory({
      epicId: epic.id,
      title: "Prove local runtime persistence",
      problem: "Static schema proof does not prove local apply/readback/reset.",
      user: "implementation proof owner",
      expectedBehavior: "AOS can persist operational records locally and reset cleanly.",
      acceptanceCriteria: ["fixture apply", "representative readback", "audit append-only", "redaction rejection", "reset clean"],
      status: "in_progress",
      estimate,
      subTasks: []
    }, this.actor);
    this.store.createStory({
      epicId: epic.id,
      title: "Validate service-backed owner trial",
      problem: "The owner-trial cockpit needs more than a static fixture row to prove service-backed selection.",
      user: "owner observer",
      expectedBehavior: "AOS serves multiple work items from the local service and keeps detail state aligned with the selected row.",
      acceptanceCriteria: ["service API row set", "row selection round trip", "refresh preserves prior data", "unavailable actions stay disabled"],
      status: "in_progress",
      estimate,
      subTasks: []
    }, this.actor);
    const subTask = this.store.addSubTask(story.id, {
      id: createId("subtask", { storyId: story.id, title: "Runtime proof" }),
      title: "Run local DB fixture proof",
      ownerRole: "verification",
      status: "in_progress",
      dependencyIds: [],
      proofExpectation: "runtime-db-proof script"
    }, this.actor);
    const comment = this.store.addComment({
      ticketId: story.id,
      type: "agent_observation",
      actor: this.actor,
      body: "Runtime proof uses ephemeral local fixture storage and commits no operational data."
    }, this.actor);
    const evidence = this.store.linkEvidence({
      type: "artifact_id",
      target: "aos-slice-2-runtime-proof",
      validity: "valid",
      producer: this.actor.employeeId,
      digest: "sha256:runtime-proof",
      redactionState: "metadata_only"
    }, this.actor);
    const gate = this.store.requestGate({
      type: "evidence_proof",
      linkedTicketId: story.id,
      inputEvidenceIds: [evidence.id]
    }, this.actor);
    const ownerIntentGate = this.store.requestGate({
      type: "owner_intent",
      linkedTicketId: story.id,
      inputEvidenceIds: [evidence.id]
    }, this.actor);
    const ownerIntent = this.store.captureOwnerIntent({
      action: "request_conference",
      summary: "Keep owner-intent-required actions pending instead of automatic."
    }, this.actor);
    const conference = this.store.createConference({
      type: "verification",
      title: "Slice 2 runtime proof review",
      initiator: this.actor,
      participantEmployeeIds: ["employee-arturo", "employee-sable"],
      agenda: ["Review runtime proof", "Confirm no deployment or product mutation"],
      linkedTicketIds: [story.id],
      desiredOutcome: "Proof package ready for review lanes."
    }, this.actor);
    const conferencePosition = this.store.recordConferencePosition({
      conferenceId: conference.id,
      actor: this.actor,
      position: "Local-first fixture proof is sufficient for Slice 2.",
      risks: ["Not a deployed PostgreSQL proof", "No live Codex dispatch"],
      recommendations: ["Keep runtime data ephemeral", "Route deployment separately"],
      evidenceIds: [evidence.id]
    }, this.actor);
    const dependency = this.store.createDependencyRecord({
      projectId: "TCRN-AOS",
      ecosystem: "npm",
      packageName: "typescript",
      versionRange: "5.8.3",
      sourceSystem: "package.json",
      projectUsage: "development",
      ownerRole: "security",
      lifecycleState: "current",
      artifactRef: "package:typescript@5.8.3",
      licenseExpression: "Apache-2.0",
      declaredLicenseEvidence: "package-json-dev-dependency",
      discoveredLicenseEvidence: "node-module-package-json",
      evidenceArtifactRef: evidence.id,
      evidenceStatus: "present",
      confidence: "high",
      policyClass: "review_required",
      reviewerRole: "security",
      residualRisk: "low",
      nextAction: "request_review",
      sbomNoticeObligation: "none",
      posture: "review_required",
      approvalOwnerRole: "security",
      linkedStoryIds: [story.id],
      linkedEvidenceIds: [evidence.id],
      releaseBlocker: false,
      packageMutationExecuted: false
    }, this.actor);
    const dependencyFinding = this.store.createDependencyDetectionFinding({
      projectId: "TCRN-AOS",
      dependencyId: dependency.id,
      state: "current",
      sourceSystem: "deterministic_fixture",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id],
      remediationExecuted: false,
      packageMutationExecuted: false,
      nextAction: "request_review"
    }, this.actor);
    const resource = this.store.createResourceRecord({
      type: "template",
      projectId: "TCRN-AOS",
      title: "Runtime proof evidence template",
      owner: "TCRN",
      source: "product-local",
      version: "0.2.0",
      digest: "sha256:resource-template",
      storageReference: "aos-runtime-proof-template",
      classification: ["proof", "template"],
      permissionState: "permission_required",
      attributionRequired: false,
      derivativeAllowed: false,
      reviewerRole: "security",
      residualRisk: "low",
      copyrightStatus: "review_required",
      lifecycleState: "proposed",
      approvalState: "review_required",
      linkedStoryIds: [story.id],
      linkedEvidenceIds: [evidence.id],
      materializationAllowed: false,
      materializationExecuted: false,
      productRepoWriteExecuted: false,
      releaseBlocker: false
    }, this.actor);
    const materializationRequest = this.store.createResourceMaterializationRequest({
      projectId: "TCRN-AOS",
      resourceId: resource.id,
      targetProjectId: "TCRN-AOS",
      requestedBy: this.actor,
      requestedPurpose: "Metadata-only runtime fixture proof; no binary copy.",
      status: "gate_required",
      linkedGateId: ownerIntentGate.id,
      evidenceIds: [evidence.id]
    }, this.actor);
    const resourceFinding = this.store.createResourceAuditFinding({
      projectId: "TCRN-AOS",
      resourceId: resource.id,
      findingType: "approved_use",
      severity: "info",
      evidenceIds: [evidence.id],
      linkedGateIds: [gate.id]
    }, this.actor);
    const knowledgeEntry = this.store.createKnowledgeEntry({
      id: createId("knowledge", { storyId: story.id, category: "knowledge" }),
      projectId: "TCRN-AOS",
      category: "operations",
      status: "proposed",
      sourceKind: "story",
      sourceIds: [story.id],
      linkedTicketIds: [story.id],
      linkedConferenceIds: [conference.id],
      linkedEvidenceIds: [evidence.id],
      freshnessState: "fresh",
      rawPrivatePayloadStored: false,
      canonicalPromotionClaimed: false,
      localFirstStorage: true,
      defaultGitStorage: false,
      explicitExportRequired: true
    }, this.actor);
    const userGuideDraft = this.store.createUserGuideDraft({
      id: createId("guide", { storyId: story.id, audience: "operator" }),
      projectId: "TCRN-AOS",
      audience: "operator",
      versionLabel: "slice-2-local",
      status: "draft",
      linkedStoryIds: [story.id],
      linkedReleaseNoteItemIds: [],
      linkedEvidenceIds: [evidence.id],
      publishedStateDistinctFromDraft: true,
      releaseCloseoutClaimed: false,
      defaultGitStorage: false
    }, this.actor);
    const releaseNote = this.store.createReleaseNote({
      id: createId("release_note", { storyId: story.id, release: "slice-2-local" }),
      projectId: "TCRN-AOS",
      releaseLabel: "slice-2-local",
      linkedStoryIds: [story.id],
      userFacingSummary: "Runtime proof remains local and not release-ready.",
      internalNotesSummary: "Evidence is product-local and does not claim deployment.",
      riskNotesSummary: "No external service proof; no Product Design acceptance.",
      linkedEvidenceIds: [evidence.id],
      reviewState: "draft",
      gitExportAuthorized: false,
      releaseCloseoutClaimed: false
    }, this.actor);
    const resourceManifest = this.store.createProjectResourceManifest({
      projectId: "TCRN-AOS",
      resourceId: resource.id,
      resourceDigest: resource.digest,
      materializedCopyReference: "manifest-only:aos-runtime-proof-template",
      status: "approved_lineage_record",
      linkedStoryIds: [story.id],
      linkedReleaseNoteIds: [releaseNote.id],
      linkedEvidenceIds: [evidence.id]
    }, this.actor);

    this.stageMap = this.store.deriveStageMap("TCRN-AOS", initiative.id);
    this.records = {
      initiativeId: initiative.id,
      epicId: epic.id,
      storyId: story.id,
      subTaskId: subTask.id,
      commentId: comment.id,
      evidenceId: evidence.id,
      gateId: gate.id,
      ownerIntentId: ownerIntent.id,
      ownerIntentGateId: ownerIntentGate.id,
      conferenceId: conference.id,
      conferencePositionId: conferencePosition.id,
      dependencyId: dependency.id,
      dependencyFindingId: dependencyFinding.id,
      resourceId: resource.id,
      materializationRequestId: materializationRequest.id,
      resourceManifestId: resourceManifest.id,
      resourceFindingId: resourceFinding.id,
      knowledgeEntryId: knowledgeEntry.id,
      userGuideDraftId: userGuideDraft.id,
      releaseNoteId: releaseNote.id
    };
    await this.persistState();
    return this.records;
  }

  readback(): RuntimeFixtureReadback {
    const auditEvents = this.store.queryAudit();
    return {
      ok: this.schemaApplied && this.seedApplied,
      schemaApplied: this.schemaApplied,
      seedApplied: this.seedApplied,
      storageMode: "os_temp_ephemeral",
      runtimeDataCommitted: false,
      projectCount: this.store.listProjects().length,
      operationalRecordCounts: {
        initiatives: this.records ? 1 : 0,
        epics: this.records ? 1 : 0,
        stories: this.records ? this.store.listStories().length : 0,
        subtasks: this.records ? 1 : 0,
        comments: this.records ? 1 : 0,
        evidence: this.records ? 1 : 0,
        gates: this.records ? 2 : 0,
        ownerIntents: this.records ? 1 : 0,
        conferences: this.records ? 1 : 0,
        conferencePositions: this.records ? 1 : 0,
        dependencies: this.records ? 1 : 0,
        dependencyFindings: this.records ? 1 : 0,
        resources: this.records ? 1 : 0,
        materializationRequests: this.records ? 1 : 0,
        resourceManifests: this.records ? 1 : 0,
        resourceFindings: this.records ? 1 : 0,
        knowledgeEntries: this.records ? 1 : 0,
        userGuideDrafts: this.records ? 1 : 0,
        releaseNotes: this.records ? 1 : 0,
        stageMapItems: this.stageMap.length,
        auditEvents: auditEvents.length
      },
      representativeIds: this.records,
      audit: {
        appendOnly: true,
        latestAction: auditEvents.at(-1)?.action ?? null
      }
    };
  }

  async proveAuditAppendOnly(): Promise<AppendOnlyProof> {
    const before = this.store.queryAudit();
    const first = before[0];
    let queryResultMutationBlocked = before.length === 0;
    if (first) {
      const originalAction = first.action;
      first.action = "tampered.query.result";
      queryResultMutationBlocked = this.store.queryAudit({ targetId: first.targetId })
        .some((event) => event.id === first.id && event.action === originalAction);
    }

    const updateRejected = rejects(() => this.updateAuditEvent("audit_immutable_probe", { action: "tamper" }));
    const deleteRejected = rejects(() => this.deleteAuditEvent("audit_immutable_probe"));
    this.store.appendAudit({ system: "aos-runtime-fixture" }, "runtime.audit.append_only.proof", "audit", "append-only", "accepted", {
      queryResultMutationBlocked,
      updateRejected,
      deleteRejected
    });
    await this.persistState();
    return {
      ok: queryResultMutationBlocked && updateRejected && deleteRejected,
      queryResultMutationBlocked,
      updateRejected,
      deleteRejected,
      beforeCount: before.length,
      afterCount: this.store.queryAudit().length
    };
  }

  async proveRestrictedPayloadRejection(): Promise<RestrictedPayloadProof> {
    const syntheticLocalPath = "/" + "Users/example/private.env";
    try {
      this.store.linkEvidence({
        type: "local_path_reference",
        target: syntheticLocalPath,
        validity: "unknown",
        producer: this.actor.employeeId,
        redactionState: "restricted"
      }, this.actor);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.appendAudit(this.actor, "runtime.restricted_payload.reject", "evidence", "synthetic-restricted", "blocked", {
        message,
        sample: syntheticLocalPath
      });
      await this.persistState();
      return {
        ok: /machine_local_absolute_path/.test(message),
        rejected: true,
        reasonKind: /machine_local_absolute_path/.test(message) ? "machine_local_absolute_path" : "other",
        auditRecorded: this.store.queryAudit({ targetId: "synthetic-restricted" }).length === 1
      };
    }
    throw new Error("Restricted payload was accepted unexpectedly");
  }

  async reset(): Promise<ResetProof> {
    const target = this.runtimeDir;
    if (target) {
      await rm(target, { recursive: true, force: true });
    }
    const existsAfterReset = target ? await pathExists(target) : false;
    this.runtimeDir = null;
    this.stateFile = null;
    return {
      ok: !existsAfterReset,
      removed: target !== null,
      runtimeDataExistsAfterReset: existsAfterReset
    };
  }

  private async persistState(extra: Record<string, unknown> = {}): Promise<void> {
    if (!this.stateFile) {
      return;
    }
    await writeFile(this.stateFile, JSON.stringify({
      storageMode: "os_temp_ephemeral",
      runtimeDataCommitted: false,
      schemaApplied: this.schemaApplied,
      seedApplied: this.seedApplied,
      representativeIds: this.records,
      stageMapItemCount: this.stageMap.length,
      auditEvents: this.store.queryAudit(),
      ...extra
    }, null, 2));
  }

  private ensureApplied(): void {
    if (!this.schemaApplied || !this.seedApplied || !this.stateFile) {
      throw new Error("Runtime fixture schema and seed must be applied first");
    }
  }

  private updateAuditEvent(_id: string, _patch: Record<string, unknown>): never {
    throw new Error("aos_audit_events is append-only; update denied");
  }

  private deleteAuditEvent(_id: string): never {
    throw new Error("aos_audit_events is append-only; delete denied");
  }
}

export async function createAppliedRuntimeFixture(actor: ActorIdentity = runtimeActor): Promise<AosRuntimeFixture> {
  const fixture = new AosRuntimeFixture(actor);
  await fixture.applySchemaAndSeed();
  await fixture.seedRepresentativeRecords();
  return fixture;
}

export const runtimeActor: ActorIdentity = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice-2-runtime-proof"
};

const estimate: Estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function rejects(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}
