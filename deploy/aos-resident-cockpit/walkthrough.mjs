#!/usr/bin/env node
// TCRN-AOS-STORY-132 — the product walkthrough against the resident cockpit,
// in the topology that now exists: the service is a systemd unit on the VM, the
// chain it reads and writes is the relocated truth root on that same host, the
// precious store is the one migrated there, and this machine reaches all of it
// through `ssh -L` and nothing else (CONF-007 D7).
//
// It writes to the REAL chain. That is the point, and it is why the record it
// creates is deliberate: one Subtask under TCRN-AOS-STORY-132 — the story this
// walkthrough belongs to — moved once, annotated with what it is, and enrolled
// once. Nothing is deleted afterwards, because the chain is append-only and
// pretending otherwise would be theatre. The precedent is
// scripts/write-surface-live-proof.mjs, which did the same thing for the write
// surface when it was new.
//
// The read half is judged, not sampled. Each of the eleven modules must render
// ITS OWN view (a route that fell back to the shell answers with SOME view, so
// "a view rendered" is satisfied by the failure this exists to catch) from THIS
// chain at THIS version — and the red control is the same renderer bound to the
// cockpit data committed in this repository, which carries the same partition id
// and the same label and a DIFFERENT chain version. That is what makes the
// version, not the label, the discriminator: both sides of the predicate can
// differ, and one of them is observed differing.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ACTOR, MODULE_VIEWS, PARTITION_ID, PORT, UNIT_NAME,
  VM_ATTEST_DIR, VM_DOMAIN_DB, VM_ENGINE, VM_HOST, VM_WORKSPACE
} from "./manifest.mjs";
import { judgeRouteView, rendersPartition, viewOf } from "../switch-rehearsal/rehearsal-predicates.mjs";
import {
  STATE_DIR, instant, reclaimLocalTunnel, saveState, shellQuote, ssh, sshNode, stepper
} from "./resident-lib.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TUNNEL_PORT = Number.parseInt(process.env.AOS_TUNNEL_PORT ?? "14318", 10);
const BASE = `http://127.0.0.1:${TUNNEL_PORT}`;

/**
 * The record this walkthrough creates, stated up front rather than generated.
 *
 * A timestamped throwaway key would leave the chain carrying junk nobody can
 * account for. This one names what it is and sits under the story it belongs to.
 */
const TARGET = {
  projectId: "project:899d30df2e67bc6e98a4f50e",
  parentStory: "work:a4e5291f2767385d898ec8a5", // TCRN-AOS-STORY-132
  kind: "Subtask"
};

/**
 * The first attempt at this walkthrough, recorded rather than hidden.
 *
 * It created TCRN-AOS-SUBTASK-320, moved it to ready, and was then refused on
 * the annotate route with `WORKSPACE_INPUT_INVALID: annotation does not change any
 * advisory field`. The engine was right and the walkthrough was wrong: a titled
 * create writes the title INTO the scope advisory, and that run passed the same
 * text as both the title and the later annotation, so the annotation changed
 * nothing. The chain is append-only, so that record stays; the fix is the shape
 * below — a short title at creation, and the full account written by the
 * annotation that follows, which is a real full-value replacement.
 */
const PRIOR_ATTEMPT = {
  externalKey: "TCRN-AOS-SUBTASK-320",
  recordId: "work:a0386c9fe4f06900987e5115",
  reached: ["work", "transition", "enrol"],
  refusedOn: "annotate",
  reasonCode: "WORKSPACE_INPUT_INVALID",
  engineMessage: "tcrn_workflow_work_annotate: WORKSPACE_INPUT_INVALID annotation does not change any advisory field",
  cause: "创建时把整段 scope 当标题传了,随后的 annotate 逐字相同,于是没有改变任何顾问字段——引擎拒得对",
  disposition: "链只追加,该记录留在链上;本次改用短标题 + 由 annotate 写入全文的形状重跑"
};

/**
 * The release train the enrolment advisory points at.
 *
 * The AOS partition holds no Release record — it has never run a train of its own
 * — and `advisory:sprint` is a QUALIFIED cross-partition reference by design, so
 * the honest way to exercise this route is to point it at a train that actually
 * exists. This is the platform's most recent one, read read-only from the
 * cross-project chain. Two things it is not: it is not a scheduling decision (the
 * advisory is non-binding, and closing a train does not change member state), and
 * it is not a claim that this subtask shipped in that train. The alternative
 * considered and rejected was minting a Release record on the real AOS chain as a
 * side effect of a walkthrough, which is plan structure nobody asked for.
 */
const TRAIN = {
  workspaceId: "workspace:7732a51de4c38afb83bb77cf",
  trainWorkId: "work:83811dc10d79eafed85c7540", // TCRN-CROSS-SPRINT-002
  externalKey: "TCRN-CROSS-SPRINT-002"
};

/**
 * The title written at creation, and the full account written by the annotation.
 *
 * They must differ, and not as a matter of style: a titled create writes the
 * title into the scope advisory, so an annotation carrying the same text changes
 * no advisory field and the engine refuses it (see PRIOR_ATTEMPT). Keeping the
 * title short and the account long is also just the right shape.
 */
const TITLE = "VM 常驻座舱走查:安全写面四路由活证(TCRN-AOS-STORY-132)";
const SCOPE_TEXT = "TCRN-AOS-STORY-132 常驻座舱走查的活证记录。本条 Subtask 由 VM 上常驻的 cockpit-service "
  + "(systemd 单元 tcrn-aos-cockpit,绑 127.0.0.1,仅经 ssh -L 到达)经安全写面创建,四条写路由"
  + "(work / transition / annotate / enrol)各走一次全链路,写入落在迁置后的 TCRN-AOS 真链上并回读验证;"
  + "随后一次向 planned 的回退被引擎以 INVALID_TRANSITION 拒绝,一次 gate-transition 被 HTTP 面以 404 拒绝"
  + "(仪式动词是边界,不是缺失功能)。enrol 的 sprint 顾问指向 TCRN-CROSS-SPRINT-002,因为 AOS 分区自身"
  + "没有 Release 记录;那是路由实证,不是排期决定,该顾问非绑定。本文本本身由 annotate 路由以全值替换写入,"
  + "与创建时的标题不同——首次尝试(TCRN-AOS-SUBTASK-320)两者逐字相同,引擎以「注解不改变任何顾问字段」"
  + "正确拒绝,那条记录留在链上作为该发现的证据。";

const receipt = {
  schemaVersion: "aos.resident-cockpit-walkthrough.v1",
  story: "TCRN-AOS-STORY-132",
  ruling: "访问形态 CONF-007 D7(127.0.0.1 + ssh -L);写面=MIN-007 安全写面三动词;读面判据沿用 D9 的真值版",
  ok: false,
  startedAt: instant(),
  criteria: {},
  steps: []
};
const step = stepper("walk", receipt, (partial) => saveState("walkthrough", partial));

const engineVm = async (verb, args) => {
  const remote = ["node", `${VM_ENGINE}/scripts/tcrn-workflow.mjs`, verb, ...args].map(shellQuote).join(" ");
  const result = await ssh([remote], { allowFailure: true });
  return JSON.parse(result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim()));
};
const chainStatus = () => engineVm("status", ["--workspace", VM_WORKSPACE]);

/**
 * The next unused Subtask key, derived from the chain's own roster.
 *
 * Not a timestamp: a run-unique throwaway key leaves the chain carrying names
 * nobody can account for, and this walkthrough is re-runnable. Not a constant
 * either: the chain is append-only, so a second run on a fixed key collides and
 * the failure reads as a broken write surface rather than as a repeated name.
 */
async function nextSubtaskKey() {
  const listed = await engineVm("work-list", ["--workspace", VM_WORKSPACE, "--limit", "500"]);
  const used = (listed.records ?? [])
    .map((row) => (String(row.externalKey ?? "").match(/^TCRN-AOS-SUBTASK-(\d+)$/u) ?? [])[1])
    .filter(Boolean)
    .map(Number);
  return { key: `TCRN-AOS-SUBTASK-${Math.max(0, ...used) + 1}`, highestUsed: Math.max(0, ...used) };
}
const attestationCount = async () => Number.parseInt(
  (await ssh([`ls -1 ${shellQuote(VM_ATTEST_DIR)} | wc -l`])).stdout.trim(), 10);

/** The S113 write log, read from the file the service writes, by the VM's own node. */
const readWriteLog = async () => JSON.parse(await sshNode(`
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(${JSON.stringify(VM_DOMAIN_DB)});
  const rows = db.prepare("SELECT seq, partition_id, verb, record_id, chain_version, head_event_hash, at FROM aos_chain_write_log ORDER BY seq").all();
  db.close();
  process.stdout.write(JSON.stringify(rows.map((row) => ({
    seq: row.seq, partitionId: row.partition_id, verb: row.verb, recordId: row.record_id,
    chainVersion: row.chain_version, headEventHash: row.head_event_hash, at: row.at
  }))));
`));

const post = async (path, body) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
};

/* ---- 0. the unit is what we are talking to ------------------------------- */

// Read as KEY=VALUE, not with `--value`: systemd returns properties in its OWN
// order, not the order they were asked for, so positional parsing reads
// UnitFileState where it expects MainPID. The first attempt did exactly that and
// failed a green deployment.
const shownUnit = Object.fromEntries(
  (await ssh(["systemctl", "show", "-p", "ActiveState,SubState,MainPID,UnitFileState", UNIT_NAME],
    { allowFailure: true })).stdout.trim().split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
const statusBefore = await chainStatus();
step("resident-unit-is-the-thing-under-test", {
  ok: shownUnit.ActiveState === "active" && shownUnit.SubState === "running"
    && shownUnit.UnitFileState === "enabled"
    && statusBefore.reasonCode === "WORKSPACE_COMMAND_COMPLETED",
  reasonCode: "RESIDENT_UNIT_ACTIVE_AND_CHAIN_READABLE",
  unit: {
    activeState: shownUnit.ActiveState, subState: shownUnit.SubState,
    mainPid: Number.parseInt(shownUnit.MainPID, 10) || null, unitFileState: shownUnit.UnitFileState
  },
  chainAtStart: {
    workspaceId: statusBefore.workspaceId, version: statusBefore.version,
    headEventHash: statusBefore.headEventHash, work: statusBefore.work
  },
  notAHandStartedProcess: "本走查没有启动任何服务;被测对象是开机自启的 systemd 单元"
});

/* ---- 1. the tunnel is the only way in ----------------------------------- */

const tunnel = spawn("ssh", ["-N", "-L", `${TUNNEL_PORT}:127.0.0.1:${PORT}`, VM_HOST],
  { stdio: "ignore", detached: true });
let health = null;

try {
  for (let attempt = 0; attempt < 30 && health === null; attempt += 1) {
    health = await fetch(`${BASE}/api/health`).then((response) => response.ok ? response.json() : null, () => null);
    if (health === null) await new Promise((done) => setTimeout(done, 500));
  }
  step("tunnel-up", {
    ok: health?.ok === true && health.actor === ACTOR && health.chainWriteAvailable === true
      && health.attestationReceiptsEnabled === true
      && health.partitions.length === 1 && health.partitions[0] === PARTITION_ID,
    reasonCode: "SSH_TUNNEL_IS_THE_ONLY_PATH_IN",
    accessForm: `ssh -L ${TUNNEL_PORT}:127.0.0.1:${PORT} ${VM_HOST}`,
    health,
    onePartitionByDesign: "VM 只声明 TCRN-AOS 一个分区:另三条链在 Owner 机器上,从这里不可达,"
      + "声明它们只会造出一个先答应后失败的写面"
  });

  /* ---- 2. eleven modules, judged, with a red control -------------------- */

  const identity = { partitionId: PARTITION_ID, label: "AOS" };
  const liveVersionMark = `v${statusBefore.version}`;
  const rendersLiveVersion = (html) => String(html).includes(liveVersionMark);

  const root = await fetch(`${BASE}/`);
  const rootBody = await root.text();
  receipt.criteria.rootReachableWithSsr = {
    ok: root.status === 200 && viewOf(rootBody) !== null
      && rendersPartition(rootBody, identity) && rendersLiveVersion(rootBody),
    status: root.status,
    bytes: rootBody.length,
    view: viewOf(rootBody),
    rendersLiveChainVersion: rendersLiveVersion(rootBody)
  };
  step("root-ssr", { ok: receipt.criteria.rootReachableWithSsr.ok, reasonCode: "ROOT_REACHABLE_WITH_SSR" });

  const modules = [];
  for (const [route, expectedView] of MODULE_VIEWS) {
    const shell = await fetch(`${BASE}${route}`);
    const shellBody = await shell.text();
    const ssr = await fetch(`${BASE}${route}/index.html`);
    const ssrBody = await ssr.text();
    const judged = judgeRouteView({ route, html: ssrBody, expectedView, ...identity });
    modules.push({
      route,
      expectedView,
      serviceStatus: shell.status,
      serviceCarriesTheChain: rendersPartition(shellBody, identity),
      ssrStatus: ssr.status,
      ssrView: judged.view,
      ssrViewIsItsOwn: judged.viewIsItsOwn,
      ssrRendersPartition: judged.rendersPartition,
      ssrRendersLiveChainVersion: rendersLiveVersion(ssrBody),
      ssrVerdict: judged.reasonCode,
      ssrAosKeys: (ssrBody.match(/TCRN-AOS-[A-Z]+-\d+/gu) ?? []).length
    });
  }

  // The red control: the SAME renderer and the SAME predicate, bound to the
  // cockpit data committed in this repository. It carries this partition's id and
  // label — so a label-based predicate would call it green — and a different chain
  // version, which is the thing that separates "rendered the VM's truth" from
  // "rendered whatever was baked in at build time".
  const committed = await import(pathToFileURL(resolve(REPO_ROOT, "dist/apps/web/src/app.js")).href);
  const committedBody = committed.renderAosShellHtml({ path: "/work-items" });
  const committedJudged = judgeRouteView({
    route: "/work-items", html: committedBody, expectedView: "work-items", ...identity
  });
  const redControl = {
    renderer: "same renderer, this repository's committed cockpit data instead of the VM projection",
    viewStillRendered: committedJudged.view,
    rendersPartition: committedJudged.rendersPartition,
    rendersLiveChainVersion: rendersLiveVersion(committedBody),
    // Every chain-version mark the committed document carries, de-duplicated.
    // A bare /v(\d+)/ was here first and reported "v1" — the first `v` followed
    // by a digit anywhere in a 400 KB document, which is not a chain version at
    // all. The gating claim (does the live mark appear) was unaffected, but the
    // number printed beside it was noise, and noise in a receipt is worse than a
    // blank because someone will read it.
    committedVersionMarks: [...new Set(committedBody.match(/\bv\d{2,}\b/gu) ?? [])].sort(),
    liveVersionMark,
    verdict: committedJudged.reasonCode
  };
  receipt.criteria.everyModuleRendersTheVmChain = {
    ok: modules.every((entry) => entry.serviceStatus === 200 && entry.ssrStatus === 200
      && entry.ssrViewIsItsOwn && entry.ssrRendersPartition && entry.ssrRendersLiveChainVersion
      && entry.serviceCarriesTheChain)
      // The control must still render a view (so the renderer works) and must NOT
      // carry the live version (so the predicate is measuring the data).
      && redControl.viewStillRendered === "work-items"
      && redControl.rendersLiveChainVersion === false
      && redControl.rendersPartition === true,
    modules,
    redControl,
    note: "裸路由按设计回退到壳文档、由客户端按 window.location 重渲染;逐模块服务端渲染另以 "
      + "<route>/index.html 提供并逐一判定。判据不是「页面里有 AOS 字样」——仓内既有数据同样有;"
      + "判据是「渲染的是 VM 引擎此刻报的链版本」,红控证明这两侧确实可以不同"
  };
  step("eleven-modules", {
    ok: receipt.criteria.everyModuleRendersTheVmChain.ok,
    reasonCode: "MODULE_READ_FACE_GREEN_WITH_RED_CONTROL",
    modules: modules.length,
    liveVersionMark
  });

  /* ---- 3. the migrated domain store, live -------------------------------- */

  const stamp = `resident-${Date.now()}`;
  const domainTarget = { partitionId: PARTITION_ID, recordId: TARGET.parentStory };
  const put = await fetch(`${BASE}/api/domain/annotation`, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...domainTarget, labels: ["resident-cockpit", stamp] })
  });
  const readBack = await (await fetch(
    `${BASE}/api/domain/${domainTarget.partitionId}/${encodeURIComponent(domainTarget.recordId)}`)).json();
  const exportBody = await (await fetch(`${BASE}/api/domain/export`)).json();
  receipt.criteria.migratedStoreIsTheLiveOne = {
    ok: put.ok && (readBack.annotation?.labels ?? []).includes(stamp)
      && readBack.annotation?.updatedBy === ACTOR
      && Array.isArray(exportBody.chainWriteLog),
    wroteLabel: stamp,
    readBackLabels: readBack.annotation?.labels ?? [],
    attributedTo: readBack.annotation?.updatedBy ?? null,
    exportFamilies: Object.keys(exportBody).filter((key) => key !== "ok"),
    // INC-036 was the `export` route being shadowed by the GET catch-all. It is
    // fixed, and this is the reading that says so on the live deployment rather
    // than on a fixture.
    exportRouteReachable: Array.isArray(exportBody.chainWriteLog),
    storeOnTheVm: VM_DOMAIN_DB
  };
  step("domain-store-round-trip", {
    ok: receipt.criteria.migratedStoreIsTheLiveOne.ok,
    reasonCode: "MIGRATED_DOMAIN_STORE_ROUND_TRIPS_AND_EXPORTS"
  });

  /* ---- 4. the four write routes, once each, full path -------------------- */

  const logBefore = await readWriteLog();
  const attestBefore = await attestationCount();
  const { key: externalKey, highestUsed } = await nextSubtaskKey();
  const writes = [];

  const created = await post("/api/chain/work", {
    partitionId: PARTITION_ID,
    projectId: TARGET.projectId,
    externalKey,
    kind: TARGET.kind,
    parentId: TARGET.parentStory,
    title: TITLE
  });
  let log = await readWriteLog();
  writes.push({
    route: "work", status: created.status, ok: created.json.ok === true,
    recordId: created.json.id ?? null, externalKey, highestSubtaskKeyBefore: highestUsed,
    refusal: created.status === 200 ? null : created.json,
    logRowsAfter: log.length,
    // A titled create is two engine calls (create, then the scope annotation that
    // carries the title, because the chain has no title field), so two log rows.
    logGrew: log.length === logBefore.length + 2
  });
  const recordId = created.json.id;
  if (!recordId) {
    step("write-work", { ok: false, reasonCode: "WORK_CREATE_REFUSED", refusal: created.json });
  }

  const transitioned = await post("/api/chain/transition",
    { partitionId: PARTITION_ID, recordId, status: "ready" });
  let next = await readWriteLog();
  writes.push({
    route: "transition", status: transitioned.status, ok: transitioned.json.ok === true,
    move: "planned -> ready",
    refusal: transitioned.status === 200 ? null : transitioned.json,
    logRowsAfter: next.length, logGrew: next.length === log.length + 1
  });
  log = next;

  const annotated = await post("/api/chain/annotate",
    { partitionId: PARTITION_ID, recordId, scope: SCOPE_TEXT });
  next = await readWriteLog();
  writes.push({
    route: "annotate", status: annotated.status, ok: annotated.json.ok === true,
    scopeIsFullValueReplacement: true,
    refusal: annotated.status === 200 ? null : annotated.json,
    logRowsAfter: next.length, logGrew: next.length === log.length + 1
  });
  log = next;

  const enrolled = await post("/api/chain/enrol", {
    partitionId: PARTITION_ID, recordId,
    workspaceId: TRAIN.workspaceId, trainWorkId: TRAIN.trainWorkId
  });
  next = await readWriteLog();
  writes.push({
    route: "enrol", status: enrolled.status, ok: enrolled.json.ok === true,
    train: TRAIN,
    refusal: enrolled.status === 200 ? null : enrolled.json,
    logRowsAfter: next.length, logGrew: next.length === log.length + 1
  });
  log = next;

  const statusAfterWrites = await chainStatus();
  const attestAfter = await attestationCount();
  const lastRow = log.at(-1) ?? null;
  receipt.criteria.fourWriteRoutesFullPath = {
    ok: writes.every((entry) => entry.ok && entry.logGrew),
    writes,
    chainVersionBefore: statusBefore.version,
    chainVersionAfter: statusAfterWrites.version,
    eventsAppended: statusAfterWrites.version - statusBefore.version,
    writeLogLiveInstrument: {
      // The S113 log row appearing is one claim; the row's receipt agreeing at
      // FULL VALUE with what the chain's own authority reports is the other.
      ok: lastRow?.headEventHash === statusAfterWrites.headEventHash
        && lastRow?.chainVersion === statusAfterWrites.version,
      lastLogHeadEventHash: lastRow?.headEventHash ?? null,
      chainHeadEventHash: statusAfterWrites.headEventHash,
      lastLogChainVersion: lastRow?.chainVersion ?? null,
      chainVersion: statusAfterWrites.version,
      rowsAdded: log.length - logBefore.length
    },
    attestationReceipts: {
      // The attest-dir wiring is new: this service has never supplied one, so
      // every chain write it ever made left no time-attestation receipt. The
      // sidecar growing at all is the claim, and it is one that can only be true
      // if the unit's AOS_ATTEST_DIR reached the engine — the local unit test
      // proves the other side (no attestDir configured, no `attest-dir` in the
      // args the engine receives), and it was watched going red.
      //
      // The exact ratio is REPORTED, not asserted. One receipt per appended event
      // is what this run observed, but that is the engine's own convention and I
      // have not read the code that fixes it; pinning a relation I have not
      // verified is how a predicate ends up measuring something else.
      before: attestBefore,
      after: attestAfter,
      grewBy: attestAfter - attestBefore,
      eventsAppended: statusAfterWrites.version - statusBefore.version,
      observedOneReceiptPerEvent: (attestAfter - attestBefore) === (statusAfterWrites.version - statusBefore.version),
      wiringProven: attestAfter > attestBefore,
      sidecar: VM_ATTEST_DIR
    }
  };
  step("four-write-routes", {
    ok: receipt.criteria.fourWriteRoutesFullPath.ok
      && receipt.criteria.fourWriteRoutesFullPath.writeLogLiveInstrument.ok
      && receipt.criteria.fourWriteRoutesFullPath.attestationReceipts.wiringProven,
    reasonCode: "FOUR_WRITE_ROUTES_FULL_PATH_WITH_LIVE_WRITE_LOG_AND_RECEIPTS",
    recordId,
    chainVersionAfter: statusAfterWrites.version
  });

  /* ---- 5. read the record back through the engine ----------------------- */

  const shown = await engineVm("work-show", ["--workspace", VM_WORKSPACE, "--id", recordId]);
  const record = shown.record ?? {};
  // work-show returns the record summary and, separately, the non-binding
  // advisories under `advisory` — scope, decided-by and sprint live in the
  // record's extensions, not among its columns.
  const advisory = shown.advisory ?? {};
  const expectedSprint = `${TRAIN.workspaceId}#${TRAIN.trainWorkId}`;
  const sprintReference = advisory.sprint ?? null;
  const sprintMatches = sprintReference !== null
    && sprintReference.workspaceId === TRAIN.workspaceId
    && sprintReference.workId === TRAIN.trainWorkId;
  receipt.criteria.recordReadsBackFromTheChain = {
    ok: record.externalKey === externalKey && record.status === "ready"
      && record.kind === TARGET.kind && record.parentId === TARGET.parentStory
      && String(advisory.scope ?? "").includes("TCRN-AOS-STORY-132")
      && sprintMatches,
    externalKey: record.externalKey ?? null,
    kind: record.kind ?? null,
    status: record.status ?? null,
    parentId: record.parentId ?? null,
    revision: record.revision ?? null,
    scopeRecorded: String(advisory.scope ?? "").length > 0,
    scopeIsWhatWasWritten: advisory.scope === SCOPE_TEXT,
    sprintAdvisory: sprintReference,
    sprintWireFormSent: expectedSprint,
    sprintStoredAsQualifiedReference: sprintMatches,
    readVia: "the VM engine's own work-show against the relocated workspace"
  };
  step("record-reads-back", {
    ok: receipt.criteria.recordReadsBackFromTheChain.ok,
    reasonCode: "RECORD_READS_BACK_FROM_THE_RELOCATED_CHAIN"
  });

  /* ---- 6. the refusal half, and the ceremony boundary ------------------- */

  const illegal = await post("/api/chain/transition",
    { partitionId: PARTITION_ID, recordId, status: "planned" });
  const logAfterRefusal = await readWriteLog();
  receipt.criteria.invalidTransitionRefused = {
    ok: illegal.status === 409 && illegal.json.reasonCode === "INVALID_TRANSITION"
      && logAfterRefusal.length === log.length,
    requested: "ready -> planned",
    status: illegal.status,
    reasonCode: illegal.json.reasonCode ?? null,
    engineMessageReachedTheClient: typeof illegal.json.error === "string" && illegal.json.error.length > 0,
    refusalNotLogged: logAfterRefusal.length === log.length,
    why: "拒绝没有推进链,所以写日志不该多出一行;引擎的 reason code 原样上达客户端,"
      + "把它压成 500「保存失败」会正好丢掉唯一能告诉人下一步怎么做的那条信息"
  };

  const ceremony = await post("/api/chain/gate-transition", { partitionId: PARTITION_ID });
  receipt.criteria.ceremonialWritesStayOffHttp = {
    ok: ceremony.status === 404 && ceremony.json.error === "not_found",
    verb: "gate-transition",
    status: ceremony.status,
    body: ceremony.json,
    meaning: "仪式动词不是缺失的功能而是边界:治理写保留显式仪式,HTTP 面 404。"
      + "即便有路由也会被供权拒绝——VM bundle 只授三个写动词"
  };
  step("refusal-and-ceremony-404", {
    ok: receipt.criteria.invalidTransitionRefused.ok && receipt.criteria.ceremonialWritesStayOffHttp.ok,
    reasonCode: "INVALID_TRANSITION_HELD_AND_CEREMONY_404"
  });

  receipt.recordCreated = { id: recordId, externalKey, kind: TARGET.kind, parentId: TARGET.parentStory };
  receipt.priorAttempt = PRIOR_ATTEMPT;
  receipt.writeLogTail = log.slice(-6);
  receipt.ok = Object.values(receipt.criteria).every((criterion) => criterion.ok === true);
} finally {
  // Reclaimed whether the walkthrough passed or threw, and reclaimed at the
  // ControlMaster as well as the client: this host runs `ControlMaster auto` with
  // `ControlPersist`, so killing the `ssh -N -L` client leaves the master holding
  // the forward. The predicate is the LISTENER on the port, because only the
  // socket can answer "is anything still accepting here".
  receipt.tunnelReclaim = await reclaimLocalTunnel({
    tunnelPort: TUNNEL_PORT, vmPort: PORT, tunnelPid: tunnel.pid
  });
  receipt.finishedAt = instant();
  mkdirSync(STATE_DIR, { recursive: true });
  saveState("walkthrough", receipt);
}
step("tunnel-reclaimed", {
  ok: receipt.tunnelReclaim.ok,
  reasonCode: "TUNNEL_RECLAIMED_PORT_HAS_NO_LISTENER",
  ...receipt.tunnelReclaim
});

receipt.notClaimed = [
  "本走查不含任何发布或切换授权",
  "创建的记录是永久的:链只追加,不存在事后删除",
  "sprint 顾问指向 TCRN-CROSS-SPRINT-002 是路由实证,不是排期决定;该顾问非绑定,列车关闭亦不改成员状态",
  "服务在走查结束后仍在运行——它是交付物,不是本次为走查起的进程",
  "页面数据是部署时投影的,不是实时的:本次四笔写入之后,页面上的版本号已落后于链"
];
saveState("walkthrough", receipt);
console.log(JSON.stringify({
  ok: receipt.ok,
  criteria: Object.fromEntries(Object.entries(receipt.criteria).map(([key, value]) => [key, value.ok])),
  recordCreated: receipt.recordCreated ?? null
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
