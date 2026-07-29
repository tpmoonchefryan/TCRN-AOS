#!/usr/bin/env node
// STORY-125: the truth-side product walkthrough — the D9 mirror-acceptance
// criteria re-decided against the REAL product topology, on the VM rehearsal
// environment act one built: the cockpit service itself (not the nginx
// mirror), holding a write surface, bound to the VM's loopback, reached
// exclusively through `ssh -L` (exactly the access form CONF-007 D7 ruled).
//
// What runs where:
//  - build products are produced HERE (web SSR + client bundle rendered from
//    the SCRATCH chain's projection, service + projection dist) in the session
//    scratchpad — the repository tree is not touched — and transferred to the
//    VM with per-file sha256 reconciliation in both directions;
//  - the service runs ON the VM (AOS_ACTOR explicit, 127.0.0.1 bind), against
//    the act-one scratch chain, with a rehearsal-scoped operator authority
//    (safe write surface only) whose pins are re-signed for the VM path —
//    the S120 deployment rule for pins: they bind trust to an absolute path,
//    so a new placement mints new pins;
//  - the walkthrough talks to it through an SSH tunnel from this machine.
//
// The service is left RUNNING at the end on purpose: freezing it is step one
// of the rollback rehearsal (act4), which must follow immediately.

import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ACTOR, LOCAL_ENGINE, PARTITION_ID, REPO_ROOT, SCRATCHPAD,
  compareLedgers, engineVm, instant, loadState, localLedger, placeOnVm,
  reclaimLocalTunnel, reclaimVmService, remoteLedger, rsyncToVm, saveState,
  sha256, sha256Text, ssh, sshNode, startVmService, vmProcessResidue
} from "./rehearsal-lib.mjs";
// The per-route view judgement lives in the automated test roster, not here:
// this act runs by hand against a VM, and a predicate that only ever runs by
// hand rots between runs (TCRN-AOS-INC-038).
import { judgeRouteView, rendersPartition, viewOf } from "./rehearsal-predicates.mjs";

const act1 = loadState("act1");
const vmRoot = act1.vmRoot;
const vmRuntime = `${vmRoot}/runtime`;
const buildRoot = join(SCRATCHPAD, "switch-rehearsal-webbuild");
const VM_PORT = 14318;
const TUNNEL_PORT = 14319;
const BASE = `http://127.0.0.1:${TUNNEL_PORT}`;

const receipt = {
  schemaVersion: "aos.switch-rehearsal-walkthrough.v1",
  ruling: "TCRN-CROSS-MIN-052 D9 判据的真值版(TCRN-AOS-MIN-007 演练义务);访问形态=CONF-007 D7(127.0.0.1 + ssh -L)",
  startedAt: instant(),
  ok: false,
  criteria: {},
  steps: []
};
const step = (name, value) => {
  receipt.steps.push({ name, ...value });
  process.stderr.write(`[act3] ${name}: ${value.reasonCode ?? (value.ok ? "ok" : "FAILED")}\n`);
  if (value.ok === false) {
    saveState("act3", receipt);
    throw new Error(`act3 step failed: ${name}`);
  }
};

// ---- 0. reset the VM scratch chain to the anchor --------------------------
// This act and the rollback act (act4) are a PAIR: act3 drifts the chain, act4
// rolls it back. Re-running the pair therefore has to start from the anchor, or
// the second run enumerates a delta whose earlier half has no log rows left —
// the chain would keep the first run's events while the write log (which act3's
// transfer recreates) would not, and the reconciliation would fail for a reason
// that has nothing to do with what it is testing.
await ssh(["rm", "-rf", `${vmRoot}/rollback`]);
await ssh(["sh", "-c", `'rm -rf ${vmRoot}/workspace/.tcrn-workflow `
  + `&& cp -a ${vmRoot}/baseline/.tcrn-workflow ${vmRoot}/workspace/.tcrn-workflow `
  + `&& rm -f ${vmRuntime}/domain.db ${vmRuntime}/domain.db-wal ${vmRuntime}/domain.db-shm'`]);
const resetPlacement = await placeOnVm(vmRoot, "workspace");
const resetStatus = (await engineVm("status", ["--workspace", `${vmRoot}/workspace`])).json;
step("reset-vm-scratch-chain-to-anchor", {
  ok: resetStatus.headEventHash === act1.anchor.headEventHash
    && resetStatus.version === act1.anchor.version,
  reasonCode: "VM_SCRATCH_CHAIN_RESET_TO_ANCHOR",
  placement: resetPlacement,
  headEventHash: resetStatus.headEventHash,
  version: resetStatus.version,
  anchorHeadEventHash: act1.anchor.headEventHash
});

// ---- 1. build the rehearsal web from the SCRATCH chain's projection -------
rmSync(buildRoot, { recursive: true, force: true });
mkdirSync(buildRoot, { recursive: true });
cpSync(join(REPO_ROOT, "dist"), join(buildRoot, "dist"), { recursive: true });
symlinkSync(join(REPO_ROOT, "node_modules"), join(buildRoot, "node_modules"));

const projection = await import(pathToFileURL(join(buildRoot, "dist/packages/projection/src/index.js")).href);
const client = new projection.ChainClient({
  serverPath: resolve(LOCAL_ENGINE, "scripts/tcrn-workflow-mcp.mjs")
});
const store = new projection.ProjectionStore();
let cockpitData;
try {
  await client.start();
  const ingestor = new projection.ChainIngestor(client);
  const verifiedAt = instant();
  const source = {
    partitionId: PARTITION_ID,
    label: "Switch rehearsal",
    labelZh: "切换演练",
    workspacePath: join(act1.localRoot, "workspace")
  };
  const { projection: projected } = await ingestor.projectIfMoved(source, undefined, verifiedAt);
  if (projected) store.replacePartition(projected);
  const partitions = [{
    id: source.partitionId,
    label: source.label,
    labelZh: source.labelZh,
    chainVersion: projected?.chainVersion ?? 0,
    verifiedAt,
    readVia: projected?.readVia ?? "paginated",
    attestationFromSequence: projected?.actorAttestationFromSequence ?? null,
    unavailable: projected?.readVia === "export"
      ? []
      : projected?.readVia === "paginated-with-deliberations" ? ["events"] : ["positions", "minutes", "events"]
  }];
  const allMinutes = store.listMinutes();
  const effective = projection.computeEffectiveUnresolved(allMinutes);
  const inbox = projection.buildInbox({
    gates: store.listGates(),
    conferences: store.listConferences(),
    effectiveUnresolved: effective,
    minutesById: new Map(allMinutes.map((entry) => [entry.id, {
      partitionId: entry.partitionId, externalKey: entry.externalKey, summary: entry.summary
    }]))
  });
  const work = store.listWork({ limit: 5000 });
  const activityByWork = {};
  for (const item of work) {
    const events = store.listEvents({ partitionId: item.partitionId, subjectId: item.id });
    if (events.length === 0) continue;
    activityByWork[item.id] = projection.buildActivityFeed(
      events, store.attestationFromSequence(item.partitionId) ?? null
    ).map((entry) => ({
      id: entry.id, sequence: entry.sequence, occurredAt: entry.occurredAt,
      operation: entry.operation, actorId: entry.actorId, attribution: entry.attribution
    }));
  }
  cockpitData = {
    generatedAt: verifiedAt,
    partitions,
    work: work.map((row) => ({
      partitionId: row.partitionId, id: row.id, externalKey: row.externalKey,
      kind: row.kind, status: row.status, parentId: row.parentId, revision: row.revision,
      scope: row.scope, decidedBy: row.decidedBy, sprintWorkId: row.sprintWorkId
    })),
    gates: [],
    conferences: [],
    inbox,
    effectiveUnresolved: effective.filter((entry) => entry.effective.length > 0),
    threads: {},
    minutesByConference: {},
    activityByWork
  };
} finally {
  await client.stop();
}
writeFileSync(join(buildRoot, "dist/apps/web/src/cockpit-data.generated.js"),
  `// GENERATED for the switch rehearsal from the scratch chain projection.\nexport const cockpitData = ${JSON.stringify(cockpitData, null, 2)};\n`);
step("scratch-projection-data", {
  ok: cockpitData.work.length >= 2 && cockpitData.partitions[0].chainVersion === act1.chain.version,
  reasonCode: "SCRATCH_PROJECTION_BAKED",
  partitions: cockpitData.partitions.map((row) => `${row.id}@v${row.chainVersion}`),
  work: cockpitData.work.length
});

// Route -> the view that route must render, taken from the roster the frontend
// shell proof already holds (scripts/aos-frontend-shell-proof.mjs). Naming the
// expected view per route is what makes this a judgement: a route that fell
// back to the shell's default answers with SOME view, so "a view was rendered"
// is satisfied by the failure it is meant to catch.
const MODULE_VIEWS = new Map([
  ["/my-work", "my-work"], ["/inbox", "inbox"], ["/dashboard", "dashboard"],
  ["/projects", "projects"], ["/work-items", "work-items"], ["/board", "board"],
  ["/release-trains", "release-trains"], ["/knowledge", "knowledge"],
  ["/deliberations", "deliberations"], ["/audit", "audit"], ["/snapshots", "snapshots"]
]);
const MODULES = [...MODULE_VIEWS.keys()];
const { renderAosShellHtml } = await import(pathToFileURL(join(buildRoot, "dist/apps/web/src/app.js")).href);
const webRoot = join(buildRoot, "stage/web");
mkdirSync(join(webRoot, "assets"), { recursive: true });
// `/` explicitly: called with no argument the renderer answers for `/cockpit`,
// which is the owner-quality product shell and emits no `data-cockpit-view` at
// all — the first run of this act read that as "SSR is broken".
writeFileSync(join(webRoot, "index.html"), renderAosShellHtml({ path: "/" }));
for (const route of MODULES) {
  mkdirSync(join(webRoot, route.slice(1)), { recursive: true });
  writeFileSync(join(webRoot, route.slice(1), "index.html"), renderAosShellHtml({ path: route }));
}
const esbuild = await import("esbuild");
await esbuild.build({
  entryPoints: [join(buildRoot, "dist/apps/web/src/client.js")],
  outfile: join(webRoot, "assets/aos-client.js"),
  bundle: true, format: "esm", platform: "browser", target: "es2022",
  sourcemap: false, logLevel: "silent"
});
cpSync(join(REPO_ROOT, "apps/web/dist/assets/tcrn-brand-mark.svg"), join(webRoot, "assets/tcrn-brand-mark.svg"));
step("rehearsal-web-built", { ok: true, reasonCode: "WEB_SSR_AND_BUNDLE_BUILT", routes: MODULES.length + 1 });

// ---- 2. rehearsal-scoped operator authority: re-sign pins for the VM path -
// S120 rule: pins bind trust to an absolute path by design, so deployment
// onto the VM re-signs the pins against the VM target path. The authority
// BUNDLE bytes travel unchanged (its own authorityDigest stays valid); only
// the pins file is re-minted, using the engine's own canonicalJson +
// canonicalSha256 as the byte authority.
const protocol = await import(pathToFileURL(resolve(LOCAL_ENGINE, "dist/build/packages/protocol/src/index.js")).href);
const bundleBytes = readFileSync(join(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/vm/operator-authority.json"));
const bundle = JSON.parse(bundleBytes.toString("utf8"));
const authorityDir = join(buildRoot, "stage/authority");
mkdirSync(authorityDir, { recursive: true });
writeFileSync(join(authorityDir, "operator-authority.json"), bundleBytes);
const pinsBasis = {
  schemaVersion: "tcrn.operator-authority-pins.v1",
  authorityId: bundle.authorityId,
  authorityPath: `${vmRuntime}/authority/operator-authority.json`,
  authorityFileSha256: sha256(bundleBytes),
  minimumGeneration: 1,
  revokedAuthorityDigests: []
};
const pinsDoc = { ...pinsBasis, pinsDigest: protocol.canonicalSha256(pinsBasis) };
const pinsBytes = protocol.canonicalJson(pinsDoc);
writeFileSync(join(authorityDir, "operator-authority-pins.json"), pinsBytes);
const pinsFileDigest = sha256Text(pinsBytes);
step("vm-pins-resigned", {
  ok: bundle.mcp.writeCommands.length === 3,
  reasonCode: "OPERATOR_PINS_RESIGNED_FOR_VM_PATH",
  authorityId: bundle.authorityId,
  generation: bundle.generation,
  expiresAt: bundle.expiresAt,
  writeCommands: bundle.mcp.writeCommands,
  authorityFileSha256: pinsBasis.authorityFileSha256,
  pinsDigest: pinsDoc.pinsDigest,
  pinsFileDigest
});

// ---- 3. assemble + transfer the runtime tree ------------------------------
const stage = join(buildRoot, "stage");
cpSync(join(buildRoot, "dist"), join(stage, "dist"), { recursive: true });
cpSync(join(REPO_ROOT, "packages/db/migrations/domain"), join(stage, "packages/db/migrations/domain"), { recursive: true });
cpSync(resolve(REPO_ROOT, "deploy/switch-rehearsal/vm-cockpit-runner.mjs"), join(stage, "vm-cockpit-runner.mjs"));
const localFiles = localLedger(stage);
await rsyncToVm(stage, vmRuntime);
const remoteFiles = await remoteLedger(vmRuntime, { excludes: ["domain.db", "domain.db-wal", "domain.db-shm", "service.log"] });
const comparison = compareLedgers(localFiles, remoteFiles);
step("runtime-transfer-reconciliation", {
  ok: comparison.ok,
  reasonCode: comparison.ok ? "TRANSFER_LEDGERS_EQUAL" : "TRANSFER_LEDGERS_DIVERGENT",
  compared: comparison.compared,
  fileSetDigest: comparison.fileSetDigest
});

// ---- 4. start the service ON the VM (loopback), tunnel in -----------------
// The residue check comes FIRST: starting a second cockpit on a port a
// forgotten one already holds is how a leak becomes invisible.
const residueBefore = await vmProcessResidue();
step("vm-residue-before-start", {
  ok: residueBefore.total === 0,
  reasonCode: "VM_PROCESS_GROUP_EMPTY_BEFORE_START",
  residue: residueBefore
});
const servicePid = await startVmService(vmRuntime, {
  AOS_ACTOR: "agent:fable",
  AOS_PORT: String(VM_PORT),
  AOS_AUTHORITY_PINS_DIGEST: pinsFileDigest
});
saveState("act3-service", { vmRoot, vmRuntime, servicePid, vmPort: VM_PORT, pinsFileDigest });
let healthOnVm = null;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const probe = await ssh(["curl", "-s", "-m", "2", `http://127.0.0.1:${VM_PORT}/api/health`], { allowFailure: true });
  if (probe.code === 0 && probe.stdout.trim().startsWith("{")) { healthOnVm = JSON.parse(probe.stdout); break; }
  await new Promise((r) => setTimeout(r, 1000));
}
if (healthOnVm === null) {
  // Say what the service itself said before failing: a null health probe with
  // no log is a dead end, and the reclaim below is the only thing standing
  // between a failed start and a leaked process.
  const log = await ssh(["tail", "-5", `${vmRuntime}/service.log`], { allowFailure: true });
  receipt.serviceLogOnFailure = log.stdout.slice(-2000);
  const reclaimed = await reclaimVmService(vmRuntime);
  receipt.reclaimOnStartFailure = reclaimed;
}
step("vm-service-started", {
  ok: healthOnVm?.ok === true && healthOnVm.actor === "agent:fable" && healthOnVm.chainWriteAvailable === true,
  reasonCode: "REHEARSAL_SERVICE_UP_LOOPBACK",
  servicePid,
  health: healthOnVm,
  bind: "127.0.0.1 (hard-coded in service.ts; CONF-007 D7)"
});

const tunnel = spawn("ssh", ["-N", "-L", `${TUNNEL_PORT}:127.0.0.1:${VM_PORT}`, "tcrn-platform-dev"],
  { stdio: "ignore", detached: true });
const reachedThroughTunnel = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return await res.json();
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
};
try {
  const healthViaTunnel = await reachedThroughTunnel();
  step("tunnel-up", {
    ok: healthViaTunnel?.ok === true,
    reasonCode: "SSH_TUNNEL_PATH_LIVE",
    tunnelPid: tunnel.pid,
    accessForm: `ssh -L ${TUNNEL_PORT}:127.0.0.1:${VM_PORT} — the ruled off-host access form`
  });

  // ---- 5. D9 criteria, truth-side -----------------------------------------
  // What proves a page rendered THIS chain: the scratch partition's own id and
  // label. Both are absent from the repository's committed cockpit data, so the
  // predicate separates "rendered the rehearsal projection" from "rendered
  // whatever was baked in at build time" — the red control below performs that
  // separation rather than asserting it.
  const CHAIN_IDENTITY = { partitionId: PARTITION_ID, label: "Switch rehearsal" };
  const rendersScratchChain = (body) => rendersPartition(body, CHAIN_IDENTITY);
  const SR_KEY = /SR-[A-Z]+-\d+|work:[0-9a-f]{24}/gu;

  const rootPage = await fetch(`${BASE}/`);
  const rootBody = await rootPage.text();
  receipt.criteria.urlReachableWithSsr = {
    ok: rootPage.status === 200 && viewOf(rootBody) !== null && rendersScratchChain(rootBody),
    status: rootPage.status,
    bytes: rootBody.length,
    view: viewOf(rootBody),
    rendersScratchChain: rendersScratchChain(rootBody)
  };
  step("criterion-url-ssr", { ok: receipt.criteria.urlReachableWithSsr.ok, reasonCode: "URL_REACHABLE_WITH_SSR" });

  const modules = [];
  for (const route of MODULES) {
    const shell = await fetch(`${BASE}${route}`);
    const shellBody = await shell.text();
    const ssr = await fetch(`${BASE}${route}/index.html`);
    const ssrBody = await ssr.text();
    const expectedView = MODULE_VIEWS.get(route);
    const judged = judgeRouteView({ route, html: ssrBody, expectedView, ...CHAIN_IDENTITY });
    modules.push({
      route,
      expectedView,
      serviceStatus: shell.status,
      serviceCarriesScratchChain: rendersScratchChain(shellBody),
      ssrStatus: ssr.status,
      ssrView: judged.view,
      ssrViewIsItsOwn: judged.viewIsItsOwn,
      ssrRendersScratchChain: judged.rendersPartition,
      ssrVerdict: judged.reasonCode,
      ssrScratchChainKeys: (ssrBody.match(SR_KEY) ?? []).length,
      ssrNotices: (ssrBody.match(/data-cockpit-notice="[a-z-]+"/gu) ?? []).length
    });
  }
  // The red control: the SAME predicate against the SAME renderer bound to the
  // repository's committed cockpit data. It must come out false, or the
  // predicate is measuring the renderer rather than the data it was given.
  const committed = await import(pathToFileURL(resolve(REPO_ROOT, "dist/apps/web/src/app.js")).href);
  const committedBody = committed.renderAosShellHtml({ path: "/work-items" });
  const committedJudged = judgeRouteView({
    route: "/work-items", html: committedBody,
    expectedView: MODULE_VIEWS.get("/work-items"), ...CHAIN_IDENTITY
  });
  const redControl = {
    route: "/work-items",
    renderer: "same renderer, committed cockpit data instead of the rehearsal projection",
    viewStillRendered: committedJudged.view,
    rendersScratchChain: committedJudged.rendersPartition,
    verdict: committedJudged.reasonCode
  };
  receipt.criteria.everyModuleRendersChainData = {
    ok: modules.every((entry) => entry.serviceStatus === 200 && entry.ssrStatus === 200
      && entry.ssrViewIsItsOwn && entry.ssrRendersScratchChain && entry.serviceCarriesScratchChain)
      && redControl.rendersScratchChain === false && redControl.viewStillRendered !== null,
    note: "本地服务按设计对每条路由回退到壳文档并由客户端按 window.location 重渲染;逐模块的服务端渲染读面另以 <route>/index.html 提供并逐一核验(镜像同款渲染器,同一 scratch 投影)。判据两侧可不同:同一渲染器换成仓内既有 cockpit 数据即转红(redControl),故绿不是渲染器的恒真属性",
    redControl,
    modules
  };
  step("criterion-modules", {
    ok: receipt.criteria.everyModuleRendersChainData.ok,
    reasonCode: "MODULE_READ_FACE_GREEN_WITH_RED_CONTROL",
    modules: modules.length
  });

  // domain write round trip (D9 criterion 3, unchanged in the truth topology)
  const stamp = `rehearsal-${Date.now()}`;
  // A run-unique external key: the chain is append-only, so a second walkthrough
  // against the same scratch chain would collide on a fixed key and the failure
  // would read as a broken write surface rather than as a repeated name.
  const walkKey = `SR-WALK-${Date.now().toString(36).toUpperCase()}`;
  const target = { partitionId: PARTITION_ID, recordId: act1.chain.records.initiative };
  const put = await fetch(`${BASE}/api/domain/annotation`, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...target, labels: ["rehearsal", stamp] })
  });
  const readBack = await (await fetch(`${BASE}/api/domain/${target.partitionId}/${encodeURIComponent(target.recordId)}`)).json();
  receipt.criteria.localDomainWriteRoundTrips = {
    ok: put.ok && (readBack.annotation?.labels ?? []).includes(stamp),
    wroteLabel: stamp,
    readBackLabels: readBack.annotation?.labels ?? []
  };
  step("criterion-domain-roundtrip", { ok: receipt.criteria.localDomainWriteRoundTrips.ok, reasonCode: "DOMAIN_WRITE_ROUND_TRIPS" });

  // ---- 6. the four chain-write routes, full path, once each ---------------
  // The write log is read from the file the service writes, on the VM, by the
  // VM's own node — not through `GET /api/domain/export`, which cannot answer.
  //
  // Found here, recorded rather than worked around silently: in
  // apps/cockpit-service/src/service.ts, handleDomain's first branch is an
  // unconditional `if (request.method === "GET") { … return; }` that treats the
  // remainder as `<partition>/<recordId>`. `export` therefore parses as a
  // partition with no record id and returns the un-scoped annotation listing,
  // and the `rest === "export"` branch further down is unreachable for GET.
  // The S113 write log consequently has no HTTP read face at all. The proof is
  // captured below as a criterion of its own.
  const readWriteLog = async () => {
    const rows = JSON.parse(await sshNode(`
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(${JSON.stringify(`${vmRuntime}/domain.db`)});
      const rows = db.prepare("SELECT seq, partition_id, verb, args_json, record_id, chain_version, head_event_hash, at, switch_anchor FROM aos_chain_write_log ORDER BY seq").all();
      db.close();
      process.stdout.write(JSON.stringify(rows));
    `));
    return rows.map((row) => ({
      seq: row.seq, partitionId: row.partition_id, verb: row.verb, argsJson: row.args_json,
      recordId: row.record_id, chainVersion: row.chain_version,
      headEventHash: row.head_event_hash, at: row.at, switchAnchor: row.switch_anchor
    }));
  };
  const logCount = async () => {
    const rows = await readWriteLog();
    return { rows: rows.length, last: rows.at(-1) ?? null };
  };
  const exportBody = await (await fetch(`${BASE}/api/domain/export`)).json();
  receipt.criteria.writeLogHttpReadFaceShadowed = {
    // A found defect is a criterion when the walkthrough is what found it: the
    // green half of this cell is "the service answered", the honest half is
    // "and what it answered with is not the export".
    ok: exportBody.ok === true && exportBody.chainWriteLog === undefined
      && Array.isArray(exportBody.annotations),
    route: "GET /api/domain/export",
    respondedWith: Object.keys(exportBody),
    expected: ["ok", "schemaVersion", "annotations", "comments", "relations", "chainWriteLog"],
    cause: "handleDomain 的 GET 首分支无条件返回,把 rest 解为 <partition>/<recordId>;`export` 落成一个无 recordId 的分区名,故走了未限定的 annotation 列表分支,下方 rest === \"export\" 分支对 GET 永不可达",
    consequence: "S113 写日志没有 HTTP 读面;本走查改由 VM 自身 node:sqlite 直读服务写的那个 domain.db 文件(权威源),并将该缺陷如实记录待立单"
  };
  step("criterion-write-log-http-shadowed", {
    ok: receipt.criteria.writeLogHttpReadFaceShadowed.ok,
    reasonCode: "DOMAIN_EXPORT_ROUTE_SHADOWED_BY_GET_CATCHALL"
  });
  const writes = [];
  const logBefore = await logCount();

  const created = await fetch(`${BASE}/api/chain/work`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      partitionId: PARTITION_ID,
      projectId: act1.chain.records.project,
      externalKey: walkKey,
      // Epic, not Story: the engine enforces a strict tree, and the scratch
      // chain's only parent-capable record is the Initiative. A Story under an
      // Initiative is refused GRAPH_PARENT_KIND_INVALID — which the first run
      // of this walkthrough took as a refusal, correctly, from the engine.
      kind: "Epic",
      parentId: act1.chain.records.initiative,
      title: "Rehearsal walkthrough epic (S125)"
    })
  });
  const createdBody = await created.json();
  let log = await logCount();
  writes.push({
    route: "work", status: created.status, ok: createdBody.ok === true,
    recordId: createdBody.id ?? null,
    refusal: created.ok ? null : createdBody,
    logRowsAfter: log.rows,
    logGrew: log.rows === logBefore.rows + 2,
    note: "含标题即两笔引擎调用(create + scope annotate),写日志两行"
  });
  const storyId = createdBody.id;

  const transitioned = await fetch(`${BASE}/api/chain/transition`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ partitionId: PARTITION_ID, recordId: storyId, status: "ready" })
  });
  const transitionedBody = await transitioned.json();
  const logAfterTransition = await logCount();
  writes.push({
    route: "transition", status: transitioned.status, ok: transitionedBody.ok === true,
    refusal: transitioned.ok ? null : transitionedBody,
    logRowsAfter: logAfterTransition.rows, logGrew: logAfterTransition.rows === log.rows + 1
  });
  log = logAfterTransition;

  const annotated = await fetch(`${BASE}/api/chain/annotate`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      partitionId: PARTITION_ID, recordId: storyId,
      scope: "Rehearsal walkthrough epic (S125) — annotated through the VM write face"
    })
  });
  const annotatedBody = await annotated.json();
  const logAfterAnnotate = await logCount();
  writes.push({
    route: "annotate", status: annotated.status, ok: annotatedBody.ok === true,
    refusal: annotated.ok ? null : annotatedBody,
    logRowsAfter: logAfterAnnotate.rows, logGrew: logAfterAnnotate.rows === log.rows + 1
  });
  log = logAfterAnnotate;

  const enrolled = await fetch(`${BASE}/api/chain/enrol`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      partitionId: PARTITION_ID, recordId: storyId,
      workspaceId: act1.chain.workspaceId, trainWorkId: act1.chain.records.train
    })
  });
  const enrolledBody = await enrolled.json();
  const logAfterEnrol = await logCount();
  writes.push({
    route: "enrol", status: enrolled.status, ok: enrolledBody.ok === true,
    refusal: enrolled.ok ? null : enrolledBody,
    logRowsAfter: logAfterEnrol.rows, logGrew: logAfterEnrol.rows === log.rows + 1
  });

  const vmStatusAfter = (await engineVm("status", ["--workspace", `${vmRoot}/workspace`])).json;
  receipt.criteria.chainWriteFourRoutesFullPath = {
    ok: writes.every((entry) => entry.ok && entry.logGrew),
    writes,
    writeLogLiveInstrument: {
      ok: logAfterEnrol.last?.headEventHash === vmStatusAfter.headEventHash
        && logAfterEnrol.last?.chainVersion === vmStatusAfter.version,
      lastLogHeadEventHash: logAfterEnrol.last?.headEventHash ?? null,
      chainHeadEventHash: vmStatusAfter.headEventHash,
      chainVersion: vmStatusAfter.version,
      meaning: "每笔写入落链的同时,S113 写日志行同步出现且其回执 head/version 与链权威全值一致——仪器活证"
    }
  };
  step("criterion-four-writes", {
    ok: receipt.criteria.chainWriteFourRoutesFullPath.ok
      && receipt.criteria.chainWriteFourRoutesFullPath.writeLogLiveInstrument.ok,
    reasonCode: "FOUR_WRITE_ROUTES_FULL_PATH_WITH_LIVE_WRITE_LOG",
    chainVersionAfterWrites: vmStatusAfter.version
  });
  receipt.storyId = storyId;
  receipt.walkExternalKey = walkKey;

  // ---- 7. the refusal half + the ceremony boundary ------------------------
  const illegal = await fetch(`${BASE}/api/chain/transition`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ partitionId: PARTITION_ID, recordId: storyId, status: "planned" })
  });
  const illegalBody = await illegal.json();
  const logAfterRefusal = await logCount();
  const ceremony = await fetch(`${BASE}/api/chain/gate-transition`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ partitionId: PARTITION_ID })
  });
  const ceremonyBody = await ceremony.json();
  receipt.criteria.chainWriteAndRefusal = {
    ok: illegal.status === 409 && illegalBody.reasonCode === "INVALID_TRANSITION"
      && logAfterRefusal.rows === logAfterEnrol.rows,
    refusal: { requested: "ready->planned", status: illegal.status, reasonCode: illegalBody.reasonCode },
    refusalNotLogged: logAfterRefusal.rows === logAfterEnrol.rows
  };
  receipt.criteria.ceremonialWritesStayOffHttp = {
    ok: ceremony.status === 404 && ceremonyBody.error === "not_found",
    verb: "gate-transition",
    status: ceremony.status,
    meaning: "仪式动词不是缺失的功能而是边界:治理写保留显式仪式,HTTP 面 404"
  };
  step("criterion-refusal-and-ceremony-404", {
    ok: receipt.criteria.chainWriteAndRefusal.ok && receipt.criteria.ceremonialWritesStayOffHttp.ok,
    reasonCode: "INVALID_TRANSITION_HELD_AND_CEREMONY_404",
    refusalReasonCode: illegalBody.reasonCode
  });

  // The delta the rollback rehearsal (act4) will have to enumerate and replay,
  // captured here at its source while the service that wrote it is still up.
  receipt.writeLog = await readWriteLog();
  receipt.ok = Object.values(receipt.criteria).every((criterion) => criterion.ok === true);
} catch (walkthroughFailure) {
  // A failed walkthrough must not leave the cockpit running. The rehearsal
  // already paid for this lesson once: an interrupted run left a cockpit and
  // its engine facade alive on the VM for eight and a half hours, holding port
  // 14318, with no process in this session owning the record of it.
  receipt.reclaimOnWalkthroughFailure = await reclaimVmService(vmRuntime);
  receipt.failure = String(walkthroughFailure?.message ?? walkthroughFailure);
  saveState("act3", receipt);
  throw walkthroughFailure;
} finally {
  // ---- 8. tunnel down (the VM service stays up for act4's freeze) ---------
  // Reclaimed here whether the walkthrough passed or threw, and reclaimed at
  // the MASTER as well as the client — see reclaimLocalTunnel for why killing
  // the client alone leaves the port held.
  receipt.tunnelReclaim = await reclaimLocalTunnel({
    tunnelPort: TUNNEL_PORT, vmPort: VM_PORT, tunnelPid: tunnel.pid
  });
}
step("tunnel-reclaimed", {
  ok: receipt.tunnelReclaim.ok,
  reasonCode: "TUNNEL_RECLAIMED_PORT_HAS_NO_LISTENER",
  ...receipt.tunnelReclaim
});

receipt.notClaimed = [
  "本走查不含任何切换、迁移或发布授权;矩阵结论与产品面走查同为 conformance 证据链之一环(MIN-007 切换仪式的 owner 门另行)",
  "VM 上的写面与供权是演练期供给:authority 为 rehearsal-scoped 安全写面三动词,演练毕随 scratch-rehearsal 目录一并删净",
  "服务按设计只绑 127.0.0.1;走查经 ssh -L 到达,未在任何非回环地址暴露写面",
  "服务在本幕结束时仍在运行——冻结它是回退演练(S123)的第一步,紧随其后执行"
];
receipt.finishedAt = instant();
saveState("act3", receipt);
console.log(JSON.stringify({
  ok: receipt.ok,
  criteria: Object.fromEntries(Object.entries(receipt.criteria).map(([key, value]) => [key, value.ok])),
  storyId: receipt.storyId,
  serviceLeftRunningForAct4: true
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
