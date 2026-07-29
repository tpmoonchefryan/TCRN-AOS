#!/usr/bin/env node
// Turn the four acts' run state into the evidence files that outlive the run.
//
// Two rules this enforces rather than trusts:
//  1. No absolute path of THIS machine survives into evidence. Local roots are
//     rewritten to the placeholders the repository already uses, and the result
//     is scanned afterwards — a redaction that is only performed, never checked,
//     is the kind that quietly stops covering a new field.
//  2. The cross-act invariants are RECOMPUTED here from the separate receipts
//     rather than restated. If act four's restored head does not equal act one's
//     anchor head at full value, this file says so instead of narrating that the
//     rehearsal went well.

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  LOCAL_ENGINE, PLATFORM_ROOT, REPO_ROOT, SCRATCHPAD,
  hasState, instant, loadState, vmProcessResidue, ssh
} from "./rehearsal-lib.mjs";

const act1 = loadState("act1");
const act2 = loadState("act2");
const act3 = loadState("act3");
const act4 = loadState("act4");
const redNames = ["act4-red-accept-forged", "act4-red-drop-one-replay-row"];
const reds = redNames.filter(hasState).map((name) => ({ name, receipt: loadState(name) }));

const vmRoot = act1.vmRoot;
const vmScratchRootName = vmRoot.split("/").pop();

// Longest first: LOCAL_ENGINE and REPO_ROOT can both sit under the home dir, and
// a home-first pass would leave a half-rewritten path behind.
const REDACTIONS = [
  [resolve(SCRATCHPAD), "<scratch>"],
  [resolve(REPO_ROOT), "<repo>"],
  [resolve(LOCAL_ENGINE), "<local-governed-copy>"],
  [resolve(PLATFORM_ROOT), "<platform-root>"],
  [vmRoot, "<vm-scratch>"],
  [homedir(), "<home>"]
].sort((a, b) => b[0].length - a[0].length);

function redact(value) {
  if (typeof value === "string") {
    let out = value;
    for (const [from, to] of REDACTIONS) out = out.split(from).join(to);
    return out;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [redact(key), redact(entry)]));
  }
  return value;
}

const reasonCodes = (receipt) => receipt.steps.map((entry) => ({ step: entry.name, reasonCode: entry.reasonCode, ok: entry.ok !== false }));

// ---- cross-act invariants, recomputed ------------------------------------
const walkthroughWrites = act3.criteria.chainWriteFourRoutesFullPath;
const restore = act4.steps.find((entry) => entry.name === "restore-base-double-green");
const reconcile = act4.steps.find((entry) => entry.name === "reconcile");
const enumerate = act4.steps.find((entry) => entry.name === "enumerate-delta");
const freeze = act4.steps.find((entry) => entry.name === "freeze-write-face");
const authority = act2.steps.find((entry) => entry.name === "authority-untouched");

const invariants = {
  anchorIsTheSameAnchorAcrossActs: {
    ok: act4.anchor.headEventHash === act1.anchor.headEventHash
      && act4.anchor.version === act1.anchor.version,
    act1AnchorHeadEventHash: act1.anchor.headEventHash,
    act4AnchorHeadEventHash: act4.anchor.headEventHash,
    comparedAt: "full value"
  },
  restoredBaseEqualsAnchor: {
    ok: restore?.headFullValueEqualsAnchor === true,
    restoredHeadEventHash: restore?.restoredHeadEventHash ?? null,
    restoredVersion: restore?.restoredVersion ?? null
  },
  writeLogIsALiveInstrument: {
    ok: walkthroughWrites?.writeLogLiveInstrument?.ok === true,
    lastLogHeadEventHash: walkthroughWrites?.writeLogLiveInstrument?.lastLogHeadEventHash ?? null,
    chainHeadEventHash: walkthroughWrites?.writeLogLiveInstrument?.chainHeadEventHash ?? null
  },
  everyWalkthroughWriteWasEnumerated: {
    ok: (enumerate?.replayable ?? -1) === (freeze?.writeLogRowsCaptured ?? -2),
    writeLogRowsAtFreeze: freeze?.writeLogRowsCaptured ?? null,
    rowsEnumeratedAsReplayable: enumerate?.replayable ?? null
  },
  rollbackRestoredContentNotVersion: {
    ok: reconcile?.ok === true,
    counts: reconcile?.counts ?? null,
    versions: reconcile?.versions ?? null,
    perRecordAllEqual: (reconcile?.perRecord ?? []).every((entry) => entry.equal)
  },
  liveAuthorityOnlyRead: {
    ok: authority?.ok === true,
    liveHeadEventHash: authority?.liveHeadEventHash ?? null,
    liveVersion: authority?.liveVersion ?? null
  }
};

const residue = await vmProcessResidue();
const vmListing = (await ssh(["sh", "-c", "'ls -1 /srv/tcrn'"])).stdout.trim().split("\n");
const scratchGone = (await ssh(["sh", "-c", `'test -e ${vmRoot} && echo PRESENT || echo ABSENT'`])).stdout.trim();

const index = {
  schemaVersion: "aos.switch-rehearsal-arc.v1",
  ruling: "TCRN-AOS-MIN-007 切换仪式演练义务(矩阵双跑 → owner 门 → 切换 → 降级归档);产品面走查判据取 TCRN-CROSS-MIN-052 D9 的真值版;访问形态取 CONF-007 D7",
  generatedAt: instant(),
  run: {
    vmScratchRootName,
    vmScratchRoot: "<vm-scratch>",
    engineOnVm: "/srv/tcrn/engine/tcrn-workflow",
    partitionId: "SCRATCH-REHEARSAL",
    chain: act1.chain
  },
  acts: [
    {
      act: 1, story: "STORY-122", script: "deploy/switch-rehearsal/act1-scratch-arc.mjs",
      what: "scratch 全绿弧:本机建受治链(启用 attestation + attest-dir 旁车)→ 镜像 A 侧摄入 → 5×4 一致性矩阵双容器全绿 → 链侧锚(manifest + 基线字节归档 + snapshot-verify)→ 五件套传 VM 双向全值对账 → VM 自身引擎复验",
      ok: act1.ok === true, steps: reasonCodes(act1),
      matrixSummary: act1.matrix?.summary ?? null,
      transfer: { files: act1.transfer.fileCount, bytes: act1.transfer.totalBytes, fileSetDigest: act1.transfer.fileSetDigest }
    },
    {
      act: 2, story: "STORY-122", script: "deploy/switch-rehearsal/act2-real-chain-arc.mjs",
      what: "真链 F 侧弧:活链只读,字节副本证不共 inode;副本 validate + snapshot 绿;矩阵在 A 容器缺席下取诚实形状(R1/R3 的 A 侧格记 acceptance-gate-pending,整跑不通过);副本传 VM 由 VM 引擎全量回放后删净;权威前后 head 全值不变",
      ok: act2.ok === true, steps: reasonCodes(act2),
      liveChain: act2.liveChain,
      matrixHonestShape: act2.matrixHonestShape?.summary ?? null
    },
    {
      act: 3, story: "STORY-125", script: "deploy/switch-rehearsal/act3-product-walkthrough.mjs",
      what: "真值版产品面走查:驾驶舱服务跑在 VM 上(AOS_ACTOR 显式、绑 127.0.0.1),经 ssh -L 走查;十一条模块读面逐一 200 且渲染 scratch 链投影(带红对照);安全写面四路由各一次全链路;INVALID_TRANSITION 拒绝;仪式动词 404;写入落链的同时 S113 写日志行同步出现",
      ok: act3.ok === true, steps: reasonCodes(act3),
      criteria: Object.fromEntries(Object.entries(act3.criteria).map(([key, value]) => [key, value.ok])),
      detail: "evidence/aos-s125-product-walkthrough.json"
    },
    {
      act: 4, story: "STORY-123", script: "deploy/switch-rehearsal/act4-rollback-arc.mjs",
      what: "回退演练六步:冻结(前答后拒的两侧证 + 进程组空)→ 复原基座(snapshot-verify 与 validate 双绿)→ 枚举增量(注入两条伪造行,语义漂移红路径逐条单列)→ 受治重放(逐笔经 VM 引擎动词)→ 对账(逐记录内容摘要 + 终检计数两侧相等)→ 新锚(先 knowledge-rebase 恢复锁步,再 manifest + 归档 + verify)",
      ok: act4.ok === true, steps: reasonCodes(act4),
      replayed: act4.replay.ledger.length,
      singledOut: act4.enumeration.nonReplayable.map((entry) => entry.reasonCode),
      newAnchor: act4.newAnchor,
      detail: "evidence/aos-s123-rollback-rehearsal.json"
    }
  ],
  crossActInvariants: invariants,
  redProofs: reds.map((entry) => ({
    mode: entry.receipt.redMode,
    receipt: `evidence/aos-s123-rollback-rehearsal.json#redProofs`,
    turnedRedAt: entry.receipt.steps.at(-1)?.name ?? null,
    expectedRedAt: entry.receipt.redMode === "accept-forged" ? "enumerate-delta" : "reconcile",
    ok: (entry.receipt.steps.at(-1)?.name ?? null)
      === (entry.receipt.redMode === "accept-forged" ? "enumerate-delta" : "reconcile")
      && entry.receipt.steps.at(-1)?.ok === false
  })),
  reclaimFindings: [
    {
      what: "被中断的走查在 VM 上留下 cockpit-service 与其引擎门面(端口 14318),存活约 8.5 小时",
      cause: "远端启动命令自己把输出带回来,ssh 会话通道因而不关闭,调用挂起;宿主随后杀掉整跑,而当时没有失败路径上的回收",
      fixed: "启动改为 pid 落文件 + 第二次普通调用读取,ssh 加 -n;任何失败路径都先按进程组回收再抛,并以独立残留计数复核",
      predicateNow: "reclaimVmService: 进程组杀净后 pgrep(带括号防自匹配)与监听端口两项皆为零"
    },
    {
      what: "本机 ssh -L 转发在客户端进程死后仍被 ControlMaster 持有,收尾时才在 14319 上发现监听者",
      cause: "本主机配置 ControlMaster auto + ControlPersist,客户端把转发交给 master 后立刻退出,故「没有 ssh -N -L 进程」这条判据自始至终为真——是一道恒绿门,不是一次疏漏",
      fixed: "回收改为向 master 取消转发(ssh -O cancel -L),判据改为「端口上有没有监听者」由 socket 自己回答",
      redProof: "evidence/aos-tunnel-reclaim-red-proof.json(同一时刻旧判据绿、新判据红)"
    }
  ],
  productDefectFound: {
    where: "apps/cockpit-service/src/service.ts — handleDomain",
    what: "GET /api/domain/export 永不可达:GET 首分支无条件返回,把 `export` 解成一个无 recordId 的分区名并回未限定的 annotation 列表;下方 rest === \"export\" 分支对 GET 是死代码",
    consequence: "S113 写日志没有任何 HTTP 读面(备份与回退都得绕开它直读 domain.db)",
    foundBy: "S125 走查(本弧),证据见 evidence/aos-s125-product-walkthrough.json 的 writeLogHttpReadFaceShadowed",
    status: "如实记录待立单;本弧未改产品代码"
  },
  ceremonyFindings: [
    "重放之后取新锚是两步:先 knowledge-rebase 恢复锁步(元数据写,事件流不动),再 snapshot-manifest;直接取锚会被 KNOWLEDGE_HIGH_WATER_MISMATCH 拒绝",
    "引擎的三个安全写动词没有自由文本 provenance 字段(判据取自实时 commands 名册),唯一自由文本 scope 正是对账要比的内容;故逐笔出处绑在规范化重放账本上,链上保留原始 at 与 actor",
    "被搬迁的工作区在 validate 之前必须先做 placement(引擎把工作区绑在五个绝对根路径上且无搬迁动词)——snapshot-verify 要在 placement 之前跑,validate 要在之后"
  ],
  vmEndState: {
    srvTcrnEntries: vmListing,
    rehearsalScratchRoot: scratchGone,
    // Not just this run's root: any `scratch-rehearsal-*` left behind is a
    // leak, including one an earlier interrupted run created.
    anyRehearsalScratchRemaining: vmListing.filter((entry) => entry.startsWith("scratch-rehearsal-")),
    processResidue: residue,
    expected: "引擎 + 权威副本 + backups + 镜像保留;scratch-rehearsal-* 全删;游离进程为零"
  },
  notClaimed: [
    "四幕全绿不是切换授权,也不是发布授权:MIN-007 的 owner 门另行,本弧只交付它所要求的证据形状",
    "矩阵在活分区的真实结论仍是 A_SIDE_ABSENT_DECLARED(不通过),这是 A 容器尚未实例化的如实读数,不是演练失败",
    "演练期的 VM 写面与供权是一次性的:authority 仅授三个安全写动词,随 scratch 目录一并删净",
    "语义漂移的两条伪造日志行由本演练注入并逐行标注来源,它们从未进入任何链",
    "重放后的链版本高于漂移侧是设计使然:事件只增不改,回退还原的是内容而非版本号"
  ]
};

const walkthrough = {
  schemaVersion: "aos.switch-rehearsal-walkthrough.v1",
  story: "TCRN-AOS-STORY-125",
  index: "evidence/aos-switch-rehearsal-arc.json",
  ...act3
};
const rollback = {
  schemaVersion: "aos.switch-rehearsal-rollback.v1",
  story: "TCRN-AOS-STORY-123",
  index: "evidence/aos-switch-rehearsal-arc.json",
  ...act4,
  redProofs: reds.map((entry) => ({
    mode: entry.receipt.redMode,
    what: entry.receipt.redMode === "accept-forged"
      ? "去掉引擎名册校验后,两条伪造行进入重放集 —— enumerate-delta 当场转红,证明名册校验是承重的而非装饰"
      : "扣下最后一条可重放行 —— reconcile 当场转红,证明对账是真判据而非恒真式",
    expectedRedAt: entry.receipt.redMode === "accept-forged" ? "enumerate-delta" : "reconcile",
    turnedRedAt: entry.receipt.steps.at(-1)?.name ?? null,
    failure: entry.receipt.failure ?? null,
    steps: reasonCodes(entry.receipt)
  }))
};

const outDir = join(REPO_ROOT, "evidence");
mkdirSync(outDir, { recursive: true });
const files = [
  ["aos-switch-rehearsal-arc.json", index],
  ["aos-s125-product-walkthrough.json", walkthrough],
  ["aos-s123-rollback-rehearsal.json", rollback]
];
const written = [];
for (const [name, body] of files) {
  const text = `${JSON.stringify(redact(body), null, 2)}\n`;
  // The check, not the intention: a placeholder table that stopped covering a
  // field would otherwise ship a home directory into the repository.
  const leaks = [...text.matchAll(/"[^"]*(\/Users\/|\/private\/tmp\/|\/home\/[a-z])[^"]*"/gu)]
    .map((match) => match[0]);
  if (leaks.length > 0) {
    throw new Error(`evidence ${name} still carries local absolute paths: ${leaks.slice(0, 3).join(" | ")}`);
  }
  writeFileSync(join(outDir, name), text);
  written.push({ file: `evidence/${name}`, bytes: text.length });
}
console.log(JSON.stringify({
  ok: index.acts.every((act) => act.ok)
    && Object.values(invariants).every((entry) => entry.ok)
    && index.redProofs.every((entry) => entry.ok),
  written,
  invariants: Object.fromEntries(Object.entries(invariants).map(([key, value]) => [key, value.ok])),
  vmEndState: index.vmEndState
}, null, 2));
