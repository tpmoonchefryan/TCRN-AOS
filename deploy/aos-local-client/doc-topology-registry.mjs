// TCRN-AOS-STORY-136 — which documents on this platform are allowed to state where a
// partition's truth lives, and what each of them must state.
//
// WHY A REGISTRY AND NOT A GREP. The lesson this file mechanises is "举例即断言": a
// convention that names an instance has, by naming it, asserted something about that
// instance's present state — and nothing maintains that assertion. It has now cost this
// platform the same mistake twice (a repository described as remote-less after it had a
// remote; a LAN mirror address quoted after it was retired). A scan that merely looked
// for suspicious sentences would be the third instance of a failure mode already in the
// knowledge base: a predicate that measures whether some prose mentions a thing rather
// than whether the thing is where the prose says.
//
// So the shape is inverted. A location claim must be written in ONE machine-readable
// form (the claim block below), the block is checked against a real measurement, and any
// concrete address appearing OUTSIDE a block is itself a finding. The first half makes
// claims checkable; the second half stops a writer from routing around the check by
// phrasing the claim as prose.
//
// `expectedPartitions` is the part that cannot be deleted quietly. Without it, removing a
// row — or removing the whole block — would make a finding disappear, which is exactly
// the hole `local-purity-predicates.mjs` had to close for the partition roster. With it,
// a registry entry states the claims the document is REQUIRED to carry, so deletion reds.

import { join } from "node:path";
import { PARTITION_ROSTER, PLATFORM_ROOT } from "./topology.mjs";

// Re-exported, not re-declared: the markers belong to the parser that consumes them.
export { CLAIM_BLOCK_BEGIN, CLAIM_BLOCK_END } from "./doc-topology-predicates.mjs";

const ALL_PARTITIONS = Object.freeze(PARTITION_ROSTER.map((entry) => entry.partitionId));

/**
 * The registry.
 *
 * `mustCarryClaims: false` does not mean "unchecked". Those documents are still subject
 * to the containment rule, which is the half that catches a NEW claim written into a
 * document that was never supposed to make one. A document that is in neither list is
 * genuinely unchecked, and that is the declared ceiling of this gate — see CEILING.
 */
export const DOC_REGISTRY = Object.freeze([
  Object.freeze({
    path: "AGENTS.md",
    what: "平台级代理正本。五个分区的活真值现在都在这里说全。",
    mustCarryClaims: true,
    expectedPartitions: ALL_PARTITIONS
  }),
  Object.freeze({
    path: "docs/delivery-cadence-convention.md",
    what: "交付节奏公约。它的第 7 条(中断保险)直接依赖真值在哪台机器上,所以它必须自己带一份声明,"
      + "而不是引别处的散文。",
    mustCarryClaims: true,
    expectedPartitions: ALL_PARTITIONS
  }),
  Object.freeze({
    path: "TCRN-AOS/AGENTS.md",
    what: "AOS 仓代理正本。本仓的链已回到本机,进仓的人第一件要知道的事就是这个。",
    mustCarryClaims: true,
    expectedPartitions: Object.freeze(["TCRN-AOS"])
  }),
  Object.freeze({
    path: "TCRN-Design-System/AGENTS.md",
    what: "DS 仓代理正本。本仓分区本轮仍在本机——但这句话现在需要被核对,不能再默认。",
    mustCarryClaims: true,
    expectedPartitions: Object.freeze(["TCRN-Design-System"])
  }),
  Object.freeze({
    path: "TCRN-TMS/AGENTS.md",
    what: "TMS 仓代理正本。同上。",
    mustCarryClaims: true,
    expectedPartitions: Object.freeze(["TCRN-TMS"])
  }),
  Object.freeze({
    path: "CLAUDE.md",
    what: "平台级 Claude 入口。只允许保留宿主官方的 @AGENTS.md import,不得成为第二正本。",
    mustCarryClaims: false,
    expectedImport: "@AGENTS.md",
    forbidClaimBlock: true
  }),
  Object.freeze({
    path: "tcrn-workflow/CLAUDE.md",
    what: "引擎仓 Claude 入口。只允许保留宿主官方的 @AGENTS.md import,不得成为第二正本。",
    mustCarryClaims: false,
    expectedImport: "@AGENTS.md",
    forbidClaimBlock: true
  }),
  Object.freeze({
    path: "tcrn-workflow/AGENTS.md",
    what: "引擎仓代理正本;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "TCRN-AOS/CLAUDE.md",
    what: "AOS 仓 Claude 入口。只允许保留宿主官方的 @AGENTS.md import,不得成为第二正本。",
    mustCarryClaims: false,
    expectedImport: "@AGENTS.md",
    forbidClaimBlock: true
  }),
  Object.freeze({
    path: "TCRN-Design-System/CLAUDE.md",
    what: "DS 仓 Claude 入口。只允许保留宿主官方的 @AGENTS.md import,不得成为第二正本。",
    mustCarryClaims: false,
    expectedImport: "@AGENTS.md",
    forbidClaimBlock: true
  }),
  Object.freeze({
    path: "TCRN-TMS/CLAUDE.md",
    what: "TMS 仓 Claude 入口。只允许保留宿主官方的 @AGENTS.md import,不得成为第二正本。",
    mustCarryClaims: false,
    expectedImport: "@AGENTS.md",
    forbidClaimBlock: true
  }),
  Object.freeze({
    path: "docs/direction-and-tracks-convention.md",
    what: "方向与轨道公约。它谈的是「真值宿主是一道方向题」,不落具体地址;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "docs/harness-constraint-convention.md",
    what: "约束进化公约。它谈的是「约束在哪台机器上被执行」,不落具体地址;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "docs/projection-freshness-convention.md",
    what: "投影新鲜度公约(INIT-019 新增)。它声明「凡物化侧车须声明三数」,不落具体地址;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "docs/dispatch-readiness-convention.md",
    what: "派工就绪公约。它谈的是单据要素,不落具体地址;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "TCRN-AOS/docs/dispatch-readiness-convention.md",
    what: "派工就绪公约的 AOS 兼容入口;不是第二正本,只指向平台根正本并受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "docs/deliberation-adoption-convention.md",
    what: "审议采用公约。它谈的是审议执行形态,不落具体地址;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "docs/sourcing-and-vetting-convention.md",
    what: "外采与准入公约。它谈的是引入外部依赖的审查,不落具体地址;受收容规则约束。",
    mustCarryClaims: false
  }),
  Object.freeze({
    path: "TCRN-AOS/docs/direction-aos-collaborative-workbench.md",
    what: "AOS 协作工作台方向材料。它的复核命令句会声称 AOS 真值位置,须受收容规则约束(INC-050:登记到名册,不留在暗面)。",
    mustCarryClaims: false
  })
]);

export const registryPaths = () => DOC_REGISTRY.map((entry) => entry.path);
export const absoluteDocPath = (relative) => join(PLATFORM_ROOT, relative);

/**
 * The concrete address strings that may appear only inside a claim block.
 *
 * Derived from the roster rather than typed, so a relocation that edits the roster also
 * moves what the containment rule looks for. Two families per partition:
 *
 *   - the local siting convention `.tcrn-workspace/<partition>/workspace`, which is a
 *     specific address because it names a specific partition. The generic form
 *     `.tcrn-workspace/<分区>/` with a placeholder is deliberately NOT matched — that is
 *     prose about the convention, not a claim about one chain;
 *   - the away partition's `liveAddress`, plus the governance container above it. The
 *     container is included because "the AOS chain is under /srv/tcrn/governance" is the
 *     same claim one directory shallower, and a rule that only matched the leaf would be
 *     trivially side-stepped. A local row contributes only its concrete per-partition
 *     address: the generic `.tcrn-workspace/` container is a documented siting convention,
 *     not a claim that all five chains have one particular home.
 */
export function forbiddenOutsideClaimBlocks(roster = PARTITION_ROSTER) {
  const literals = new Set();
  for (const entry of roster) {
    // Both forms, and the declared one comes from the roster rather than a second
    // hand-typed copy. INIT-024 moved the container beside the platform root, so the
    // declared address gained a `../` prefix; a literal set that only knew the older
    // bare form still fired (it is a substring) but reported the wrong literal, which
    // is how a red proof can go red for the wrong reason and still look satisfied.
    // The bare form stays forbidden so a document that drops the prefix is still red.
    literals.add(`.tcrn-workspace/${entry.partitionId}/workspace`);
    if (typeof entry.liveAddress === "string" && entry.liveAddress.length > 0) {
      literals.add(entry.liveAddress);
    }
    if (entry.home === "vm" && typeof entry.liveAddress === "string" && entry.liveAddress.length > 0) {
      literals.add(entry.liveAddress);
      const container = entry.liveAddress.split("/").slice(0, -2).join("/");
      if (container.length > 0) literals.add(container);
    }
  }
  return Object.freeze([...literals].sort());
}

/**
 * What this gate cannot see, stated where it is configured.
 *
 * The third one is the honest limit of the cheap run: refusal at the local address proves
 * the truth is not HERE, which is not the same claim as "it is on that host". Only
 * `--probe-vm` asks the host itself, and the artifact records which of the two ran.
 */
export const CEILING = Object.freeze({
  registryIsClosed:
    "只核对名册里这些文档。名册外的一份文档写错了地址,本判据看不见——"
    + "所以新增会声称真值位置的入口文档时,同一次改动要把它登记进来。",
  containmentIsSyntactic:
    "收容规则判的是「具体地址是否只出现在声明块内」,它不判块外那句话的真假。"
    + "块外出现即红,由人把它搬进块里,由块的真值检查接手。",
  awayHomeWithoutProbe:
    "不带 --probe-vm 时,home=vm 的证据是「本机这个地址不再答活」——它证明真值不在本机,"
    + "不证明真值在那台机器上。带 --probe-vm 才问了对方本身(仪器纪律第 4 条)。",
  recheckCommandNotExecuted:
    "复核命令列被检查「包含所声明的地址」且「不含白名单外的 SSH 直驱引擎命令」,但并未被执行。"
    + "它保证地址变了命令必须跟着变、且命令教的访问形态合规,不保证那条命令今天能跑通。"
    + "(STORY-157.3:访问形态判据已并入;复核要走 MCP 只读面,SSH 直驱只允许白名单内两类 break-glass。)"
});
