import type { ProjectedEvent, ProjectedGate, ProjectedMinutes, ProjectedPosition } from "./types.js";

/**
 * Read-layer computations: the things the chain records faithfully but does not
 * present usefully.
 *
 * Each one exists because reading the raw record leads a person to a wrong
 * conclusion — not because the record is wrong, but because it is a log entry
 * and not an answer.
 */

/**
 * A logical position reassembled from its recorded fragments.
 *
 * A position has a 2048-byte ceiling and the engine refuses an oversized one
 * outright, so a long argument is recorded as several sequential records under
 * one actor, each carrying a `k/n` marker. That budget constrains storage, not
 * reading: a reader should see the argument, so the fragments are concatenated
 * back in recorded order.
 */
export interface ReassembledPosition {
  conferenceId: string;
  actorId: string | null;
  /** Ids of the fragments, in order, so a reader can still reach each record. */
  fragmentIds: readonly string[];
  externalKeys: readonly string[];
  body: string;
  fragmentCount: number;
}

const FRAGMENT_MARKER = /^(\d+)\/(\d+)\s/u;

/**
 * Reassemble fragmented positions within one conference.
 *
 * Fragments are joined only when they are consecutive, share an actor, and the
 * markers count up to the same total. Anything else is left alone — two separate
 * arguments from one persona must not be welded into a sentence neither of them
 * made, so ambiguity resolves toward leaving the record as recorded.
 */
export function reassemblePositions(positions: readonly ProjectedPosition[]): ReassembledPosition[] {
  const ordered = [...positions].sort((left, right) => left.ordinal - right.ordinal);
  const out: ReassembledPosition[] = [];
  let run: { actorId: string | null; total: number; next: number; parts: ProjectedPosition[] } | undefined;

  const flush = () => {
    if (!run) return;
    out.push(toReassembled(run.parts));
    run = undefined;
  };

  for (const position of ordered) {
    const match = FRAGMENT_MARKER.exec(position.body);
    if (!match) {
      flush();
      out.push(toReassembled([position]));
      continue;
    }
    const index = Number(match[1]);
    const total = Number(match[2]);
    if (run && run.actorId === position.actorId && run.total === total && run.next === index) {
      run.parts.push(position);
      run.next += 1;
      if (run.next > total) flush();
      continue;
    }
    flush();
    if (index === 1 && total > 1) {
      run = { actorId: position.actorId, total, next: 2, parts: [position] };
    } else {
      out.push(toReassembled([position]));
    }
  }
  flush();
  return out;
}

function toReassembled(parts: readonly ProjectedPosition[]): ReassembledPosition {
  const first = parts[0] as ProjectedPosition;
  return {
    conferenceId: first.conferenceId,
    actorId: first.actorId,
    fragmentIds: parts.map((part) => part.id),
    externalKeys: parts.map((part) => part.externalKey ?? ""),
    // Strip the k/n marker from each fragment: it is transport bookkeeping, and
    // leaving it inline would make the reassembled text read as if the author
    // had numbered their own paragraphs.
    body: parts.map((part) => part.body.replace(FRAGMENT_MARKER, "")).join("\n\n"),
    fragmentCount: parts.length
  };
}

/**
 * Unresolved issues that later minutes have not dissolved.
 *
 * `unresolvedIssues` is immutable once recorded, and the way an issue gets
 * settled is a later minutes entry saying so — so reading the field alone
 * overstates how much is actually open. An audit of this platform found twelve
 * apparent open issues of which two were real; that gap is what this computes
 * away.
 *
 * Matching is deliberately conservative: an issue counts as dissolved only when
 * a later minutes decision quotes it closely enough to be unambiguous. A missed
 * dissolution shows an extra item — annoying. A false dissolution hides a real
 * decision — unacceptable.
 */
export interface EffectiveUnresolved {
  minutesId: string;
  externalKey: string | null;
  /** Everything the minutes recorded as open at the time it closed. */
  surface: readonly string[];
  /** What no later minutes has addressed. */
  effective: readonly string[];
  dissolvedCount: number;
}

export function computeEffectiveUnresolved(
  minutes: readonly ProjectedMinutes[]
): EffectiveUnresolved[] {
  // Chain order is authoritative: later minutes can only dissolve earlier ones,
  // never the reverse, so ordering by chain version is what makes this sound.
  const ordered = [...minutes].sort((left, right) => left.chainVersion - right.chainVersion);
  return ordered.map((entry, index) => {
    const later = ordered.slice(index + 1);
    const laterText = later
      .flatMap((row) => [row.summary ?? "", ...row.decisions, ...row.unresolvedIssues])
      .map(normalize)
      .join("\n");
    const effective = entry.unresolvedIssues.filter((issue) => !isDissolved(issue, laterText));
    return {
      minutesId: entry.id,
      externalKey: entry.externalKey,
      surface: entry.unresolvedIssues,
      effective,
      dissolvedCount: entry.unresolvedIssues.length - effective.length
    };
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, " ").trim();
}

/**
 * An issue counts as addressed when a distinctive run of it reappears later.
 *
 * Short issues are matched whole; longer ones by their opening clause, which is
 * where an issue states what it is about. The threshold is high enough that
 * incidental word overlap cannot dissolve anything.
 */
function isDissolved(issue: string, laterText: string): boolean {
  const needle = normalize(issue);
  if (needle.length < 8) return false;
  if (laterText.includes(needle)) return true;
  const opening = needle.slice(0, Math.max(16, Math.floor(needle.length * 0.6)));
  return opening.length >= 16 && laterText.includes(opening);
}

/**
 * The single list of things waiting on the operator, across every partition.
 *
 * Three sources feed it, and they are genuinely different obligations: a gate
 * the engine will not satisfy without the named actor's intent; a deliberation
 * still collecting positions; and a minutes entry whose open items nothing has
 * since settled. Presenting them as one list is the point — the stop budget was
 * written so these get cleared in one sitting rather than one interruption at a
 * time.
 */
/**
 * The facts behind an inbox row's detail cell — not the sentence.
 *
 * `detail` used to be a string this function assembled: `collecting positions`
 * for an open deliberation, `` `${open} open of ${recorded} recorded` `` for a
 * minutes entry. Both read well and both could only ever be English, because
 * this is the projection layer and no reader's locale is in scope here. A
 * dictionary in the view could not have repaired it either — by the time a view
 * saw the row the sentence was already built, so the only thing left to translate
 * was English prose. So the decision moves rather than the words: the projection
 * carries the numbers and the chain's own token, and the view says it in the
 * reader's language.
 *
 * This is the same defect shape as the readback panel's error message, which was
 * resolved at fetch time for the same reason and fixed the same way.
 */
export type InboxDetail =
  /** A gate, named by the chain's own outcome class. */
  | { reason: "gate-outcome"; outcomeClass: string }
  /** A deliberation still open, with no minutes yet. */
  | { reason: "collecting-positions" }
  /** A minutes entry: how many of its recorded issues nothing has since settled. */
  | { reason: "open-issues"; open: number; recorded: number };

export interface InboxItem {
  kind: "gate" | "conference" | "unresolved";
  partitionId: string;
  recordId: string;
  externalKey: string | null;
  title: string;
  detail: InboxDetail;
  /** Owner-intent gates outrank everything: the engine is blocked until they clear. */
  severity: "owner-intent" | "attention";
}

export function buildInbox(input: {
  gates: readonly ProjectedGate[];
  conferences: readonly { partitionId: string; id: string; externalKey: string | null; title: string | null; status: string }[];
  effectiveUnresolved: readonly EffectiveUnresolved[];
  minutesById: ReadonlyMap<string, { partitionId: string; externalKey: string | null; summary: string | null }>;
}): InboxItem[] {
  const items: InboxItem[] = [];

  for (const gate of input.gates) {
    if (gate.status !== "pending") continue;
    items.push({
      kind: "gate",
      partitionId: gate.partitionId,
      recordId: gate.id,
      externalKey: gate.externalKey,
      title: gate.title ?? gate.externalKey ?? gate.id,
      detail: { reason: "gate-outcome", outcomeClass: gate.outcomeClass },
      severity: gate.outcomeClass === "owner_intent_required" ? "owner-intent" : "attention"
    });
  }

  for (const conference of input.conferences) {
    if (conference.status !== "open") continue;
    items.push({
      kind: "conference",
      partitionId: conference.partitionId,
      recordId: conference.id,
      externalKey: conference.externalKey,
      title: conference.title ?? conference.externalKey ?? conference.id,
      detail: { reason: "collecting-positions" },
      severity: "attention"
    });
  }

  for (const entry of input.effectiveUnresolved) {
    if (entry.effective.length === 0) continue;
    const minutes = input.minutesById.get(entry.minutesId);
    if (!minutes) continue;
    items.push({
      kind: "unresolved",
      partitionId: minutes.partitionId,
      recordId: entry.minutesId,
      externalKey: entry.externalKey ?? minutes.externalKey,
      title: minutes.summary ?? entry.externalKey ?? entry.minutesId,
      detail: { reason: "open-issues", open: entry.effective.length, recorded: entry.surface.length },
      severity: "attention"
    });
  }

  // Owner-intent first, then stable by key so the list does not reshuffle
  // between reads and cost the reader their place.
  const rank = (item: InboxItem) => (item.severity === "owner-intent" ? 0 : 1);
  return items.sort((left, right) =>
    rank(left) - rank(right) || (left.externalKey ?? "").localeCompare(right.externalKey ?? ""));
}

/**
 * One line of a work item's history, ready to render.
 *
 * The chain records operations, not sentences, so this layer names the
 * operation and stops there. It never reconstructs a diff ("status changed from
 * ready to active") because the event payload holds the record's state *after*
 * the write and nothing about what it replaced — a before-value would have to be
 * inferred from the neighbouring event, and an inferred before-value presented
 * as history is a fabrication with a timestamp on it.
 */
export interface ActivityEntry {
  id: string;
  sequence: number;
  occurredAt: string;
  operation: string;
  /**
   * Who the chain says acted, or null.
   *
   * Null has two distinct causes and `attribution` tells them apart, because
   * "this partition never recorded actors" and "this event predates the day it
   * started" are different facts about the same blank space.
   */
  actorId: string | null;
  attribution: "recorded" | "predates-attestation" | "not-enabled";
}

/**
 * Build a work item's activity feed from the chain's own event log.
 *
 * `attestationFromSequence` is the sequence at which the partition began
 * recording actors — null when it never did. It is passed in rather than
 * inferred from whether any event happens to carry an actor: a chain that
 * enabled attestation and has not been written to since carries no actor on any
 * event, and inferring from that would report it as never enabled.
 */
export function buildActivityFeed(
  events: readonly ProjectedEvent[],
  attestationFromSequence: number | null
): ActivityEntry[] {
  return [...events]
    .sort((left, right) => right.sequence - left.sequence)
    .map((event) => ({
      id: event.id,
      sequence: event.sequence,
      occurredAt: event.occurredAt,
      operation: event.operation,
      actorId: event.actorId,
      attribution: event.actorId
        ? "recorded" as const
        : attestationFromSequence === null
          ? "not-enabled" as const
          : event.sequence < attestationFromSequence
            ? "predates-attestation" as const
            // Attestation is on and this event still carries no actor. Reporting
            // it as "not recorded" would be a guess about why; the honest label
            // is the same one used for a chain that never enabled it, so the
            // reader is told what is missing rather than told a reason.
            : "not-enabled" as const
    }));
}
