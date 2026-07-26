/**
 * The shape the cockpit renders from.
 *
 * Deliberately flat and serialisable: it is produced by the projection pipeline
 * and consumed by the views, with no behaviour in between. Anything that needs
 * computing — freshness, reassembly, effective open issues — is computed in the
 * projection package and arrives here already decided, so a view never has to
 * re-derive a governance judgement while rendering.
 */

export interface CockpitPartition {
  id: string;
  label: string;
  labelZh: string;
  chainVersion: number;
  verifiedAt: string;
  /**
   * Record families this partition could not supply, named rather than omitted.
   *
   * Two of the four chains exceed the read surface's one-MiB export ceiling and
   * fall back to a paginated path that cannot reach positions or minutes. A view
   * over such a partition must say "not read here" — an empty deliberation and
   * an unread one look identical, and only one of them is true.
   */
  unavailable: readonly string[];
  /** Which read path produced this partition; decides what `unavailable` holds. */
  readVia: "export" | "paginated";
  /**
   * Chain sequence from which writes name who made them, or null if this chain
   * has never enabled actor attestation.
   */
  attestationFromSequence: number | null;
}

/**
 * One line of a work item's history.
 *
 * `attribution` carries why an actor is missing, because the two reasons are
 * different facts a reader acts on differently: a chain that never enabled
 * attestation will never name anyone, while an event that merely predates
 * enablement sits in a log whose later entries do.
 */
export interface CockpitActivityEntry {
  id: string;
  sequence: number;
  occurredAt: string;
  operation: string;
  actorId: string | null;
  attribution: "recorded" | "predates-attestation" | "not-enabled";
}

export interface CockpitWork {
  partitionId: string;
  id: string;
  /** Null when the key could not be recovered; views then show the id. */
  externalKey: string | null;
  kind: string;
  status: string;
  parentId: string | null;
  /** How many times the chain has revised this record. */
  revision: number;
  /** The chain has no title field; scope is where a work item states its intent. */
  scope: string | null;
  decidedBy: readonly string[];
  sprintWorkId: string | null;
}

export interface CockpitGate {
  partitionId: string;
  id: string;
  externalKey: string | null;
  title: string | null;
  status: string;
  outcomeClass: string;
  workId: string | null;
}

export interface CockpitConference {
  partitionId: string;
  id: string;
  externalKey: string | null;
  title: string | null;
  type: string | null;
  status: string;
  workIds: readonly string[];
}

export interface CockpitInboxItem {
  kind: "gate" | "conference" | "unresolved";
  partitionId: string;
  recordId: string;
  externalKey: string | null;
  title: string;
  detail: string;
  severity: "owner-intent" | "attention";
}

export interface CockpitEffectiveUnresolved {
  minutesId: string;
  externalKey: string | null;
  surface: readonly string[];
  effective: readonly string[];
  dissolvedCount: number;
}

/**
 * One logical position, already reassembled from however many fragments the
 * byte budget forced it into.
 *
 * The budget constrains storage; a reader should see the argument, so the
 * cockpit renders the whole and keeps the fragment ids for anyone who needs to
 * reach the individual records.
 */
export interface CockpitPosition {
  conferenceId: string;
  actorId: string | null;
  fragmentIds: readonly string[];
  externalKeys: readonly string[];
  body: string;
  fragmentCount: number;
}

export interface CockpitMinutes {
  id: string;
  externalKey: string | null;
  summary: string | null;
  outcomeClass: string;
  decisions: readonly string[];
  /** Everything recorded as open when these minutes closed. */
  unresolvedIssues: readonly string[];
  /** What later minutes have not since settled. */
  effective: readonly string[];
}

export interface CockpitData {
  generatedAt: string;
  partitions: readonly CockpitPartition[];
  work: readonly CockpitWork[];
  gates: readonly CockpitGate[];
  conferences: readonly CockpitConference[];
  inbox: readonly CockpitInboxItem[];
  effectiveUnresolved: readonly CockpitEffectiveUnresolved[];
  /** Reassembled position threads, keyed by conference id. */
  threads: Readonly<Record<string, readonly CockpitPosition[]>>;
  minutesByConference: Readonly<Record<string, CockpitMinutes>>;
  /** Event history keyed by work record id; absent for chains read by fallback. */
  activityByWork: Readonly<Record<string, readonly CockpitActivityEntry[]>>;
}

/**
 * Chain work status → StatusBadge input.
 *
 * The label is always the chain's own word. The DS copy-state vocabulary was
 * written for verification claims — "Ready for local use", "Review required" —
 * and mapping work statuses onto it made every active row claim it needed
 * review while its own Status field said otherwise: two labels on one row,
 * contradicting each other. `CopyStateInput.label` exists exactly so a product
 * can keep the DS tone scale while speaking its own vocabulary; the state token
 * here picks nothing but the tone.
 */
export function chainStatusBadge(status: string): { state: string; label: string } {
  const tone = status === "done"
    ? "ready" // positive
    : status === "active"
      ? "review_required" // warning: the eye should land on what is in flight
      : status === "blocked"
        ? "blocked" // danger
        : "not_claimed"; // neutral: planned, ready, cancelled — the label tells them apart
  return { state: tone, label: status };
}

/**
 * First line of a work item's scope, for use as a list label.
 *
 * A work item with no scope annotation genuinely has no title, so the caller is
 * given null and shows the key instead of inventing prose for it.
 */
export function workTitle(work: CockpitWork): string | null {
  if (!work.scope) return null;
  const firstLine = work.scope.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return null;
  // Scope annotations often open with a full sentence; a list needs a label, so
  // the first clause is taken and the rest stays available in the detail view.
  const clause = firstLine.split(/[。;；]/u)[0]?.trim() ?? firstLine;
  return clause.length > 72 ? `${clause.slice(0, 72)}…` : clause;
}
