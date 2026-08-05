#!/usr/bin/env node
// TCRN-AOS-STORY-127 — switchover ceremony receipt.
//
// This run did NOT switch over. It froze the local partition, took the terminal
// paired anchor, and then stopped at the migration step with a red proof: the
// migration as ruled (byte-for-byte, 五件套原样) produces a control tree the VM
// engine refuses to read at all. The receipt records exactly that, and no more.
//
// The receipt carries no authorization. It is evidence of what was observed;
// the decision it asks for belongs to the Owner.
//
// Host paths are scrubbed through the repository's own scrubber (INC-037), so
// the engine's own refusal message — which quotes a local absolute path — lands
// as a placeholder without losing its meaning.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const out = resolve(repoRoot, "evidence", "aos-switchover-proof.json");

const receipt = {
  schemaVersion: "aos.switchover-proof.v1",
  story: "TCRN-AOS-STORY-127",
  ruling: "TCRN-AOS-MIN-007 (D3 O1 部署位面切换 / D4 pins / D7 访问边界) + TCRN-AOS-MIN-010",
  gate: "TCRN-AOS-GATE-001 satisfied (chain v738)",
  generatedAt: "2026-07-29T04:47:00Z",

  outcome: {
    switchedOver: false,
    stoppedAtStep: 3,
    reasonCode: "MIGRATION_BLOCKED_NO_GOVERNED_PLACEMENT",
    truthStillAt: "local",
    verdict:
      "步 1-2 绿并已落证;步 3 红——按裁定的逐字节迁移产出一个 VM 引擎完全读不了的控制树。"
      + "步 4-6 未执行。本机仍是唯一真值,且经 validate 证明完好。",
  },

  // This receipt carries no authorization. It records observations only; it
  // grants no switchover, no migration, and no release.
  carriesNoAuthorization:
    "本证物不含授权——它只记录观测,不批准切换、迁移或发布。",

  steps: [
    {
      n: 1,
      name: "freeze",
      ok: true,
      declaration:
        "本会话声明为本机 AOS 链的唯一写者;仪式期间不运行 cockpit:data / build-mirror / 镜像 rsync。",
      chainHeadAtFreeze: {
        headEventHash: "837aa60dc0d639e49d3b2f92c8111ea1766eb5616feebcdc9ede8e40a95b8638",
        version: 742,
        workspaceId: "workspace:fbc32e3ff874fbbd637a1b85",
      },
      soleWriterEvidence: {
        leaseHeld: false,
        leaseReasonCode: "WORKSPACE_LEASE_OBSERVED",
        localCron: "none",
        localLaunchdTcrnJobs: 0,
        vmCron: "none",
        vmSystemdTimers: 0,
        headStableOverObservationWindow: true,
        note:
          "链头在约 7 分钟的观测窗内全值不变;窗口起点之前最近一次写入为 seq 742 "
          + "(occurredAt 2026-07-29T04:32:19Z),即编排方为本 Story 写下的 scope 注解。",
      },
      mirrorFreeze: {
        frozen: true,
        asOf: "2026-07-28T11:28:03Z",
        aosChainVersionReflected: 535,
        deployedAt: "2026-07-28T11:30:16Z",
        deployedSetDigest: "e9dc6f1eb300e103184a12ed57073f0300ccc3752feb21e8040acc42d35e164f",
        deployedFileCount: 16,
        note:
          "镜像无调度器——它只在有人跑 cockpit:data + build-mirror + rsync 时才动,"
          + "因此冻结即「不跑」。as-of 取自 cockpit-data.generated.ts 的 generatedAt。",
      },
    },
    {
      n: 2,
      name: "terminal-anchor",
      ok: true,
      lockstepRemedy: {
        required: true,
        verb: "knowledge-rebase",
        reasonCodeBefore: "KNOWLEDGE_HIGH_WATER_MISMATCH",
        reasonCodeAfter: "KNOWLEDGE_STORE_REBASED",
        knowledgeVersion: { before: 10, after: 11 },
        retired: 0,
        offenders: [],
        eventStreamUnmoved: {
          headBefore: "837aa60dc0d639e49d3b2f92c8111ea1766eb5616feebcdc9ede8e40a95b8638",
          headAfter: "837aa60dc0d639e49d3b2f92c8111ea1766eb5616feebcdc9ede8e40a95b8638",
          versionBefore: 742,
          versionAfter: 742,
          equal: true,
        },
        readBeforeRunning:
          "先读引擎源码确认 knowledge-rebase 只写知识库 store/metadata/index,"
          + "把 marker 的 eventHighWaterDigest 追平到当前链头,不向事件链追加任何事件;"
          + "未传 --retire-invalid(那会退休知识单元,属超出追平的语义改动)。",
      },
      pairedAnchor: {
        pairedAt: "2026-07-29T04:43:05Z",
        ok: true,
        chainReasonCode: "SNAPSHOT_VERIFIED",
        chainHeadEventHash: "837aa60dc0d639e49d3b2f92c8111ea1766eb5616feebcdc9ede8e40a95b8638",
        chainVersion: 742,
        chainManifestDigest: "f3576b3e41729b5de713c886ad9ea693e780971d3517b5a7b81250723c124837",
        domainSnapshotDigest: "4d276b91f2d8890af54c4b104e61a953933ee3526bcd12e335587ca80829cee0",
        domainExportDigest: "08ac87e6f39d3eba83b1a95389054a05d17b71d89039c53aa5ca6614d15e652b",
        attestationSetDigest: "03711e902ff69dce5b2f1bbb0480d61abc4b4f80bf630dbf5b831550144df5d4",
        attestationCount: 537,
        orphanReceipts: 0,
        filenameMismatches: 0,
        domainIntegrityCheck: "ok",
        mutualDigests: true,
      },
    },
    {
      n: 3,
      name: "migrate",
      ok: false,
      reasonCode: "MIGRATION_BLOCKED_NO_GOVERNED_PLACEMENT",
      filesystemProbe: {
        ok: true,
        target: "/srv/tcrn/governance",
        dfType: "ext4",
        statfsMagic: "ef53",
        inEnginePinnedSet: true,
        engineAuthoritativeProbe: {
          verb: "init",
          reasonCode: "WORKSPACE_COMMAND_COMPLETED",
          meaning:
            "判据是引擎自己的回答而非我方对 magic 表的分类:引擎在该文件系统上真的建成了一个"
            + "一次性工作区,随后删除并验证删净。",
        },
      },
      transfer: {
        performed: true,
        disposition: "probe only — copied, proven, refused by the VM engine, then deleted",
        byteIdentity: {
          "workspace.json": {
            local: "60b413be9642b31b8327356a3cf52f409bedc7b2ad5344a407ed482a5aba602f",
            vm: "60b413be9642b31b8327356a3cf52f409bedc7b2ad5344a407ed482a5aba602f",
            equal: true,
          },
          note:
            "传输本身没有问题——字节到得了。挡住迁移的不是传输,是引擎的根身份契约。",
        },
      },
      redProof: {
        what:
          "把与本机逐字节相同的控制树放到 VM 上,用 VM 自己的引擎读它。",
        verbsTried: ["status", "validate", "snapshot-manifest"],
        allRefusedWith: "WORKSPACE_SCHEMA_INVALID",
        engineMessage:
          "~/.tcrn-workflow/tcrn-workflow does not resolve to a directory",
        meaning:
          "逐字节迁移产出的不是「一条还没接线的链」,而是一条 VM 引擎连读都读不了的链。"
          + "三个只读动词全数拒绝。",
      },
      rootCause: {
        statement:
          "引擎把工作区绑定到 workspace.json 里五个绝对根路径,而 workspace.json 正是"
          + "「五件套原样」要求逐字节保留的那个文件。",
        boundRoots: 5,
        identityCheck:
          "resolveWorkspace 逐项比对 kind/path/canonicalPath/portableIdentity,"
          + "且要求每个根在活文件系统上真实存在、非符号链接、realpath 等于自身。"
          + "比对是纯词法的(portableIdentity = normalize + NFC + 小写),不绑 device/inode。",
        engineDoctrine:
          "引擎自己的 backup-restore-runbook 第一条教义:同路径唯一(same-path-only)。"
          + "换路径或换机器需要 migration apply 通路,V1 没有——"
          + "WORKSPACE_MIGRATION_APPLY_UNAVAILABLE,按 OD-29 明确不在 V1 范围内。",
        rehearsalAlreadyNamedIt:
          "deploy/switch-rehearsal/rehearsal-lib.mjs 的 placement 注释把这条写成了"
          + "「本次演练的具名发现,而非顺手之举」,并明说:真正的切换仪式需要一个受治的"
          + "placement 步骤(或动词);演练只在一次性副本上做这件事。那个受治步骤至今不存在。",
      },
      waysForwardBothUnruled: [
        {
          option: "A",
          name: "改写 workspace.json 的五个根(演练里的 placement)",
          preservesBytes: false,
          blockedBy:
            "与裁定「五件套原样、不改一个字节」直接冲突;且控制树只有引擎能写——"
            + "用脚本改写它正是平台公约点名会让整条链 fail-closed 的那种写法。"
            + "演练能这么做是因为对象是一次性副本;对真值这么做是对权威的一次未受治写入。",
        },
        {
          option: "B",
          name: "在 VM 上复刻本机的绝对路径布局,让存储的根解析得开",
          preservesBytes: true,
          technicallyViable: true,
          blockedBy:
            "身份校验是纯词法的,所以技术上可行;但这会把本机 home 目录布局永久烙进 VM 的"
            + "真值根,而 V1 既无 rebind 通路,这个选择就没有任何受治手段可以撤回。"
            + "真值根也就不在 /srv/tcrn 下了,与 D4 及 vm-operator-bundle.md 的路径预设相左。",
        },
      ],
      whyThisIsAStop:
        "两条路都是「无既有裁定支撑的不可逆方向变更」——正是常设停顿预算里三类必停的第三类。"
        + "在本 Initiative 唯一一次真正搬动真值的操作上,这个选择不该由执行方替 Owner 做。",
    },
    { n: 4, name: "dual-side-verification", ok: null, executed: false, reason: "步 3 红,未执行" },
    { n: 5, name: "write-surface-switchover", ok: null, executed: false, reason: "步 3 红,未执行" },
    { n: 6, name: "demote-and-new-anchor", ok: null, executed: false, reason: "步 3 红,未执行" },
  ],

  engineVersionDrift: {
    severity: "must-decide-before-any-retry",
    localGovernedCopy: "0.8.0",
    localGovernedCopyTag: "v0.8.0",
    checkedOutAt: "2026-07-29T03:25:15Z",
    trustedHelperPins: "v0.7.0",
    trustedHelperCandidate: "v0.1.0-candidate.29",
    installedCopyMarkerVersion: "v0.7.0",
    installedCopyMarkerVerifiedAt: "2026-07-27T23:54:53Z",
    vmEngine: "0.7.0",
    deployManifestRequires: "0.7.0",
    finding:
      "本机受治副本今天 11:25(+0800)被 checkout 到 v0.8.0,而信任链(helper candidate.29 与"
      + "已验证安装副本标记)钉的是 v0.7.0,且没有对应的 helper 重钉。链上最近四个事件"
      + "(seq 739-742,今日 11:50-12:32 写入)因此是由一个信任链不为其背书的引擎副本写下的。",
    notClaimed:
      "未主张这些事件有问题——事件 schemaVersion 仍是 tcrn.event.v1,0.7.0→0.8.0 的改动只是"
      + "读面分页(INC-027)。这里主张的只有一件事:「受治引擎随迁」在今天有两个互相矛盾的答案,"
      + "而哪一个才是受治引擎,须在重试之前定下来。",
  },

  ironRuleHeld: {
    statement: "拷贝后验证再降级,永不先删;任何时候至少有一份可验证的完整真值。",
    localStillAuthoritative: true,
    localValidateAfterEverything: {
      reasonCode: "WORKSPACE_COMMAND_COMPLETED",
      headEventHash: "837aa60dc0d639e49d3b2f92c8111ea1766eb5616feebcdc9ede8e40a95b8638",
      version: 742,
    },
    localControlTreeDemoted: false,
    localArchiveMarkerWritten: false,
    mutatingVerbsRunAgainstLocalChain: ["knowledge-rebase"],
    mutatingVerbsNote:
      "仅此一个,即简报点名允许的那个;它不向事件链追加事件,前后链头全值相等已记于步 2。",
  },

  residue: {
    vmProbeRemoved: true,
    vmProbeRemovalVerified: true,
    vmStatfsProbeRemoved: true,
    vmGovernanceDirRestoredToPriorState: true,
    vmEngineProcessResidue: 0,
    vmCockpitProcessResidue: 0,
    backgroundLoadsStarted: 0,
    note:
      "VM 上除仪式前既有的 gate-identity-authority.json 外没有留下任何东西;"
      + "本 Story 未起任何后台负载,故无进程组需要回收。",
  },

  notClaimed: [
    "未主张切换成功——本次没有切换。",
    "未主张 VM 上存在可写的真值链——VM 上现在没有任何 AOS 链。",
    "未主张仪式写通路可用——步 5 从未执行,pins 未重签,cockpit 未起。",
    "未主张一致性矩阵在切换后仍绿——矩阵未重跑,因为没有切换后的状态可跑。",
    "未主张 v0.7.0 能读本机这条链——只证了它读不了一份根未改写的逐字节副本;"
      + "根改写之后能不能读,没测,因为改写本身就是待裁的那件事。",
  ],
};

const text = scrubHostPaths(JSON.stringify(receipt, null, 2));
writeFileSync(out, `${text}\n`);
process.stderr.write(`wrote ${out.slice(out.lastIndexOf("/TCRN-AOS/") + 1)}\n`);
