import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FACADE_PREFIX, classifyReplayRow, judgeExportFallback, judgeRouteView,
  rendersPartition, rosterIndex, viewOf
} from "./rehearsal-predicates.mjs";

/**
 * The switch rehearsal's two load-bearing judgements, on synthetic input
 * (TCRN-AOS-INC-038).
 *
 * No VM, no tunnel, no engine, no network: every input below is a literal in
 * this file. That is the whole point — these predicates decide whether a
 * rehearsal passes, and until now they only ever ran on a machine with an SSH
 * connection open, a few times a quarter, where a silent change of meaning
 * would go unnoticed until the next ceremony.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));

// A page as the renderer emits it, reduced to the bytes the predicate reads.
const page = ({ view, partitionId = "SCRATCH-REHEARSAL", label = "Switch rehearsal" }) =>
  `<!doctype html><html><body><main${view === null ? "" : ` data-cockpit-view="${view}"`}>`
  + `<h1>${label}</h1><span data-partition="${partitionId}">…</span></main></body></html>`;

const IDENTITY = { partitionId: "SCRATCH-REHEARSAL", label: "Switch rehearsal" };

test("a route that rendered its own view from this chain is green", () => {
  const judged = judgeRouteView({
    route: "/work-items", html: page({ view: "work-items" }),
    expectedView: "work-items", ...IDENTITY
  });
  assert.equal(judged.ok, true);
  assert.equal(judged.reasonCode, "ROUTE_RENDERED_ITS_OWN_VIEW");
  assert.equal(judged.view, "work-items");
  assert.equal(judged.viewIsItsOwn, true);
  assert.equal(judged.rendersPartition, true);
});

test("the shell fallback is red, and named as the fallback rather than as a mismatch", () => {
  // The service answers the shell document for any unknown path by design, so
  // "200 with HTML" is not evidence a route rendered. A page with no view
  // marker at all is the shape that arrives when it did not.
  const judged = judgeRouteView({
    route: "/board", html: page({ view: null }),
    expectedView: "board", ...IDENTITY
  });
  assert.equal(judged.ok, false);
  assert.equal(judged.reasonCode, "SHELL_FALLBACK");
  assert.equal(judged.view, null);
  assert.equal(judged.viewIsItsOwn, false);
});

test("another route's view is red, even though a view did render", () => {
  const judged = judgeRouteView({
    route: "/board", html: page({ view: "work-items" }),
    expectedView: "board", ...IDENTITY
  });
  assert.equal(judged.ok, false);
  assert.equal(judged.reasonCode, "VIEW_NOT_ITS_OWN");
  assert.equal(judged.view, "work-items");
});

test("the right view rendered from another partition's data is red", () => {
  // The red control the rehearsal runs for real: the SAME renderer, given the
  // repository's committed cockpit data instead of the rehearsal projection.
  // The view still renders — so a predicate that only looked at the view marker
  // would be green on data from an entirely different chain.
  const judged = judgeRouteView({
    route: "/work-items",
    html: page({ view: "work-items", partitionId: "TCRN-AOS", label: "AOS" }),
    expectedView: "work-items", ...IDENTITY
  });
  assert.equal(judged.ok, false);
  assert.equal(judged.reasonCode, "PARTITION_NOT_RENDERED");
  assert.equal(judged.viewIsItsOwn, true, "the view marker alone would have passed");
  assert.equal(judged.rendersPartition, false);

  // The partition id without the label is not enough either: an id can appear
  // in a link the shell renders with no data behind it.
  assert.equal(
    rendersPartition(page({ view: "work-items", label: "AOS" }), IDENTITY), false);
  assert.equal(viewOf("<main>no marker</main>"), null);
});

// ---- the replay classifier ------------------------------------------------

/** A roster shaped like the engine's own `commands` output. */
const ROSTER = rosterIndex([
  { name: "work-transition", mutates: true, flags: [
    { name: "workspace" }, { name: "expected-version" }, { name: "at" }, { name: "actor" },
    { name: "id" }, { name: "status" }] },
  { name: "work-annotate", mutates: true, flags: [
    { name: "workspace" }, { name: "expected-version" }, { name: "at" }, { name: "actor" },
    { name: "id" }, { name: "scope" }, { name: "decided-by" }] },
  { name: "status", mutates: false, flags: [{ name: "workspace" }] }
]);

const logRow = (verb, args) => ({ seq: 1, verb, argsJson: JSON.stringify(args) });
const BASE = { workspace: "/srv/rehearsal/workspace", "expected-version": "head",
  at: "2026-07-29T02:30:00Z", actor: "agent:fable", id: "work:aaaaaaaaaaaaaaaaaaaaaaaa" };

test("a genuine row classifies replayable, with the CLI verb derived from the tool name", () => {
  const verdict = classifyReplayRow(
    logRow(`${FACADE_PREFIX}work_transition`, { ...BASE, status: "ready" }), ROSTER);
  assert.equal(verdict.replayable, true);
  assert.equal(verdict.reasonCode, "REPLAYABLE");
  assert.equal(verdict.derivedVerb, "work-transition");
  assert.equal(verdict.args.status, "ready");
});

test("a well-formed tool name for a verb the engine does not have is REPLAY_VERB_UNKNOWN_TO_ENGINE", () => {
  // The first forgery the rollback rehearsal injects: nothing about the row
  // looks wrong. It is only wrong against the roster of the engine that is
  // actually here, which is why the roster is the authority and not a list
  // transcribed into a source file.
  const verdict = classifyReplayRow(logRow(`${FACADE_PREFIX}work_bless`, BASE), ROSTER);
  assert.equal(verdict.replayable, false);
  assert.equal(verdict.reasonCode, "REPLAY_VERB_UNKNOWN_TO_ENGINE");
  assert.equal(verdict.derivedVerb, "work-bless");
});

test("a real verb carrying an argument it does not declare is REPLAY_ARG_NOT_A_DECLARED_FLAG", () => {
  // The second forgery: a verb that exists, called with a flag it never
  // declared. Replaying it would either be rejected by the engine or, worse,
  // be accepted with the extra field dropped — a write that recorded less than
  // the log said it recorded.
  const verdict = classifyReplayRow(
    logRow(`${FACADE_PREFIX}work_annotate`,
      { ...BASE, scope: "forged", "provenance-note": "a flag this verb does not declare" }),
    ROSTER);
  assert.equal(verdict.replayable, false);
  assert.equal(verdict.reasonCode, "REPLAY_ARG_NOT_A_DECLARED_FLAG");
  assert.deepEqual(verdict.undeclaredFlags, ["provenance-note"]);
});

test("the other two refusals stay distinguishable from each other", () => {
  assert.equal(
    classifyReplayRow(logRow("work-transition", BASE), ROSTER).reasonCode,
    "REPLAY_VERB_NOT_A_FACADE_TOOL");
  assert.equal(
    classifyReplayRow(logRow(`${FACADE_PREFIX}status`, { workspace: "/srv/x" }), ROSTER).reasonCode,
    "REPLAY_VERB_NOT_A_MUTATION");
});

test("acceptForged is the red-path switch, and it really does let the forgeries through", () => {
  // The rehearsal's red suite flips this to prove the classifier is what stops
  // the forgeries. A switch that cannot be exercised proves nothing, so both
  // of its positions are asserted here against the same two rows.
  const unknown = logRow(`${FACADE_PREFIX}work_bless`, BASE);
  const undeclared = logRow(`${FACADE_PREFIX}work_annotate`, { ...BASE, "provenance-note": "x" });
  assert.equal(classifyReplayRow(unknown, ROSTER).replayable, false);
  assert.equal(classifyReplayRow(undeclared, ROSTER).replayable, false);
  assert.equal(classifyReplayRow(unknown, ROSTER, { acceptForged: true }).replayable, true);
  assert.equal(classifyReplayRow(undeclared, ROSTER, { acceptForged: true }).replayable, true);
});

// ---- the export-ceiling fallback -----------------------------------------

const HEAD = "557b5032648ede9157d68b4c9ccec7b4216f700576ff7c39cbf781e6bfac1088";
/** A matrix result, reduced to the fields this judgement reads. */
const matrixResult = ({ projectionMode, stateProjectionDigest = null, segments = 12, events = 549, head = HEAD }) => ({
  sides: { f: { projectionMode, segments, events } },
  mutualReference: {
    stateProjectionDigest: { f: stateProjectionDigest, fMode: projectionMode },
    chainHeadEventHash: { f: head }
  }
});

test("export refused past the ceiling, paged path produced the chain: green", () => {
  const judged = judgeExportFallback({
    matrix: matrixResult({ projectionMode: "per-event-segmented (whole-document export refused: INPUT_OVERSIZED)" }),
    authorityHeadEventHash: HEAD
  });
  assert.equal(judged.ok, true);
  assert.equal(judged.reasonCode, "EXPORT_REFUSED_PAGED_PATH_PRODUCED_THE_CHAIN");
  assert.equal(judged.pagedEvents, 549);
  assert.equal(judged.headFullValueEqualsAuthority, true);
});

test("no fallback at all is red, and says so rather than passing quietly", () => {
  const judged = judgeExportFallback({
    matrix: matrixResult({ projectionMode: "whole-document", stateProjectionDigest: "a".repeat(64) }),
    authorityHeadEventHash: HEAD
  });
  assert.equal(judged.ok, false);
  assert.equal(judged.reasonCode, "EXPORT_FALLBACK_DID_NOT_OCCUR");
});

test("a driver that claims the paged path while still holding a whole-document digest is red", () => {
  // The two signals can disagree, and when they do the mode string is the
  // driver describing a path it did not take.
  const judged = judgeExportFallback({
    matrix: matrixResult({ projectionMode: "per-event-segmented (…)", stateProjectionDigest: "b".repeat(64) }),
    authorityHeadEventHash: HEAD
  });
  assert.equal(judged.ok, false);
  assert.equal(judged.reasonCode, "EXPORT_FALLBACK_CONTRADICTED_BY_PROJECTION_DIGEST");
});

test("a fallback that produced nothing is red — this is the state the old run could not tell from success", () => {
  const empty = judgeExportFallback({
    matrix: matrixResult({ projectionMode: "per-event-segmented (…)", segments: 0, events: 0, head: null }),
    authorityHeadEventHash: HEAD
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.reasonCode, "PAGED_PATH_PRODUCED_NO_EVENTS");
});

test("a paged read that assembled some OTHER chain is red, and full values are compared", () => {
  const other = judgeExportFallback({
    matrix: matrixResult({ projectionMode: "per-event-segmented (…)", head: "c".repeat(64) }),
    authorityHeadEventHash: HEAD
  });
  assert.equal(other.ok, false);
  assert.equal(other.reasonCode, "PAGED_HEAD_DIFFERS_FROM_AUTHORITY");
  // A truncation of the same hash is a difference, not a match: comparing
  // shortened ids is how a difference that does not exist gets reported and
  // how one that does gets missed.
  const truncated = judgeExportFallback({
    matrix: matrixResult({ projectionMode: "per-event-segmented (…)", head: HEAD.slice(0, 40) }),
    authorityHeadEventHash: HEAD
  });
  assert.equal(truncated.reasonCode, "PAGED_HEAD_DIFFERS_FROM_AUTHORITY");
  // And a missing authority head cannot be talked into agreeing with anything.
  assert.equal(
    judgeExportFallback({ matrix: matrixResult({ projectionMode: "per-event-segmented (…)", head: null }),
      authorityHeadEventHash: null }).ok,
    false);
});

test("act2 reads the matrix fields this judgement expects", () => {
  // The judgement navigates a runMatrix result by path, and a renamed field
  // would make every lookup undefined — which the ?? chain would turn into a
  // red rather than a crash, and a hand-run act could then fail for a reason
  // nobody could see. The driver's own assignments are the reference.
  const driver = readFileSync(join(HERE, "../../scripts/consistency-matrix/run-matrix.mjs"), "utf8");
  assert.match(driver, /validateReasonCode: fValidate\.reasonCode, projectionMode/u);
  assert.match(driver, /chainHeadEventHash: \{ f: fHead, a: aHead \}/u);
  assert.match(driver, /stateProjectionDigest: \{\s*f: fExport !== null \? sha256Text\(fExport\) : null/u);
  const act2 = readFileSync(join(HERE, "act2-real-chain-arc.mjs"), "utf8");
  assert.match(act2, /import \{[^}]*judgeExportFallback[^}]*\} from "\.\/rehearsal-predicates\.mjs"/u);
  assert.match(act2, /judgeExportFallback\(\{ matrix, authorityHeadEventHash: liveHeadBefore\.headEventHash \}\)/u);
});

test("the rehearsal acts import these predicates rather than keeping a second copy", () => {
  // A second copy drifts from the first the moment anybody fixes one of them,
  // and the rehearsal would then be running a predicate this file has never
  // seen. Asserted on the source text because that is where the duplication
  // would appear.
  const act3 = readFileSync(join(HERE, "act3-product-walkthrough.mjs"), "utf8");
  const act4 = readFileSync(join(HERE, "act4-rollback-arc.mjs"), "utf8");
  assert.match(act3, /import \{[^}]*judgeRouteView[^}]*\} from "\.\/rehearsal-predicates\.mjs"/u);
  assert.match(act4, /import \{[^}]*classifyReplayRow[^}]*\} from "\.\/rehearsal-predicates\.mjs"/u);
  // And no re-implementation beside the import: the marker regex and the
  // facade prefix each have exactly one definition, here.
  assert.doesNotMatch(act3, /data-cockpit-view="\(\[a-z-\]\+\)"/u);
  assert.doesNotMatch(act4, /const FACADE_PREFIX/u);
  assert.doesNotMatch(act4, /REPLAY_VERB_UNKNOWN_TO_ENGINE/u);
});
