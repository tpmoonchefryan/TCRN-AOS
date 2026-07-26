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
}

export interface CockpitWork {
  partitionId: string;
  id: string;
  /** Null when the key could not be recovered; views then show the id. */
  externalKey: string | null;
  kind: string;
  status: string;
  parentId: string | null;
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

export interface CockpitData {
  generatedAt: string;
  partitions: readonly CockpitPartition[];
  work: readonly CockpitWork[];
  gates: readonly CockpitGate[];
  conferences: readonly CockpitConference[];
  inbox: readonly CockpitInboxItem[];
  effectiveUnresolved: readonly CockpitEffectiveUnresolved[];
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
