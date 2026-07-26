/**
 * Chain-shaped projection types.
 *
 * These deliberately do NOT reuse the AOS domain's `StoryRecord` and friends.
 * A chain work record carries exactly `id`, `kind`, `parentId`, `projectId`,
 * `revision`, `status` and `tombstone` — it has no title, no problem statement,
 * no acceptance criteria, no estimate. `StoryRecord` requires all of those, so
 * projecting a chain record into it would mean inventing values the chain never
 * asserted. This package exists so that cannot happen by accident.
 *
 * Everything here mirrors the chain. Operational metadata the cockpit adds on
 * top — assignee, priority, labels, comments, free relations — lives in the AOS
 * domain and references these records by qualified ref; it is never merged into
 * them, because the chain is the truth and the projection is a derivative
 * (the engine's own `projection-import-truth-ownership` contract).
 */

/** Partition id as used on disk, e.g. "cross-project" or "TCRN-AOS". */
export type PartitionId = string;

/**
 * Chain work kinds. Same record shape for every one of them — `kind` is a field,
 * not a separate system, which is exactly why the cockpit can treat them all as
 * tickets.
 */
export type ChainWorkKind =
  | "Initiative"
  | "Epic"
  | "Story"
  | "Subtask"
  | "Review"
  | "Incident"
  | "Release"
  | "Knowledge";

/** The engine's work status machine: planned → ready → active → done. */
export type ChainWorkStatus =
  | "planned"
  | "ready"
  | "active"
  | "blocked"
  | "done"
  | "cancelled";

export type ChainGateStatus = "pending" | "satisfied" | "blocked";

export type ChainOutcomeClass =
  | "discussion_only"
  | "recommendation"
  | "role_decision"
  | "blocked"
  | "owner_intent_required";

export type ChainConferenceStatus = "open" | "closed" | "cancelled";

/**
 * A work record as the chain holds it, plus the partition it came from and the
 * chain version this projection read it at.
 *
 * `title` is intentionally absent and `scope` is optional: the chain has no
 * title field, and a work item's meaning lives in its advisory scope annotation.
 * Callers that need a display label derive one from `scope`; a record with no
 * scope annotation genuinely has no title, and the cockpit shows its key rather
 * than inventing prose.
 */
export interface ProjectedWork {
  partitionId: PartitionId;
  /** Engine record id, e.g. "work:b1b2767f8f2a47ca19e4e16f". */
  id: string;
  /** Human-facing key, e.g. "TCRN-CROSS-STORY-105". */
  externalKey: string | null;
  kind: ChainWorkKind;
  status: ChainWorkStatus;
  parentId: string | null;
  projectId: string;
  revision: number;
  /** advisory:scope — the closest thing the chain has to a description. */
  scope: string | null;
  /** advisory:decided-by — minutes ids that justify this record's shape. */
  decidedBy: readonly string[];
  /** advisory:sprint — the release train this record was enrolled in, if any. */
  sprintWorkId: string | null;
  /** Chain version at which this row was projected. */
  chainVersion: number;
}

export interface ProjectedGate {
  partitionId: PartitionId;
  id: string;
  externalKey: string | null;
  title: string | null;
  status: ChainGateStatus;
  outcomeClass: ChainOutcomeClass;
  /** The work record this gate blocks. */
  workId: string | null;
  chainVersion: number;
}

export interface ProjectedConference {
  partitionId: PartitionId;
  id: string;
  externalKey: string | null;
  title: string | null;
  type: string | null;
  status: ChainConferenceStatus;
  workIds: readonly string[];
  chainVersion: number;
}

export interface ProjectedPosition {
  partitionId: PartitionId;
  id: string;
  externalKey: string | null;
  conferenceId: string;
  /** Persona or actor the position argues from; an attribution claim, not proof. */
  actorId: string | null;
  body: string;
  /** Sequence within the conference, so reassembly and rounds stay ordered. */
  ordinal: number;
  chainVersion: number;
}

export interface ProjectedMinutes {
  partitionId: PartitionId;
  id: string;
  externalKey: string | null;
  conferenceId: string;
  summary: string | null;
  outcomeClass: ChainOutcomeClass;
  decisions: readonly string[];
  unresolvedIssues: readonly string[];
  chainVersion: number;
}

/**
 * One appended event, as the chain's own log holds it.
 *
 * This is the only record family that carries time and causation, which is why
 * the detail view's activity feed reads from here rather than diffing states.
 */
export interface ProjectedEvent {
  partitionId: PartitionId;
  id: string;
  /** Position in the chain; the only ordering that is authoritative. */
  sequence: number;
  occurredAt: string;
  /** e.g. "work.created", "work.annotated", "conference.closed". */
  operation: string;
  /** The record this event acted on, when the payload names one. */
  subjectId: string | null;
  /**
   * Who the chain says acted — and null for every event a chain recorded before
   * it enabled actor attestation.
   *
   * That null is a fact about the chain, not a hole in the read: TMS has never
   * enabled attestation, so not one of its events names an actor, and AOS's
   * first 61 events predate its own enablement. A feed that left the column
   * blank would read as "unknown by accident"; it has to say the chain did not
   * record it.
   */
  actorId: string | null;
  chainVersion: number;
}

/**
 * What one partition looked like at one chain version.
 *
 * `verifiedAt` is when this projection read the chain, deliberately separate
 * from any timestamp inside the chain: the cockpit must be able to say "I last
 * looked at 13:20 and the chain was at v1254" without implying the chain moved
 * at 13:20.
 */
export interface PartitionProjection {
  partitionId: PartitionId;
  chainVersion: number;
  verifiedAt: string;
  /**
   * Which read path produced this projection.
   *
   * Recorded rather than inferred from empty arrays: "the fallback cannot reach
   * positions" and "this chain has no positions" produce identical data, and a
   * view has to be able to tell a reader which one it is looking at.
   */
  readVia: "export" | "paginated";
  work: readonly ProjectedWork[];
  gates: readonly ProjectedGate[];
  conferences: readonly ProjectedConference[];
  positions: readonly ProjectedPosition[];
  minutes: readonly ProjectedMinutes[];
  events: readonly ProjectedEvent[];
  /**
   * Sequence at which this partition began recording who acted, or null if it
   * never has. Everything before it is unattributed by design rather than by
   * omission, and the activity feed says which case a reader is looking at.
   */
  actorAttestationFromSequence: number | null;
}

/**
 * Freshness of one partition's projection relative to the chain it mirrors.
 *
 * `stale` is computed by comparing versions, never by elapsed time: a chain that
 * has not moved in a day is not stale, and a projection one version behind is,
 * however recently it ran.
 */
export interface PartitionFreshness {
  partitionId: PartitionId;
  projectedVersion: number;
  chainVersion: number;
  verifiedAt: string;
  stale: boolean;
}
