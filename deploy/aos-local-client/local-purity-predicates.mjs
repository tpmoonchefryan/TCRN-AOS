// The judgements "this machine is a pure client of the AOS chain" turns on, as
// pure functions (TCRN-AOS-STORY-133).
//
// TCRN-AOS-INC-038 again: the scan that feeds these needs a real filesystem and the
// governed engine, so it runs from a proof script. The judgement itself decides from
// data alone — a list of observed control trees and a roster — so it lives in the
// automated test roster and the proof script IMPORTS it. Imported, never copied.
//
// WHY THIS IS NOT "does a .tcrn-workflow exist here".
//
// That predicate would be red today for a correct machine and it would stay red
// forever: cross-project, TCRN-Design-System and TCRN-TMS still keep their truth on
// this laptop, by design, this round. A gate that cannot go green on a correct
// machine gets disabled, and a gate that goes green by scanning nothing measures
// nothing. So the question is asked per PARTITION:
//
//   for every control tree found on this host, which partition does it belong to
//   (by the tree's own declared identity, not by its directory name), and is that
//   partition's truth supposed to live on this host?
//
// The AOS answer is "no", so a LIVE AOS tree here is a defect. The other three
// answer "yes", so their live trees are assets. Same predicate, different rows.

/**
 * The engine's own address-state vocabulary
 * (`WorkspaceRelocationState`, packages/core/src/workspace.ts).
 *
 * A CLOSED set, and closed in the failing direction: an observation carrying a state
 * this list does not contain is refused rather than treated as benign. If a later
 * engine adds a fifth state, this goes red and a person decides what it means —
 * which is the opposite of the default behaviour of `state === "live"`, where a new
 * state name would quietly read as "not live" and pass.
 */
export const RELOCATION_STATES = Object.freeze([
  "live", "vacated", "adoption-required", "foreign-address"
]);

/**
 * How a found tree is attributed to a partition.
 *
 * Both terms are compared and both must match. `externalKey` is legible to a human
 * approving the roster; `workspaceId` is the one an accidental copy of another
 * partition's tree cannot fake by being renamed. A tree matching one but not the
 * other is NOT resolved to that partition — it is reported as a conflict, because
 * "the file says TCRN-AOS-WORKSPACE but carries a different chain's id" is a state
 * no legitimate operation produces.
 */
export function attributeTree(tree, roster) {
  const byKey = roster.find((entry) => entry.externalKey === tree.externalKey);
  const byId = roster.find((entry) => entry.workspaceId === tree.workspaceId);
  if (byKey && byId && byKey.partitionId === byId.partitionId) {
    return { partition: byKey, attribution: "IDENTITY_PAIR_MATCHED" };
  }
  if (byKey || byId) {
    return {
      partition: null,
      attribution: "IDENTITY_TERMS_DISAGREE",
      matchedByExternalKey: byKey?.partitionId ?? null,
      matchedByWorkspaceId: byId?.partitionId ?? null
    };
  }
  return { partition: null, attribution: "PARTITION_UNKNOWN" };
}

/**
 * One control tree, judged.
 *
 * `engineState` is the ENGINE's verdict for this tree at the address it was found
 * at — `relocationStateAt(metadata, address)` — not a re-implementation. That
 * matters more than it looks: the engine returns `foreign-address` (not `live`) for
 * a ledger-less copy standing anywhere other than its own stored root, so a stray
 * duplicate is correctly reported as inert rather than raising a false fork alarm,
 * and a revived tree AT the original address is correctly reported as live. Both of
 * those are decisions this file must not make for itself.
 *
 * The reason codes, and what each one means to whoever reads the receipt:
 *   ARCHIVE_RETAINED_AND_DEAD        an away-partition tree, vacated on both terms. Wanted.
 *   LIVE_TREE_OF_A_PERMITTED_PARTITION  a home-partition tree, live. Also wanted.
 *   AWAY_PARTITION_TREE_IS_LIVE      a partition whose truth moved is live here. RED.
 *   AWAY_PARTITION_TREE_AWAITS_ADOPTION  one governed verb from live here. RED.
 *   ARCHIVE_NOT_DEAD_ON_THE_READ_FACE   ledger says vacated, `status` answers anyway. RED.
 *   ARCHIVE_CARRIES_A_DIFFERENT_RELOCATION  not the hop the roster names. RED.
 *   UNATTRIBUTED_TREE_IS_LIVE        a live tree belonging to no rostered partition. RED.
 *   INERT_COPY                       present, not live at this address.
 *   RELOCATION_STATE_UNRECOGNISED    vocabulary drift. RED.
 */
export function judgeControlTree({ tree, roster }) {
  if (!RELOCATION_STATES.includes(tree.engineState)) {
    return {
      ok: false,
      reasonCode: "RELOCATION_STATE_UNRECOGNISED",
      address: tree.address,
      partitionId: null,
      engineState: tree.engineState ?? null,
      attribution: "NOT_ATTEMPTED"
    };
  }
  const { partition, attribution, ...conflict } = attributeTree(tree, roster);

  // LIVE takes two facts, not one, and they are computed by different code paths in
  // the engine: the ledger-and-address discriminator says `live`, AND the engine's
  // own read face (`status`, through `resolveWorkspace`) accepts the address. The
  // second term is what makes this a measurement rather than a paraphrase of one
  // file — `resolveWorkspace` additionally requires the control subdirectories and
  // every root of the active binding to resolve to exactly the stored canonical
  // path, so a copy that merely carries live-looking metadata is refused there.
  // What makes a tree dangerous is that the engine will actually WORK at it.
  const live = tree.engineState === "live" && tree.readFaceAccepted === true;
  const awaitingAdoption = tree.engineState === "adoption-required";

  const base = {
    address: tree.address,
    engineState: tree.engineState,
    readFaceAccepted: tree.readFaceAccepted === true,
    readFaceReasonCode: tree.readFaceReasonCode ?? null,
    partitionId: partition?.partitionId ?? null,
    home: partition?.home ?? null,
    attribution,
    ...conflict
  };

  if (partition === null) {
    // An unattributed tree is red only when it is LIVE or awaiting adoption. A
    // ledger-less stray at a foreign address is refused by the engine anyway, and
    // failing on it would make the gate red for every abandoned experiment on the
    // disk — which is how a gate gets switched off rather than fixed.
    return live || awaitingAdoption
      ? { ok: false, reasonCode: "UNATTRIBUTED_TREE_IS_LIVE", ...base }
      : { ok: true, reasonCode: "INERT_COPY", ...base };
  }

  if (partition.home === "vm") {
    if (live) return { ok: false, reasonCode: "AWAY_PARTITION_TREE_IS_LIVE", ...base };
    if (awaitingAdoption) {
      return { ok: false, reasonCode: "AWAY_PARTITION_TREE_AWAITS_ADOPTION", ...base };
    }
    // `vacated` is the retained archive MIN-012 asks for, and it is asserted on both
    // sides: the ledger discriminator says `vacated` AND the read face refuses with
    // the engine's own `WORKSPACE_RELOCATION_VACATED`. Both, because the ledger is
    // the one part of the control tree the event hash chain does not cover (ADR 0003
    // ceiling 2) — restore a pre-vacate `workspace.json` and the address is fully
    // alive again. A predicate that read only the ledger would be reporting the
    // deleted evidence's absence as good news.
    const expectedHop = partition.relocationId ?? null;
    const hopMatches = expectedHop === null || tree.lastRelocationId === expectedHop;
    const archiveFields = {
      expectedRelocationId: expectedHop,
      observedRelocationId: tree.lastRelocationId ?? null,
      ...base
    };
    if (tree.engineState !== "vacated") return { ok: true, reasonCode: "INERT_COPY", ...base };
    if (!hopMatches) {
      return { ok: false, reasonCode: "ARCHIVE_CARRIES_A_DIFFERENT_RELOCATION", ...archiveFields };
    }
    if (tree.readFaceAccepted === true || tree.readFaceReasonCode !== "WORKSPACE_RELOCATION_VACATED") {
      return { ok: false, reasonCode: "ARCHIVE_NOT_DEAD_ON_THE_READ_FACE", ...archiveFields };
    }
    return { ok: true, reasonCode: "ARCHIVE_RETAINED_AND_DEAD", ...archiveFields };
  }

  // home === "local": this partition's truth is still here this round.
  //
  // A non-live tree of a home partition is an inert copy and NOT a finding. The
  // requirement "each home partition must actually have a live tree here" is a
  // question about the PARTITION, not about this row, and it is judged once in
  // `judgeScanScope`. Asking it per row instead would turn every stray copy of a
  // permitted partition into a red — a false red, and the kind that gets a gate
  // muted rather than read.
  return live
    ? { ok: true, reasonCode: "LIVE_TREE_OF_A_PERMITTED_PARTITION", ...base }
    : { ok: true, reasonCode: "INERT_COPY", ...base };
}

/**
 * Did the walk establish a scope worth judging?
 *
 * Without this, the predicate's green has a hole big enough to drive through: run it
 * where the workspace container does not exist and it finds nothing, judges nothing,
 * and reports success. "I found no live AOS tree" and "I looked nowhere" must not
 * share a verdict. So the scan must have found the container AND a live tree for
 * every partition the roster says is at home; anything less is
 * SCAN_SCOPE_NOT_ESTABLISHED, which is red.
 *
 * When the roster is tightened to zero home partitions, `expectedLocalPartitions`
 * empties and the container's own presence carries the scope on its own — the
 * container will still be there, holding archives.
 */
export function judgeScanScope({ containerExists, rootsWalked, partitionsFoundLive, roster }) {
  const expectedLocalPartitions = roster.filter((entry) => entry.home === "local")
    .map((entry) => entry.partitionId).sort();
  const found = [...new Set(partitionsFoundLive)].sort();
  const missing = expectedLocalPartitions.filter((id) => !found.includes(id));
  const walkedEnough = Array.isArray(rootsWalked) && rootsWalked.length > 0
    && rootsWalked.every((root) => root.reachable === true);
  const reasonCode = !containerExists ? "SCAN_SCOPE_NOT_ESTABLISHED"
    : !walkedEnough ? "SCAN_ROOT_UNREACHABLE"
      : missing.length > 0 ? "SCAN_SCOPE_NOT_ESTABLISHED"
        : "SCAN_SCOPE_ESTABLISHED";
  return {
    ok: reasonCode === "SCAN_SCOPE_ESTABLISHED",
    reasonCode,
    containerExists: containerExists === true,
    expectedLocalPartitions,
    partitionsFoundLive: found,
    missing,
    rootsWalked: (rootsWalked ?? []).map((root) => ({ id: root.id, reachable: root.reachable === true })),
    predicate: "「没找到活的 AOS 树」与「什么都没找到」不得共用一个绿:名册说在家的分区必须真的被找到活的,"
      + "否则本次扫描没有建立可判的范围"
  };
}

/**
 * The closed set of basenames the container may hold WORKSPACE-SHAPED: one per
 * rostered partition, plus one per local shadow the CALLER declares.
 *
 * Derived from the partition roster that is handed in rather than restated as a
 * literal, so adding a partition cannot leave this list behind — the failure mode
 * would be a new partition's own archive reported as a stray, which is the kind of
 * false red that gets a gate muted rather than fixed.
 *
 * `shadows` defaults to EMPTY and is never derived as `${partitionId}-shadow` over the
 * partition roster, for two separate reasons:
 *   - deriving would admit a `TCRN-AOS-shadow`. AOS is the fallback HOST, so a shadow
 *     of itself is a directory that must never exist, and a roster generous enough to
 *     accept it is a roster that cannot be used to detect it;
 *   - "which partitions have a local shadow directory" is a fact about a machine's
 *     layout, i.e. topology. Topology is stated in exactly one place in this repository
 *     (deploy/aos-local-client/topology.mjs) and handed in; a second copy typed into
 *     this file is the drift this platform has already paid for twice.
 *
 * The default is empty rather than populated because this is the WHITELIST side of a
 * detection gate — the side that suppresses findings. An absent declaration must
 * therefore widen the finding, never narrow it: an undeclared shadow directory reds as
 * a stray until somebody declares it, which is the direction that gets looked at.
 *
 * De-duplicated because the two sources legitimately overlap: the day a shadow chain
 * is promoted to a rostered partition of its own, its directory name arrives from both
 * lists, and a roster carrying it twice would make "how many names are allowed" stop
 * matching "how many directories are allowed".
 */
export function containerWorkspaceRoster(roster, shadows = []) {
  return [...new Set([
    ...roster.map((entry) => entry.partitionId),
    ...shadows.map((partitionId) => `${partitionId}-shadow`)
  ])];
}

/**
 * What the container scan cannot see, stated beside the judgement rather than in a
 * footnote of a receipt nobody re-reads.
 */
export const CONTAINER_SCAN_CEILING = Object.freeze({
  onlyDirectChildren:
    "只判容器的直接子目录。更深一层的「无链但有 workspace/ 形状」的目录两道扫描都看不见——"
    + "按身份走的扫描对无链树结构性失明(见 shapeNotIdentity),本判据只看顶层。"
    + "这是一个已知盲区,不是分工",
  shapeNotIdentity:
    "判据看的是「有没有 workspace/ 子目录」而不是「有没有链」。引号事故留下的正是无链的那一种,"
    + "judgeControlTree 对它结构性失明——那是本判据存在的全部理由",
  unshapedIsNotAFinding:
    "没有 workspace/ 子目录的陌生条目只被记录、不算发现。否则容器里任何一个临时目录都会把门刷红,"
    + "门会被关掉而不是被读",
  childrenNotJudgedAsDirectories:
    "只有目录与符号链接的子项进入本判据(形状探测跟随软链,所以一个指向别处工作区的软链子项读作野目录"
    + "而不是「不存在」);普通文件等其余子项由观测侧单列记录、不进桶也不计入 entriesSeen"
});

/**
 * Does the workspace CONTAINER hold a workspace-shaped directory the roster does not
 * name?
 *
 * The complement of `judgeControlTree`, and the reason it is needed: that judgement
 * attributes a tree by the tree's OWN declared identity, so a directory carrying the
 * workspace SHAPE but no `.tcrn-workflow` has no identity to judge and is invisible to
 * it. Three such directories — partial trees left by a shell quoting accident, names
 * like "cross-project-shadow cross-project SHADOW cross-project" — sat under a green
 * light for exactly that reason (TCRN-CROSS-STORY-129).
 *
 * WHY THIS ONE IS ALLOWED TO BE NAME-BASED, given this file opens by rejecting a
 * name-based predicate. The rejected one ("does a directory called X exist") could not
 * go green on a correct machine at all. This one greens on every name the roster carries
 * and reds only on the complement, so a container holding nothing but rostered
 * directories passes; the container is a CLOSED set with a single owner, which is what
 * makes the complement of a roster meaningful here and nowhere else on the disk.
 *
 * The price of that is stated rather than hidden: a directory nobody put in the roster
 * is a finding whether or not somebody thinks it is legitimate. The fix for a
 * legitimate one is to register it where the roster comes from, not to add a name to a
 * whitelist beside this judgement — a whitelist here can only ever make a finding
 * disappear, and it is how one axis of a gate ends up contradicting the other.
 *
 * `containerExists`, `listed` and the SCOPE FLOOR are separate gates for the reason
 * `judgeScanScope` exists: "the container holds no stray", "the container is not
 * there", "the listing could not be read" and "the listing came back holding nothing I
 * expected" must not share a green. The floor mirrors `judgeScanScope` term for term —
 * a listing that does not contain every rostered name did not establish a scope this
 * judgement can green, because an emptied or half-read container would otherwise turn
 * "no stray was found" into a permanent green with nothing able to go red.
 *
 * `nonWorkspaceEntries` is the caller's declaration of which unshaped basenames are
 * known sidecars (the release-trust directory sits beside the partition directories,
 * one level out from any workspace root). It is a PARAMETER and not a constant here for
 * the same reason `roster` is: it is a claim about a machine's layout, and this file
 * judges data rather than stating topology. It cannot suppress a finding either way —
 * an entry with no `workspace/` child is never a finding (see `CONTAINER_SCAN_CEILING`)
 * — so the empty default only moves an unclassified entry from `knownSiblings` to
 * `unshapedStrangers`, both of which are data.
 *
 *   CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES  every shaped entry is rostered. Wanted.
 *   CONTAINER_HOLDS_UNROSTERED_WORKSPACE      a workspace-shaped stranger. RED.
 *   CONTAINER_NOT_FOUND                       nothing was looked at. RED.
 *   CONTAINER_NOT_LISTED                      the container refused to be read, or no
 *                                             `entries` term arrived at all. RED.
 *   CONTAINER_LISTING_ESTABLISHED_NO_SCOPE    read, and it held nothing. RED.
 *   CONTAINER_SCOPE_NOT_ESTABLISHED           a rostered name was not found. RED.
 */
export function judgeContainerRoster({
  containerExists, listed, entries, roster, nonWorkspaceEntries = []
}) {
  const declaredRoster = [...(roster ?? [])].sort();
  const siblings = new Set(nonWorkspaceEntries ?? []);
  const empty = {
    roster: declaredRoster,
    strays: [],
    rostered: [],
    rosteredWithoutWorkspace: [],
    // Nothing was observed, so every rostered name is missing. Stated rather than left
    // empty: an empty `missingRostered` beside `entriesSeen: 0` would read as "all
    // present", which is the confusion this whole floor exists to refuse. Its own copy,
    // not the same array as `roster` — two fields sharing one object is how a receipt's
    // two sides stop being able to differ.
    missingRostered: [...declaredRoster],
    knownSiblings: [],
    unshapedStrangers: [],
    entriesSeen: 0,
    workspaceShaped: 0,
    ceiling: CONTAINER_SCAN_CEILING,
    predicate: "受治工作区容器里的每一个「工作区形」目录都必须是名册点名的那几个之一;"
      + "名册之外的一个就是发现,哪怕它没有链。"
      + "并且名册上的每一个都必须真的在列表里出现过,否则本次列举没有建立可判的范围"
  };
  if (containerExists !== true) return { ok: false, reasonCode: "CONTAINER_NOT_FOUND", ...empty };
  // A missing or non-array `entries` fails CLOSED beside the missing `listed` term. The
  // two must be treated alike: `listed: true` with no entries term at all is exactly
  // what a refactor or a partial call site leaves behind, and reading that as "we read
  // the container and it was clean" is the fail-OPEN direction.
  if (listed !== true || !Array.isArray(entries)) {
    return { ok: false, reasonCode: "CONTAINER_NOT_LISTED", ...empty };
  }

  // Every observed entry lands in exactly one bucket. A classification with a hole in
  // it is how an entry disappears from a receipt while still sitting on the disk.
  const allowed = new Set(declaredRoster);
  const observed = entries;
  const seen = new Set(observed.map((entry) => entry.name));
  const named = (rows) => rows.map((entry) => entry.name).sort();
  const shaped = observed.filter((entry) => entry.workspaceShaped === true);
  const unshaped = observed.filter((entry) => entry.workspaceShaped !== true);
  const strays = named(shaped.filter((entry) => !allowed.has(entry.name)));
  // Present by NAME, whatever its shape: a rostered partition whose archive was pruned
  // of its `workspace/` child is still evidence that the listing reached the container
  // this roster describes. Only a name that is not there at all fails the floor.
  const missingRostered = declaredRoster.filter((name) => !seen.has(name));

  // Ordered as `judgeScanScope` orders its own terms: scope before findings. Both are
  // reported in full either way — the buckets below are populated whichever code wins,
  // so a stray is never hidden by a scope failure, only out-ranked in the headline.
  const reasonCode = observed.length === 0 ? "CONTAINER_LISTING_ESTABLISHED_NO_SCOPE"
    : missingRostered.length > 0 ? "CONTAINER_SCOPE_NOT_ESTABLISHED"
      : strays.length > 0 ? "CONTAINER_HOLDS_UNROSTERED_WORKSPACE"
        : "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES";

  return {
    ok: reasonCode === "CONTAINER_HOLDS_ONLY_ROSTERED_WORKSPACES",
    reasonCode,
    ...empty,
    strays,
    rostered: named(shaped.filter((entry) => allowed.has(entry.name))),
    // A rostered partition whose archive no longer carries a `workspace/` child. Data,
    // not a finding: pruning an archive is a decision somebody may legitimately take,
    // and whether a chain is still readable is judged by the control-tree scan.
    rosteredWithoutWorkspace: named(unshaped.filter((entry) => allowed.has(entry.name))),
    missingRostered,
    knownSiblings: named(unshaped.filter((entry) =>
      !allowed.has(entry.name) && siblings.has(entry.name))),
    unshapedStrangers: named(unshaped.filter((entry) =>
      !allowed.has(entry.name) && !siblings.has(entry.name))),
    entriesSeen: observed.length,
    workspaceShaped: shaped.length
  };
}

/**
 * The story's core judgement: does this machine still hold a live control tree of
 * any partition whose truth has moved away?
 *
 * Derived from the per-tree verdicts rather than restated, so a row that goes red
 * upstream cannot be green here. `permittedLocalPartitions` is reported as data:
 * it is the roster's own home list, and the day it empties this same function reads
 * "this machine holds zero live governed workspaces" without a line changing.
 */
export function judgeLocalPurity({ trees, roster, scope }) {
  const verdicts = trees.map((tree) => judgeControlTree({ tree, roster }));
  const awayPartitions = roster.filter((entry) => entry.home === "vm").map((entry) => entry.partitionId);
  const permittedLocalPartitions = roster.filter((entry) => entry.home === "local")
    .map((entry) => entry.partitionId).sort();

  const offending = verdicts.filter((verdict) => verdict.ok === false);
  const liveAwayTrees = verdicts.filter((verdict) =>
    verdict.reasonCode === "AWAY_PARTITION_TREE_IS_LIVE"
    || verdict.reasonCode === "AWAY_PARTITION_TREE_AWAITS_ADOPTION");
  const retainedArchives = verdicts.filter((verdict) => verdict.reasonCode === "ARCHIVE_RETAINED_AND_DEAD");
  const permittedLive = verdicts.filter((verdict) =>
    verdict.reasonCode === "LIVE_TREE_OF_A_PERMITTED_PARTITION");

  // Two live trees for one partition on one host is a fork inside this machine.
  // Nothing upstream reports it: each row is individually legitimate.
  const liveByPartition = new Map();
  for (const verdict of permittedLive) {
    liveByPartition.set(verdict.partitionId, (liveByPartition.get(verdict.partitionId) ?? 0) + 1);
  }
  const duplicated = [...liveByPartition.entries()]
    .filter(([, count]) => count > 1).map(([partitionId]) => partitionId).sort();

  const reasonCode = scope?.ok !== true ? (scope?.reasonCode ?? "SCAN_SCOPE_NOT_ESTABLISHED")
    : liveAwayTrees.length > 0 ? "AWAY_PARTITION_ARTEFACT_PRESENT_ON_LOCAL_HOST"
      : duplicated.length > 0 ? "TWO_LIVE_TREES_FOR_ONE_PARTITION"
        : offending.length > 0 ? "LOCAL_CONTROL_TREE_ROSTER_VIOLATION"
          : "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT";

  return {
    ok: reasonCode === "LOCAL_HOST_HOLDS_NO_AWAY_PARTITION_ARTEFACT",
    reasonCode,
    awayPartitions,
    permittedLocalPartitions,
    counts: {
      treesFound: verdicts.length,
      retainedArchives: retainedArchives.length,
      permittedLiveTrees: permittedLive.length,
      liveAwayTrees: liveAwayTrees.length,
      offending: offending.length
    },
    duplicatedLivePartitions: duplicated,
    verdicts,
    offending,
    scope: scope ?? null,
    // Stated in the artifact, not only in this comment: the same function is the
    // tightened gate once the roster's home list is empty.
    tightening: permittedLocalPartitions.length === 0
      ? "已收紧:名册无在家分区,本判据此刻读作「本机零活工作区」"
      : "未收紧:名册仍允许 " + permittedLocalPartitions.join("/")
        + " 在本机为活;三分区迁走后把它们的 home 改为 vm,本判据即读作「本机零活工作区」",
    ceiling: "判据测的是「引擎在该地址上给出的状态」,不是「磁盘上有没有这些字节」。"
      + "vacated 的树仍是复活材料(ADR 0003 ceiling 2:workspace.json 不在事件哈希链覆盖范围内),"
      + "归档 tarball 更不在扫描范围内——绿不等于没有回去的路"
  };
}
