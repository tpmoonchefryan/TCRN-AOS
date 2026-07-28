import test from "node:test";
import assert from "node:assert/strict";
import {
  stripStampLines,
  stampedScope,
  judgeAnnotatePair,
  NOOP_REFUSAL_MESSAGE
} from "./annotate-pair.mjs";

/**
 * The annotate-pair judge and stamp handling, judged as units.
 *
 * The judge also has a live red-proof (scripts/inc-034-annotate-pair-proof.mjs)
 * that runs it against a real scratch chain; these tests are the cheap half
 * that runs on every `pnpm test`, over synthetic observations whose shape
 * matches what both callers measure.
 */

// --- stripStampLines --------------------------------------------------------

test("a scope with no stamp is returned byte for byte, trailing blank lines included", () => {
  // The trailing-blank pop is conditional on a stamp actually having been
  // removed; without one, blanks are narrative and stay.
  assert.equal(stripStampLines("line1\n\n"), "line1\n\n");
  assert.equal(stripStampLines(""), "");
  assert.equal(stripStampLines("narrative only"), "narrative only");
});

test("a stamp this module appended is stripped, along with its separator blanks", () => {
  const scope = "narrative\n[acceptance-stamp 2026-07-28T00:00:00Z]";
  assert.equal(stripStampLines(scope), "narrative");
  const withBlanks = "narrative\n\n[acceptance-stamp 2026-07-28T00:00:00Z]";
  assert.equal(stripStampLines(withBlanks), "narrative");
});

test("an indented stamp-looking line is narrative and is not stripped", () => {
  // The pattern anchors on the raw line: this module writes stamps flush-left,
  // so an indented lookalike was written by someone's narrative, not by us.
  const scope = "narrative\n  [acceptance-stamp 2026-07-28T00:00:00Z]";
  assert.equal(stripStampLines(scope), scope);
});

test("a stamp line that round-tripped through CRLF is still recognised", () => {
  assert.equal(stripStampLines("narrative\n[acceptance-stamp 2026-07-28T00:00:00Z]\r"), "narrative");
});

test("stampedScope appends exactly one stamp that stripStampLines removes again", () => {
  const stamped = stampedScope("narrative", "2026-07-28T00:00:00Z");
  assert.equal(stamped, "narrative\n[acceptance-stamp 2026-07-28T00:00:00Z]");
  assert.equal(stripStampLines(stamped), "narrative");
  assert.equal(stampedScope("", "2026-07-28T00:00:00Z"), "[acceptance-stamp 2026-07-28T00:00:00Z]");
});

// --- judgeAnnotatePair ------------------------------------------------------

const RECORD = "work:0000000000000000000000aa";

/** A faithful observation: accepted write, one event, refused no-op replay. */
const faithful = () => ({
  recordId: RECORD,
  write: { status: 200 },
  before: { revision: 3 },
  afterWrite: { revision: 4 },
  events: { delta: 1, lastOperation: "work.annotated", lastRecordId: RECORD },
  replay: { status: 409, message: `refused: ${NOOP_REFUSAL_MESSAGE}`, revisionAfter: 4 }
});

const failedNames = (judged) => judged.checks.filter((check) => !check.ok).map((check) => check.name);

test("a faithful pair is judged green on every check", () => {
  const judged = judgeAnnotatePair(faithful());
  assert.equal(judged.ok, true);
  assert.deepEqual(failedNames(judged), []);
  assert.deepEqual(
    judged.checks.map((check) => check.name),
    [
      "write-accepted",
      "revision-advanced-by-one",
      "exactly-one-work-annotated-event",
      "replay-refused",
      "refusal-names-the-noop",
      "revision-held-on-replay"
    ]
  );
});

test("an accepted replay turns the judge red on replay-refused and revision-held", () => {
  // The engine accepted the "replay" as a fresh annotation: 200, revision moved
  // again. The pair never held a refusal and the judge must say exactly that.
  const observation = faithful();
  observation.replay = { status: 200, message: null, revisionAfter: 5 };
  const judged = judgeAnnotatePair(observation);
  assert.equal(judged.ok, false);
  assert.deepEqual(failedNames(judged), ["replay-refused", "refusal-names-the-noop", "revision-held-on-replay"]);
});

test("a wrong-id refusal shares the 409 but not the message, and must not count as the no-op refusal", () => {
  // WORKSPACE_INPUT_INVALID covers dozens of refusals; the verbatim message is
  // the half a shared reason code cannot fake.
  const observation = faithful();
  observation.replay = { status: 409, message: "work work:000000000000000000000000 not found", revisionAfter: 4 };
  const judged = judgeAnnotatePair(observation);
  assert.equal(judged.ok, false);
  assert.deepEqual(failedNames(judged), ["refusal-names-the-noop"]);
});

test("a write the engine refused is red on write-accepted even if the replay half looks held", () => {
  const observation = faithful();
  observation.write = { status: 409 };
  observation.afterWrite = { revision: 3 };
  observation.events = { delta: 0, lastOperation: null, lastRecordId: null };
  observation.replay = { status: 409, message: `refused: ${NOOP_REFUSAL_MESSAGE}`, revisionAfter: 3 };
  const judged = judgeAnnotatePair(observation);
  assert.equal(judged.ok, false);
  assert.ok(failedNames(judged).includes("write-accepted"));
  assert.ok(failedNames(judged).includes("revision-advanced-by-one"));
});

test("an event attributed to a different record fails the event check by name", () => {
  const observation = faithful();
  observation.events = { delta: 1, lastOperation: "work.annotated", lastRecordId: "work:0000000000000000000000bb" };
  const judged = judgeAnnotatePair(observation);
  assert.equal(judged.ok, false);
  assert.deepEqual(failedNames(judged), ["exactly-one-work-annotated-event"]);
});
