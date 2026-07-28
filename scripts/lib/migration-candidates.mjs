// Candidate selection for the mirror acceptance proof's migration leg
// (TCRN-CROSS-MIN-052 D9 criterion 4), factored out so the proof and the unit
// tests judge with the same code rather than a re-implementation.
//
// A candidate is only ever a guess: the projection this draws from is a
// snapshot and may be behind the chain, so the engine's answer — not this
// filter — decides whether a move happens. What this module owes is the
// ruling's selection policy, stated once:
//
//   - only the named partition's records are candidates;
//   - Initiatives are excluded: the ruling's minimum requirement keeps the top
//     of the work tree out of a proof that permanently advances one real
//     record every time it runs;
//   - only records whose status has a forward move are candidates at all.

/** The work state machine's forward edges, as the proof is allowed to walk them. */
export const FORWARD = Object.freeze({ planned: "ready", ready: "active", active: "done" });

/** The backward edges, used to derive a guaranteed-illegal move for the refusal half. */
export const BACKWARD = Object.freeze({ ready: "planned", active: "ready", done: "active" });

/**
 * Select migration candidates from projected work rows.
 *
 * Returns `{ recordId, externalKey, from, to }` per candidate, in projection
 * order. Rows of other partitions, Initiatives, and terminal-status rows are
 * excluded — and the exclusion of Initiatives must hold even when an
 * Initiative's status would otherwise be movable.
 */
export function selectMigrationCandidates(work, partitionId) {
  return (work ?? [])
    .filter((row) => row.partitionId === partitionId && row.kind !== "Initiative" && FORWARD[row.status])
    .map((row) => ({ recordId: row.id, externalKey: row.externalKey, from: row.status, to: FORWARD[row.status] }));
}
