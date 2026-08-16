import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTAINER_SCAN_CEILING, RELOCATION_STATES, attributeTree, containerWorkspaceRoster,
  judgeContainerRoster, judgeControlTree, judgeLocalPurity, judgeScanScope
} from "./local-purity-predicates.mjs";
import { PARTITION_ROSTER } from "./topology.mjs";

// The judgement half of the zero-artefact predicate, on synthetic rows
// (TCRN-AOS-STORY-133). No filesystem, no VM, no network: every input here is a
// literal, which is the whole reason this half was split out of the scan.
//
// The discipline this file is written to (MEMORY: 判据两侧必须能够不同) is that no
// assertion may stand alone. For every green there is a red that differs from it in
// exactly ONE field, and the field is named in the test title. A green whose
// neighbouring red is not also asserted is a green that could be structural.

/**
 * A row shaped like what `observeControlTree` actually emits, for the AOS archive
 * as it stands on this machine today.
 *
 * The values are the real ones (roster identity, the hop that moved it, the engine's
 * own refusal code) so that a change to the roster breaks this file rather than
 * silently making it test a partition that no longer exists.
 */
const AOS = Object.freeze(PARTITION_ROSTER.find((entry) => entry.partitionId === "TCRN-AOS"));
const CROSS = Object.freeze(PARTITION_ROSTER.find((entry) => entry.partitionId === "cross-project"));

// Archive/away branches are still part of the predicate contract, but the shipped
// topology is now all-local after S199. Keep those branches on explicit synthetic
// rosters instead of making the current roster lie in order to exercise them.
const ALL_AWAY_ROSTER = Object.freeze(
  PARTITION_ROSTER.map((entry) => ({ ...entry, home: "vm" })));
const MIXED_ROSTER = Object.freeze(
  PARTITION_ROSTER.map((entry) => entry.partitionId === "TCRN-AOS"
    ? { ...entry, home: "vm" } : entry));

const archivedAosRow = Object.freeze({
  address: "/local/platform/.tcrn-workspace/TCRN-AOS/workspace",
  externalKey: AOS.externalKey,
  workspaceId: AOS.workspaceId,
  engineState: "vacated",
  readFaceAccepted: false,
  readFaceReasonCode: "WORKSPACE_RELOCATION_VACATED",
  relocationCount: 1,
  lastRelocationId: AOS.relocationId
});

const liveCrossRow = Object.freeze({
  address: "/local/platform/.tcrn-workspace/cross-project/workspace",
  externalKey: CROSS.externalKey,
  workspaceId: CROSS.workspaceId,
  engineState: "live",
  readFaceAccepted: true,
  readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED",
  relocationCount: 0,
  lastRelocationId: null
});

/** Live rows for every partition the roster says still lives here. */
const permittedLiveRows = PARTITION_ROSTER.filter((entry) => entry.home === "local")
  .map((entry) => ({
    ...liveCrossRow,
    address: `/local/platform/.tcrn-workspace/${entry.partitionId}/workspace`,
    externalKey: entry.externalKey,
    workspaceId: entry.workspaceId
  }));
const permittedOtherLiveRows = permittedLiveRows.filter((row) => row.externalKey !== AOS.externalKey);

/**
 * Synthetic archived rows for every partition under an all-away roster. They keep
 * the archive branch covered without changing the shipped all-local S199 roster.
 */
const archivedRows = ALL_AWAY_ROSTER.map((entry) => ({
  address: `/srv/tcrn/governance/tcrn-workspace/${entry.partitionId}/workspace`,
  externalKey: entry.externalKey,
  workspaceId: entry.workspaceId,
  engineState: "vacated",
  readFaceAccepted: false,
  readFaceReasonCode: "WORKSPACE_RELOCATION_VACATED",
  relocationCount: 1,
  lastRelocationId: entry.relocationId
}));

const establishedScope = () => judgeScanScope({
  containerExists: true,
  rootsWalked: [{ id: "platform-root", reachable: true }, { id: "home-shallow", reachable: true }],
  partitionsFoundLive: PARTITION_ROSTER.filter((entry) => entry.home === "local")
    .map((entry) => entry.partitionId),
  roster: PARTITION_ROSTER
});

const establishedMixedScope = () => judgeScanScope({
  containerExists: true,
  rootsWalked: [{ id: "platform-root", reachable: true }, { id: "home-shallow", reachable: true }],
  partitionsFoundLive: MIXED_ROSTER.filter((entry) => entry.home === "local")
    .map((entry) => entry.partitionId),
  roster: MIXED_ROSTER
});

const establishedAwayScope = () => judgeScanScope({
  containerExists: true,
  rootsWalked: [{ id: "platform-root", reachable: true }, { id: "home-shallow", reachable: true }],
  partitionsFoundLive: [],
  roster: ALL_AWAY_ROSTER
});

test("attribution needs BOTH identity terms, and one term matching alone is a conflict not a match", () => {
  const matched = attributeTree(archivedAosRow, PARTITION_ROSTER);
  assert.equal(matched.attribution, "IDENTITY_PAIR_MATCHED");
  assert.equal(matched.partition.partitionId, "TCRN-AOS");

  // One field changed: the workspaceId now belongs to another rostered partition
  // while the externalKey still says AOS. That is the shape a copied-and-renamed
  // tree produces, and it must not resolve to either partition.
  const crossed = attributeTree(
    { ...archivedAosRow, workspaceId: CROSS.workspaceId }, PARTITION_ROSTER);
  assert.equal(crossed.attribution, "IDENTITY_TERMS_DISAGREE");
  assert.equal(crossed.partition, null);
  assert.equal(crossed.matchedByExternalKey, "TCRN-AOS");
  assert.equal(crossed.matchedByWorkspaceId, "cross-project");

  const stranger = attributeTree(
    { externalKey: "SOMEONE-ELSES-WORKSPACE", workspaceId: "workspace:0000000000000000000000ff" },
    PARTITION_ROSTER);
  assert.equal(stranger.attribution, "PARTITION_UNKNOWN");
  assert.equal(stranger.partition, null);
});

test("the retained AOS archive is green, and reviving it — one field, engineState — is red", () => {
  const archive = judgeControlTree({ tree: archivedAosRow, roster: ALL_AWAY_ROSTER });
  assert.equal(archive.ok, true);
  assert.equal(archive.reasonCode, "ARCHIVE_RETAINED_AND_DEAD");
  assert.equal(archive.home, "vm");

  // ADR 0003 ceiling 2 in one field: restore a pre-vacate binding and the address
  // is fully alive again. This is exactly what red-proof.mjs makes happen for real
  // on a scratch copy; here it is the same judgement on a literal.
  const revived = judgeControlTree({
    tree: { ...archivedAosRow, engineState: "live", readFaceAccepted: true,
      readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED", relocationCount: 0, lastRelocationId: null },
    roster: ALL_AWAY_ROSTER
  });
  assert.equal(revived.ok, false);
  assert.equal(revived.reasonCode, "AWAY_PARTITION_TREE_IS_LIVE");
});

test("an away-partition tree one governed verb short of live is red on its own", () => {
  const awaiting = judgeControlTree({
    tree: { ...archivedAosRow, engineState: "adoption-required", readFaceAccepted: false,
      readFaceReasonCode: "WORKSPACE_RELOCATION_ADOPTION_REQUIRED" },
    roster: ALL_AWAY_ROSTER
  });
  assert.equal(awaiting.ok, false);
  assert.equal(awaiting.reasonCode, "AWAY_PARTITION_TREE_AWAITS_ADOPTION");
});

test("the archive is asserted on BOTH faces: a ledger that says vacated is not enough", () => {
  // The ledger term and the read-face term are computed by different engine code
  // paths, and only the pair rules out the ceiling-2 revival. So a row whose ledger
  // still says `vacated` while `status` answers must not pass.
  const answering = judgeControlTree({
    tree: { ...archivedAosRow, readFaceAccepted: true, readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED" },
    roster: ALL_AWAY_ROSTER
  });
  assert.equal(answering.ok, false);
  assert.equal(answering.reasonCode, "ARCHIVE_NOT_DEAD_ON_THE_READ_FACE");

  // Refused, but with somebody else's reason code. "It refused" is not the claim;
  // "it refused BECAUSE it was vacated" is.
  const wrongRefusal = judgeControlTree({
    tree: { ...archivedAosRow, readFaceReasonCode: "WORKSPACE_NOT_FOUND" },
    roster: ALL_AWAY_ROSTER
  });
  assert.equal(wrongRefusal.ok, false);
  assert.equal(wrongRefusal.reasonCode, "ARCHIVE_NOT_DEAD_ON_THE_READ_FACE");
});

test("an archive carrying a different hop is not accepted as the archive the roster names", () => {
  const otherHop = judgeControlTree({
    tree: { ...archivedAosRow, lastRelocationId: "relocation:ffffffffffffffffffffffff" },
    roster: ALL_AWAY_ROSTER
  });
  assert.equal(otherHop.ok, false);
  assert.equal(otherHop.reasonCode, "ARCHIVE_CARRIES_A_DIFFERENT_RELOCATION");
  assert.equal(otherHop.expectedRelocationId, AOS.relocationId);
  assert.equal(otherHop.observedRelocationId, "relocation:ffffffffffffffffffffffff");
});

test("an all-away roster makes a live tree here an away tree (red)", () => {
  // This branch is exercised against a synthetic all-away roster because S199's
  // shipped roster now correctly says every chain is local.
  const away = judgeControlTree({ tree: liveCrossRow, roster: ALL_AWAY_ROSTER });
  assert.equal(away.ok, false);
  assert.equal(away.reasonCode, "AWAY_PARTITION_TREE_IS_LIVE");

  // The same bytes, inert at a foreign address, stay inert — a stray copy is not
  // a finding.
  const stray = judgeControlTree({
    tree: { ...liveCrossRow, engineState: "foreign-address", readFaceAccepted: false,
      readFaceReasonCode: "WORKSPACE_ROOT_IDENTITY_MISMATCH" },
    roster: PARTITION_ROSTER
  });
  assert.equal(stray.ok, true);
  assert.equal(stray.reasonCode, "INERT_COPY");
});

test("a stray copy of a permitted partition is inert, not a red", () => {
  // A false red here is how a gate gets muted rather than read: every abandoned
  // experiment on the disk would light it up.
  const stray = judgeControlTree({
    tree: { ...liveCrossRow, engineState: "foreign-address", readFaceAccepted: false,
      readFaceReasonCode: "WORKSPACE_ROOT_IDENTITY_MISMATCH" },
    roster: PARTITION_ROSTER
  });
  assert.equal(stray.ok, true);
  assert.equal(stray.reasonCode, "INERT_COPY");
});

test("an unrostered LIVE tree is red, which is what stops the roster being a mute button", () => {
  const stranger = {
    address: "/somewhere/else/workspace",
    externalKey: "SOME-OTHER-WORKSPACE",
    workspaceId: "workspace:0000000000000000000000ff",
    engineState: "live",
    readFaceAccepted: true,
    readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED",
    relocationCount: 0,
    lastRelocationId: null
  };
  const live = judgeControlTree({ tree: stranger, roster: PARTITION_ROSTER });
  assert.equal(live.ok, false);
  assert.equal(live.reasonCode, "UNATTRIBUTED_TREE_IS_LIVE");

  // One field: the same stranger the engine refuses at this address is inert.
  const inert = judgeControlTree({
    tree: { ...stranger, engineState: "foreign-address", readFaceAccepted: false },
    roster: PARTITION_ROSTER
  });
  assert.equal(inert.ok, true);
  assert.equal(inert.reasonCode, "INERT_COPY");
});

test("the relocation-state vocabulary is closed, and closed in the FAILING direction", () => {
  // A fifth state added by a later engine must stop a person, not slip past as
  // "not live". This is the opposite of what `state === \"live\"` would do.
  const drifted = judgeControlTree({
    tree: { ...archivedAosRow, engineState: "quiesced" }, roster: PARTITION_ROSTER
  });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.reasonCode, "RELOCATION_STATE_UNRECOGNISED");
  assert.equal(drifted.attribution, "NOT_ATTEMPTED");

  assert.equal(judgeControlTree({ tree: { ...archivedAosRow, engineState: undefined },
    roster: PARTITION_ROSTER }).reasonCode, "RELOCATION_STATE_UNRECOGNISED");

  // The list is the engine's own, so it is asserted as a set rather than trusted.
  assert.deepEqual([...RELOCATION_STATES].sort(),
    ["adoption-required", "foreign-address", "live", "vacated"]);
});

test("「什么都没找到」不得与「没找到活的本地树」共用一个绿", () => {
  const established = establishedScope();
  assert.equal(established.ok, true);
  assert.equal(established.reasonCode, "SCAN_SCOPE_ESTABLISHED");
  assert.deepEqual(established.missing, []);

  // Run it where the workspace container does not exist: nothing found, nothing
  // judged, and without this term the whole predicate would report success.
  const nowhere = judgeScanScope({
    containerExists: false, rootsWalked: [{ id: "platform-root", reachable: true }],
    partitionsFoundLive: [], roster: PARTITION_ROSTER
  });
  assert.equal(nowhere.ok, false);
  assert.equal(nowhere.reasonCode, "SCAN_SCOPE_NOT_ESTABLISHED");

  // The all-away synthetic roster has no expected local partitions, so the scope
  // establishes regardless of what was found — a "found" live tree is then judged
  // by the tree-level predicate, not by scope.
  const partial = judgeScanScope({
    containerExists: true, rootsWalked: [{ id: "platform-root", reachable: true }],
    partitionsFoundLive: ["cross-project"], roster: ALL_AWAY_ROSTER
  });
  assert.equal(partial.ok, true);
  assert.equal(partial.reasonCode, "SCAN_SCOPE_ESTABLISHED");
  assert.deepEqual(partial.missing, []);

  const unreachable = judgeScanScope({
    containerExists: true,
    rootsWalked: [{ id: "platform-root", reachable: true }, { id: "home-shallow", reachable: false }],
    partitionsFoundLive: PARTITION_ROSTER.filter((entry) => entry.home === "local")
      .map((entry) => entry.partitionId),
    roster: PARTITION_ROSTER
  });
  assert.equal(unreachable.ok, false);
  assert.equal(unreachable.reasonCode, "SCAN_ROOT_UNREACHABLE");

  // Zero declared roots is "I looked nowhere" too, and `every` over an empty
  // array is true — so this needs the length term, not just the predicate.
  assert.equal(judgeScanScope({
    containerExists: true, rootsWalked: [], partitionsFoundLive: [], roster: PARTITION_ROSTER
  }).reasonCode, "SCAN_ROOT_UNREACHABLE");
});

test("today's real shape is green: every home chain lives locally", () => {
  // Since S199 every partition's chain lives on this machine's local file backend;
  // the shipped topology must therefore accept every live local tree it names.
  //
  // Both sides come from the roster rather than from a list frozen here. This is not a
  // tautology — the left side is what the PREDICATE returned and the right side is what
  // the roster DECLARES, so a predicate that dropped or invented a partition still fails.
  // What it stops being is a second copy of the roster that has to be hand-edited every
  // time one is admitted, which is how the count `5` outlived the fifth partition.
  const homeRows = PARTITION_ROSTER.filter((entry) => entry.home === "local");
  const verdict = judgeLocalPurity({
    trees: permittedLiveRows,
    roster: PARTITION_ROSTER,
    scope: establishedScope()
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reasonCode, "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT");
  assert.deepEqual(verdict.awayPartitions, []);
  assert.deepEqual(verdict.permittedLocalPartitions,
    homeRows.map((entry) => entry.partitionId).sort());
  assert.equal(verdict.counts.retainedArchives, 0);
  assert.equal(verdict.counts.permittedLiveTrees, homeRows.length);
  assert.equal(verdict.counts.liveAwayTrees, 0);
  assert.match(verdict.tightening, /^未收紧/u);
});

test("one revived AOS tree beside the other permitted ones turns the whole verdict red", () => {
  const revived = { ...archivedAosRow, address: "/scratch/revival/workspace",
    engineState: "live", readFaceAccepted: true,
    readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED", relocationCount: 0, lastRelocationId: null };
  const verdict = judgeLocalPurity({
    trees: [archivedAosRow, ...permittedOtherLiveRows, revived],
    roster: MIXED_ROSTER,
    scope: establishedMixedScope()
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasonCode, "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST");
  assert.equal(verdict.counts.liveAwayTrees, 1);
  // And the other legitimate ones are UNAFFECTED. If they went red too, the
  // predicate would be measuring "is anything here" after all.
  assert.equal(verdict.verdicts.filter((row) => row.home === "local").every((row) => row.ok), true);
});

test("a scope that was never established cannot be overridden by clean rows", () => {
  // The failure the ordering exists for: every row green, nothing to report, and
  // the walk covered nothing. The scope term must win.
  const verdict = judgeLocalPurity({
    trees: [archivedAosRow],
    roster: PARTITION_ROSTER,
    scope: judgeScanScope({
      containerExists: false, rootsWalked: [{ id: "platform-root", reachable: true }],
      partitionsFoundLive: [], roster: PARTITION_ROSTER
    })
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasonCode, "SCAN_SCOPE_NOT_ESTABLISHED");
  assert.equal(verdict.counts.offending, 0, "no row was individually bad; the SCOPE was");

  // A missing scope argument is the same answer, not a green.
  assert.equal(judgeLocalPurity({ trees: [archivedAosRow], roster: PARTITION_ROSTER }).reasonCode,
    "SCAN_SCOPE_NOT_ESTABLISHED");
});

test("under the all-vm roster, two live trees for one partition report away first (fork is absorbed)", () => {
  // Every partition in this synthetic roster is away, so two live trees are each an away artefact,
  // and the away red (AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST) outranks the
  // fork term — the fork term protects against a locally-permitted partition
  // having two live trees, which no longer exists as a case. The predicate must
  // still red, naming away.
  const twin = { ...liveCrossRow, address: "/local/elsewhere/workspace" };
  const verdict = judgeLocalPurity({
    trees: [liveCrossRow, twin],
    roster: ALL_AWAY_ROSTER,
    scope: establishedAwayScope()
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasonCode, "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST");
});

test("an all-vm tightened roster accepts only archives", () => {
  // The current roster is local, so this is the red-leg/tightening synthetic shape:
  // moving the home declaration to VM makes any live local tree an away artefact.
  const tightened = ALL_AWAY_ROSTER;
  const scope = judgeScanScope({
    containerExists: true,
    rootsWalked: [{ id: "platform-root", reachable: true }],
    partitionsFoundLive: [],
    roster: tightened
  });

  const archiveOnly = judgeLocalPurity({
    trees: archivedRows,
    roster: tightened,
    scope
  });
  assert.equal(archiveOnly.ok, true);
  assert.equal(archiveOnly.reasonCode, "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT");
  assert.deepEqual(archiveOnly.permittedLocalPartitions, []);
  assert.equal(archiveOnly.counts.permittedLiveTrees, 0);
  assert.match(archiveOnly.tightening, /^已收紧/u);

  // A single live tree anywhere on the host is red under the all-vm roster.
  const withLive = judgeLocalPurity({
    trees: [...archivedRows, liveCrossRow],
    roster: tightened,
    scope: judgeScanScope({
      containerExists: true, rootsWalked: [{ id: "platform-root", reachable: true }],
      partitionsFoundLive: [], roster: tightened
    })
  });
  assert.equal(withLive.ok, false);
  assert.equal(withLive.reasonCode, "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST");
});

// --- the container roster (TCRN-CROSS-STORY-129) ---------------------------------
//
// The complement of everything above: those rows are trees the walk found BY IDENTITY,
// these are directories the container holds BY NAME AND SHAPE. The three literals below
// are the real quote-accident directories that sat inside the governed container while
// every identity-based check reported green — they carry no `.tcrn-workflow`, so there
// was nothing for `judgeControlTree` to attribute and nothing for it to report.

const QUOTE_ACCIDENT_STRAYS = Object.freeze([
  "cross-project-shadow cross-project SHADOW cross-project",
  "TCRN-TMS-shadow TCRN-TMS SHADOW-TMS TCRN-TMS",
  "TCRN-Design-System-shadow TCRN-Design-System SHADOW-DS TCRN-Design-System"
]);

const CONTAINER_ROSTER = containerWorkspaceRoster(PARTITION_ROSTER);

/** What the caller declares as the container's known non-workspace siblings. */
const KNOWN_SIBLINGS = ["release-trust"];

/** The container as a healthy machine presents it: the archives plus the sidecar. */
const healthyContainer = () => [
  ...CONTAINER_ROSTER.map((name) => ({ name, workspaceShaped: true })),
  { name: "release-trust", workspaceShaped: false }
];

const judgeContainer = (entries, overrides = {}) => judgeContainerRoster({
  containerExists: true,
  listed: true,
  entries,
  roster: CONTAINER_ROSTER,
  nonWorkspaceEntries: KNOWN_SIBLINGS,
  ...overrides
});

test("容器名册:名册上的受治目录是绿,多出一个名册之外的工作区形目录(只差这一个)就是红", () => {
  const green = judgeContainer(healthyContainer());
  assert.equal(green.ok, true);
  assert.equal(green.reasonCode, "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES");
  assert.deepEqual(green.strays, []);
  assert.equal(green.rostered.length, CONTAINER_ROSTER.length);
  assert.deepEqual(green.missingRostered, []);
  assert.deepEqual(green.knownSiblings, ["release-trust"]);

  // ONE field: the same listing plus a single workspace-shaped directory the roster
  // does not name. This is the state the machine was actually in.
  const red = judgeContainer([
    ...healthyContainer(),
    { name: QUOTE_ACCIDENT_STRAYS[0], workspaceShaped: true }
  ]);
  assert.equal(red.ok, false);
  assert.equal(red.reasonCode, "CONTAINER_HOLDS_UNROSTERED_WORKSPACE");
  assert.deepEqual(red.strays, [QUOTE_ACCIDENT_STRAYS[0]]);
  // The legitimate ones are unaffected — otherwise the predicate would be measuring
  // "is anything here" rather than "is anything here unrostered".
  assert.equal(red.rostered.length, CONTAINER_ROSTER.length);
});

test("今天真实的三个引号事故目录被逐一点名,而不是只报一个计数", () => {
  const red = judgeContainer([
    ...healthyContainer(),
    ...QUOTE_ACCIDENT_STRAYS.map((name) => ({ name, workspaceShaped: true }))
  ]);
  assert.equal(red.ok, false);
  assert.deepEqual(red.strays, [...QUOTE_ACCIDENT_STRAYS].sort());
  assert.equal(red.workspaceShaped, CONTAINER_ROSTER.length + QUOTE_ACCIDENT_STRAYS.length);
});

test("「容器里没有野目录」不得与「没看容器」「读不出来」或「什么也没读到」共用一个绿", () => {
  // No container: nothing was listed, nothing was judged. Green here would be the
  // same hole `judgeScanScope` exists to close.
  const missing = judgeContainer([], { containerExists: false });
  assert.equal(missing.ok, false);
  assert.equal(missing.reasonCode, "CONTAINER_NOT_FOUND");
  // Nothing was observed, so every rostered name is missing — not "all present".
  assert.deepEqual(missing.missingRostered, [...CONTAINER_ROSTER].sort());

  // Present but unreadable is its own answer, not "it held nothing".
  const unreadable = judgeContainer([], { listed: false });
  assert.equal(unreadable.ok, false);
  assert.equal(unreadable.reasonCode, "CONTAINER_NOT_LISTED");

  // A missing `listed` term must fail closed, not default to "we read it".
  assert.equal(judgeContainerRoster({
    containerExists: true, entries: [], roster: CONTAINER_ROSTER
  }).reasonCode, "CONTAINER_NOT_LISTED");

  // And a missing `entries` term must fail closed for exactly the same reason. This is
  // the one that was fail-OPEN: `listed: true` with no entries at all read as "we read
  // the container and it was clean", which is the shape a half-finished call site
  // leaves behind.
  const noEntriesTerm = judgeContainerRoster({
    containerExists: true, listed: true, roster: CONTAINER_ROSTER
  });
  assert.equal(noEntriesTerm.ok, false);
  assert.equal(noEntriesTerm.reasonCode, "CONTAINER_NOT_LISTED");
  assert.equal(judgeContainerRoster({
    containerExists: true, listed: true, entries: "not an array", roster: CONTAINER_ROSTER
  }).reasonCode, "CONTAINER_NOT_LISTED");

  // A listing that genuinely returned nothing is NOT green either: "I read the
  // container and saw nothing" and "the container holds no stray" are different
  // answers. Without this term, any regression that empties the listing makes this
  // gate permanently green with nothing able to go red.
  const emptied = judgeContainer([]);
  assert.equal(emptied.ok, false);
  assert.equal(emptied.reasonCode, "CONTAINER_LISTING_ESTABLISHED_NO_SCOPE");
  assert.equal(emptied.entriesSeen, 0);

  // The empty-roster trap, the same one `judgeScanScope` needs its length term for: a
  // roster of zero names makes "every rostered name was found" vacuously true, so the
  // zero-entries term has to stand on its own rather than fall out of the name check.
  assert.equal(judgeContainerRoster({
    containerExists: true, listed: true, entries: [], roster: []
  }).reasonCode, "CONTAINER_LISTING_ESTABLISHED_NO_SCOPE");

  // And a listing that came back holding SOMETHING, but not the partitions the roster
  // names, has not established a scope this judgement can green either.
  const halfRead = judgeContainer([
    { name: "release-trust", workspaceShaped: false },
    { name: CONTAINER_ROSTER[0], workspaceShaped: true }
  ]);
  assert.equal(halfRead.ok, false);
  assert.equal(halfRead.reasonCode, "CONTAINER_SCOPE_NOT_ESTABLISHED");
  assert.deepEqual(halfRead.missingRostered, [...CONTAINER_ROSTER].slice(1).sort());

  // A stray is still NAMED when the scope fails — the scope out-ranks it in the
  // headline, it does not hide it.
  const both = judgeContainer([
    { name: CONTAINER_ROSTER[0], workspaceShaped: true },
    { name: QUOTE_ACCIDENT_STRAYS[0], workspaceShaped: true }
  ]);
  assert.equal(both.reasonCode, "CONTAINER_SCOPE_NOT_ESTABLISHED");
  assert.deepEqual(both.strays, [QUOTE_ACCIDENT_STRAYS[0]]);
});

test("SHAPE 是判据,不是名字本身:同一个陌生名字没有 workspace/ 就只被记录、不算发现", () => {
  // One field from the red above: workspaceShaped false. A gate that reds on any
  // unexpected directory would light up for every scratch folder and be switched off.
  const verdict = judgeContainer([
    ...healthyContainer(),
    { name: QUOTE_ACCIDENT_STRAYS[0], workspaceShaped: false }
  ]);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reasonCode, "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES");
  assert.deepEqual(verdict.unshapedStrangers, [QUOTE_ACCIDENT_STRAYS[0]]);
  assert.deepEqual(verdict.knownSiblings, ["release-trust"]);

  // A rostered partition whose archive lost its workspace child is reported in its own
  // bucket rather than silently dropped, and it is not a finding either. It is also NOT
  // a scope failure: the name was there to be seen, which is what the floor asks.
  const pruned = judgeContainer(healthyContainer()
    .map((entry) => (entry.name === "TCRN-TMS" ? { ...entry, workspaceShaped: false } : entry)));
  assert.equal(pruned.ok, true);
  assert.deepEqual(pruned.rosteredWithoutWorkspace, ["TCRN-TMS"]);
  assert.deepEqual(pruned.missingRostered, []);

  // Every observed entry lands in exactly one bucket: a classification with a hole is
  // how an entry vanishes from the receipt while still sitting on the disk.
  const entries = [
    ...healthyContainer(),
    { name: QUOTE_ACCIDENT_STRAYS[0], workspaceShaped: true },
    { name: "some-scratch-dir", workspaceShaped: false }
  ];
  const total = judgeContainer(entries);
  assert.equal(total.entriesSeen, entries.length);
  assert.equal(
    total.strays.length + total.rostered.length + total.rosteredWithoutWorkspace.length
      + total.knownSiblings.length + total.unshapedStrangers.length,
    entries.length);
});

test("已知旁邻由调用方声明,不是判据自己写死的一份拓扑", () => {
  // The same listing, two declarations. The entry moves bucket and neither reading is
  // a finding — which is why this list cannot be used to suppress one. What it must
  // NOT be is a literal inside the predicate: "release-trust sits beside the partition
  // directories" is a claim about a machine's layout, and topology is stated in exactly
  // one place in this repository.
  const listing = healthyContainer();
  const declared = judgeContainer(listing);
  assert.deepEqual(declared.knownSiblings, ["release-trust"]);
  assert.deepEqual(declared.unshapedStrangers, []);

  const undeclared = judgeContainer(listing, { nonWorkspaceEntries: [] });
  assert.equal(undeclared.ok, true);
  assert.deepEqual(undeclared.knownSiblings, []);
  assert.deepEqual(undeclared.unshapedStrangers, ["release-trust"]);

  // Omitting the term entirely is the same as declaring nothing, and still green: the
  // default widens the reporting, it never narrows a finding.
  const omitted = judgeContainerRoster({
    containerExists: true, listed: true, entries: listing, roster: CONTAINER_ROSTER
  });
  assert.deepEqual(omitted.unshapedStrangers, ["release-trust"]);
  assert.equal(omitted.ok, true);
});

test("容器名册由分区名册派生;影子目录须由调用方声明,且绝不接受一个 TCRN-AOS-shadow", () => {
  // Derived, not restated: a partition added to the roster must appear here without
  // anyone remembering to edit a second list.
  assert.deepEqual([...CONTAINER_ROSTER].sort(),
    [...PARTITION_ROSTER.map((entry) => entry.partitionId)].sort());
  for (const entry of PARTITION_ROSTER) {
    assert.ok(CONTAINER_ROSTER.includes(entry.partitionId), `${entry.partitionId} missing`);
  }

  // The shadow half is NOT derived from the partition roster, and the default is EMPTY.
  // Two reasons, and both matter: deriving `${id}-shadow` for all five would admit a
  // `TCRN-AOS-shadow` (AOS is the fallback HOST, so a shadow of itself must never
  // exist, and a roster that admits it cannot detect it); and "which partitions have a
  // local shadow directory" is topology, which this file does not get to state.
  assert.equal(CONTAINER_ROSTER.includes("TCRN-AOS-shadow"), false);
  assert.equal(containerWorkspaceRoster(PARTITION_ROSTER).some((name) => name.endsWith("-shadow")),
    false);

  // Declared by a caller, the shadow names are admitted — and AOS still is not, because
  // the caller declares partition ids and AOS is not among them.
  const declared = containerWorkspaceRoster(PARTITION_ROSTER, ["cross-project", "TCRN-TMS"]);
  assert.ok(declared.includes("cross-project-shadow"));
  assert.ok(declared.includes("TCRN-TMS-shadow"));
  assert.equal(declared.includes("TCRN-AOS-shadow"), false);
  // The two sources may name the same directory — the day a shadow chain is promoted to
  // a rostered partition of its own, the name arrives from both. One name, one
  // allowance, or "how many names are allowed" stops matching "how many directories are
  // allowed".
  const promoted = containerWorkspaceRoster(
    [...PARTITION_ROSTER, { partitionId: "cross-project-shadow" }], ["cross-project"]);
  assert.equal(promoted.filter((name) => name === "cross-project-shadow").length, 1);
  assert.equal(new Set(promoted).size, promoted.length);
  assert.equal(new Set(declared).size, declared.length);

  // An UNDECLARED shadow directory is a stray, on the same axis and in the same run as
  // the identity scan's `UNATTRIBUTED_TREE_IS_LIVE` for the live chain inside it. That
  // agreement is the point: a whitelist here while the identity axis reds would be one
  // artifact asserting two things about one directory.
  const shadowed = judgeContainer([
    ...healthyContainer(), { name: "cross-project-shadow", workspaceShaped: true }
  ]);
  assert.equal(shadowed.ok, false);
  assert.deepEqual(shadowed.strays, ["cross-project-shadow"]);

  const aosShadow = judgeContainer([
    ...healthyContainer(), { name: "TCRN-AOS-shadow", workspaceShaped: true }
  ]);
  assert.equal(aosShadow.ok, false);
  assert.deepEqual(aosShadow.strays, ["TCRN-AOS-shadow"]);
});

test("天花板说的是本判据真的看不见什么,而不是一句「分工不重叠」", () => {
  // A ceiling is what a reader uses to decide what a green means, so it may not
  // over-claim coverage. A workspace-shaped directory with no chain, one level below
  // the container's direct children, is seen by NEITHER scan: the identity walk only
  // ever collects `.tcrn-workflow` directories, and this predicate only looks at the
  // top level. That is a blind spot, and the ceiling has to say so.
  assert.deepEqual(Object.keys(CONTAINER_SCAN_CEILING).sort(),
    ["childrenNotJudgedAsDirectories", "onlyDirectChildren", "shapeNotIdentity",
      "unshapedIsNotAFinding"]);
  assert.match(CONTAINER_SCAN_CEILING.onlyDirectChildren, /盲区/u);
  assert.match(CONTAINER_SCAN_CEILING.onlyDirectChildren, /两道扫描都看不见/u);
  assert.equal(/分工不重叠/u.test(CONTAINER_SCAN_CEILING.onlyDirectChildren), false);
  // And the symlink/non-directory drop is named rather than left to be discovered.
  assert.match(CONTAINER_SCAN_CEILING.childrenNotJudgedAsDirectories, /符号链接/u);
});

test("the roster this repository ships is the one the archive notice names", () => {
  // The roster is data the predicate is parameterised by, so a wrong row would
  // make every judgement above test a machine that does not exist.
  assert.deepEqual(PARTITION_ROSTER.map((entry) => entry.partitionId),
    ["TCRN-AOS", "cross-project", "TCRN-Design-System", "TCRN-TMS", "Joi-Button",
      "dsh-joi-channel-theme"]);
  assert.equal(AOS.home, "local");
  assert.equal(AOS.workspaceId, "workspace:fbc32e3ff874fbbd637a1b85");
  // Measured, not recalled: `relocation-inspect` on this partition answers
  // `relocations: 6, stage: adopted, relocationId: relocation:4e8ccbb9…`, and the trailing
  // hop is what `scan-local` compares against (`lastRelocationId`). Two earlier values sat
  // here and neither matched the roster this test claims to pin — the assertion had been
  // red for long enough to stop being read.
  assert.equal(AOS.relocationId, "relocation:4e8ccbb92424f97c595860d4");
  assert.equal(AOS.liveAddress, "../.tcrn-workspace/TCRN-AOS/workspace");
  // A hop is what a MOVE leaves behind, so only a partition that moved has one to name.
  // `dsh-joi-channel-theme` was admitted where it already stands (`relocations: 0`), and
  // TCRN-CROSS-INC-210 settled that as a legitimate origin rather than a missing field:
  // null here, never a borrowed id. Every other row must still carry a well-formed one,
  // because for those the hop is the thing that explains the current address.
  for (const entry of PARTITION_ROSTER.filter((row) => row.home === "local")) {
    if (entry.relocationId === null) continue;
    assert.match(entry.relocationId, /^relocation:[0-9a-f]{24}$/u,
      `${entry.partitionId} must carry a well-formed hop or declare null`);
  }
  assert.equal(PARTITION_ROSTER.filter((row) => row.relocationId === null)
    .map((row) => row.partitionId).join(","), "dsh-joi-channel-theme",
  "null is admitted for the one partition measured to have never moved, not as a default");
});
