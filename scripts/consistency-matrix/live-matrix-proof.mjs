#!/usr/bin/env node
// The live-chain consistency matrix (STORY-114 unblock, MIN-008 opening condition).
//
// What changed since `evidence/aos-consistency-matrix-proof.json`. That receipt
// proved the driver works on a SCRATCH chain, and recorded — honestly — that
// the live partitions had no A container at all, so R1/R3's eight A-side cells
// came back `acceptance-gate-pending`. They were pending because the live A
// side could not be built: `EventMirrorStore.ingest` needs the whole event list
// and `export` refuses this partition at the one-MiB canonical ceiling.
//
// `event-list` (engine v0.8.0) is the way through, and `readAllEvents` is the
// checked assembly of its pages. This script builds the live A side through it
// and runs the matrix with both containers really present.
//
// Read-only on the chain, with one named exception recorded below: the
// knowledge-rebase that put the knowledge high-water mark back in lockstep with
// the chain head. That verb is a governed write and this script does NOT run
// it; it was run once, by hand, under an explicit owner authorization, and the
// before/after head hashes recorded here are what proves the event stream did
// not move under it. Everything this script itself executes is a read.
//
// Evidence hygiene: zero machine-absolute paths, and its own no-authorization
// line. A green matrix is conformance evidence. It is not a switch permit.

import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runMatrix, loadJudges, scrubAbsolutePaths, engineRead, sha256Text } from "./run-matrix.mjs";
import { liveMirrorIngest } from "./live-mirror-ingest.mjs";

const PARTITION_ID = "TCRN-AOS";

/** The knowledge-rebase transcript: recorded facts from the authorized hand-run. */
const LOCKSTEP_TRANSCRIPT = {
  authorization: "Owner 授权:仅 knowledge-rebase 一个 mutating 动词可在活 AOS 链上运行;其余一律只读",
  verb: "knowledge-rebase",
  why: "矩阵取锚前要求知识高水位 == 链头;不满足时 snapshot-manifest 会在半途 fail-closed(KNOWLEDGE_HIGH_WATER_MISMATCH)",
  whyItCannotMoveTheChain:
    "rebaseKnowledgeStore(engine v0.8.0 knowledge-core.ts)只写 knowledge/ 下的 store.json、index 与 metadata,并把 marker 的 eventHighWaterDigest 置为 workspace.headEventHash;它不调用任何 append 路径。源读为据,下面的前后哈希为证。",
  // Pinned to one run on purpose: the third conjunct below ties this transcript
  // to the chain as it stands now, so a stale transcript reddens rather than
  // vouching for a state it never saw. Refresh it whenever a new rebase runs.
  before: {
    knowledgeMarkerVersion: 8,
    knowledgeEventHighWaterDigest: "81d757b430cfd63d11d1481d810fa501d08474f555a31f8461d05cdfdbca3539",
    statusHeadEventHash: "81d757b430cfd63d11d1481d810fa501d08474f555a31f8461d05cdfdbca3539",
    statusVersion: 725,
    eventSegmentSetDigest: "9b428d3ba41be645ef92bcc9f6ad80e26c3666281159ce3ca04a2bbc3ba542cc",
    eventSegments: 12
  },
  receipt: {
    reasonCode: "KNOWLEDGE_STORE_REBASED",
    version: 9,
    retired: 0,
    offenders: [],
    eventHighWaterDigest: "81d757b430cfd63d11d1481d810fa501d08474f555a31f8461d05cdfdbca3539"
  },
  after: {
    knowledgeMarkerVersion: 9,
    knowledgeEventHighWaterDigest: "81d757b430cfd63d11d1481d810fa501d08474f555a31f8461d05cdfdbca3539",
    statusHeadEventHash: "81d757b430cfd63d11d1481d810fa501d08474f555a31f8461d05cdfdbca3539",
    statusVersion: 725,
    validateReasonCode: "WORKSPACE_COMMAND_COMPLETED",
    eventSegmentSetDigest: "9b428d3ba41be645ef92bcc9f6ad80e26c3666281159ce3ca04a2bbc3ba542cc",
    eventSegments: 12
  }
};

const digestOfDirectory = (directory) => {
  const names = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  const lines = names.map((name) =>
    `${name} ${createHash("sha256").update(readFileSync(join(directory, name))).digest("hex")}`);
  return { files: names.length, setDigest: sha256Text(lines.join("\n")) };
};

export async function runLiveProof({ workspace, scratchRoot, attestDir, engineRoot }) {
  const judges = await loadJudges(engineRoot);
  const scratch = resolve(scratchRoot);
  mkdirSync(scratch, { recursive: true });

  // ---- 0. lockstep, verified read-only against the current chain ----------
  const statusNow = JSON.parse(engineRead(judges.engineRoot, "status", ["--workspace", workspace]));
  const marker = JSON.parse(readFileSync(join(workspace, ".tcrn-workflow/knowledge/store.json"), "utf8"));
  const lockstep = {
    ...LOCKSTEP_TRANSCRIPT,
    verifiedNow: {
      knowledgeHighWaterDigest: marker.eventHighWaterDigest,
      chainHeadEventHash: statusNow.headEventHash,
      inLockstep: marker.eventHighWaterDigest === statusNow.headEventHash,
      // The claim that matters is not "the rebase succeeded" but "the event
      // stream did not move while it ran". Compared at full digest length.
      eventStreamUnmovedAcrossRebase:
        LOCKSTEP_TRANSCRIPT.before.statusHeadEventHash === LOCKSTEP_TRANSCRIPT.after.statusHeadEventHash
        && LOCKSTEP_TRANSCRIPT.before.eventSegmentSetDigest === LOCKSTEP_TRANSCRIPT.after.eventSegmentSetDigest
        && LOCKSTEP_TRANSCRIPT.after.statusHeadEventHash === statusNow.headEventHash
    }
  };

  // ---- 1. the live A side, built through the paged governed read ----------
  const mirrorPath = join(scratch, "aos-live-mirror.db");
  const ingest = await liveMirrorIngest({
    workspace, partitionId: PARTITION_ID, mirrorPath, engineRoot: judges.engineRoot, freshMirror: true
  });

  // ---- 2. the oversize path, forced against the real engine ---------------
  // Not a simulation: a 1024-event window really does exceed the canonical
  // ceiling on this partition, so the engine really does raise
  // CLI_EVENT_PAGE_OVERSIZED and the loop really does halve and retry.
  const oversizePath = join(scratch, "aos-live-mirror-oversize.db");
  const oversize = await liveMirrorIngest({
    workspace, partitionId: PARTITION_ID, mirrorPath: oversizePath,
    engineRoot: judges.engineRoot, initialLimit: 1024, freshMirror: true
  });

  // ---- 3. the red: a middle page dropped on the live read -----------------
  // The mutation happens in the reader wrapper, never on the chain. The chain
  // is read exactly as in step 1; one assembled page is discarded before the
  // assertions run, which is precisely the failure a trusted concatenation
  // would not notice.
  const projection = await import(pathToFileURL(
    resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
  const client = new projection.ChainClient({
    serverPath: resolve(judges.engineRoot, "scripts/tcrn-workflow-mcp.mjs"),
    timeoutMs: 120_000
  });
  const red = [];
  try {
    await client.start();
    const status = await client.callTool("tcrn_workflow_status", { workspace });
    const anchor = { workspaceId: status.workspaceId, version: status.version, headEventHash: status.headEventHash };
    const pages = [];
    for (let offset = 0; offset < anchor.version; offset += 64) {
      pages.push(await client.callTool("tcrn_workflow_event_list", { workspace, limit: 64, offset }));
    }

    // Control first. The same page set, unmutated, must assemble green — or a
    // red below would prove nothing about the mutation.
    const control = (() => {
      try {
        const { events } = projection.assembleEventPages(pages, anchor);
        return { mutation: "none (control)", expectedReasonCode: null, receivedReasonCode: null, events: events.length, ok: events.length === anchor.version };
      } catch (error) {
        return { mutation: "none (control)", expectedReasonCode: null, receivedReasonCode: error?.reasonCode ?? null, ok: false };
      }
    })();
    red.push(control);

    const attempt = (mutation, mutated, expectedReasonCode) => {
      try {
        projection.assembleEventPages(mutated, anchor);
        red.push({ mutation, expectedReasonCode, receivedReasonCode: null, ok: false,
          note: "the assembly returned instead of refusing — this assertion is not load-bearing" });
      } catch (error) {
        red.push({
          mutation, expectedReasonCode,
          receivedReasonCode: error?.reasonCode ?? null,
          detail: error?.detail ?? null,
          ok: error?.reasonCode === expectedReasonCode
        });
      }
    };

    const droppedIndex = 5;
    attempt(
      `drop page #${droppedIndex} of ${pages.length} (offset ${droppedIndex * 64}, ${pages[droppedIndex]?.records.length ?? 0} events) from the live page set`,
      pages.filter((unused, index) => index !== droppedIndex),
      "EVENT_PAGING_COUNT_MISMATCH"
    );
    // The same loss with the count restored by repeating an earlier page: the
    // count check cannot see this one, so it proves contiguity is load-bearing
    // and not decoration on top of a count that already decided everything.
    attempt(
      `drop page #${droppedIndex} and repeat page #${droppedIndex - 1} so the total still equals the chain version`,
      pages.map((page, index) => (index === droppedIndex ? pages[droppedIndex - 1] : page)),
      "EVENT_PAGING_SEQUENCE_GAP"
    );
  } finally {
    await client.stop();
  }

  // ---- 4. the sidecar, migrated as bytes ----------------------------------
  const migratedAttest = join(scratch, "attest-migrated");
  rmSync(migratedAttest, { recursive: true, force: true });
  cpSync(attestDir, migratedAttest, { recursive: true });
  const attestProof = {
    f: digestOfDirectory(attestDir),
    a: digestOfDirectory(migratedAttest),
    // Recorded so "the copy is a copy, not the same bytes twice" is a fact on
    // file rather than an assumption: same digest, different inode.
    sampleInodes: (() => {
      const name = readdirSync(attestDir).filter((entry) => entry.endsWith(".json")).sort()[0];
      if (!name) return null;
      const fStat = statSync(join(attestDir, name));
      const aStat = statSync(join(migratedAttest, name));
      return { sameDevIno: fStat.dev === aStat.dev && fStat.ino === aStat.ino };
    })()
  };

  // ---- 5. the matrix, both containers present -----------------------------
  const matrix = await runMatrix({
    fWorkspace: workspace,
    aDatabasePath: mirrorPath,
    partitionId: PARTITION_ID,
    fAttestDir: attestDir,
    aAttestDir: migratedAttest,
    engineRoot: judges.engineRoot,
    whitelistPath: resolve(process.cwd(), "scripts/consistency-matrix/na-whitelist.json"),
    labels: { f: "live-chain-file-container", a: "live-event-row-mirror" }
  });

  const cellVerdict = (id) => matrix.cells?.find((entry) => entry.cell === id)?.verdict ?? null;
  const r1r3 = Object.fromEntries(["R1", "R3"].flatMap((row) =>
    ["C1", "C2", "C3", "C4"].map((col) => [`${row}${col}`, cellVerdict(`${row}${col}`)])));
  const r1r3AllJudged = Object.values(r1r3).every((verdict) => verdict === "equal");
  const r1r3AnyPending = Object.values(r1r3).some((verdict) => verdict === "acceptance-gate-pending");

  const receipt = {
    schemaVersion: "aos.live-consistency-matrix-proof.v1",
    story: "TCRN-AOS-STORY-114",
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    engineVersion: judges.engineVersion,
    authorization:
      "本证物不含授权:活链矩阵结论只是 conformance-mutual-release 证据链之一环。任何切换、迁移或发布须另过 Owner 门(MIN-002 切换仪式),本文件不构成也不暗示该授权。文中记录的 knowledge-rebase 是一次已获点名授权的例外写入,该授权只覆盖那一个动词那一次运行。",
    partition: PARTITION_ID,
    readSurface: ingest.surface,
    lockstep,
    liveIngest: ingest,
    oversizeBackoff: {
      initialLimit: oversize.paging.initialLimit,
      finalLimit: oversize.paging.finalLimit,
      oversizedRefusals: oversize.paging.oversizedRefusals,
      windowsUsed: oversize.paging.windowsUsed,
      windowSteps: oversize.paging.windowSteps,
      rows: oversize.mirror.rows,
      verifyOk: oversize.mirror.verifyOk,
      meaning: "同一条链、同一条通路,窗口 1024 被引擎按 CLI_EVENT_PAGE_OVERSIZED 拒绝,降到 512 后走通并装配出同一条 711 事件流"
    },
    pagingRedProof: red,
    attestationSidecar: attestProof,
    matrix,
    r1r3Verdicts: r1r3,
    ok: matrix.ok === true && r1r3AllJudged && !r1r3AnyPending && red.every((entry) => entry.ok === true)
      && lockstep.verifiedNow.inLockstep === true
      && lockstep.verifiedNow.eventStreamUnmovedAcrossRebase === true,
    notClaimed: [
      "矩阵全绿证明两容器此刻持有同一条链;它不证明 A 容器在任何未来时点仍会持有,也不证明切换本身安全",
      "分页装配的四条断言证明「读回来的是这条链的完整事件流」;哈希链是否成立由引擎 validateEventChain 判,不由这里判——实证:本次接线首跑正是被 validateEventChain 判红(EVENT_CHAIN_CORRUPT),四条装配断言全绿也没拦住,因为损坏落在链中段的载荷字节上而非计数、序号或链尾",
      "无密钥哈希链挡不住整链重算式的尾部追加伪造;该盲区由 C4 互指与外部见证补位,本运行不改变这一点",
      "行镜像按 MIN-007 O3 裁定明确不备份,本证物记录的镜像库位于会话 scratch,收尾即删",
      "本运行只对活链执行只读动词(status/validate/export/snapshot-manifest/event-list);knowledge-rebase 是运行之外、经点名授权的一次手动写入,其前后哈希在 lockstep 段留证"
    ]
  };

  return { receipt, scratch, mirrorPath, oversizePath, migratedAttest };
}

// ---- CLI ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const platformRoot = resolve(process.cwd(), "..");
  const workspace = resolve(flag("workspace",
    join(platformRoot, ".tcrn-workspace/TCRN-AOS/workspace")));
  const attestDir = resolve(flag("attest-dir",
    join(platformRoot, ".tcrn-workspace/TCRN-AOS/attestations")));
  const scratchRoot = resolve(flag("scratch",
    join(tmpdir(), `tcrn-aos-live-matrix-${process.pid}`)));

  const { receipt, scratch } = await runLiveProof({ workspace, attestDir, scratchRoot });

  const scrubbed = scrubAbsolutePaths(receipt, [
    [scratch, "<scratch>"],
    [process.cwd(), "<repo>"],
    [platformRoot, "<platform>"],
    [resolve(homedir(), ".tcrn-workflow/tcrn-workflow"), "<engine>"],
    [homedir(), "<home>"],
    [tmpdir(), "<tmp>"]
  ]);
  mkdirSync("evidence", { recursive: true });
  writeFileSync("evidence/aos-live-matrix-proof.json", `${JSON.stringify(scrubbed, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: scrubbed.ok,
    lockstep: scrubbed.lockstep.verifiedNow,
    ingest: { rows: scrubbed.liveIngest.mirror.rows, pages: scrubbed.liveIngest.paging.pages },
    oversize: {
      refusals: scrubbed.oversizeBackoff.oversizedRefusals,
      windows: scrubbed.oversizeBackoff.windowsUsed
    },
    red: scrubbed.pagingRedProof.map((entry) => ({ expected: entry.expectedReasonCode, received: entry.receivedReasonCode, ok: entry.ok })),
    matrix: { ok: scrubbed.matrix.ok, summary: scrubbed.matrix.summary, reasonCode: scrubbed.matrix.reasonCode ?? null },
    r1r3: scrubbed.r1r3Verdicts,
    evidence: "evidence/aos-live-matrix-proof.json"
  }, null, 2));
  if (!scrubbed.ok) process.exitCode = 1;
}
