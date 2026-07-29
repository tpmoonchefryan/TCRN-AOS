// The two judgements the switch rehearsal actually turns on, as pure functions.
//
// TCRN-AOS-INC-038. Everything else in this directory needs a VM, an SSH
// tunnel, a live engine and a running service — so it runs by hand, a few times
// a quarter, and between runs nothing notices when a predicate quietly stops
// meaning what it meant. The two judgements below are the expensive ones (they
// are what act3 and act4 come down to) and neither of them needs any of that
// machinery: given a string of HTML and given a roster, they decide. So they
// live here, in the automated test roster, and the acts IMPORT them.
//
// Imported, not copied. A second copy would drift from the first the first time
// somebody fixed one of them, and the rehearsal would then be testing a
// predicate the test suite has never seen.

/** The tool-name prefix every governed facade verb carries. */
export const FACADE_PREFIX = "tcrn_workflow_";

/**
 * Which cockpit view a rendered page says it is.
 *
 * `null` means the marker is absent — which is what the shell fallback answers
 * with, and is exactly the failure this predicate exists to separate from a
 * real render. The service serves the shell document for any unknown path by
 * design (a deep link has to reach the same document), so "200 and some HTML"
 * is not evidence that the route rendered anything of its own.
 */
export function viewOf(html) {
  return (String(html).match(/data-cockpit-view="([a-z-]+)"/u) ?? [])[1] ?? null;
}

/**
 * Whether a page carries THIS chain's identity — its partition id and its label.
 *
 * Both, not either: the id alone can appear in a link or a data attribute that
 * a shell renders without any data behind it, and the label alone is prose.
 */
export function rendersPartition(html, { partitionId, label }) {
  const text = String(html);
  return text.includes(partitionId) && text.includes(label);
}

/**
 * Did `route` render its OWN view, from THIS partition's data?
 *
 * Three ways to be red, each named separately, because they mean different
 * things to whoever reads the receipt:
 *   - SHELL_FALLBACK      the page has no view marker at all — the service fell
 *                         back to the shell document and no view rendered;
 *   - VIEW_NOT_ITS_OWN    a view rendered, but another route's;
 *   - PARTITION_NOT_RENDERED  the right view, rendered from data that is not
 *                         this chain's (the committed cockpit fixtures, another
 *                         partition, a stale build).
 */
export function judgeRouteView({ route, html, expectedView, partitionId, label }) {
  const view = viewOf(html);
  const carriesPartition = rendersPartition(html, { partitionId, label });
  const reasonCode = view === null ? "SHELL_FALLBACK"
    : view !== expectedView ? "VIEW_NOT_ITS_OWN"
      : !carriesPartition ? "PARTITION_NOT_RENDERED"
        : "ROUTE_RENDERED_ITS_OWN_VIEW";
  return {
    route,
    expectedView,
    view,
    viewIsItsOwn: view !== null && view === expectedView,
    rendersPartition: carriesPartition,
    ok: reasonCode === "ROUTE_RENDERED_ITS_OWN_VIEW",
    reasonCode
  };
}

/**
 * Can this write-log row be replayed against the engine that is actually here?
 *
 * The authority is the engine's own command roster, passed in — never a list
 * transcribed into a source file, which would answer today's question from
 * whatever the roster looked like the day it was typed. This function decides;
 * fetching the roster stays with the caller, because that is the part that
 * needs a live engine.
 *
 * `roster` is a Map from CLI verb name to `{ mutates, flags: [{ name }] }`.
 *
 * `acceptForged` is the red-suite knob: with it on, an unknown verb is treated
 * as a mutation with no declared flags and undeclared arguments are waved
 * through — which is precisely the classifier NOT doing its job, and the
 * rehearsal asserts that the forgeries then get through. A red-path switch that
 * cannot be exercised proves nothing, so it lives in the signature.
 */
export function classifyReplayRow(row, roster, { acceptForged = false } = {}) {
  if (!String(row.verb).startsWith(FACADE_PREFIX)) {
    return { replayable: false, derivedVerb: null, reasonCode: "REPLAY_VERB_NOT_A_FACADE_TOOL" };
  }
  const derivedVerb = String(row.verb).slice(FACADE_PREFIX.length).replaceAll("_", "-");
  const command = acceptForged
    ? (roster.get(derivedVerb) ?? { mutates: true, flags: [] })
    : roster.get(derivedVerb);
  if (!command) {
    return { replayable: false, derivedVerb, reasonCode: "REPLAY_VERB_UNKNOWN_TO_ENGINE" };
  }
  if (command.mutates !== true) {
    return { replayable: false, derivedVerb, reasonCode: "REPLAY_VERB_NOT_A_MUTATION" };
  }
  const args = JSON.parse(row.argsJson);
  const declared = new Set((command.flags ?? []).map((flag) => flag.name));
  const undeclaredFlags = Object.keys(args).filter((key) => !declared.has(key));
  if (undeclaredFlags.length > 0 && !acceptForged) {
    return { replayable: false, derivedVerb, undeclaredFlags, reasonCode: "REPLAY_ARG_NOT_A_DECLARED_FLAG" };
  }
  return { replayable: true, derivedVerb, args, reasonCode: "REPLAYABLE" };
}

/** The engine's `commands` output as the map `classifyReplayRow` reads. */
export function rosterIndex(commands) {
  return new Map(commands.map((command) => [command.name, command]));
}

/**
 * Did the consistency matrix's whole-document `export` hit the 1MiB ceiling and
 * did the per-event paged path then produce THIS chain?
 *
 * On a live partition past the ceiling the engine refuses `export` outright and
 * the matrix driver degrades to reading the event segments one at a time. The
 * degradation used to leave nothing behind but the engine's refusal on stderr:
 * a run in which the paged path produced the whole chain and a run in which it
 * produced nothing looked exactly alike, because nothing judged it.
 *
 * Three claims, each able to fail on its own:
 *   1. the fallback happened — the mode the driver reports AND the absence of a
 *      whole-document projection digest. Both, because a mode string is the
 *      driver describing itself, and the missing digest is the consequence;
 *      they can disagree, and if they do the driver is describing a path it did
 *      not take.
 *   2. the paged read assembled events at all (segments and events non-zero);
 *   3. what it assembled is THIS chain — the head hash the paged read arrives
 *      at equals, at full value, the head the engine's own `status` reports for
 *      the authority. Not a prefix comparison: an 8-character local id against a
 *      7-character truncation is how a difference that does not exist gets
 *      reported, and how one that does gets missed.
 */
export function judgeExportFallback({ matrix, authorityHeadEventHash }) {
  const projectionMode = matrix?.sides?.f?.projectionMode ?? null;
  const fellBack = typeof projectionMode === "string" && projectionMode.startsWith("per-event-segmented");
  const wholeDocumentProjectionDigest = matrix?.mutualReference?.stateProjectionDigest?.f ?? null;
  const pagedSegments = matrix?.sides?.f?.segments ?? 0;
  const pagedEvents = matrix?.sides?.f?.events ?? 0;
  const pagedHeadEventHash = matrix?.mutualReference?.chainHeadEventHash?.f ?? null;
  const headMatches = typeof authorityHeadEventHash === "string"
    && authorityHeadEventHash.length > 0
    && pagedHeadEventHash === authorityHeadEventHash;
  const reasonCode = !fellBack ? "EXPORT_FALLBACK_DID_NOT_OCCUR"
    : wholeDocumentProjectionDigest !== null ? "EXPORT_FALLBACK_CONTRADICTED_BY_PROJECTION_DIGEST"
      : (pagedSegments === 0 || pagedEvents === 0) ? "PAGED_PATH_PRODUCED_NO_EVENTS"
        : !headMatches ? "PAGED_HEAD_DIFFERS_FROM_AUTHORITY"
          : "EXPORT_REFUSED_PAGED_PATH_PRODUCED_THE_CHAIN";
  return {
    ok: reasonCode === "EXPORT_REFUSED_PAGED_PATH_PRODUCED_THE_CHAIN",
    reasonCode,
    projectionMode,
    wholeDocumentProjectionDigest,
    pagedSegments,
    pagedEvents,
    pagedHeadEventHash,
    authorityHeadEventHash: authorityHeadEventHash ?? null,
    headFullValueEqualsAuthority: headMatches
  };
}
