#!/usr/bin/env node
// EPIC-033 proof runner: produces `evidence/aos-consistency-matrix-proof.json`
// with the three receipts the epic's stories owe —
//   1. STORY-115: a complete two-container matrix run on a SCRATCH chain
//      (built fresh, mirrored into an EventMirrorStore A side, sidecar
//      migrated as bytes) that comes out green on every applicable cell;
//   2. STORY-116: the red suite's full record, every column forced red with
//      predicted-vs-received codes;
//   3. STORY-117: the read-only per-partition instantiation table.
//
// The live chains are touched by nothing here except read-only verbs (the
// partition table's `status` calls). Every write of any kind happens on a
// scratch chain under the session scratchpad, and the scratch root is
// destroyed and verified gone before the receipt is written.
//
// Evidence hygiene: the receipt carries ZERO machine-absolute paths (roots
// are scrubbed to stable tokens, then asserted clean), and it carries its own
// no-authorization line — a matrix result is conformance evidence, never a
// switch permit.

import { mkdirSync, writeFileSync, cpSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runMatrix, loadJudges, scrubAbsolutePaths } from "./run-matrix.mjs";
import { buildScratchChain, destroyScratch } from "./scratch-chain.mjs";
import { runRedSuite } from "./red-suite.mjs";
import { buildPartitionProfile } from "./partition-profile.mjs";

export async function runProof({ scratchRoot, workspaceContainer } = {}) {
  const scratch = resolve(scratchRoot
    ?? process.env.TCRN_AOS_MATRIX_SCRATCH
    ?? join(tmpdir(), `tcrn-aos-matrix-${process.pid}`));
  mkdirSync(scratch, { recursive: true });
  const judges = await loadJudges();

  // ---- STORY-115: the scratch double run ---------------------------------
  const chain = buildScratchChain(scratch, { label: "proof" });
  let matrixRun;
  try {
    // A side: ingest the scratch chain into a real EventMirrorStore through
    // the engine's own validator, then migrate the sidecar as bytes — the
    // same two moves the switchover would make.
    const { EventMirrorStore } = await import(pathToFileURL(
      resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
    const mirrorPath = join(chain.root, "mirror.db");
    const store = new EventMirrorStore(mirrorPath);
    const appended = store.ingest("SCRATCH", chain.version, chain.events, judges);
    store.close();
    const migratedAttest = join(chain.root, "attest-migrated");
    cpSync(chain.attestDir, migratedAttest, { recursive: true });

    matrixRun = await runMatrix({
      fWorkspace: chain.workspace,
      aDatabasePath: mirrorPath,
      partitionId: "SCRATCH",
      fAttestDir: chain.attestDir,
      aAttestDir: migratedAttest,
      labels: { f: "scratch-file-container", a: "scratch-event-row-mirror" }
    });
    matrixRun.aIngest = { appended, chainVersion: chain.version };
  } finally {
    destroyScratch(chain.root);
  }

  // ---- STORY-116: the red suite ------------------------------------------
  const redSuite = await runRedSuite(scratch);

  // ---- STORY-117: the partition table (read-only) ------------------------
  const partitionProfile = await buildPartitionProfile({ workspaceContainer });

  // ---- cleanup + receipt --------------------------------------------------
  const cleanup = destroyScratch(scratch);

  const receipt = {
    schemaVersion: "aos.consistency-matrix-proof.v1",
    epic: "TCRN-AOS-EPIC-033",
    stories: ["STORY-115 matrix driver", "STORY-116 red suite", "STORY-117 partition instantiation"],
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    engineVersion: judges.engineVersion,
    authorization: "本证物不含授权:矩阵全绿+红证齐备+分区表齐备,合起来也只是 conformance-mutual-release 证据链的一环;任何切换、迁移或发布须另过 Owner 门(MIN-002 切换仪式),本文件不构成也不暗示该授权。",
    scratchDoubleRun: matrixRun,
    redSuite,
    partitionProfile,
    scratchCleanup: cleanup,
    ok: matrixRun.ok === true && redSuite.ok === true && partitionProfile.ok === true && cleanup.verified === true,
    notClaimed: [
      "scratch 双跑证明驱动器与判据在两容器上工作;它不是对任何活链 A 侧的比对结论(活分区尚无生产 A 容器)",
      "红证证明每列判据能变红;它不证明所有可能的篡改形态都被覆盖(无密钥哈希的尾部追加盲区由 C4 补位,亦仅在互指锚定后有效)",
      "A 镜像的 append-only 触发器挡意外写、不挡持句柄先 DROP 再改写的蓄意者;该形态的防线是 verify 的触发器存在性自检(EVENT_MIRROR_TRIGGERS_MISSING)与跨容器矩阵比对,红套的 DROP 后改写例即其实证",
      "分区表是 2026-07 实测快照,链会前进;复跑脚本即可重measure,不应引用陈旧数值",
      "本运行对活链只执行了只读动词(status);未持有任何租约,未写入任何分区"
    ]
  };

  // Zero machine-absolute paths in the archived artifact.
  // Longer/nested prefixes first: the repo root sits inside the platform
  // root, so the repo token must win before the platform token can eat it.
  const scrubbed = scrubAbsolutePaths(receipt, [
    [scratch, "<scratch>"],
    [process.cwd(), "<repo>"],
    [resolve(process.cwd(), ".."), "<platform>"],
    [judges.engineRoot, "<engine>"],
    [homedir(), "<home>"],
    [tmpdir(), "<tmp>"]
  ]);

  mkdirSync("evidence", { recursive: true });
  writeFileSync("evidence/aos-consistency-matrix-proof.json", `${JSON.stringify(scrubbed, null, 2)}\n`);
  return scrubbed;
}

// ---- CLI ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const result = await runProof({ scratchRoot: process.argv[2] });
  console.log(JSON.stringify({
    ok: result.ok,
    matrix: {
      ok: result.scratchDoubleRun.ok,
      cells: result.scratchDoubleRun.summary,
      anchorStable: result.scratchDoubleRun.anchorStability?.stable
    },
    redSuite: {
      ok: result.redSuite.ok,
      cases: result.redSuite.cases.length,
      findings: result.redSuite.findings.length
    },
    partitionProfile: {
      ok: result.partitionProfile.ok,
      partitions: result.partitionProfile.partitions.map((row) =>
        `${row.partition}@v${row.chain.version}`)
    },
    evidence: "evidence/aos-consistency-matrix-proof.json"
  }, null, 2));
  if (!result.ok) process.exitCode = 1;
}
