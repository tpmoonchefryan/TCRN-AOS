#!/usr/bin/env node
// Per-partition matrix instantiation table (EPIC-033 / STORY-117).
//
// The matrix was designed against the AOS partition's shape, but the four
// live partitions are NOT the same shape (the recon proved it: attestation
// never enabled on TMS, sidecar receipts only beside AOS, the domain store
// only paired with AOS, two chains already past the 1MiB whole-document
// export ceiling). Running the matrix "the same way everywhere" would
// therefore quietly measure different things under one name. This table
// measures each partition — READ-ONLY, nothing here runs a mutating verb or
// opens a write handle — and instantiates, per partition, which cells are
// n/a under the frozen whitelist, which anchor form applies, and which
// export path the byte budget forces.
//
// The TMS R5 row is the worked example the story names: it is n/a WITH an
// executable predicate whose live result is recorded (zero
// `attestation.actor.enabled` events across its segments), so the claim
// stays checkable instead of hardening into folklore.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ALL_CELLS, FORBIDDEN_NA_CELLS,
  loadJudges, loadWhitelist, whitelistLookup, engineRead
} from "./run-matrix.mjs";

const MAX_CANONICAL_BYTES = 1_048_576; // PROTOCOL_LIMITS.maxCanonicalBytes

export const DEFAULT_PARTITIONS = Object.freeze(
  ["cross-project", "TCRN-Design-System", "TCRN-TMS", "TCRN-AOS"]);

function readEvents(workspaceRoot) {
  const dir = join(workspaceRoot, ".tcrn-workflow/events");
  const names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  let bytes = 0;
  const events = [];
  for (const name of names) {
    const path = join(dir, name);
    bytes += statSync(path).size;
    events.push(...JSON.parse(readFileSync(path, "utf8")));
  }
  return { segments: names.length, bytes, events };
}

export async function buildPartitionProfile({ workspaceContainer, partitions = DEFAULT_PARTITIONS,
  domainDatabasePath = process.env.AOS_DOMAIN_DB ?? resolve(homedir(), ".tcrn-aos/domain.db") } = {}) {
  const judges = await loadJudges();
  const whitelist = loadWhitelist();
  const container = workspaceContainer ?? resolve(process.cwd(), "../.tcrn-workspace");
  const rows = [];

  for (const partition of partitions) {
    const partitionRoot = join(container, partition);
    const workspaceRoot = join(partitionRoot, "workspace");
    const { segments, bytes, events } = readEvents(workspaceRoot);

    // Executable predicate, executed: attestation enablement is a chain fact.
    const enableHits = events.filter(
      (event) => event?.payload?.operation === judges.enableOperation);
    const attestation = {
      enabled: enableHits.length > 0,
      enabledAtSequence: enableHits[0]?.sequence ?? null,
      executablePredicate: `遍历全部 ${events.length} 事件,payload.operation === "${judges.enableOperation}" 命中 ${enableHits.length} 次`,
      hits: enableHits.length
    };

    const attestDirPath = join(partitionRoot, "attestations");
    const attestDir = {
      present: existsSync(attestDirPath),
      receipts: existsSync(attestDirPath)
        ? readdirSync(attestDirPath).filter((name) => name.endsWith(".json")).length
        : 0
    };

    // The domain store pairs only with the AOS partition (the anchor-form
    // finding from the recon: pairing digests include domainSnapshotDigest,
    // which the other three chains cannot produce).
    const domainPresent = partition === "TCRN-AOS" && existsSync(domainDatabasePath);
    const domainStore = {
      present: domainPresent,
      anchorForm: domainPresent
        ? "paired(domainSnapshotDigest+chainManifestDigest+chainHeadEventHash)"
        : "chain-only(headEventHash/version)"
    };

    const status = JSON.parse(engineRead(judges.engineRoot, "status", ["--workspace", workspaceRoot]));
    const knowledgePath = join(workspaceRoot, ".tcrn-workflow/knowledge/store.json");
    let knowledgeLockstep;
    if (existsSync(knowledgePath)) {
      const marker = JSON.parse(readFileSync(knowledgePath, "utf8"));
      knowledgeLockstep = {
        applicable: true,
        inLockstep: marker.eventHighWaterDigest === status.headEventHash,
        knowledgeHighWaterDigest: marker.eventHighWaterDigest,
        chainHeadEventHash: status.headEventHash,
        consequence: marker.eventHighWaterDigest === status.headEventHash
          ? "snapshot-manifest 可直接取锚"
          : "snapshot-manifest 将拒 KNOWLEDGE_HIGH_WATER_MISMATCH;矩阵双跑须先经受治 knowledge-rebase(本表只读,不执行)"
      };
    } else {
      knowledgeLockstep = { applicable: false, inLockstep: null, reason: "分区无知识库 store.json(结构性缺席)" };
    }

    const exportBudget = {
      eventsBytes: bytes,
      limitBytes: MAX_CANONICAL_BYTES,
      overLimit: bytes > MAX_CANONICAL_BYTES,
      relation: bytes > MAX_CANONICAL_BYTES
        ? `events 字节已越 1MiB 上限(${bytes} > ${MAX_CANONICAL_BYTES}):整文档 export 必拒 INPUT_OVERSIZED,矩阵 C3/C4 走逐事件规范摘要序列+分段路径(硬前置,非备选)`
        : `events 字节在 1MiB 上限内(${bytes} <= ${MAX_CANONICAL_BYTES});整文档 export 仍可能因状态集合逼近上限,驱动器自带分段退化路径`
    };

    // Instantiate the matrix: which cells the frozen whitelist declares n/a
    // for this partition's shape, and which stand as acceptance gates.
    const context = {
      aContainer: "event-row-mirror",
      aPresent: false,
      aAttestDirPresent: false,
      fAttestDirPresent: attestDir.present,
      attestationEnabledSequence: attestation.enabledAtSequence
    };
    const naCells = [];
    for (const cellId of ALL_CELLS) {
      const entry = whitelistLookup(whitelist, cellId, context);
      if (entry) naCells.push({ cell: cellId, entryId: entry.id, structuralAbsence: entry.structuralAbsence });
    }
    // R1/R3 A-side cells are NEVER in that list (closure forbids it); for a
    // partition with no mirror yet they are pending acceptance gates, stated
    // as such rather than silently absent.
    const acceptanceGates = FORBIDDEN_NA_CELLS.map((cellId) => ({
      cell: cellId,
      status: "acceptance-gate-pending",
      basis: "MIN-003:append-only 记录流与哈希链在 A 侧的建成以此格变绿为准,不得以 n/a 免除"
    }));

    rows.push({
      partition,
      chain: {
        workspaceId: status.workspaceId,
        headEventHash: status.headEventHash,
        version: status.version,
        events: events.length,
        segments
      },
      attestation,
      attestDirSidecar: attestDir,
      domainStore,
      exportBudget,
      knowledgeLockstep,
      matrixInstantiation: {
        naCells,
        naCellCount: naCells.length,
        r5Row: attestation.enabled
          ? "适用(启用点起判)" + (attestDir.present ? ";sidecar 格待迁移副本供入" : ";sidecar 格按 NA-R5-SIDECAR-SOURCE-DIR-ABSENT 结构性 n/a")
          : "n/a(NA-R5-ROW-ATTESTATION-NEVER-ENABLED,谓词已执行:enable 事件 0 命中)",
        acceptanceGates
      }
    });
  }

  return {
    schemaVersion: "aos.consistency-matrix-partition-profile.v1",
    engineVersion: judges.engineVersion,
    readOnly: "本表全程只读:status 为唯一引擎调用(mutates:false),其余为文件读取;无任何写入或租约持有",
    whitelistEntries: whitelist.entries.map((entry) => entry.id),
    partitions: rows,
    ok: rows.length === partitions.length
      && rows.every((row) => typeof row.chain.headEventHash === "string" && row.chain.events > 0)
  };
}

// ---- CLI ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const result = await buildPartitionProfile({
    workspaceContainer: process.argv[2] ? resolve(process.argv[2]) : undefined
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
