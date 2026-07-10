import { assertNoRestrictedContent } from "./security.js";
import { createId, digest } from "./idempotency.js";
import { AosStore } from "./store.js";
import type { ActorIdentity, Estimate, GateStatus, PlanProjectionMetadata, ProjectRecord, WorkStatus } from "./types.js";

export const PLAN_PROJECTION_SCHEMA_VERSION = "tcrn.aos.planProjection.v1" as const;

export interface PlanProjectionProject {
  id: string;
  name: string;
  registryStatus: ProjectRecord["registryStatus"];
  repoRegistryId: string;
  repoPathReference: string;
  status: WorkStatus;
  gateState: GateStatus;
}

interface PlanProjectionBase {
  externalKey: string;
  projectId: string;
  title: string;
  status: WorkStatus;
  dependencies: string[];
  owners: string[];
  writeScopes: string[];
  acceptanceCriteria: string[];
  gateRequirements: string[];
}

export interface PlanProjectionInitiative extends PlanProjectionBase {
  problem: string;
  expectedOutcome: string;
}

export interface PlanProjectionEpic extends PlanProjectionBase {
  initiativeKey: string;
  goal: string;
  estimate?: Estimate;
}

export interface PlanProjectionStory extends PlanProjectionBase {
  epicKey: string;
  problem: string;
  user: string;
  expectedBehavior: string;
  estimate: Estimate;
}

export interface PlanProjectionManifest {
  schemaVersion: typeof PLAN_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  sourceDigest: string;
  project: PlanProjectionProject;
  initiatives: PlanProjectionInitiative[];
  epics: PlanProjectionEpic[];
  stories: PlanProjectionStory[];
}

export interface PlanProjectionReadback {
  ok: boolean;
  schemaVersion: typeof PLAN_PROJECTION_SCHEMA_VERSION;
  projectionId: string;
  manifestDigest: string;
  projectId: string;
  projectRegistered: boolean;
  recordIds: {
    initiatives: Record<string, string>;
    epics: Record<string, string>;
    stories: Record<string, string>;
  };
  counts: {
    initiatives: number;
    epics: number;
    stories: number;
    created: number;
    reconciled: number;
    reused: number;
  };
  sourceMetadataOnly: true;
}

export class PlanProjectionValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PlanProjectionValidationError";
  }
}

export function validatePlanProjectionManifest(manifest: PlanProjectionManifest): void {
  assertNoRestrictedContent(manifest, "plan projection manifest");
  if (manifest.schemaVersion !== PLAN_PROJECTION_SCHEMA_VERSION) {
    fail("plan_projection_schema_version_invalid");
  }
  requireText(manifest.projectionId, "projectionId");
  requireDigest(manifest.sourceDigest, "sourceDigest");
  validateProject(manifest.project);
  const all = [
    ...manifest.initiatives.map((row) => ({ kind: "initiative", row })),
    ...manifest.epics.map((row) => ({ kind: "epic", row })),
    ...manifest.stories.map((row) => ({ kind: "story", row }))
  ];
  const seen = new Set<string>();
  for (const { kind, row } of all) {
    validateBase(row, kind, manifest.project.id);
    if (seen.has(row.externalKey)) {
      fail(`plan_projection_duplicate_external_key:${row.externalKey}`);
    }
    seen.add(row.externalKey);
  }
  const initiatives = new Set(manifest.initiatives.map((row) => row.externalKey));
  const epics = new Set(manifest.epics.map((row) => row.externalKey));
  for (const epic of manifest.epics) {
    if (!initiatives.has(epic.initiativeKey)) {
      fail(`plan_projection_unknown_initiative_parent:${epic.externalKey}`);
    }
    requireText(epic.goal, `epic.goal:${epic.externalKey}`);
  }
  for (const story of manifest.stories) {
    if (!epics.has(story.epicKey)) {
      fail(`plan_projection_unknown_epic_parent:${story.externalKey}`);
    }
    requireText(story.problem, `story.problem:${story.externalKey}`);
    requireText(story.user, `story.user:${story.externalKey}`);
    requireText(story.expectedBehavior, `story.expectedBehavior:${story.externalKey}`);
    validateEstimate(story.estimate, story.externalKey);
  }
  for (const row of all.map((item) => item.row)) {
    for (const dependency of row.dependencies) {
      if (!seen.has(dependency)) {
        fail(`plan_projection_unknown_or_cross_project_dependency:${row.externalKey}:${dependency}`);
      }
      if (dependency === row.externalKey) {
        fail(`plan_projection_self_dependency:${row.externalKey}`);
      }
    }
  }
}

export function projectPlanManifest(store: AosStore, manifest: PlanProjectionManifest, actor: ActorIdentity): PlanProjectionReadback {
  validatePlanProjectionManifest(manifest);
  const registered = store.getProject(manifest.project.id);
  if (!registered) {
    fail(`plan_projection_unknown_project:${manifest.project.id}`);
  }
  if (registered.repoRegistryId !== manifest.project.repoRegistryId) {
    fail(`plan_projection_project_registry_mismatch:${manifest.project.id}`);
  }
  const manifestDigest = digest(manifest);
  const initiatives = new Map(manifest.initiatives.map((row) => [row.externalKey, row]));
  const epics = new Map(manifest.epics.map((row) => [row.externalKey, row]));
  const initiativeIds = Object.fromEntries(manifest.initiatives.map((row) => [row.externalKey, createId("init", { projectId: manifest.project.id, externalKey: row.externalKey })]));
  const epicIds = Object.fromEntries(manifest.epics.map((row) => [row.externalKey, createId("epic", { projectId: manifest.project.id, externalKey: row.externalKey })]));
  const storyIds = Object.fromEntries(manifest.stories.map((row) => [row.externalKey, createId("story", { projectId: manifest.project.id, externalKey: row.externalKey })]));
  const priorInitiatives = new Map(store.listInitiatives().map((row) => [row.id, row]));
  const priorEpics = new Map(store.listEpics().map((row) => [row.id, row]));
  const priorStories = new Map(store.listStories().map((row) => [row.id, row]));
  let created = 0;
  let reconciled = 0;
  let reused = 0;

  for (const row of manifest.initiatives) {
    const id = requiredId(initiativeIds, row.externalKey);
    const candidate = {
      id,
      projectId: manifest.project.id,
      title: row.title,
      status: row.status,
      problem: row.problem,
      expectedOutcome: row.expectedOutcome,
      projection: projectionMetadata(row, manifest.sourceDigest, manifestDigest)
    };
    const existing = priorInitiatives.get(id);
    if (sameProjection(existing, candidate)) {
      reused += 1;
    } else {
      store.upsertInitiative(candidate, actor);
      existing ? reconciled += 1 : created += 1;
    }
  }
  for (const row of manifest.epics) {
    const id = requiredId(epicIds, row.externalKey);
    const candidate = {
      id,
      initiativeId: requiredId(initiativeIds, row.initiativeKey),
      title: row.title,
      goal: row.goal,
      status: row.status,
      ...(row.estimate ? { estimate: row.estimate } : {}),
      projection: projectionMetadata(row, manifest.sourceDigest, manifestDigest)
    };
    const existing = priorEpics.get(id);
    if (sameProjection(existing, candidate)) {
      reused += 1;
    } else {
      store.upsertEpic(candidate, actor);
      existing ? reconciled += 1 : created += 1;
    }
  }
  for (const row of manifest.stories) {
    const id = requiredId(storyIds, row.externalKey);
    const candidate = {
      id,
      epicId: requiredId(epicIds, row.epicKey),
      title: row.title,
      problem: row.problem,
      user: row.user,
      expectedBehavior: row.expectedBehavior,
      acceptanceCriteria: row.acceptanceCriteria,
      status: row.status,
      estimate: row.estimate,
      subTasks: [],
      projection: projectionMetadata(row, manifest.sourceDigest, manifestDigest)
    };
    const existing = priorStories.get(id);
    if (sameProjection(existing, candidate)) {
      reused += 1;
    } else {
      store.upsertStory(candidate, actor);
      existing ? reconciled += 1 : created += 1;
    }
  }

  return {
    ok: true,
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    projectionId: manifest.projectionId,
    manifestDigest,
    projectId: manifest.project.id,
    projectRegistered: true,
    recordIds: { initiatives: initiativeIds, epics: epicIds, stories: storyIds },
    counts: {
      initiatives: initiatives.size,
      epics: epics.size,
      stories: manifest.stories.length,
      created,
      reconciled,
      reused
    },
    sourceMetadataOnly: true
  };
}

function projectionMetadata(row: PlanProjectionBase, sourceDigest: string, manifestDigest: string): PlanProjectionMetadata {
  return {
    schemaVersion: PLAN_PROJECTION_SCHEMA_VERSION,
    externalKey: row.externalKey,
    dependencyKeys: [...row.dependencies],
    ownerRefs: [...row.owners],
    writeScopes: [...row.writeScopes],
    gateRequirements: [...row.gateRequirements],
    acceptanceCriteriaDigest: digest(row.acceptanceCriteria),
    sourceDigest,
    manifestDigest
  };
}

function sameProjection(existing: unknown, candidate: Record<string, unknown>): boolean {
  if (!existing || typeof existing !== "object") {
    return false;
  }
  const record = existing as Record<string, unknown>;
  return Object.entries(candidate).every(([key, value]) => digest(record[key]) === digest(value));
}

function requiredId(ids: Record<string, string>, externalKey: string): string {
  const id = ids[externalKey];
  if (!id) {
    fail(`plan_projection_internal_key_missing:${externalKey}`);
  }
  return id;
}

function validateProject(project: PlanProjectionProject): void {
  requireText(project.id, "project.id");
  requireText(project.name, "project.name");
  requireText(project.repoRegistryId, "project.repoRegistryId");
  requireText(project.repoPathReference, "project.repoPathReference");
  if (!allowedRegistryStatus.has(project.registryStatus)) {
    fail("plan_projection_project_registry_status_invalid");
  }
  if (!allowedWorkStatus.has(project.status) || !allowedGateStatus.has(project.gateState)) {
    fail("plan_projection_project_status_invalid");
  }
}

function validateBase(row: PlanProjectionBase, kind: string, projectId: string): void {
  if (!externalKeyPattern.test(row.externalKey)) {
    fail(`plan_projection_external_key_invalid:${kind}`);
  }
  if (row.projectId !== projectId) {
    fail(`plan_projection_cross_project_parent:${row.externalKey}`);
  }
  requireText(row.title, `${kind}.title:${row.externalKey}`);
  if (!allowedWorkStatus.has(row.status)) {
    fail(`plan_projection_status_invalid:${row.externalKey}`);
  }
  for (const [name, values] of Object.entries({ dependencies: row.dependencies, owners: row.owners, writeScopes: row.writeScopes, acceptanceCriteria: row.acceptanceCriteria, gateRequirements: row.gateRequirements })) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
      fail(`plan_projection_${name}_invalid:${row.externalKey}`);
    }
  }
}

function validateEstimate(value: Estimate, externalKey: string): void {
  if (!value || typeof value !== "object" || !Number.isInteger(value.effortPoints) || value.effortPoints < 0) {
    fail(`plan_projection_estimate_invalid:${externalKey}`);
  }
}

function requireText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 4_000) {
    fail(`plan_projection_${name}_invalid`);
  }
}

function requireDigest(value: unknown, name: string): void {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    fail(`plan_projection_${name}_invalid`);
  }
}

function fail(code: string): never {
  throw new PlanProjectionValidationError(code);
}

const externalKeyPattern = /^[a-z0-9][a-z0-9._:-]{2,160}$/;
const allowedRegistryStatus = new Set(["planned", "active", "archived", "unknown"]);
const allowedWorkStatus = new Set(["proposed", "accepted", "in_progress", "blocked", "in_review", "verified", "released", "archived", "superseded"]);
const allowedGateStatus = new Set(["proposed", "pending_role", "owner_intent_required", "accepted", "blocked", "superseded"]);
