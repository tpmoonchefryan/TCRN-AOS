import test from "node:test";
import assert from "node:assert/strict";

import {
  RELOCATION_STATES, attributeTree, judgeControlTree, judgeLocalPurity, judgeScanScope
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

const establishedScope = () => judgeScanScope({
  containerExists: true,
  rootsWalked: [{ id: "platform-root", reachable: true }, { id: "home-shallow", reachable: true }],
  partitionsFoundLive: PARTITION_ROSTER.filter((entry) => entry.home === "local")
    .map((entry) => entry.partitionId),
  roster: PARTITION_ROSTER
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
  const archive = judgeControlTree({ tree: archivedAosRow, roster: PARTITION_ROSTER });
  assert.equal(archive.ok, true);
  assert.equal(archive.reasonCode, "ARCHIVE_RETAINED_AND_DEAD");
  assert.equal(archive.home, "vm");

  // ADR 0003 ceiling 2 in one field: restore a pre-vacate binding and the address
  // is fully alive again. This is exactly what red-proof.mjs makes happen for real
  // on a scratch copy; here it is the same judgement on a literal.
  const revived = judgeControlTree({
    tree: { ...archivedAosRow, engineState: "live", readFaceAccepted: true,
      readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED", relocationCount: 0, lastRelocationId: null },
    roster: PARTITION_ROSTER
  });
  assert.equal(revived.ok, false);
  assert.equal(revived.reasonCode, "AWAY_PARTITION_TREE_IS_LIVE");
});

test("an away-partition tree one governed verb short of live is red on its own", () => {
  const awaiting = judgeControlTree({
    tree: { ...archivedAosRow, engineState: "adoption-required", readFaceAccepted: false,
      readFaceReasonCode: "WORKSPACE_RELOCATION_ADOPTION_REQUIRED" },
    roster: PARTITION_ROSTER
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
    roster: PARTITION_ROSTER
  });
  assert.equal(answering.ok, false);
  assert.equal(answering.reasonCode, "ARCHIVE_NOT_DEAD_ON_THE_READ_FACE");

  // Refused, but with somebody else's reason code. "It refused" is not the claim;
  // "it refused BECAUSE it was vacated" is.
  const wrongRefusal = judgeControlTree({
    tree: { ...archivedAosRow, readFaceReasonCode: "WORKSPACE_NOT_FOUND" },
    roster: PARTITION_ROSTER
  });
  assert.equal(wrongRefusal.ok, false);
  assert.equal(wrongRefusal.reasonCode, "ARCHIVE_NOT_DEAD_ON_THE_READ_FACE");
});

test("an archive carrying a different hop is not accepted as the archive the roster names", () => {
  const otherHop = judgeControlTree({
    tree: { ...archivedAosRow, lastRelocationId: "relocation:ffffffffffffffffffffffff" },
    roster: PARTITION_ROSTER
  });
  assert.equal(otherHop.ok, false);
  assert.equal(otherHop.reasonCode, "ARCHIVE_CARRIES_A_DIFFERENT_RELOCATION");
  assert.equal(otherHop.expectedRelocationId, AOS.relocationId);
  assert.equal(otherHop.observedRelocationId, "relocation:ffffffffffffffffffffffff");
});

test("a live tree of a partition that still lives here is an asset, not a finding", () => {
  const permitted = judgeControlTree({ tree: liveCrossRow, roster: PARTITION_ROSTER });
  assert.equal(permitted.ok, true);
  assert.equal(permitted.reasonCode, "LIVE_TREE_OF_A_PERMITTED_PARTITION");
  assert.equal(permitted.home, "local");

  // This is the assertion that stops the predicate from degenerating into "is there
  // a .tcrn-workflow here". The same bytes, the same shape, the same engine state —
  // and the verdict differs only because the roster says this partition's truth is
  // supposed to be on this host.
  const away = judgeControlTree({
    tree: { ...liveCrossRow, externalKey: AOS.externalKey, workspaceId: AOS.workspaceId },
    roster: PARTITION_ROSTER
  });
  assert.equal(away.ok, false);
  assert.equal(away.reasonCode, "AWAY_PARTITION_TREE_IS_LIVE");
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

test("「什么都没找到」不得与「没找到活的 AOS 树」共用一个绿", () => {
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

  // The container is there but a partition the roster says is at home was not
  // found live — the walk did not cover what it claims to cover.
  const partial = judgeScanScope({
    containerExists: true, rootsWalked: [{ id: "platform-root", reachable: true }],
    partitionsFoundLive: ["cross-project"], roster: PARTITION_ROSTER
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.reasonCode, "SCAN_SCOPE_NOT_ESTABLISHED");
  assert.deepEqual(partial.missing, ["TCRN-Design-System", "TCRN-TMS"]);

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

test("today's real shape is green: the AOS archive plus three permitted live trees", () => {
  const verdict = judgeLocalPurity({
    trees: [archivedAosRow, ...permittedLiveRows],
    roster: PARTITION_ROSTER,
    scope: establishedScope()
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reasonCode, "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT");
  assert.deepEqual(verdict.awayPartitions, ["TCRN-AOS"]);
  assert.deepEqual(verdict.permittedLocalPartitions,
    ["TCRN-Design-System", "TCRN-TMS", "cross-project"]);
  assert.equal(verdict.counts.retainedArchives, 1);
  assert.equal(verdict.counts.permittedLiveTrees, 3);
  assert.equal(verdict.counts.liveAwayTrees, 0);
  assert.match(verdict.tightening, /^未收紧/u);
});

test("one revived AOS tree beside the three permitted ones turns the whole verdict red", () => {
  const revived = { ...archivedAosRow, address: "/scratch/revival/workspace",
    engineState: "live", readFaceAccepted: true,
    readFaceReasonCode: "WORKSPACE_COMMAND_COMPLETED", relocationCount: 0, lastRelocationId: null };
  const verdict = judgeLocalPurity({
    trees: [archivedAosRow, ...permittedLiveRows, revived],
    roster: PARTITION_ROSTER,
    scope: establishedScope()
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasonCode, "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST");
  assert.equal(verdict.counts.liveAwayTrees, 1);
  // And the three legitimate ones are UNAFFECTED. If they went red too, the
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

test("two live trees for one partition on one host is a fork nothing upstream reports", () => {
  const twin = { ...liveCrossRow, address: "/local/elsewhere/workspace" };
  const verdict = judgeLocalPurity({
    trees: [archivedAosRow, ...permittedLiveRows, twin],
    roster: PARTITION_ROSTER,
    scope: establishedScope()
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasonCode, "TWO_LIVE_TREES_FOR_ONE_PARTITION");
  assert.deepEqual(verdict.duplicatedLivePartitions, ["cross-project"]);
  // Each row is individually legitimate — that is why this needs its own term.
  assert.equal(verdict.verdicts.filter((row) => row.ok === false).length, 0);
});

test("TIGHTENING is a measurement, not a comment: home=vm for all four names the three still here", () => {
  // The future state this predicate is designed to grow into. Same function, same
  // rows, one data edit — and it must be RED today, naming the three partitions
  // whose truth has not moved yet. Without this the tightening claim in
  // topology.mjs and ARCHIVED.md would be prose.
  const tightened = PARTITION_ROSTER.map((entry) => ({ ...entry, home: "vm" }));
  const verdict = judgeLocalPurity({
    trees: [archivedAosRow, ...permittedLiveRows],
    roster: tightened,
    scope: judgeScanScope({
      containerExists: true,
      rootsWalked: [{ id: "platform-root", reachable: true }],
      partitionsFoundLive: [], // nothing is expected at home once the roster is tightened
      roster: tightened
    })
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasonCode, "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST");
  assert.deepEqual(verdict.offending
    .filter((row) => row.reasonCode === "AWAY_PARTITION_TREE_IS_LIVE")
    .map((row) => row.partitionId).sort(),
  ["TCRN-Design-System", "TCRN-TMS", "cross-project"]);
  assert.deepEqual(verdict.permittedLocalPartitions, []);
  assert.match(verdict.tightening, /^已收紧/u);

  // And the day the three trees are actually gone, the SAME tightened roster is
  // green over a machine that holds only the archive. That is the sentence
  // "本机零活工作区", asserted rather than promised.
  const future = judgeLocalPurity({
    trees: [archivedAosRow],
    roster: tightened,
    scope: judgeScanScope({
      containerExists: true, rootsWalked: [{ id: "platform-root", reachable: true }],
      partitionsFoundLive: [], roster: tightened
    })
  });
  assert.equal(future.ok, true);
  assert.equal(future.reasonCode, "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT");
  assert.equal(future.counts.permittedLiveTrees, 0);
});

test("the roster this repository ships is the one the archive notice names", () => {
  // The roster is data the predicate is parameterised by, so a wrong row would
  // make every judgement above test a machine that does not exist.
  assert.deepEqual(PARTITION_ROSTER.map((entry) => entry.partitionId),
    ["TCRN-AOS", "cross-project", "TCRN-Design-System", "TCRN-TMS"]);
  assert.equal(AOS.home, "vm");
  assert.equal(AOS.workspaceId, "workspace:fbc32e3ff874fbbd637a1b85");
  assert.equal(AOS.relocationId, "relocation:bba03004faf175867349495b");
  assert.equal(AOS.liveAddress, "/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace");
  // Only the relocated partition carries a hop id: a `home: "local"` row with one
  // would mean the roster claims a relocation that never happened.
  for (const entry of PARTITION_ROSTER.filter((row) => row.home === "local")) {
    assert.equal(entry.relocationId, undefined, `${entry.partitionId} must not claim a hop`);
  }
});
