// The annotate-pair criterion, factored out so the acceptance proof and its
// red-proof judge with the same code (TCRN-AOS-INC-034 route B, TCRN-AOS-MIN-007).
//
// The pair is: one scope annotation that must be accepted, then a byte-identical
// replay that must be refused as a no-op. Both halves are judged from what the
// engine actually did — revision, event log, refusal message — never from the
// pair's own belief that it ran.

/**
 * A stamp line as the annotate pair writes it. Anchored to the whole raw line —
 * no trimming before the match — so an indented stamp-looking line is narrative
 * and stays: stripping must only ever remove lines this module itself appended,
 * and this module appends stamps flush-left. The optional trailing \r admits a
 * scope that once round-tripped through CRLF line endings.
 */
export const STAMP_LINE_PATTERN = /^\[acceptance-stamp \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\]\r?$/u;

/**
 * The engine's exact wording for a no-op annotation. The judge matches this
 * message, not the reason code: WORKSPACE_INPUT_INVALID is shared by dozens of
 * refusals (a wrong record id among them), so judging the code alone would be a
 * gate that cannot go red — any input mistake would count as "refusal held".
 */
export const NOOP_REFUSAL_MESSAGE = "annotation does not change any advisory field";

/**
 * The engine's string ceiling; scope is replaced whole, so the whole value must fit.
 *
 * Measured in Unicode code points, because that is how the engine measures it
 * (protocol PROTOCOL_LIMITS.maxStringLength = 8192, compared against
 * `[...value].length`). This constant was once treated as a UTF-8 byte limit,
 * which read a mostly-Chinese scope as full at roughly a third of its real
 * capacity — a false red, and one this measure exists to avoid repeating.
 */
export const SCOPE_CODE_POINT_LIMIT = 8192;

/** Measure a scope the way the engine does: Unicode code points, not bytes. */
export function scopeCodePointLength(value) {
  return [...value].length;
}

/**
 * Remove trailing stamp lines from a scope, returning the narrative.
 *
 * Scope is full-value-replacement in the engine, so every run re-sends the
 * entire narrative plus exactly one fresh stamp line; stripping earlier stamps
 * first is what keeps repeated runs bounded instead of growing by a line each
 * time until the 8192-byte ceiling refuses the write.
 */
export function stripStampLines(scope) {
  const lines = scope.split("\n");
  let poppedStamp = false;
  while (lines.length > 0 && STAMP_LINE_PATTERN.test(lines[lines.length - 1])) {
    lines.pop();
    poppedStamp = true;
  }
  // Trailing blank lines are popped only when a stamp was actually removed:
  // they are then the separator this module wrote before its own stamp. A scope
  // with no stamp is pure narrative, and narrative — trailing blanks included —
  // is returned byte for byte.
  if (poppedStamp) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
  }
  return lines.join("\n");
}

/** The narrative with a single fresh stamp line appended. */
export function stampedScope(narrative, atUtc) {
  const stamp = `[acceptance-stamp ${atUtc}]`;
  return narrative.length > 0 ? `${narrative}\n${stamp}` : stamp;
}

/**
 * Judge one observed annotate pair.
 *
 * The observation is everything the caller measured, and this function only
 * compares — it performs no writes, so the red-proof can feed it observations
 * of deliberately broken pairs and assert the verdict goes red for the right
 * reason.
 *
 * observation = {
 *   recordId,
 *   write:      { status },                      // 200 expected
 *   before:     { revision },
 *   afterWrite: { revision },
 *   events:     { delta, lastOperation, lastRecordId },
 *   replay:     { status, message, revisionAfter }
 * }
 */
export function judgeAnnotatePair(observation) {
  const { recordId, write, before, afterWrite, events, replay } = observation;
  const checks = [
    {
      name: "write-accepted",
      ok: write.status === 200,
      observed: { status: write.status }
    },
    {
      name: "revision-advanced-by-one",
      ok: afterWrite.revision === before.revision + 1,
      observed: { before: before.revision, afterWrite: afterWrite.revision }
    },
    {
      name: "exactly-one-work-annotated-event",
      ok: events.delta === 1 && events.lastOperation === "work.annotated" && events.lastRecordId === recordId,
      observed: events
    },
    {
      name: "replay-refused",
      ok: replay.status === 409,
      observed: { status: replay.status }
    },
    {
      // The verbatim-message check is the half a shared reason code cannot fake:
      // a replay that was refused for being aimed at the wrong record also
      // returns 409 WORKSPACE_INPUT_INVALID, and must not count as "the engine
      // held the no-op refusal".
      name: "refusal-names-the-noop",
      ok: typeof replay.message === "string" && replay.message.includes(NOOP_REFUSAL_MESSAGE),
      observed: { message: replay.message ?? null }
    },
    {
      name: "revision-held-on-replay",
      ok: replay.revisionAfter === afterWrite.revision,
      observed: { afterWrite: afterWrite.revision, afterReplay: replay.revisionAfter }
    }
  ];
  return { ok: checks.every((check) => check.ok), checks };
}
