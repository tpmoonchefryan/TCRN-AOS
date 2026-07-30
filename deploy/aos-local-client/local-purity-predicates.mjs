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
