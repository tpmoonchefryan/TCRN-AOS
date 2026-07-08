import { createHash } from "node:crypto";
import type { KnowledgeRetrievalEntryInput, KnowledgeRetrievalStatus } from "./sqlite-repository.js";

export const kr05OwnerSeedEntryListDisposition = "none_initial" as const;
export const kr05MaxPreEpicSeedEntries = 20;
export const kr05FactCardConventionEntryId = "knowledge-kr05-fact-card-convention";
export const kr05FactCardRequiredSections = [
  "invariants",
  "settings_and_cross_module_interactions",
  "gotchas",
  "source_refs_with_digests"
] as const;

export type Kr05FactCardSection = typeof kr05FactCardRequiredSections[number];
export type Kr05SeedEntryKind =
  | "fact_card_convention"
  | "owner_enumerated_seed"
  | "dogfood_authored_fact_card"
  | "convention_proof_fixture"
  | "bulk_vault_migration";

export interface Kr05SeedEntryCandidate {
  id: string;
  title: string;
  roleScope: string;
  project: string;
  category: string;
  knowledgeKind: string;
  status: KnowledgeRetrievalStatus;
  lastVerified: string;
  stalenessPolicy: string;
  sourceRef: string;
  sourceDigest: string;
  tags: string[];
  summary: string;
  body: string;
  seedKind: Kr05SeedEntryKind;
}

export interface Kr05SeedEntryPolicy {
  ownerSeedEntryListDisposition: typeof kr05OwnerSeedEntryListDisposition;
  ownerEnumeratedCanonicalEntryIds?: string[];
  allowCanonicalConventionEntry?: boolean;
  allowDogfoodCanonicalEntryIds?: string[];
}

export interface Kr05SeedEntryDecision {
  id: string;
  status: KnowledgeRetrievalStatus;
  seedKind: Kr05SeedEntryKind;
  accepted: boolean;
  reason: string;
  missingRequiredSections: Kr05FactCardSection[];
}

export interface Kr05SeedEntryBatchReadback {
  ok: boolean;
  ownerSeedEntryListDisposition: typeof kr05OwnerSeedEntryListDisposition;
  maxPreEpicSeedEntries: number;
  requestedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  conventionEntryCount: number;
  canonicalConventionEntryCount: number;
  canonicalSeedEntryCount: number;
  draftOrFixtureCount: number;
  bulkVaultMigrationAttempted: boolean;
  nonEnumeratedCanonicalSeedEntryAccepted: boolean;
  overLimitAttemptRejected: boolean;
  decisions: Kr05SeedEntryDecision[];
  acceptedEntries: KnowledgeRetrievalEntryInput[];
}

export function createKr05FactCardConventionEntry(overrides: Partial<Kr05SeedEntryCandidate> = {}): Kr05SeedEntryCandidate {
  const body = [
    "Invariants: A fact card covers exactly one module or topic, preserves the D-KR2 taxonomy, and stays within the 1,500-word body cap.",
    "Settings and cross-module interactions: A fact card names the project, role scope, category, knowledge kind, status, tags, source reference, and source digest before it is searchable.",
    "Gotchas: Bulk vault migration, non-enumerated canonical seeds, generic ingestion, raw paths, raw database dumps, and private payloads are outside KR-05.",
    "Source refs with digests: Source references must use digest-oriented plan, ticket, run, or evidence identifiers instead of local absolute paths."
  ].join("\n\n");
  const base = {
    id: kr05FactCardConventionEntryId,
    title: "KR-05 fact-card convention",
    roleScope: "implementation",
    project: "TCRN-AOS",
    category: "knowledge-retrieval",
    knowledgeKind: "fact_card_convention",
    status: "canonical" as KnowledgeRetrievalStatus,
    lastVerified: "2026-07-08",
    stalenessPolicy: "review_after_30_days",
    sourceRef: "workflow-plan:2026-07-07-aos-knowledge-retrieval-layer#KR-05@4a502362",
    sourceDigest: `sha256:${sha256(body)}`,
    tags: ["kr05", "fact-card", "convention", "no-bulk"],
    summary: "KR-05 convention for bounded, digest-backed AOS knowledge fact cards.",
    body,
    seedKind: "fact_card_convention" as Kr05SeedEntryKind
  };
  return { ...base, ...overrides };
}

export function kr05SeedEntryBatchReadback(
  candidates: Kr05SeedEntryCandidate[],
  policy: Kr05SeedEntryPolicy = { ownerSeedEntryListDisposition: kr05OwnerSeedEntryListDisposition }
): Kr05SeedEntryBatchReadback {
  const overLimit = candidates.length > kr05MaxPreEpicSeedEntries;
  const decisions = candidates.map((candidate) => decideCandidate(candidate, policy, overLimit));
  const acceptedEntries = decisions
    .filter((decision) => decision.accepted)
    .map((decision) => toKnowledgeRetrievalEntryInput(requireCandidate(candidates, decision.id)));
  const canonicalSeedEntryCount = decisions.filter((decision) =>
    decision.accepted &&
    decision.status === "canonical" &&
    decision.seedKind !== "fact_card_convention"
  ).length;
  return {
    ok: !overLimit && decisions.every((decision) => decision.accepted || decision.reason.length > 0),
    ownerSeedEntryListDisposition: policy.ownerSeedEntryListDisposition,
    maxPreEpicSeedEntries: kr05MaxPreEpicSeedEntries,
    requestedCount: candidates.length,
    acceptedCount: acceptedEntries.length,
    rejectedCount: decisions.filter((decision) => !decision.accepted).length,
    conventionEntryCount: decisions.filter((decision) => decision.accepted && decision.seedKind === "fact_card_convention").length,
    canonicalConventionEntryCount: decisions.filter((decision) => decision.accepted && decision.seedKind === "fact_card_convention" && decision.status === "canonical").length,
    canonicalSeedEntryCount,
    draftOrFixtureCount: decisions.filter((decision) => decision.accepted && decision.status !== "canonical").length,
    bulkVaultMigrationAttempted: candidates.some((candidate) => candidate.seedKind === "bulk_vault_migration"),
    nonEnumeratedCanonicalSeedEntryAccepted: canonicalSeedEntryCount > 0,
    overLimitAttemptRejected: overLimit && decisions.every((decision) => !decision.accepted),
    decisions,
    acceptedEntries
  };
}

export function toKnowledgeRetrievalEntryInput(candidate: Kr05SeedEntryCandidate): KnowledgeRetrievalEntryInput {
  return {
    id: candidate.id,
    title: candidate.title,
    roleScope: candidate.roleScope,
    project: candidate.project,
    category: candidate.category,
    knowledgeKind: candidate.knowledgeKind,
    status: candidate.status,
    lastVerified: candidate.lastVerified,
    stalenessPolicy: candidate.stalenessPolicy,
    sourceRef: candidate.sourceRef,
    sourceDigest: candidate.sourceDigest,
    tags: candidate.tags,
    summary: candidate.summary,
    body: candidate.body
  };
}

function decideCandidate(
  candidate: Kr05SeedEntryCandidate,
  policy: Kr05SeedEntryPolicy,
  overLimit: boolean
): Kr05SeedEntryDecision {
  const missingRequiredSections = missingFactCardSections(candidate.body);
  if (overLimit) {
    return reject(candidate, "kr05_seed_entry_count_limit_exceeded", missingRequiredSections);
  }
  if (candidate.seedKind === "bulk_vault_migration") {
    return reject(candidate, "kr05_bulk_vault_migration_forbidden", missingRequiredSections);
  }
  if (missingRequiredSections.length > 0) {
    return reject(candidate, "kr05_fact_card_required_sections_missing", missingRequiredSections);
  }
  if (candidate.status === "canonical" && candidate.seedKind === "fact_card_convention") {
    if (policy.allowCanonicalConventionEntry ?? true) {
      return accept(candidate, "kr05_canonical_convention_entry_allowed_by_plan", missingRequiredSections);
    }
    return reject(candidate, "kr05_canonical_convention_entry_not_allowed", missingRequiredSections);
  }
  if (candidate.status === "canonical" && candidate.seedKind === "owner_enumerated_seed") {
    if ((policy.ownerEnumeratedCanonicalEntryIds ?? []).includes(candidate.id)) {
      return accept(candidate, "kr05_owner_enumerated_canonical_seed_allowed", missingRequiredSections);
    }
    return reject(candidate, "kr05_non_enumerated_canonical_seed_denied", missingRequiredSections);
  }
  if (candidate.status === "canonical" && candidate.seedKind === "dogfood_authored_fact_card") {
    if ((policy.allowDogfoodCanonicalEntryIds ?? []).includes(candidate.id)) {
      return accept(candidate, "kr05_dogfood_authored_canonical_seed_allowed", missingRequiredSections);
    }
    return reject(candidate, "kr05_dogfood_canonical_seed_not_source_visible", missingRequiredSections);
  }
  if (candidate.status === "canonical") {
    return reject(candidate, "kr05_canonical_entry_kind_not_allowed", missingRequiredSections);
  }
  return accept(candidate, "kr05_draft_or_fixture_entry_allowed_for_proof_only", missingRequiredSections);
}

function missingFactCardSections(body: string): Kr05FactCardSection[] {
  const normalized = body.toLowerCase();
  const sectionPatterns: Record<Kr05FactCardSection, RegExp> = {
    invariants: /\binvariants?\b/,
    settings_and_cross_module_interactions: /\bsettings\b[\s\S]*\bcross[- ]module interactions?\b/,
    gotchas: /\bgotchas?\b/,
    source_refs_with_digests: /\bsource refs?\b[\s\S]*\bdigests?\b/
  };
  return kr05FactCardRequiredSections.filter((section) => !sectionPatterns[section].test(normalized));
}

function accept(candidate: Kr05SeedEntryCandidate, reason: string, missingRequiredSections: Kr05FactCardSection[]): Kr05SeedEntryDecision {
  return {
    id: candidate.id,
    status: candidate.status,
    seedKind: candidate.seedKind,
    accepted: true,
    reason,
    missingRequiredSections
  };
}

function reject(candidate: Kr05SeedEntryCandidate, reason: string, missingRequiredSections: Kr05FactCardSection[]): Kr05SeedEntryDecision {
  return {
    id: candidate.id,
    status: candidate.status,
    seedKind: candidate.seedKind,
    accepted: false,
    reason,
    missingRequiredSections
  };
}

function requireCandidate(candidates: Kr05SeedEntryCandidate[], id: string): Kr05SeedEntryCandidate {
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) {
    throw new Error(`kr05_seed_candidate_missing:${id}`);
  }
  return candidate;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
