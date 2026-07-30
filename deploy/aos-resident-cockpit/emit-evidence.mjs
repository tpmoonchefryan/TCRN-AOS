#!/usr/bin/env node
// Assemble evidence/aos-vm-resident-cockpit.json from the three recipes' receipts.
//
// It reads state written by apply.mjs, migrate-domain-store.mjs, tripwire.mjs and
// walkthrough.mjs, adds the few readings that are only meaningful at emit time
// (the deployment as it stands right now, and a fresh both-hosts comparison of
// the precious store against its archive), and writes one document.
//
// Two rules it holds:
//   - no machine-local absolute path reaches the file. Everything goes through
//     scrubHostPaths, and the result is scanned again before writing
//     (TCRN-AOS-INC-037, and the hygiene gate in the test roster);
//   - nothing is invented. A reading that is not available is recorded as absent,
//     with why.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import {
  ACTOR, PARTITION_ID, PORT, UNIT_NAME, UNIT_PATH, VM_ATTEST_DIR, VM_AUTHORITY_DIR,
  VM_DOMAIN_DB, VM_ENGINE, VM_HOST, VM_ROOT, VM_RUNTIME, VM_WORKSPACE
} from "./manifest.mjs";
import { judgeLoopbackBind } from "./resident-predicates.mjs";
import { STATE_DIR, instant, loadState, sha256File, shellQuote, ssh } from "./resident-lib.mjs";
import { findHostPaths, scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(REPO_ROOT, "evidence/aos-vm-resident-cockpit.json");
const LOCAL_ARCHIVE = process.env.AOS_DOMAIN_DB ?? resolve(homedir(), ".tcrn-aos/domain.db");
const ARCHIVE_SENTINEL = join(dirname(LOCAL_ARCHIVE), "RELOCATED-TO-VM.json");

const state = (name) => existsSync(join(STATE_DIR, `${name}.json`)) ? loadState(name) : null;
const apply = state("apply");
const domain = state("domain-migration");
const tripwire = state("tripwire");
const walkthrough = state("walkthrough");
const missing = Object.entries({ apply, domain, tripwire, walkthrough })
  .filter(([, value]) => value === null).map(([key]) => key);
if (missing.length > 0) {
  throw new Error(`no receipt for: ${missing.join(", ")} — run those recipes before emitting`);
}

const stepOf = (receipt, name) => receipt.steps.find((entry) => entry.name === name) ?? null;

/* ---- readings only meaningful now --------------------------------------- */

const unitShown = Object.fromEntries(
  (await ssh(["systemctl", "show", "-p",
    "ActiveState,SubState,UnitFileState,MainPID,ExecMainStartTimestamp,NRestarts", UNIT_NAME]))
    .stdout.trim().split("\n").map((line) => line.trim()).filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const bindNow = judgeLoopbackBind((await ssh(["ss", "-ltnH"])).stdout, { port: PORT });
const healthNow = JSON.parse(
  (await ssh(["curl", "-s", "-m", "3", `http://127.0.0.1:${PORT}/api/health`])).stdout);
const chainNow = JSON.parse((await ssh([["node", `${VM_ENGINE}/scripts/tcrn-workflow.mjs`,
  "status", "--workspace", VM_WORKSPACE].map(shellQuote).join(" ")])).stdout);
const attestNow = Number.parseInt(
  (await ssh([`ls -1 ${shellQuote(VM_ATTEST_DIR)} | wc -l`])).stdout.trim(), 10);
const authorityModesNow = (await ssh([["stat", "-c", "%a %n",
  `${VM_AUTHORITY_DIR}/operator-authority.json`, `${VM_AUTHORITY_DIR}/operator-authority-pins.json`]
  .map(shellQuote).join(" ")])).stdout.trim().split("\n");
// Boot persistence read as the artifact, not as systemd's summary word: "enabled"
// is systemctl describing itself, while the WantedBy symlink is the thing that
// actually makes the machine start this unit at boot.
const bootLink = await ssh(["ls", "-l", `/etc/systemd/system/multi-user.target.wants/${UNIT_NAME}`],
  { allowFailure: true });

// The precious store, compared right now against its archive, each side digesting
// its own bytes with its own tool. The transfer-time receipt was overwritten by a
// later verify-mode run of the same recipe (stated in honestNotes), so this is a
// live re-derivation rather than a quoted one.
const archiveSha = existsSync(LOCAL_ARCHIVE) ? sha256File(LOCAL_ARCHIVE) : null;
const liveStoreSha = (await ssh(["sha256sum", VM_DOMAIN_DB])).stdout.trim().split(/\s+/u)[0];
const sentinel = existsSync(ARCHIVE_SENTINEL)
  ? JSON.parse(await readFile(ARCHIVE_SENTINEL, "utf8")) : null;

// The archive guard, exercised here rather than quoted: start the local cockpit
// with no AOS_DOMAIN_DB and the sentinel present, and it must refuse. Cheap,
// local, and it starts nothing — a refusal that has never been observed is a
// comment, not a guard.
const guardDrill = await new Promise((done) => {
  const child = spawn(process.execPath, [join(REPO_ROOT, "scripts/cockpit-service-start.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, AOS_ACTOR: "agent:evidence-drill", AOS_DOMAIN_DB: undefined },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let text = "";
  child.stdout.on("data", (chunk) => { text += chunk; });
  child.stderr.on("data", (chunk) => { text += chunk; });
  child.on("close", (code) => {
    let parsed = null;
    try { parsed = JSON.parse(text.trim()); } catch { parsed = null; }
    done({
      exitCode: code,
      refused: code === 1 && parsed?.ok === false,
      error: parsed?.error ?? text.trim().slice(0, 300),
      remedies: parsed?.remedies ?? null
    });
  });
});

// The red control, re-derived here with a corrected version-mark extraction. The
// walkthrough's gating claim was right; the number it printed beside that claim
// came from a naive /v(\d+)/ over a 400 KB document and read "v1".
const committedRender = await import(pathToFileURL(resolve(REPO_ROOT, "dist/apps/web/src/app.js")).href);
const committedBody = committedRender.renderAosShellHtml({ path: "/work-items" });
const committedVersionMarks = [...new Set(committedBody.match(/\bv\d{2,}\b/gu) ?? [])].sort();
const walkVersionMark = `v${walkthrough.steps.find((entry) => entry.name === "eleven-modules")?.liveVersionMark
  ?.replace(/^v/u, "") ?? "?"}`;

/* ---- the document ------------------------------------------------------- */

const receipt = {
  schemaVersion: "aos.vm-resident-cockpit.v1",
  story: "TCRN-AOS-STORY-132",
  ruling: "Owner:座舱常驻(A 模式的核心即此 UI);拓扑=STORY-131 迁置后的 VM 真值根;"
    + "访问形态=CONF-007 D7;pins 重签=MIN-007 D4 既有条款;写面=MIN-007 安全写面三动词",
  authorization: "本证物不含授权。它记录一次已裁定方向下的常驻部署与走查,不构成任何发布、切换、"
    + "其余分区迁置或供权扩张的许可。",
  emittedAt: instant(),
  summary: "AOS 域库已随迁至 VM(归档留本机未删),cockpit-service 以 systemd 单元 "
    + "tcrn-aos-cockpit 在 VM 常驻并开机自启,绑 127.0.0.1、AOS_ACTOR 显式、pins 已按 VM 路径重签;"
    + "绊线判据随之迁至 VM 侧并对真部署造红一次(红窗内 LAN 确实到达,复原经全值摘要证明);"
    + "十一模块读面经 ssh -L 全部 200 且渲染 VM 真链数据,安全写面四路由各一次全链路落真链并回读,"
    + "INVALID_TRANSITION 与仪式动词 404 两个拒绝证据俱在,S113 写日志与时间见证收据同步出现。",

  deployment: {
    host: VM_HOST,
    unit: { name: UNIT_NAME, path: UNIT_PATH },
    root: VM_ROOT,
    runtime: VM_RUNTIME,
    domainStore: VM_DOMAIN_DB,
    authority: VM_AUTHORITY_DIR,
    engine: VM_ENGINE,
    workspace: VM_WORKSPACE,
    attestSidecar: VM_ATTEST_DIR,
    boundTo: `127.0.0.1:${PORT}`,
    actor: ACTOR,
    partitionsWritable: [PARTITION_ID],
    stateAtEmit: {
      activeState: unitShown.ActiveState,
      subState: unitShown.SubState,
      unitFileState: unitShown.UnitFileState,
      mainPid: Number.parseInt(unitShown.MainPID, 10) || null,
      startedAt: unitShown.ExecMainStartTimestamp,
      restarts: Number.parseInt(unitShown.NRestarts, 10),
      startsAtBoot: {
        unitFileState: unitShown.UnitFileState,
        wantedBySymlink: bootLink.code === 0 ? bootLink.stdout.trim() : null,
        symlinkPresent: bootLink.code === 0,
        notClaimed: "开机自启由 WantedBy 符号链接与 enabled 状态两处证实;本次没有真的重启这台机器"
      },
      observability: `journalctl -u ${UNIT_NAME}`,
      health: healthNow,
      boundAddress: bindNow.boundAddress,
      chain: {
        workspaceId: chainNow.workspaceId, version: chainNow.version,
        headEventHash: chainNow.headEventHash, work: chainNow.work
      },
      attestationReceipts: attestNow,
      authorityModes: authorityModesNow
    },
    declarativeSources: {
      manifest: "deploy/aos-resident-cockpit/manifest.mjs — 唯一路径与环境来源",
      unit: `deploy/aos-resident-cockpit/${UNIT_NAME} — 由 emit-unit.mjs 渲染并入仓`,
      runner: "deploy/aos-resident-cockpit/vm-resident-runner.mjs",
      recipe: "deploy/aos-resident-cockpit/apply.mjs",
      readme: "deploy/aos-resident-cockpit/README.md(部署时同时落到 VM 的 DEPLOYMENT.md)"
    }
  },

  domainStoreMigration: {
    ...domain,
    liveByteComparisonAtEmit: {
      archiveOnThisMachine: archiveSha,
      liveOnTheVm: liveStoreSha,
      equal: archiveSha === liveStoreSha,
      note: "迁置至今若无域写入,两侧仍逐字节相等;有写入则活库必然领先——本字段是观测,不是判据。"
        + "判据见上方 archive-still-retained-in-the-live-store(包含关系 + 追加表旧行逐字未变 + 活库两读者互证)"
    },
    archiveDisposition: {
      deleted: false,
      keptAt: "<local-home>/.tcrn-aos/domain.db",
      sentinel: sentinel,
      guard: "scripts/cockpit-service-start.mjs 见到 RELOCATED-TO-VM.json 即拒绝以默认路径启动;"
        + "显式 AOS_DOMAIN_DB 仍可用——这是对默认值的护栏,不是对文件的锁",
      guardDrillAtEmit: {
        ...guardDrill,
        otherSideObserved: "以显式 AOS_DOMAIN_DB 指向一份一次性 store 时服务照常启动并绑 127.0.0.1,"
          + "随后按进程组回收、端口无监听者复核为零——两侧都看过,门不是恒真的"
      }
    }
  },

  systemdUnit: {
    installed: stepOf(apply, "unit-installed"),
    enabledAndActive: stepOf(apply, "unit-enabled-and-active"),
    threeWayByteCheck: "仓内副本 / 本次渲染 / 机器上安装的三份逐字节相等;emit-unit.mjs 与 apply.mjs "
      + "分开正是为此——同一次运行里既写又判的判据只会恒绿",
    refusesWithoutActor: "vm-resident-runner.mjs 对九个必需环境值逐一检查,缺一即拒启并列名(STORY-112 的推广)",
    runsAsRoot: "因 /srv/tcrn/governance 为 0700 root:root(迁置仪式所置);改所有权属真值根围栏的裁定,"
      + "不是部署配方顺手可做的事"
  },

  pinsResigning: {
    ...stepOf(apply, "pins-resigned-for-the-vm-path"),
    placed: stepOf(apply, "authority-placed")
  },

  tripwire: {
    ...tripwire,
    stateAtEmit: bindNow
  },

  walkthrough: {
    ...walkthrough,
    redControlRederivedAtEmit: {
      why: "走查记录的门控判据(页面是否带有 VM 引擎此刻报的链版本)是对的;它旁边打印的版本号"
        + "取自一个朴素的 /v(\\d+)/,在 400KB 文档里匹配到的是别处的「v1」。此处以修正后的提取重新求值",
      liveVersionMarkAtWalkthrough: walkVersionMark,
      committedDocumentVersionMarks: committedVersionMarks,
      committedDocumentCarriesTheLiveMark: committedVersionMarks.includes(walkVersionMark),
      renderer: "同一个 renderAosShellHtml,数据换成仓内既有 cockpit 数据"
    }
  },

  instrumentsReused: {
    from: "deploy/switch-rehearsal/(MIN-011 退役切换方向、器材转用途继续服役)",
    imported: ["rehearsal-lib.mjs 的 ssh / sshNode / rsync / 双向 ledger / tunnel 回收",
      "rehearsal-predicates.mjs 的 judgeRouteView / rendersPartition / viewOf"],
    why: "复制一份会在任一侧被修好时立刻漂移,而那些函数里带着已经付过学费的教训"
      + "(ssh -n 与后台命令、pgrep 自匹配、ControlMaster 持有转发)"
  },

  repositoryChanges: {
    "apps/cockpit-service/src/service.ts":
      "新增 attestDir 选项并透传给安全写面;/api/health 增 attestationReceiptsEnabled。"
      + "此前本服务对真链的每一笔写入都没有时间见证收据——这是缺口而非决定,平台在 INIT-001 已采用 attest-dir 时间见证",
    "apps/cockpit-service/test/service.test.mjs": "新增该判据的两侧(配置则每笔写入带 attest-dir,不配置则一定不带);已造红一次",
    "scripts/cockpit-service-start.mjs": "见到归档哨兵即拒绝以默认路径启动",
    "scripts/lib/cockpit-data-aggregate.mjs": "从 build-cockpit-data.mjs 抽出的聚合与生成模块渲染,两个调用方共用",
    "scripts/lib/remote-partition-projection.mjs": "在持有链的那台机器上投影一个分区,只有投影本身跨网",
    "scripts/build-cockpit-data.mjs": "AOS 分区改由 VM 投影(本机那条地址已 vacated);输出路径可经 AOS_COCKPIT_DATA_OUT 指定",
    "deploy/aos-resident-cockpit/*": "清单、单元、运行器、四条配方、纯判据与其测试",
    "package.json": "resident-predicates.test.mjs 入测试名册"
  },

  notClaimed: [
    "本文不含任何发布、切换或其余分区迁置的授权",
    "座舱页面数据是部署时投影的,不是实时的;走查的四笔写入之后页面版本已落后于链",
    "留在本机的三个分区从 VM 不可写(写面答 UNKNOWN_PARTITION);它们的数据仍可读,因读面由四个投影合成",
    "仪式动词不在 HTTP 面上;即便有路由,VM 供权只授三个写动词,仍会被 OPERATOR_AUTHORITY_COMMAND_NOT_GRANTED 拒绝",
    "本次未取得 INSTALLED_COPY_VALIDATED(见 honestNotes),与前两次会话同一缺口",
    "attest 收据与事件数 1:1 是本次观测,不是本文断言的引擎契约"
  ],

  risks: [
    "红窗暴露:绊线造红期间(约 1 秒)写面确实绑在 0.0.0.0 且 LAN 可达,该进程持有供权 pins。"
      + "已记录窗口时长与复原摘要;更安全的替代(改绑 127.0.0.2 同样转红且零暴露)已写入配方注释",
    "unit 以 root 运行:被攻破的座舱进程即拥有真值根的完整读写。围栏是 loopback 绑定与 ssh 隧道,不是权限降级",
    "座舱页面数据在部署时冻结,链继续前进;运营者看到的版本号会越来越旧,直到有人重跑 apply。"
      + "目前没有定时刷新,也没有告警",
    "本机 domain.db 仍是可写的文件,只是默认路径被哨兵拦住;显式 AOS_DOMAIN_DB 仍能在归档上写出分叉",
    "apply 的 rsync --delete 覆盖 runtime/;域库在 data/ 之外故安全,但任何将来放进 runtime/ 的数据都会被删",
    "走查在真链上永久留下两条记录(SUBTASK-320 首次尝试被引擎正确拒绝、SUBTASK-321 完整通过);链只追加"
  ],

  honestNotes: [
    "我没有取得 INSTALLED_COPY_VALIDATED。受信 bootstrap 的 verify-installed-copy 本次未跑——"
      + "前一次会话已如实记录它的三种失败形态(=分隔符 INVOCATION_INVALID、引擎目录 INPUT_TOO_LARGE、live/ 目录 "
      + "IDENTITY_MISMATCH),我没有把预算花在第三次撞同一面墙上。我有的更弱:VM 引擎 package.json 报 0.9.0,"
      + "与链迁置时所用版本相符。这是版本核对,不是身份验证。这已是连续第三次会话缺它",
    "第一次走查在真链上留下了一条半成品记录。TCRN-AOS-SUBTASK-320 建成、转 ready、enrol 成功,annotate 被引擎以 "
      + "WORKSPACE_INPUT_INVALID「注解不改变任何顾问字段」拒绝——因为我把整段 scope 当标题传了,随后的 annotate "
      + "逐字相同。引擎拒得对,是我的走查形状错了。链只追加,那条记录留着,并在本文与 SUBTASK-321 的 scope 里都写明了它是什么",
    "域库复核判据我第一版写错了方向。写成「归档与活库相等」,于是它在座舱第一次成功写入后立刻转红,"
      + "把一个正常工作的部署报成分叉。迁置承诺的是「没丢」而不是「相等」;改为包含关系判据(可变行按身份、"
      + "追加表按全值),并把这次转红当作它自己的红证记下",
    "迁置那一次(transfer 模式)的收据被后来同一配方的 verify 模式运行覆盖了——两者写同一个 state 文件名。"
      + "字节相等的证据因此不是从当时的收据里引来的,而是现在重新在两台机器上各自计算后比较的(见 "
      + "domainStoreMigration.liveByteComparisonAtEmit),外加哨兵里记下的迁置时摘要。这比原本该有的弱一档,如实说明",
    "两次靠 systemd 与 ss 的输出格式栽了跟头,都不是链的问题:systemctl show 按它自己的顺序返回属性(不是我问的顺序),"
      + "位置解析把 UnitFileState 读成了 MainPID,把一个绿部署判成红;远端 node - 收程序时不能带 ssh -n,"
      + "否则 stdin 指向 /dev/null、程序根本没到,而退出码是 0、报错是「JSON 意外结束」。两处都改成不会被误读的形状后重跑",
    "attest 收据与事件数 1:1 是我观测到的(+5 对 +5),不是我读过源码确认的引擎契约。判据只钉「收据确实增长」——"
      + "那是 AOS_ATTEST_DIR 真的到达引擎的充分证明;比例作为观测记录",
    "enrol 的 sprint 顾问指向 cross 分区一列已 done 的发布列车。AOS 分区自身没有 Release 记录,"
      + "而 advisory:sprint 只校验形状不校验存在性——我拒绝了「在真链上顺手造一条 Release」这个更方便的选项,"
      + "因为那是没人要求的计划结构。指向一列真实存在但已收官的列车,是我能找到的最不失真的选择,并已在记录里写明它不是排期决定",
    "十一模块的读面判据不是「页面里有 AOS 字样」——仓内既有数据同样有。判据是「渲染的是 VM 引擎此刻报的链版本」,"
      + "红控用同一渲染器换仓内数据证明这两侧确实可以不同。但红控的版本号字段我第一版取错了(朴素正则命中文档里别处的 v1),"
      + "门控判据未受影响,数字在本文中已重新求值",
    "本机三个分区全程只读:build-cockpit-data 对它们只跑投影读取,没有任何写入动词。VM 上只跑了必要的受治动词——"
      + "status、work-list、work-show 三个读动词,加上经安全写面的四条写路由",
    "我在仓内建了一个目录,虽然铁律禁止。验证归档护栏的另一侧时环境变量没传进子进程,AOS_DOMAIN_DB 成了字符串 "
      + "\"undefined/guardprobe.db\",服务照相对路径在仓根建了 undefined/ 并把探针库写在里面。已删净并核实;"
      + "记在这里因为它是违规,不是小事——路径来自变量时,变量没值也会算出一个看起来正常的路径",
    "两条判据是我先造红再采信的:attest-dir 判据(把 dist 里的透传去掉,work-create 立刻见红,原样复原后转绿)"
      + "与归档护栏(默认路径见哨兵即拒,exit 1;显式给 store 则照常启动并已按进程组回收)。"
      + "绊线的红是对 VM 上真部署做的,不是对测试进程",
    "没有提交任何东西。仓内改动全部未提交,按指示留给主线程统一提交;任何仓里都没有新建 worktree 或目录(deploy 下的新目录是交付物本身)"
  ],

  evidenceFiles: [
    "evidence/aos-vm-resident-cockpit.json(本文)",
    "evidence/aos-domain-backup.json(迁前保险的收据,由 scripts/domain-backup.mjs 重写)"
  ],

  vmState: {
    residentProcesses: null,
    temporaryProcessesReclaimed: null
  }
};

/* ---- reclaim accounting, then write ------------------------------------ */

// The resident unit and the engine facade it spawned are ASSETS: something owns
// the record of them (the unit file). What must be zero is anything this session
// started. The pattern carries a bracket class so the pgrep command line cannot
// match itself — a residue check that counts itself never reaches zero.
const residue = await ssh([
  "sh -c 'echo runner=$(pgrep -c -f \"vm-resident-runn[e]r\"); "
  + "echo facades=$(pgrep -c -f \"tcrn-workflow-mc[p]\"); "
  + "echo scratch=$(ls -1d /srv/tcrn/scratch-* 2>/dev/null | wc -l)'"
], { allowFailure: true });
const residueLines = Object.fromEntries(residue.stdout.trim().split("\n")
  .map((line) => line.trim().split("=")).filter((pair) => pair.length === 2));
receipt.vmState = {
  residentProcesses: {
    runner: Number.parseInt(residueLines.runner, 10),
    engineFacades: Number.parseInt(residueLines.facades, 10),
    owned: `both are the unit's own; the record that owns them is ${UNIT_PATH}`
  },
  temporaryProcessesReclaimed: {
    sshTunnel: walkthrough.tunnelReclaim,
    vmScratchDirectories: Number.parseInt(residueLines.scratch, 10),
    predicate: "常驻进程有登记即为资产,只有无人认领的才是泄漏;本次临时负载只有一条 ssh -L,已在 master 处取消并以端口无监听者证实"
  },
  serviceLeftRunning: true,
  why: "它是交付物"
};

const scrubbed = scrubHostPaths(receipt);
let text = `${JSON.stringify(scrubbed, null, 2)}\n`;
const hits = findHostPaths(text);
if (hits.length > 0) {
  throw new Error(`host paths survived scrubbing: ${JSON.stringify(hits.slice(0, 5))}`);
}
mkdirSync(dirname(OUT), { recursive: true });
await writeFile(OUT, text);
console.log(JSON.stringify({
  ok: true,
  out: "evidence/aos-vm-resident-cockpit.json",
  bytes: Buffer.byteLength(text),
  sha256: createHash("sha256").update(text).digest("hex"),
  hostPathHits: hits.length,
  unit: `${unitShown.ActiveState}/${unitShown.SubState}/${unitShown.UnitFileState}`,
  boundAddress: bindNow.boundAddress,
  chainVersion: chainNow.version
}, null, 2));
