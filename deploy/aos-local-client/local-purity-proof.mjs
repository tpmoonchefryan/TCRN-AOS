#!/usr/bin/env node
// The real-machine run of the zero-artefact predicate (TCRN-AOS-STORY-133).
//
//   node deploy/aos-local-client/local-purity-proof.mjs
//        [--scratch <dir>]            also perform the revival red on a scratch copy
//        [--ceremony-receipt <file>]  fold a ceremony receipt into the artifact
//        [--emit]                     write evidence/aos-local-pure-client.json
//
// WHAT THIS RUN IS FOR. `local-purity-predicates.test.mjs` proves the judgement is
// right about data; it cannot say anything about THIS laptop, because a test file may
// not read a home directory. So the judgement is exercised twice, against two
// different kinds of input, and neither run can stand in for the other:
//
//   - the test roster judges literals, every time `pnpm test` runs;
//   - this script judges the machine, and asserts BOTH DIRECTIONS in the same run.
//
// BOTH DIRECTIONS, because this platform has shipped gates that could not fail (two
// sides sharing one inode; a fixture that could not go wrong; a predicate that
// measured whether some prose mentioned an address). A green reading on its own is
// not evidence that a green means anything. So one invocation records:
//
//   GREEN   the machine as it stands — all five returned partitions and the declared
//           fallback shadows live here — must satisfy the predicate;
//   RED 1   the roster tightened to home=vm for every returned partition, judged over
//           the SAME observation, must fail and must name every live tree still here;
//   RED 2   a live workspace belonging to no rostered partition must fail on its own,
//           so that deleting a roster row cannot make a finding disappear;
//   RED 3   a workspace-shaped directory the container roster does not name must fail
//           on its own, so that a partial tree carrying no chain — which the
//           identity-based scan is structurally blind to — cannot pass unseen;
//   RED 4   the same accident REBUILT ON A REAL FILESYSTEM in a disposable directory,
//           so that the OBSERVER (readdir, the `workspace` literal, the shape probe)
//           has a repeatable red of its own once the strays now on this disk are
//           cleaned up. Cheap: empty directories under the OS temp directory, removed
//           in a `finally`, no governed workspace anywhere near it;
//   RED 5   (only with --scratch) the archive REVIVED per ADR 0003 ceiling 2 on a
//           disposable copy must fail. This is the expensive one, and the only one that
//           builds a live governed workspace, which is why it is opt-in.
//
// WHY THE REVIVAL RED IS OPT-IN AND THE OTHERS ARE NOT. It needs a directory that is
// safe to build a live governed workspace inside, and choosing that directory is not a
// decision a script invoked from `pnpm verify` gets to make on the way past — the
// containment assertion in red-proof.mjs is only worth anything if a person named the
// prefix it checks against. So the cheap reds run always and gate `verify`; the
// revival is run by hand and its result is recorded in the artifact under
// `revivalRed`, with `ran: false` stated plainly when it was not performed. A section
// that quietly vanishes when it does not run is how "we proved that once" becomes
// unfalsifiable.
//
// RED 4 touches a filesystem and is NOT opt-in, and the distinction is the point: what
// it builds is a handful of empty directories, so there is no live chain to contain, no
// second authority anybody could mistake for real, and nothing whose destruction needs a
// human-named prefix. It still asserts containment before deleting, and it still deletes
// in a `finally`.
//
// WHY THE CONTAINER SCAN IS HERE AND NOT IN THE CONTROL-TREE WALK. The walk finds
// `.tcrn-workflow` directories and attributes each by its own declared identity; a
// directory that has the workspace SHAPE but no control tree has no identity to
// attribute and is invisible to it. TCRN-CROSS-STORY-129: three such directories, left
// by a shell quoting accident, lived inside the governed container under a green
// light. The container listing is therefore read here, name-and-shape only, as the
// complement of the identity walk.

import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync,
  statSync, symlinkSync, writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  LOCAL_LIVE_PARTITIONS, PARTITION_ROSTER, RELOCATED_PARTITIONS,
  SHADOWED_PARTITIONS, SHADOW_ROSTER,
  REPO_ROOT, SCAN_CEILING, WORKSPACE_CONTAINER
} from "./topology.mjs";
import { observeLocalHost } from "./scan-local.mjs";
import {
  containerWorkspaceRoster, judgeContainerRoster, judgeLocalPurity, judgeScanScope
} from "./local-purity-predicates.mjs";
import { runRedProof, runTighteningRedProof, runUnattributedRedProof } from "./red-proof.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

export const EVIDENCE_PATH = join(REPO_ROOT, "evidence/aos-local-pure-client.json");

/**
 * The basenames the container may hold workspace-shaped, derived from the partition
 * roster and from NOTHING ELSE.
 *
 * No shadow list is passed, and that is a decision rather than an omission. This
 * machine's container holds four `*-shadow` directories, and each of them carries a
 * LIVE control tree that `PARTITION_ROSTER` does not name — so the identity scan
 * already reds on all four with `UNATTRIBUTED_TREE_IS_LIVE`. Whitelisting the same four
 * names here would have produced a single artifact asserting both things at once: the
 * name axis calling them rostered while the identity axis calls them unattributed live
 * trees. A gate is not allowed to disagree with itself inside one receipt.
 *
 * So the two axes are made to agree in the only direction available without a topology
 * change: both red, on the same four directories, until the shadow chains are
 * reconciled. The reconciliation is a topology edit and belongs in exactly one place —
 * register the four shadow chains in `PARTITION_ROSTER` (topology.mjs) with their real
 * `externalKey`/`workspaceId` and an explicit `home`, at which point the identity gate
 * stops reding on them AND this roster derives their names from that same source. See
 * `containerRosterReconciliation` in the artifact.
 */
export const CONTAINER_WORKSPACE_ROSTER = Object.freeze(
  containerWorkspaceRoster(PARTITION_ROSTER, SHADOWED_PARTITIONS));

/**
 * What the IDENTITY scan classifies against: every live control tree this machine may
 * legitimately hold. That is the partitions plus the shadows, because the scan sees a
 * shadow whether or not anything declares it, and an undeclared live tree is a finding.
 *
 * `doc-topology` deliberately keeps reading PARTITION_ROSTER alone: it asks which
 * partitions every platform document must declare a truth location for, and a shadow is
 * a buffer rather than a partition. Registering the shadows there was tried and it
 * demanded a `cross-project-shadow` row in the declaration blocks — a document asserting
 * a falsehood. Two questions, two rosters.
 */
export const SCANNED_ROSTER = Object.freeze([...PARTITION_ROSTER, ...SHADOW_ROSTER]);

/** The partitions+shadows this machine may hold LIVE, by declaration. */
export const PERMITTED_LOCAL_LIVE = Object.freeze(
  SCANNED_ROSTER.filter((entry) => entry.home === "local").map((entry) => entry.partitionId).sort());

/**
 * A quote-accident name that really occurred, kept as the red proof's input.
 *
 * A synthetic literal, not a measurement: what has to keep reddening is the SHAPE of
 * the accident — a directory whose name is the several arguments a lost quote never
 * split — so this stays fixed while the real container changes underneath it.
 */
export const QUOTE_ACCIDENT_EXAMPLE = "cross-project-shadow cross-project SHADOW cross-project";

/**
 * Is there a directory called `workspace` under this child of the container?
 *
 * `throwIfNoEntry: false` rather than an existsSync/statSync pair: the pair races
 * against anything writing the container while the walk runs, and a throw there would
 * abort the whole proof over one vanished directory. The try/catch is for the errors
 * that flag suppresses nothing of — ENOTDIR (the child is not a directory after all),
 * ELOOP (a symlink cycle), EACCES. None of those is "a workspace lives here", and none
 * of them is a reason to abandon the listing.
 *
 * The probe FOLLOWS symlinks, deliberately: `statSync` resolves them, so a symlinked
 * child pointing at a workspace-shaped tree is reported shaped rather than skipped.
 */
function workspaceShapedChild(container, name) {
  try {
    return statSync(join(container, name, "workspace"), { throwIfNoEntry: false })
      ?.isDirectory() === true;
  } catch {
    return false;
  }
}

/** What a container child is, for the entries the shape probe is not run against. */
const direntKind = (entry) => (entry.isSymbolicLink() ? "symlink"
  : entry.isDirectory() ? "directory"
    : entry.isFile() ? "file"
      : entry.isFIFO() ? "fifo"
        : entry.isSocket() ? "socket" : "other");

/**
 * The container's direct children, by BASENAME and shape.
 *
 * Basenames, never absolute paths (INC-037): the container sits inside a home
 * directory, so a row carrying its full path would put that home directory into every
 * receipt this proof emits. "Workspace-shaped" is `a child directory called
 * workspace` — the one signal every legitimate partition archive, every local shadow
 * and every one of the STORY-129 strays shares, and that the release-trust sidecar
 * lacks. Keying on the control tree instead would miss the strays entirely, which is
 * precisely how they went unseen.
 *
 * DIRECTORIES **AND SYMLINKS** are judged. `Dirent.isDirectory()` is already false for
 * a symlink — readdir reports the link itself, not its target — so the previous
 * `isDirectory() && !isSymbolicLink()` filter had a dead second clause and dropped
 * every symlinked child on the floor: it reached none of the predicate's buckets and
 * was not counted in `entriesSeen`, so a symlinked partition directory read as ABSENT
 * rather than as anything at all. Both halves of that are wrong for a gate whose
 * classification is supposed to have no hole in it.
 *
 * Children that are neither (plain files, sockets) cannot be a workspace root, so they
 * are not judged as one — but they are still REPORTED, in `skipped`, with what they
 * are. "Not a workspace" and "never looked at" must not be the same silence.
 *
 * `listed` is reported separately from `containerExists` so that a container that
 * refused to be read cannot be mistaken for one that held nothing.
 */
export function observeContainerEntries(container = WORKSPACE_CONTAINER) {
  if (!existsSync(container)) {
    return {
      container, containerExists: false, listed: false, listingError: null,
      entries: [], skipped: []
    };
  }
  let dirents;
  try {
    dirents = readdirSync(container, { withFileTypes: true });
  } catch (error) {
    return {
      container,
      containerExists: true,
      listed: false,
      listingError: String(error?.code ?? error).slice(0, 60),
      entries: [],
      skipped: []
    };
  }
  const byName = (left, right) => (left.name < right.name ? -1 : 1);
  const judged = dirents.filter((entry) => entry.isDirectory() || entry.isSymbolicLink());
  const entries = judged
    .map((entry) => ({
      name: entry.name,
      symlink: entry.isSymbolicLink(),
      workspaceShaped: workspaceShapedChild(container, entry.name)
    }))
    .sort(byName);
  const skipped = dirents
    .filter((entry) => !entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => ({ name: entry.name, kind: direntKind(entry) }))
    .sort(byName);
  return { container, containerExists: true, listed: true, listingError: null, entries, skipped };
}

/**
 * The container-roster red, on data alone: one workspace-shaped stranger.
 *
 * The green and the red differ in exactly one field — the same roster, the same
 * container existence, the same rostered entries, plus a single directory the
 * roster does not name. Both sides are computed in the same call so the green cannot
 * quietly stop being green while the red keeps passing.
 */
export function runContainerRosterRedProof(roster = CONTAINER_WORKSPACE_ROSTER) {
  const rostered = roster.map((name) => ({ name, workspaceShaped: true }));
  const shared = { containerExists: true, listed: true, roster };
  const green = judgeContainerRoster({ ...shared, entries: rostered });
  const red = judgeContainerRoster({
    ...shared,
    entries: [...rostered, { name: QUOTE_ACCIDENT_EXAMPLE, workspaceShaped: true }]
  });
  // The same stranger WITHOUT the workspace shape must stay green, or the predicate is
  // measuring "is there an unexpected directory" rather than "is there an unrostered
  // workspace" — a gate that reds on every scratch directory gets switched off.
  const unshaped = judgeContainerRoster({
    ...shared,
    entries: [...rostered, { name: QUOTE_ACCIDENT_EXAMPLE, workspaceShaped: false }]
  });
  return {
    reasonCode: red.reasonCode,
    wentRed: red.ok === false && red.reasonCode === "CONTAINER_HOLDS_UNROSTERED_WORKSPACE",
    named: red.strays,
    greenStaysGreen: green.ok === true
      && green.reasonCode === "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES"
      && green.rostered.length === roster.length,
    unshapedStrangerIsNotAFinding: unshaped.ok === true
      && unshaped.unshapedStrangers.length === 1,
    greenReasonCode: green.reasonCode,
    greenRosteredCount: green.rostered.length,
    rosterSize: roster.length,
    unshapedReasonCode: unshaped.reasonCode,
    unshapedStrangerCount: unshaped.unshapedStrangers.length,
    filesystemTouched: false,
    whatWasProven:
      "同一函数、同一容器存在性、同一份名册,只多出一个名册之外的工作区形目录即转红并点名;"
      + "去掉 workspace/ 这个形状,同一个陌生名字就只被记录、不算发现。"
      + "无链的引号事故树因此不再能借「身份扫描看不见它」躲在绿灯下。"
  };
}

/** The names the filesystem fixture builds beside the rostered ones. */
const FIXTURE_SYMLINKED_STRAY = "linked-stray-workspace";
const FIXTURE_NON_DIRECTORY_CHILD = "not-a-workspace.txt";

/**
 * The OBSERVER's red, on a real filesystem — the half `runContainerRosterRedProof`
 * cannot reach.
 *
 * That red is data-level: it hands literals to the judgement and proves the JUDGEMENT
 * discriminates. Nothing in the repository exercised `observeContainerEntries` itself,
 * so the `"workspace"` literal, the directory filter and the `statSync` shape test were
 * held up by exactly one thing: the container happening to hold three strays today —
 * evidence that disappears the moment STORY-129's cleanup lands, which is the entire
 * point of the story. A regression in any of the three would then leave a permanently
 * green gate with no failing test anywhere.
 *
 * So the accident is REBUILT, in a disposable directory, and the observer is made to
 * find it. Unlike the revival red this needs no governed workspace and no `--scratch`
 * caution — empty directories under the OS temp directory are not a chain, so nothing
 * here can be mistaken for a second authority, and no operator has to name a prefix for
 * a containment assertion to be worth anything. The containment assertion is still
 * made, and the tree is still removed in a `finally`.
 *
 * INC-037: not one path from this fixture reaches the returned value. Basenames and
 * booleans only.
 */
export function runContainerObservationRedProof(roster = CONTAINER_WORKSPACE_ROSTER) {
  const fixture = mkdtempSync(join(tmpdir(), "aos-container-observation-"));
  // Asserted BEFORE anything is written and re-checked before the recursive delete: a
  // fixture that somehow landed outside the OS temp directory is not removed by this
  // function, it is left for a person.
  const contained = realpathSync(fixture).startsWith(`${realpathSync(tmpdir())}/`);
  const judge = (listing) => judgeContainerRoster({
    containerExists: listing.containerExists,
    listed: listing.listed,
    entries: listing.entries,
    roster
  });
  let measured;
  try {
    if (!contained) {
      throw new Error("refusing to build a fixture outside the OS temp directory");
    }
    // A healthy container first: every rostered name, workspace-shaped. Without this the
    // judgement's scope floor would refuse the fixture — which is the floor doing its
    // job, and it means the red below is measured against an established scope rather
    // than against a directory holding one thing.
    for (const name of roster) mkdirSync(join(fixture, name, "workspace"), { recursive: true });
    // The finding, rebuilt: a workspace-shaped directory carrying no control tree.
    mkdirSync(join(fixture, QUOTE_ACCIDENT_EXAMPLE, "workspace"), { recursive: true });
    // A SYMLINKED child pointing at it. `Dirent.isDirectory()` is false for a symlink,
    // so this is the row the previous filter dropped entirely.
    symlinkSync(join(fixture, QUOTE_ACCIDENT_EXAMPLE), join(fixture, FIXTURE_SYMLINKED_STRAY), "dir");
    // And a plain file: cannot be a workspace root, must still be reported rather than
    // silently vanish from the receipt.
    writeFileSync(join(fixture, FIXTURE_NON_DIRECTORY_CHILD), "not a workspace\n");

    const listing = observeContainerEntries(fixture);
    const red = judge(listing);
    const strayRow = listing.entries.find((entry) => entry.name === QUOTE_ACCIDENT_EXAMPLE) ?? null;
    const linkRow = listing.entries.find((entry) => entry.name === FIXTURE_SYMLINKED_STRAY) ?? null;

    // ONE filesystem fact changes: the `workspace/` child goes away. Nothing else is
    // touched — same directory, same name, same symlink pointing at it.
    rmSync(join(fixture, QUOTE_ACCIDENT_EXAMPLE, "workspace"), { recursive: true });
    const afterListing = observeContainerEntries(fixture);
    const afterVerdict = judge(afterListing);
    const strayRowAfter = afterListing.entries
      .find((entry) => entry.name === QUOTE_ACCIDENT_EXAMPLE) ?? null;

    // The observer's own "I looked nowhere" direction, on a path that was never created.
    const absentListing = observeContainerEntries(join(fixture, "no-such-container"));
    const absentVerdict = judge(absentListing);

    measured = {
      reasonCode: red.reasonCode,
      wentRed: red.ok === false
        && red.reasonCode === "CONTAINER_HOLDS_UNROSTERED_WORKSPACE"
        && red.strays.includes(QUOTE_ACCIDENT_EXAMPLE),
      named: red.strays,
      // The shape test measured a real `workspace/` directory, not a name.
      observerSawTheStrayShaped: strayRow?.workspaceShaped === true,
      // The symlinked child reached the predicate at all — and, because the shape probe
      // follows the link, reached it as a finding rather than as a nameless absence.
      symlinkedChildWasJudged: linkRow !== null,
      symlinkedChildWasNamedAStray: red.strays.includes(FIXTURE_SYMLINKED_STRAY),
      // Every child of the fixture is accounted for in exactly one place: judged, or
      // recorded as a non-directory.
      nonDirectoryChildRecorded: listing.skipped
        .some((entry) => entry.name === FIXTURE_NON_DIRECTORY_CHILD && entry.kind === "file"),
      nonDirectoryChildNotJudged: listing.entries
        .every((entry) => entry.name !== FIXTURE_NON_DIRECTORY_CHILD),
      // The fixture's children are: one per rostered name, the stray, the symlink to
      // it, and the plain file. Nothing else was created, so nothing else may be seen.
      childrenAccountedFor:
        red.entriesSeen + listing.skipped.length === roster.length + 3,
      greenNeighbourReasonCode: afterVerdict.reasonCode,
      greenNeighbourStaysGreen: afterVerdict.ok === true
        && afterVerdict.reasonCode === "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES"
        && strayRowAfter?.workspaceShaped === false
        && afterVerdict.unshapedStrangers.includes(QUOTE_ACCIDENT_EXAMPLE)
        && afterVerdict.rostered.length === roster.length,
      absentContainerReasonCode: absentVerdict.reasonCode,
      absentContainerIsRed: absentListing.containerExists === false
        && absentListing.listed === false
        && absentVerdict.ok === false
        && absentVerdict.reasonCode === "CONTAINER_NOT_FOUND"
    };
  } finally {
    if (contained) rmSync(fixture, { recursive: true, force: true });
  }
  return {
    ...measured,
    filesystemTouched: true,
    containedToOsTempDir: contained,
    fixtureRemoved: existsSync(fixture) === false,
    whatWasProven:
      "在一次性目录里把引号事故重建成真的字节:观测侧 readdir + `workspace/` 形状探测确实看见它并点名,"
      + "只删掉那一个 workspace/ 子目录(其余不动)同一个名字就退回「只记录、不算发现」;"
      + "符号链接子项进入判据而不是被丢弃,普通文件被单列记录而不是消失;容器不存在时为红。"
      + "清理掉今天容器里那三个野目录之后,观测侧仍有一个可重复的红。"
  };
}

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * The whole run, as one value.
 *
 * `ok` is the AND of every expectation, and each expectation is stated next to the
 * measurement that satisfies it rather than in a summary line further down — a summary
 * that is maintained separately from what it summarises is the thing that drifts.
 */
export async function runLocalPurityProof({ scratchpad = null, ceremonyReceiptPath = null } = {}) {
  const observation = await observeLocalHost();
  const scope = judgeScanScope({
    containerExists: observation.containerExists,
    rootsWalked: observation.rootsWalked,
    partitionsFoundLive: observation.partitionsFoundLive,
    roster: SCANNED_ROSTER
  });
  const green = judgeLocalPurity({ trees: observation.trees, roster: SCANNED_ROSTER, scope });

  // Read at the same instant as it is judged: `containerExists` comes from this listing
  // rather than from the walk's earlier probe, so the two halves of one verdict cannot
  // describe two different moments.
  const containerListing = observeContainerEntries();
  const containerRoster = judgeContainerRoster({
    containerExists: containerListing.containerExists,
    listed: containerListing.listed,
    entries: containerListing.entries,
    roster: CONTAINER_WORKSPACE_ROSTER,
    // `nonWorkspaceEntries` is deliberately not supplied: which basenames are known
    // sidecars is a claim about this machine's layout, and topology.mjs is the one place
    // this repository states those. Until it exports such a list, an unshaped entry
    // nobody has classified is reported as exactly that (`unshapedStrangers`) rather
    // than as a known sibling. Nothing is suppressed either way — an entry with no
    // `workspace/` child is not a finding in the first place.
    nonWorkspaceEntries: []
  });

  const tighteningRed = runTighteningRedProof(observation);
  const unattributedRed = runUnattributedRedProof();
  const containerRosterRed = runContainerRosterRedProof();
  const containerObservationRed = runContainerObservationRedProof();

  const revivalRed = scratchpad === null
    ? {
      ran: false,
      why: "no --scratch was named. The revival builds a LIVE governed workspace on disk, so "
        + "the prefix it is contained to must be chosen by a person, not defaulted by a script.",
      howToRun: "node deploy/aos-local-client/local-purity-proof.mjs --scratch <disposable dir> --emit"
    }
    : { ran: true, ...await runRedProof({ scratchpad }) };

  const ceremonyWrite = ceremonyReceiptPath === null
    ? { folded: false, why: "no --ceremony-receipt was named" }
    : foldCeremonyReceipt(ceremonyReceiptPath);

  const expectations = [
    { id: "GREEN_ON_THIS_MACHINE", met: green.ok === true,
      expected: "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT", observed: green.reasonCode },
    { id: "SCOPE_ESTABLISHED", met: scope.ok === true,
      expected: "SCAN_SCOPE_ESTABLISHED", observed: scope.reasonCode },
    { id: "NO_RETAINED_AWAY_ARCHIVE_IN_LOCAL_LIVE_ROSTER",
      met: green.counts.retainedArchives === 0,
      expected: 0, observed: green.counts.retainedArchives },
    // Counted over the SCANNED roster: all five partitions and the declared shadows are
    // intentionally live on this machine after S199. Comparing against the primary roster
    // alone would make the shadow buffer look like an unaccounted tree.
    { id: "PERMITTED_LIVE_TREES_MATCH_THE_ROSTER",
      met: green.counts.permittedLiveTrees === PERMITTED_LOCAL_LIVE.length,
      expected: PERMITTED_LOCAL_LIVE.length, observed: green.counts.permittedLiveTrees },
    { id: "RED_WHEN_ROSTER_TIGHTENED", met: tighteningRed.wentRed === true,
      expected: "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST", observed: tighteningRed.reasonCode },
    // Same rebase as the count above: what the tightening must NAME is whatever this
    // machine legitimately holds live, which is the declared shadows. Against
    // LOCAL_LIVE_PARTITIONS this asserted the empty list, so a working red — one that
    // correctly named four live trees — read as a failure.
    { id: "TIGHTENING_NAMES_EVERY_PERMITTED_LIVE_TREE",
      met: tighteningRed.namedLivePartitions.join("/") === [...PERMITTED_LOCAL_LIVE].sort().join("/"),
      expected: [...PERMITTED_LOCAL_LIVE].sort(), observed: tighteningRed.namedLivePartitions },
    { id: "RED_ON_AN_UNROSTERED_LIVE_TREE", met: unattributedRed.wentRed === true,
      expected: "UNATTRIBUTED_TREE_IS_LIVE", observed: unattributedRed.reasonCode },
    { id: "CONTAINER_HOLDS_NO_STRAY_WORKSPACE", met: containerRoster.ok === true,
      expected: "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES", observed: containerRoster.reasonCode },
    // Deliberately NOT a second expectation on `strays.length === 0`: that reads green
    // when the container is missing entirely, which is the direction this whole file
    // exists to refuse. The names themselves are carried in `containerRoster.strays`.
    { id: "RED_ON_AN_UNROSTERED_WORKSPACE_SHAPED_DIRECTORY",
      met: containerRosterRed.wentRed === true,
      expected: "CONTAINER_HOLDS_UNROSTERED_WORKSPACE", observed: containerRosterRed.reasonCode },
    // Two expectations, not one boolean over two conjuncts: "the green neighbour stopped
    // being green" and "the shape test degraded into a name test" are different failures
    // needing different fixes, and an artifact recording only `false` names neither.
    { id: "CONTAINER_ROSTER_GREEN_STAYS_GREEN",
      met: containerRosterRed.greenStaysGreen === true,
      expected: `CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES / ${containerRosterRed.rosterSize} rostered`,
      observed: `${containerRosterRed.greenReasonCode} / ${containerRosterRed.greenRosteredCount} rostered` },
    { id: "UNSHAPED_STRANGER_IS_NOT_A_FINDING",
      met: containerRosterRed.unshapedStrangerIsNotAFinding === true,
      expected: "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES / 1 unshaped stranger",
      observed: `${containerRosterRed.unshapedReasonCode} / `
        + `${containerRosterRed.unshapedStrangerCount} unshaped strangers` },
    // The OBSERVER's own reds, on a real filesystem. Without these the readdir, the
    // `workspace` literal and the shape probe are held up only by today's three strays
    // — the very things STORY-129 removes.
    { id: "OBSERVER_SEES_A_REAL_UNROSTERED_WORKSPACE",
      met: containerObservationRed.wentRed === true
        && containerObservationRed.observerSawTheStrayShaped === true,
      expected: "CONTAINER_HOLDS_UNROSTERED_WORKSPACE / workspaceShaped true",
      observed: `${containerObservationRed.reasonCode} / workspaceShaped `
        + `${containerObservationRed.observerSawTheStrayShaped}` },
    { id: "OBSERVER_RED_NEIGHBOURS_A_GREEN_ON_ONE_REMOVED_DIRECTORY",
      met: containerObservationRed.greenNeighbourStaysGreen === true,
      expected: "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES",
      observed: containerObservationRed.greenNeighbourReasonCode },
    { id: "OBSERVER_JUDGES_A_SYMLINKED_CHILD_RATHER_THAN_DROPPING_IT",
      met: containerObservationRed.symlinkedChildWasJudged === true
        && containerObservationRed.symlinkedChildWasNamedAStray === true,
      expected: true,
      observed: `judged ${containerObservationRed.symlinkedChildWasJudged} / `
        + `named ${containerObservationRed.symlinkedChildWasNamedAStray}` },
    { id: "OBSERVER_ACCOUNTS_FOR_EVERY_CHILD",
      met: containerObservationRed.nonDirectoryChildRecorded === true
        && containerObservationRed.nonDirectoryChildNotJudged === true
        && containerObservationRed.childrenAccountedFor === true,
      expected: true,
      observed: `recorded ${containerObservationRed.nonDirectoryChildRecorded} / `
        + `notJudged ${containerObservationRed.nonDirectoryChildNotJudged} / `
        + `counted ${containerObservationRed.childrenAccountedFor}` },
    { id: "OBSERVER_RED_WHEN_THE_CONTAINER_IS_ABSENT",
      met: containerObservationRed.absentContainerIsRed === true,
      expected: "CONTAINER_NOT_FOUND", observed: containerObservationRed.absentContainerReasonCode },
    { id: "OBSERVATION_FIXTURE_REMOVED",
      met: containerObservationRed.fixtureRemoved === true
        && containerObservationRed.containedToOsTempDir === true,
      expected: true,
      observed: `removed ${containerObservationRed.fixtureRemoved} / `
        + `contained ${containerObservationRed.containedToOsTempDir}` }
  ];
  if (revivalRed.ran) {
    expectations.push(
      { id: "RED_WHEN_THE_ARCHIVE_IS_REVIVED", met: revivalRed.wentRed === true,
        expected: "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST", observed: revivalRed.reasonCode },
      { id: "PERMITTED_PARTITIONS_UNAFFECTED_BY_THE_RED",
        met: revivalRed.permittedPartitionsStayedGreen === true,
        expected: true, observed: revivalRed.permittedPartitionsStayedGreen },
      { id: "REAL_ARCHIVE_UNTOUCHED_BYTE_FOR_BYTE",
        met: revivalRed.realArchiveUntouched.equal === true,
        expected: true, observed: revivalRed.realArchiveUntouched.equal },
      { id: "REVIVAL_REMOVED", met: revivalRed.scratchRemoved === true,
        expected: true, observed: revivalRed.scratchRemoved });
  }
  if (ceremonyWrite.folded) {
    expectations.push(
      { id: "CEREMONY_WROTE_AND_READ_BACK", met: ceremonyWrite.ok === true,
        expected: "CEREMONY_COMPLETED_AND_READ_BACK", observed: ceremonyWrite.reasonCode },
      { id: "CEREMONY_WAS_NOT_A_DRY_RUN", met: ceremonyWrite.dryRun === false,
        expected: false, observed: ceremonyWrite.dryRun },
      { id: "CEREMONY_ADVANCED_THE_REAL_CHAIN", met: (ceremonyWrite.eventsAppended ?? 0) > 0,
        expected: "> 0", observed: ceremonyWrite.eventsAppended ?? 0 });
  }

  const unmet = expectations.filter((entry) => entry.met !== true).map((entry) => entry.id);

  return {
    schemaVersion: "aos.local-pure-client-proof.v1",
    story: "TCRN-AOS-STORY-133",
    ruling: "TCRN-AOS-MIN-012 direction D — S199 后本机持有 file store; AOS operating face 封存",
    ok: unmet.length === 0,
    reasonCode: unmet.length === 0 ? "LOCAL_HOST_IS_A_PURE_CLIENT" : "LOCAL_PURITY_PROOF_INCOMPLETE",
    unmetExpectations: unmet,
    expectations,
    claim: {
      predicate: "本机不得留有任何「真值已迁走」分区的活控制树;仍以本机为家的分区其活树是资产,不是缺陷。",
      judgedPerPartition: true,
      awayPartitions: [...RELOCATED_PARTITIONS],
      permittedLocalPartitions: [...LOCAL_LIVE_PARTITIONS],
      whereTheJudgementLives: "deploy/aos-local-client/local-purity-predicates.mjs (in the pnpm test roster)",
      whereTheObservationLives: "deploy/aos-local-client/scan-local.mjs (needs a disk and the engine)",
      containerPredicate: "受治工作区容器里不得存在名册之外的「工作区形」目录——"
        + "无链的部分树没有身份可判,按身份走的扫描对它失明(TCRN-CROSS-STORY-129)",
      containerRosterNames: [...CONTAINER_WORKSPACE_ROSTER].sort()
    },
    // Recorded in the artifact rather than settled inside a predicate: the two axes of
    // this gate — identity (judgeControlTree) and name/shape (judgeContainerRoster) —
    // must not disagree about the same directory. They currently agree, both red, on
    // every local shadow chain, and this states why and what closes it.
    containerRosterReconciliation: {
      state: containerRoster.strays.length === 0 && green.counts.offending === 0
        ? "RECONCILED" : "BOTH_AXES_RED_PENDING_TOPOLOGY",
      rule: "一个目录不得在一份收据里同时被两条轴判成两种东西:名册说它在册、身份扫描说它是未归属的活树。"
        + "在拓扑登记之前,两条轴一起红,而不是名字轴给它开一张白条",
      whyNoShadowWhitelist:
        "影子链的名字是一条关于本机布局的拓扑声明,本仓库只在 deploy/aos-local-client/topology.mjs "
        + "里说一次。把同样四个名字手打进判据文件,就是这个平台已经付过两次学费的第二份副本",
      howItCloses:
        "把这些影子链登记进 topology.mjs 的 PARTITION_ROSTER(真实 externalKey/workspaceId 与显式 home),"
        + "身份轴随即不再对它们报 UNATTRIBUTED_TREE_IS_LIVE,名字轴也从同一处派生出它们的目录名",
      identityAxisOffending: green.counts.offending,
      nameAxisStrays: containerRoster.strays.length
    },
    observation: {
      observedAt: observation.observedAt,
      engineRoot: observation.engineRoot,
      workspaceContainer: WORKSPACE_CONTAINER,
      containerExists: observation.containerExists,
      rootsWalked: observation.rootsWalked,
      controlTreesFound: observation.trees.length,
      nonWorkspaceCandidates: observation.nonWorkspaceCandidates,
      trees: observation.trees,
      // Basenames and shape only — the container's own path is stated once, above.
      // `skipped` carries the children that are neither directories nor symlinks: they
      // cannot be a workspace root, so they are not judged as one, and they are reported
      // here rather than dropped so that "not a workspace" and "never looked at" stay
      // distinguishable in the receipt.
      containerListing: {
        listed: containerListing.listed,
        listingError: containerListing.listingError,
        entries: containerListing.entries,
        skipped: containerListing.skipped
      },
      ceiling: SCAN_CEILING
    },
    green: { scope, verdict: green },
    containerRoster,
    tighteningRed,
    unattributedRed,
    containerRosterRed,
    containerObservationRed,
    revivalRed,
    ceremonyWrite,
    tightening: green.tightening
  };
}

/**
 * A ceremony receipt, folded in as a summary rather than whole.
 *
 * Whole would be worse, not better: the receipt carries the full scope text twice (as
 * the flag that was sent and as the value that was read back), and a second copy of
 * that inside this artifact would make the two files drift the first time either is
 * regenerated. What is kept is what cannot be re-derived — the chain versions either
 * side of the write, the record id, the read-back's field-by-field verdict — plus the
 * receipt's own digest, which is how the summary is tied to a specific receipt.
 */
export function foldCeremonyReceipt(path) {
  const text = readFileSync(path, "utf8");
  const receipt = JSON.parse(text);
  const step = receipt.steps?.[0] ?? null;
  const readback = receipt.readback?.[0] ?? null;
  return {
    folded: true,
    ok: receipt.ok === true,
    reasonCode: receipt.reasonCode ?? null,
    dryRun: receipt.dryRun === true,
    receiptSha256: sha256Text(text),
    host: receipt.host ?? null,
    topology: receipt.topology ?? null,
    hostEngineCatalogue: receipt.hostEngineCatalogue ?? null,
    chainBefore: receipt.chainBefore ?? null,
    chainAfter: receipt.chainAfter ?? null,
    eventsAppended: receipt.eventsAppended ?? null,
    write: step === null ? null : {
      verb: step.verb,
      mutates: step.mutates === true,
      executed: step.executed === true,
      accepted: step.accepted === true,
      reasonCode: step.reasonCode ?? null,
      headAtPlanning: step.headAtPlanning ?? null,
      autoSupplied: step.autoSupplied ?? [],
      fromPayload: step.fromPayload ?? []
    },
    readback: readback === null ? null : {
      verb: readback.verb,
      accepted: readback.accepted === true,
      reasonCode: readback.reasonCode ?? null,
      verdict: readback.verdict === undefined || readback.verdict === null ? null : {
        ok: readback.verdict.ok === true,
        reasonCode: readback.verdict.reasonCode ?? null,
        unequal: readback.verdict.unequal ?? [],
        // Field by field, as a DIGEST pair rather than a value pair. The comparison
        // itself was full-value and it happened in the ceremony, where both sides were
        // in hand; what this artifact has to carry is which fields were compared and
        // whether they matched. Carrying the values would put the 1000-character scope
        // in this file twice more, and a scope that lives in four places is a scope
        // that will disagree with itself.
        compared: (readback.verdict.compared ?? []).map((entry) => ({
          field: entry.field,
          equal: entry.equal === true,
          expectedSha256: sha256Text(String(entry.expected)),
          observedSha256: sha256Text(String(entry.observed)),
          characters: String(entry.observed ?? "").length
        }))
      }
    },
    // Named here because it is the one thing the receipt proves that nothing else in
    // this artifact can: under the legacy ceremony path the write was performed FROM
    // this laptop, against the VM chain that then owned it, and the value was read back.
    whatWasProven:
      "旧 S199 仪式路径证明本机可对迁移窗口内的真链做受治写:仪式从一处拓扑取五值、按主机引擎自己的 commands 名录校验载荷、"
      + "以写前现读的 --expected-version 作哨兵,写入后经 work-show 逐字段全值回读;S200 后普通写改由本机引擎/MCP 承担。"
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const result = await runLocalPurityProof({
    scratchpad: argument("scratch") ?? null,
    ceremonyReceiptPath: argument("ceremony-receipt")
      ? resolve(argument("ceremony-receipt"))
      : null
  });
  // Scrubbed before it is printed as well as before it is written. The scan's rows are
  // absolute local paths by construction — that is what an address is — so the console
  // copy of this artifact must not be the clean one only by accident of where it went.
  const artifact = scrubHostPaths(result);
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  if (process.argv.includes("--emit")) {
    mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
    writeFileSync(EVIDENCE_PATH, text);
  }
  process.stdout.write(text);
  if (result.ok !== true) process.exitCode = 1;
  if (!existsSync(WORKSPACE_CONTAINER)) process.exitCode = 1;
}
