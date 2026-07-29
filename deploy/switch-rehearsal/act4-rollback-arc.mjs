#!/usr/bin/env node
// STORY-123, act four: the rollback rehearsal, six steps, on the VM.
//
// The question this act answers is not "can we restore a backup" — act one
// already proved a byte archive re-verifies. It is the harder one: after the
// product has been writing to a chain, can the writes that happened since the
// anchor be ENUMERATED, REPLAYED THROUGH THE ENGINE, and RECONCILED — and does
// the enumeration stay honest when the log contains something the engine has no
// verb for.
//
// The six steps, each with its own reason code:
//   1 freeze            — stop the write face, prove it stopped
//   2 restore the base  — baseline byte archive back, snapshot-verify AND
//                         validate both green (双绿)
//   3 enumerate         — the delta after the anchor, WITH an injected forged
//                         row that maps to no engine verb: the semantic-drift
//                         red path, which must be singled out by name rather
//                         than silently dropped or allowed to abort the run
//   4 governed replay   — each row re-issued through the VM engine's own verb
//   5 reconcile         — per-record content digests, and a final work-list
//                         count equal on both sides
//   6 new anchor        — manifest + byte archive + snapshot-verify on the
//                         rolled-back chain
//
// Containment, unchanged: every governed write here targets a workspace under
// /srv/tcrn/scratch-rehearsal-*, the live chains are not touched at all, and the
// service started by act three is reclaimed by PROCESS GROUP with the residue
// verified rather than assumed.

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  LOCAL_ENGINE, PARTITION_ID, VM_SCRATCH_PREFIX,
  engineVm, instant, loadState, placeOnVm, reclaimVmService, saveState,
  sha256Text, ssh, sshNode, vmProcessResidue
} from "./rehearsal-lib.mjs";
// The replay classifier lives in the automated test roster, not here: this act
// runs by hand against a VM, and a predicate that only ever runs by hand rots
// between runs (TCRN-AOS-INC-038).
import { classifyReplayRow, rosterIndex } from "./rehearsal-predicates.mjs";

const act1 = loadState("act1");
const act3 = loadState("act3");
const vmRoot = act1.vmRoot;
const vmRuntime = `${vmRoot}/runtime`;
const driftedWorkspace = `${vmRoot}/workspace`;
const rollbackRoot = `${vmRoot}/rollback`;
const rollbackWorkspace = `${rollbackRoot}/workspace`;
const VM_PORT = 14318;

if (!rollbackRoot.startsWith(VM_SCRATCH_PREFIX)) {
  throw new Error(`rollback root outside scratch containment: ${rollbackRoot}`);
}

const protocol = await import(pathToFileURL(
  resolve(LOCAL_ENGINE, "dist/build/packages/protocol/src/index.js")).href);

// Red modes. A judgement nobody has watched fail is not yet a judgement, so the
// two load-bearing predicates of this act each have a switch that makes the
// thing they claim to catch actually happen:
//   accept-forged      — drop the roster check, so the forged rows enter the
//                        replay set: `enumerate-delta` must go red
//   drop-one-replay-row— replay all but the last row: `reconcile` must go red
// Red runs write their own receipt file and are expected to exit non-zero.
const RED = process.env.TCRN_REHEARSAL_RED ?? "";
const STATE_NAME = RED ? `act4-red-${RED}` : "act4";

const receipt = {
  schemaVersion: "aos.switch-rehearsal-rollback.v1",
  redMode: RED || null,
  ruling: "TCRN-AOS-MIN-007 演练义务(切换仪式的回退半边);语义漂移红路径为本幕必测项",
  startedAt: instant(),
  ok: false,
  anchor: act1.anchor,
  steps: []
};
const step = (name, value) => {
  receipt.steps.push({ name, ...value });
  process.stderr.write(`[act4] ${name}: ${value.reasonCode ?? (value.ok ? "ok" : "FAILED")}\n`);
  if (value.ok === false) {
    saveState(STATE_NAME, receipt);
    throw new Error(`act4 step failed: ${name}`);
  }
};

/** The write log, read from the file the cockpit writes, by the VM's own node. */
async function readWriteLog() {
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
    headEventHash: row.head_event_hash, at: row.at, switchAnchor: row.switch_anchor,
    source: "vm-domain.db (the file the cockpit wrote)"
  }));
}

/** Content state of a chain, by record, from the engine's own read verbs. */
async function chainContent(workspace) {
  const list = (await engineVm("work-list", ["--workspace", workspace, "--limit", "500"])).json;
  const records = [];
  for (const row of list.records) {
    const shown = (await engineVm("work-show", ["--workspace", workspace, "--id", row.id])).json;
    // The digest covers what the record IS, not when it was read: head hash and
    // chain version are properties of the chain at read time and would make
    // every comparison fail for the one reason that is expected to differ.
    const content = { record: shown.record, advisory: shown.advisory ?? null };
    records.push({
      id: row.id,
      externalKey: row.externalKey,
      contentDigest: sha256Text(protocol.canonicalJson(content).toString("utf8")),
      content
    });
  }
  records.sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    workspaceId: list.workspaceId,
    version: list.version,
    headEventHash: list.headEventHash,
    total: list.total,
    records
  };
}

let frozen = false;
try {
  // ---- 1. freeze -----------------------------------------------------------
  // Capture first, then stop: the write log lives in the running service's
  // database, and a freeze that discarded it would leave nothing to enumerate.
  const logAtFreeze = await readWriteLog();
  const driftedBefore = await chainContent(driftedWorkspace);
  const healthBefore = await ssh(["curl", "-s", "-m", "3", `http://127.0.0.1:${VM_PORT}/api/health`],
    { allowFailure: true });
  const reclaimed = await reclaimVmService(vmRuntime);
  frozen = true;
  const healthAfter = await ssh(["curl", "-s", "-m", "3", `http://127.0.0.1:${VM_PORT}/api/health`],
    { allowFailure: true });
  step("freeze-write-face", {
    // Two-sided by construction: the same probe answered before and refuses
    // after. A freeze proven only by "we sent SIGTERM" proves nothing.
    ok: healthBefore.code === 0 && healthBefore.stdout.includes("\"ok\":true")
      && healthAfter.code !== 0
      && reclaimed.residueAfter.total === 0 && reclaimed.listenersAfter === 0,
    reasonCode: "WRITE_FACE_FROZEN_AND_PROCESS_GROUP_EMPTY",
    healthBeforeAnswered: healthBefore.code === 0,
    healthAfterRefused: healthAfter.code !== 0,
    reclaim: reclaimed,
    writeLogRowsCaptured: logAtFreeze.length,
    driftedHeadEventHash: driftedBefore.headEventHash,
    driftedVersion: driftedBefore.version
  });
  receipt.frozen = {
    writeLog: logAtFreeze,
    drifted: { version: driftedBefore.version, headEventHash: driftedBefore.headEventHash, records: driftedBefore.total }
  };

  // ---- 2. restore the base -------------------------------------------------
  // The baseline byte archive act one took at the anchor, put back as bytes.
  // snapshot-verify runs on those bytes BEFORE placement (placement rewrites
  // workspace.json, so verifying after it would be verifying something else);
  // validate runs after, because a transplanted workspace cannot replay until
  // its five root paths name where it now lives.
  await ssh(["rm", "-rf", rollbackRoot]);
  await ssh(["mkdir", "-p", rollbackWorkspace]);
  await ssh(["cp", "-a", `${vmRoot}/baseline/.tcrn-workflow`, `${rollbackWorkspace}/.tcrn-workflow`]);
  const restoredVerify = await engineVm("snapshot-verify",
    ["--root", rollbackWorkspace, "--manifest", `${vmRoot}/anchor/chain-snapshot-manifest.json`]);
  const restoredVerifyReason = restoredVerify.json.reasonCode ?? restoredVerify.json.result?.reasonCode;
  const placement = await placeOnVm(rollbackRoot, "workspace");
  const restoredValidate = await engineVm("validate", ["--workspace", rollbackWorkspace]);
  const restoredStatus = (await engineVm("status", ["--workspace", rollbackWorkspace])).json;
  step("restore-base-double-green", {
    ok: restoredVerifyReason === "SNAPSHOT_VERIFIED"
      && restoredValidate.json.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
      && restoredStatus.headEventHash === act1.anchor.headEventHash
      && restoredStatus.version === act1.anchor.version,
    reasonCode: "BASE_RESTORED_SNAPSHOT_AND_VALIDATE_BOTH_GREEN",
    snapshotVerify: restoredVerifyReason,
    validate: restoredValidate.json.reasonCode,
    placement,
    restoredHeadEventHash: restoredStatus.headEventHash,
    restoredVersion: restoredStatus.version,
    anchorHeadEventHash: act1.anchor.headEventHash,
    headFullValueEqualsAnchor: restoredStatus.headEventHash === act1.anchor.headEventHash
  });

  // ---- 3. enumerate the delta, with the semantic-drift red path ------------
  // The classifier's authority is the engine's own command roster, fetched
  // live — not a list transcribed into this file, which would answer today's
  // question from whatever the roster looked like the day it was typed.
  const roster = (await engineVm("commands", [])).json.commands;
  const byName = rosterIndex(roster);
  const forged = [
    {
      seq: 9001, partitionId: PARTITION_ID,
      verb: "tcrn_workflow_work_bless",
      argsJson: JSON.stringify({ workspace: driftedWorkspace, "expected-version": "head",
        at: "2026-07-29T02:30:00Z", actor: "agent:fable", id: act3.storyId }),
      recordId: act3.storyId, chainVersion: null, headEventHash: null,
      at: "2026-07-29T02:30:00Z", switchAnchor: null,
      source: "rehearsal-injected forgery (semantic drift: 语义漂移)",
      forgery: "well-formed facade tool name for a verb the engine does not have"
    },
    {
      seq: 9002, partitionId: PARTITION_ID,
      verb: "tcrn_workflow_work_annotate",
      argsJson: JSON.stringify({ workspace: driftedWorkspace, "expected-version": "head",
        at: "2026-07-29T02:30:01Z", actor: "agent:fable", id: act3.storyId,
        scope: "forged", "provenance-note": "a flag this verb does not declare" }),
      recordId: act3.storyId, chainVersion: null, headEventHash: null,
      at: "2026-07-29T02:30:01Z", switchAnchor: null,
      source: "rehearsal-injected forgery (semantic drift: 语义漂移)",
      forgery: "real verb, one argument the engine's roster does not declare for it"
    }
  ];
  const enumerated = [...logAtFreeze, ...forged];
  const replayable = [];
  const nonReplayable = [];
  for (const row of enumerated) {
    // Delta membership: strictly after the anchor. Stated as a rule over the
    // recorded version rather than "everything in the log", so a log that
    // spanned two epochs would still enumerate one.
    const afterAnchor = row.chainVersion === null || row.chainVersion > act1.anchor.version;
    if (!afterAnchor) continue;
    // The judgement itself is rehearsal-predicates.mjs; what stays here is the
    // live roster it judges against and the ledger the verdicts go into.
    const verdict = classifyReplayRow(row, byName, { acceptForged: RED === "accept-forged" });
    if (!verdict.replayable) {
      nonReplayable.push({
        ...row,
        derivedVerb: verdict.derivedVerb,
        ...(verdict.undeclaredFlags ? { undeclaredFlags: verdict.undeclaredFlags } : {}),
        reasonCode: verdict.reasonCode
      });
      continue;
    }
    replayable.push({ ...row, derivedVerb: verdict.derivedVerb, args: verdict.args });
  }
  const forgedSeqs = new Set(forged.map((row) => row.seq));
  const forgedOutcome = nonReplayable.filter((row) => forgedSeqs.has(row.seq));
  step("enumerate-delta", {
    // The red path's assertion is threefold and each part can fail on its own:
    // the forgeries are present (not dropped), each carries its OWN reason code
    // (not lumped together), and the genuine rows still enumerate (the run was
    // not aborted by the bad row).
    ok: replayable.length === logAtFreeze.length
      && forgedOutcome.length === forged.length
      && new Set(forgedOutcome.map((row) => row.reasonCode)).size === forged.length
      && replayable.length + nonReplayable.length === enumerated.length,
    reasonCode: "DELTA_ENUMERATED_WITH_SEMANTIC_DRIFT_SINGLED_OUT",
    enumerated: enumerated.length,
    replayable: replayable.length,
    nonReplayable: nonReplayable.map((row) => ({
      seq: row.seq, verb: row.verb, derivedVerb: row.derivedVerb ?? null,
      reasonCode: row.reasonCode, source: row.source, forgery: row.forgery ?? null,
      undeclaredFlags: row.undeclaredFlags ?? null
    })),
    classifierAuthority: "VM 引擎自身的 commands 名册(实时取,97 条),不是本文件里抄下来的清单",
    honesty: "伪造行既没有被静默丢弃,也没有中断整场枚举:它们各带自己的 reason 码单列呈报,真行照常入列"
  });
  receipt.enumeration = { replayable: replayable.map((row) => ({ seq: row.seq, verb: row.verb, derivedVerb: row.derivedVerb })), nonReplayable };

  // ---- 4. governed replay --------------------------------------------------
  // Named finding, stated rather than worked around: none of the mutating work
  // verbs in the engine's roster carries a free-form provenance field. The only
  // free-text field on the path is `scope`, and scope is the very content the
  // reconciliation compares — writing provenance there would corrupt the thing
  // being proven. So provenance is bound per row in a canonical replay ledger
  // whose digest is carried into the new anchor, and the chain keeps the
  // ORIGINAL `at` and `actor` of each write, which is the provenance the chain
  // itself can hold.
  const provenanceFlagCandidates = ["provenance", "note", "origin", "source", "comment"];
  const provenanceFlagAvailable = ["work-create", "work-transition", "work-annotate"]
    .flatMap((name) => byName.get(name)?.flags ?? [])
    .some((flag) => provenanceFlagCandidates.includes(flag.name));
  const replayLedger = [];
  const toReplay = RED === "drop-one-replay-row" ? replayable.slice(0, -1) : replayable;
  for (const row of toReplay) {
    const args = { ...row.args, workspace: rollbackWorkspace };
    const argv = [];
    for (const [key, value] of Object.entries(args)) {
      argv.push(`--${key}`);
      argv.push(Array.isArray(value) ? (value.length === 0 ? "-" : value.join(",")) : String(value));
    }
    const result = await engineVm(row.derivedVerb, argv);
    replayLedger.push({
      sourceSeq: row.seq,
      sourceVerb: row.verb,
      sourceChainVersion: row.chainVersion,
      sourceHeadEventHash: row.headEventHash,
      sourceArgsDigest: sha256Text(row.argsJson),
      sourceAt: row.at,
      sourceActor: row.args.actor ?? null,
      replayedVerb: row.derivedVerb,
      replayedWorkspace: rollbackWorkspace,
      replayReasonCode: result.json.reasonCode,
      replayRecordId: result.json.record?.id ?? null,
      replayChainVersion: result.json.version ?? null,
      replayHeadEventHash: result.json.headEventHash ?? null
    });
  }
  const replayLedgerDigest = sha256Text(
    protocol.canonicalJson({ schemaVersion: "aos.rollback-replay-ledger.v1", entries: replayLedger })
      .toString("utf8"));
  step("governed-replay", {
    ok: replayLedger.length === toReplay.length
      && replayLedger.every((entry) => entry.replayReasonCode === "WORKSPACE_COMMAND_COMPLETED")
      && replayLedger.every((entry, index) => index === 0
        || entry.replayChainVersion === replayLedger[index - 1].replayChainVersion + 1),
    reasonCode: "DELTA_REPLAYED_THROUGH_ENGINE_VERBS",
    replayed: replayLedger.length,
    rowsWithheld: replayable.length - toReplay.length,
    replayLedgerDigest,
    provenance: {
      onChainFreeFormFieldAvailable: provenanceFlagAvailable,
      finding: "引擎三个安全写动词的 flags 里没有任何自由文本 provenance 字段(判据取自实时 commands 名册);唯一自由文本是 scope,而 scope 正是对账要比的内容——把出处写进 scope 会污染被证的东西",
      boundBy: "每笔一条的规范化重放账本(sourceSeq/sourceArgsDigest/sourceHeadEventHash → replayHeadEventHash),其摘要随第六步新锚一并落证",
      chainSideProvenance: "链上保留每笔的原始 at 与 actor(未改写),这是链本身能承载的那一半出处"
    }
  });
  receipt.replay = { ledger: replayLedger, ledgerDigest: replayLedgerDigest };

  // ---- 5. reconcile --------------------------------------------------------
  const rolledBack = await chainContent(rollbackWorkspace);
  const driftedByKey = new Map(driftedBefore.records.map((row) => [row.id, row]));
  const perRecord = rolledBack.records.map((row) => ({
    id: row.id,
    externalKey: row.externalKey,
    rolledBackDigest: row.contentDigest,
    driftedDigest: driftedByKey.get(row.id)?.contentDigest ?? null,
    equal: driftedByKey.get(row.id)?.contentDigest === row.contentDigest
  }));
  const missingOnRolledBack = driftedBefore.records
    .filter((row) => !rolledBack.records.some((other) => other.id === row.id))
    .map((row) => row.id);
  step("reconcile", {
    ok: perRecord.length > 0 && perRecord.every((entry) => entry.equal)
      && missingOnRolledBack.length === 0
      && rolledBack.total === driftedBefore.total,
    reasonCode: "ROLLBACK_RECONCILED_CONTENT_EQUAL_AND_COUNTS_EQUAL",
    perRecord,
    missingOnRolledBack,
    counts: { drifted: driftedBefore.total, rolledBack: rolledBack.total },
    versions: { drifted: driftedBefore.version, rolledBack: rolledBack.version },
    note: "版本号两侧本就不必相等:重放是新事件,链只增不改。相等的是内容(逐记录规范摘要)与终检计数——那才是回退要还原的东西"
  });
  receipt.reconciliation = { perRecord, counts: { drifted: driftedBefore.total, rolledBack: rolledBack.total } };

  // ---- 6. new anchor -------------------------------------------------------
  // Lockstep first. `snapshot-manifest` refuses KNOWLEDGE_HIGH_WATER_MISMATCH
  // while the knowledge store's high-water digest still names the anchor the
  // replay moved past — the same precondition act two met on the live-chain
  // copy. Anchoring after a replay is therefore not one step but two, and the
  // first of them is a governed write: a rollback ceremony that budgeted only
  // for "take a manifest" would discover this at the worst moment.
  const beforeRebase = (await engineVm("status", ["--workspace", rollbackWorkspace])).json;
  const knowledgeMarker = JSON.parse(
    (await ssh(["cat", `${rollbackWorkspace}/.tcrn-workflow/knowledge/store.json`])).stdout);
  const rebase = await engineVm("knowledge-rebase", ["--workspace", rollbackWorkspace,
    "--expected-version", String(knowledgeMarker.version), "--at", instant()]);
  const afterRebase = (await engineVm("status", ["--workspace", rollbackWorkspace])).json;
  step("knowledge-lockstep-restored", {
    ok: rebase.json.reasonCode === "KNOWLEDGE_STORE_REBASED"
      && afterRebase.headEventHash === beforeRebase.headEventHash
      && afterRebase.version === beforeRebase.version,
    reasonCode: "KNOWLEDGE_LOCKSTEP_RESTORED_EVENT_STREAM_UNTOUCHED",
    highWaterBefore: knowledgeMarker.eventHighWaterDigest,
    highWaterAfter: rebase.json.eventHighWaterDigest ?? null,
    eventStreamUntouched: afterRebase.headEventHash === beforeRebase.headEventHash,
    finding: "重放后取新锚是两步不是一步:先 knowledge-rebase 恢复锁步(元数据写,事件流不动),再 snapshot-manifest;否则引擎以 KNOWLEDGE_HIGH_WATER_MISMATCH 拒绝"
  });

  const anchorAt = instant();
  const manifestRaw = (await ssh(["node", "/srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs",
    "snapshot-manifest", "--workspace", rollbackWorkspace, "--at", anchorAt])).stdout;
  await sshNode(`
    const fs = require("fs");
    fs.mkdirSync(${JSON.stringify(`${rollbackRoot}/anchor`)}, { recursive: true });
    fs.writeFileSync(${JSON.stringify(`${rollbackRoot}/anchor/chain-snapshot-manifest.json`)},
      Buffer.from(${JSON.stringify(Buffer.from(manifestRaw, "utf8").toString("base64"))}, "base64"));
    fs.cpSync(${JSON.stringify(`${rollbackWorkspace}/.tcrn-workflow`)},
      ${JSON.stringify(`${rollbackRoot}/baseline/.tcrn-workflow`)}, { recursive: true });
    process.stdout.write("{}");
  `);
  const newVerify = await engineVm("snapshot-verify",
    ["--root", `${rollbackRoot}/baseline`, "--manifest", `${rollbackRoot}/anchor/chain-snapshot-manifest.json`]);
  const newVerifyReason = newVerify.json.reasonCode ?? newVerify.json.result?.reasonCode;
  const finalStatus = (await engineVm("status", ["--workspace", rollbackWorkspace])).json;
  step("new-anchor", {
    ok: newVerifyReason === "SNAPSHOT_VERIFIED",
    reasonCode: "NEW_ANCHOR_MINTED_AND_VERIFIED",
    anchorAt,
    headEventHash: finalStatus.headEventHash,
    version: finalStatus.version,
    manifestDigest: sha256Text(manifestRaw),
    replayLedgerDigest,
    snapshotVerify: newVerifyReason
  });
  receipt.newAnchor = {
    at: anchorAt,
    headEventHash: finalStatus.headEventHash,
    version: finalStatus.version,
    manifestDigest: sha256Text(manifestRaw),
    replayLedgerDigest
  };

  receipt.ok = true;
} catch (failure) {
  if (!frozen) receipt.reclaimOnFailure = await reclaimVmService(vmRuntime);
  receipt.failure = String(failure?.message ?? failure);
  saveState(STATE_NAME, receipt);
  throw failure;
}

receipt.residueAtEnd = await vmProcessResidue();
receipt.notClaimed = [
  "本幕不含任何切换或发布授权:它只证明「锚 + 写日志」这一对足以把产品期的漂移还原成内容等价的链",
  "重放后的链版本高于漂移侧,这是设计使然而非缺陷:事件只增不改,回退还原的是内容不是版本号",
  "语义漂移的两行是本演练自己注入的伪造行,已在证物中逐行标注来源;它们没有进入任何链",
  "引擎的安全写动词没有自由文本 provenance 字段,故逐笔出处绑在规范化重放账本上而非链事件里——这是被记录的限制,不是被绕过的要求"
];
receipt.finishedAt = instant();
saveState(STATE_NAME, receipt);
console.log(JSON.stringify({
  ok: receipt.ok,
  steps: receipt.steps.map((entry) => entry.reasonCode),
  replayed: receipt.replay.ledger.length,
  singledOut: receipt.enumeration.nonReplayable.length,
  newAnchor: receipt.newAnchor,
  residueAtEnd: receipt.residueAtEnd
}, null, 2));
if (!receipt.ok) process.exitCode = 1;
