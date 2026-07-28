#!/usr/bin/env node
// The switchover consistency matrix driver (EPIC-033 / STORY-115).
//
// Five pieces × four criteria, decided cell by cell against TWO containers of
// the same chain: the F side (the engine's file-container workspace) and the
// A side (the AOS event-row mirror, `EventMirrorStore`). The matrix exists to
// answer one question with receipts: does the copy hold exactly what the chain
// holds, judged by the chain's own judge?
//
// Rows (the five pieces, CONF-002 position, quoted not paraphrased):
//   R1 append-only 记录流, R2 规范字节, R3 哈希链, R4 可回放, R5 attestation
// Columns (the four criteria):
//   C1 字节等, C2 规范形等, C3 回放等价, C4 摘要互指
//
// Non-negotiables, each traceable to a ruling or a paid-for lesson:
//  - The engine is the ONLY judge. Every verdict routes through the governed
//    copy's own pure functions (`validateEventChain`, `canonicalJson`,
//    `assertCanonicalJson`, `assertActorId`) or its read-only CLI verbs.
//    No criterion is reimplemented here — two implementations would compare
//    two implementations, not two containers.
//  - Lockstep is checked BEFORE the anchor is taken. `snapshot-manifest`
//    fails closed with KNOWLEDGE_HIGH_WATER_MISMATCH when the knowledge
//    high-water mark trails the chain head, and it does so mid-run; checking
//    first turns a confusing mid-flight death into a named precondition.
//  - Digests are compared at FULL length (64 hex chars). A truncated
//    comparison once reported a difference that did not exist.
//  - The measured operands must be proven distinct before any cell is judged,
//    at a granularity where the proof CAN fail: the mirror db against every
//    segment file's inode (plus workspace containment), and sidecar sets
//    member-file against member-file. A predicate whose two sides are the
//    same bytes is always green (the pnpm hard-link lesson), and a proof
//    whose operands cannot collide (directory vs file) is the same painting.
//  - `not-applicable` is legal ONLY through the frozen whitelist
//    (`na-whitelist.json`) or an explicit caller declaration of A-side
//    absence — and the caller declaration never reaches the R1/R3 acceptance
//    gates, which are recorded as acceptance-gate-pending instead. Any cell
//    that cannot be judged and is covered by neither is a MISMATCH, not an
//    n/a — an execution-time reclassification is exactly the hole the pass
//    standard closes. Structural absence is proven on the SOURCE side: the A
//    side's own absence never authorizes its own exemption.
//  - Read-only on the chain. This driver runs no mutating verb, ever.
//
// This file doubles as a library: the judgment helpers are exported pure so
// the test roster can exercise them without an engine or a chain.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const MATRIX_ROWS = Object.freeze([
  { id: "R1", piece: "append-only 记录流" },
  { id: "R2", piece: "规范字节" },
  { id: "R3", piece: "哈希链" },
  { id: "R4", piece: "可回放" },
  { id: "R5", piece: "attestation" }
]);
export const MATRIX_COLS = Object.freeze([
  { id: "C1", criterion: "字节等" },
  { id: "C2", criterion: "规范形等" },
  { id: "C3", criterion: "回放等价" },
  { id: "C4", criterion: "摘要互指" }
]);
export const ALL_CELLS = Object.freeze(
  MATRIX_ROWS.flatMap((row) => MATRIX_COLS.map((col) => `${row.id}${col.id}`)));

/** R1/R3 A-side cells are acceptance gates (MIN-003): never whitelistable. */
export const FORBIDDEN_NA_CELLS = Object.freeze(
  ALL_CELLS.filter((cell) => cell.startsWith("R1") || cell.startsWith("R3")));

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
export const sha256Text = (text) => sha256(Buffer.from(text, "utf8"));

/** Ordered per-event digest stream, sequence-keyed so a reorder cannot cancel out. */
export function streamDigest(perEventDigests) {
  return sha256Text(perEventDigests.map((digest, index) => `${index + 1}:${digest}`).join("\n"));
}

/** The paired-backup sidecar set digest formula, byte for byte the same shape. */
export function fileSetDigest(entries) {
  return sha256Text(entries.map((entry) => `${entry.name} ${entry.sha256}`).join("\n"));
}

/**
 * One cell's verdict from already-computed facts. Pure, so the three-state
 * logic — including "n/a outside the whitelist is a mismatch" — is unit-testable.
 */
export function judgeCell({ cell, fDigest = null, aDigest = null, fOk = true, aOk = true,
  notApplicable = null, reasonCodeOnRed = null, note = null }) {
  if (notApplicable) {
    if (notApplicable.authorized !== true) {
      // Execution-time n/a with no whitelist entry and no caller declaration:
      // the pass standard says this is a mismatch, recorded as one.
      return {
        cell, verdict: "mismatch",
        reasonCodeOnRed: "NA_OUT_OF_WHITELIST",
        note: `unauthorized not-applicable claim: ${notApplicable.reason}`,
        fDigest, aDigest
      };
    }
    return {
      cell, verdict: "not-applicable-declared",
      naReason: notApplicable.reason,
      naAuthority: notApplicable.authority,
      fDigest, aDigest, note
    };
  }
  const digestsPresent = typeof fDigest === "string" && typeof aDigest === "string";
  const equal = fOk === true && aOk === true && digestsPresent && fDigest === aDigest;
  return {
    cell,
    verdict: equal ? "equal" : "mismatch",
    fDigest, aDigest,
    ...(equal ? {} : { reasonCodeOnRed: reasonCodeOnRed ?? (digestsPresent ? "DIGEST_MISMATCH" : "SIDE_UNJUDGEABLE") }),
    ...(note ? { note } : {})
  };
}

/**
 * Known runtime predicates a whitelist entry may bind to. Closed set.
 *
 * Deliberately ABSENT: any predicate keyed on the A side's own absence.
 * Structural absence must be proven on the SOURCE (F) side — an entry whose
 * predicate is "the thing under test is missing" authorizes its own exemption
 * (the reviewed R5 sidecar hole). An F-side sidecar with no migrated A copy is
 * a named mismatch (ATTESTATION_SIDECAR_NOT_MIGRATED), never an n/a.
 */
export const WHITELIST_PREDICATES = Object.freeze({
  "mirror-holds-no-views-documents": (context) => context.aContainer === "event-row-mirror",
  "attest-dir-sidecar-absent": (context) => !context.fAttestDirPresent,
  "attestation-never-enabled-on-chain": (context) => context.attestationEnabledSequence === null
});

/**
 * The whitelist is closed over STRUCTURAL absence: every entry must name the
 * structural fact and bind to a known executable predicate, and no entry may
 * cover an R1/R3 A-side cell — those are the acceptance gates the matrix
 * exists to hold shut.
 */
export function assertWhitelistClosure(whitelist) {
  const fail = (message) => { throw new Error(`na-whitelist closure violated: ${message}`); };
  if (whitelist?.schemaVersion !== "aos.consistency-matrix-na-whitelist.v1") fail("wrong schemaVersion");
  if (whitelist.frozen !== true) fail("whitelist must declare frozen: true");
  if (!Array.isArray(whitelist.entries) || whitelist.entries.length === 0) fail("entries missing");
  const seen = new Set();
  for (const entry of whitelist.entries) {
    if (typeof entry.id !== "string" || seen.has(entry.id)) fail(`entry id missing or duplicated: ${entry.id}`);
    seen.add(entry.id);
    if (!Array.isArray(entry.cells) || entry.cells.length === 0) fail(`${entry.id}: cells missing`);
    for (const cell of entry.cells) {
      if (!ALL_CELLS.includes(cell)) fail(`${entry.id}: unknown cell ${cell}`);
      if (FORBIDDEN_NA_CELLS.includes(cell)) {
        fail(`${entry.id}: cell ${cell} is an acceptance gate (MIN-003) and may never be declared away`);
      }
    }
    if (!(entry.predicateId in WHITELIST_PREDICATES)) fail(`${entry.id}: unknown predicateId ${entry.predicateId}`);
    if (typeof entry.structuralAbsence !== "string" || entry.structuralAbsence.length === 0) {
      fail(`${entry.id}: structuralAbsence must state the structural fact`);
    }
    if (typeof entry.executablePredicate !== "string" || entry.executablePredicate.length === 0) {
      fail(`${entry.id}: executablePredicate must be stated so the claim stays checkable`);
    }
  }
  return whitelist;
}

/** First whitelist entry whose predicate fires for this cell in this context, or null. */
export function whitelistLookup(whitelist, cell, context) {
  for (const entry of whitelist.entries) {
    if (!entry.cells.includes(cell)) continue;
    if (WHITELIST_PREDICATES[entry.predicateId](context)) return entry;
  }
  return null;
}

/**
 * Evidence hygiene: no machine-absolute path may survive into an archived
 * artifact. Known roots are replaced by stable tokens, then the result is
 * asserted clean.
 */
export function scrubAbsolutePaths(value, replacements) {
  let text = JSON.stringify(value);
  for (const [prefix, token] of replacements) {
    text = text.split(prefix).join(token);
  }
  if (/\/(Users|home|private\/tmp|tmp|var|srv)\//u.test(text)) {
    throw new Error("evidence hygiene violated: an absolute path survived scrubbing");
  }
  return JSON.parse(text);
}

export function defaultEngineRoot() {
  return process.env.TCRN_AOS_ENGINE_ROOT ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");
}

/** Load the governed engine's own pure functions — the only judges used here. */
export async function loadJudges(engineRoot = defaultEngineRoot()) {
  const protocol = await import(pathToFileURL(
    resolve(engineRoot, "dist/build/packages/protocol/src/index.js")).href);
  const attestation = await import(pathToFileURL(
    resolve(engineRoot, "dist/build/packages/core/src/actor-attestation.js")).href);
  let engineVersion = null;
  try {
    engineVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version ?? null;
  } catch { engineVersion = null; }
  return {
    validateEventChain: protocol.validateEventChain,
    canonicalJson: protocol.canonicalJson,
    assertCanonicalJson: protocol.assertCanonicalJson,
    createEvent: protocol.createEvent,
    assertActorId: attestation.assertActorId,
    enableOperation: attestation.ACTOR_ATTESTATION_ENABLE_OPERATION,
    engineVersion,
    engineRoot
  };
}

/** Read-only engine CLI call. The verb list is a closed allowlist on purpose. */
const READ_ONLY_VERBS = Object.freeze(["status", "validate", "export", "snapshot-manifest", "snapshot-verify", "work-list"]);
export function engineRead(engineRoot, verb, args) {
  if (!READ_ONLY_VERBS.includes(verb)) {
    throw new Error(`refusing non-read-only engine verb: ${verb}`);
  }
  const stdout = execFileSync(process.execPath,
    [join(engineRoot, "scripts/tcrn-workflow.mjs"), verb, ...args],
    { cwd: engineRoot, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
  return stdout;
}

function readSegments(workspaceRoot) {
  const eventsDir = join(workspaceRoot, ".tcrn-workflow/events");
  const names = readdirSync(eventsDir).filter((name) => name.endsWith(".json")).sort();
  const segments = names.map((name) => {
    const text = readFileSync(join(eventsDir, name), "utf8");
    return { name, text, events: JSON.parse(text) };
  });
  return { eventsDir, segments, events: segments.flatMap((segment) => segment.events) };
}

function listAttestDir(directory) {
  if (!directory || !existsSync(directory)) return { present: false, entries: [] };
  const entries = readdirSync(directory).filter((name) => name.endsWith(".json")).sort()
    .map((name) => ({ name, sha256: sha256(readFileSync(join(directory, name))) }));
  return { present: true, entries };
}

function findEnableSequence(events, enableOperation) {
  for (const event of events) {
    if (event?.payload?.operation === enableOperation) return event.sequence;
  }
  return null;
}

export function loadWhitelist(path = resolve(fileURLToPath(new URL(".", import.meta.url)), "na-whitelist.json")) {
  return assertWhitelistClosure(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * Derive what the A container actually IS from the storage it presents, not
 * from a literal constant. A predicate fed `aContainer: "event-row-mirror"`
 * as a string literal is always true — the whitelist's views-absence entry
 * could then never fail, and NA_OUT_OF_WHITELIST was unreachable from the
 * driver. This opens the database read-only and reports the real schema.
 */
export function deriveAContainer(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const names = db.prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map((row) => String(row.name));
    const nonMirror = names.filter((name) => name !== "aos_event_mirror");
    return {
      kind: names.includes("aos_event_mirror") && nonMirror.length === 0
        ? "event-row-mirror"
        : `sqlite:${names.join(",") || "empty"}`,
      tables: names
    };
  } finally {
    db.close();
  }
}

/**
 * The full 5×4 run. Returns the archive object; never writes the chain.
 *
 * options: {
 *   fWorkspace,                 // file-container workspace root (dir holding .tcrn-workflow)
 *   aDatabasePath | aAbsent,    // event-row mirror db path, or {reason} declaring A absent
 *   partitionId,                // mirror partition key
 *   fAttestDir?, aAttestDir?,   // sidecar set and its migrated copy
 *   engineRoot?, labels?, whitelistPath?, mirrorModulePath?
 * }
 */
export async function runMatrix(options) {
  const judges = await loadJudges(options.engineRoot);
  const labels = { f: options.labels?.f ?? "file-container", a: options.labels?.a ?? "event-row-mirror" };
  const cells = [];
  const result = {
    schemaVersion: "aos.consistency-matrix-run.v1",
    engineVersion: judges.engineVersion,
    authorization: "本证物不含授权:矩阵结论只是 conformance-mutual-release 证据链之一环;切换须另过 Owner 门(MIN-002 切换仪式),本运行不含任何切换、发布或迁移授权。",
    rows: MATRIX_ROWS, cols: MATRIX_COLS,
    labels,
    ok: false
  };

  // A missing whitelist is a named fail-closed, not an uncaught exception: a
  // driver that dies raw on its own configuration cannot be told apart from a
  // driver that crashed mid-judgment.
  let whitelist;
  try {
    whitelist = loadWhitelist(options.whitelistPath);
  } catch (error) {
    result.stage = "na-whitelist-load";
    result.reasonCode = error?.code === "ENOENT" ? "NA_WHITELIST_MISSING" : "NA_WHITELIST_INVALID";
    result.error = String(error.message ?? error).slice(0, 300);
    return result;
  }

  // Structured wrapper for the pre-anchor engine reads: a bad F chain must
  // come back as a structured red carrying the ENGINE's reason code, with the
  // stage named, never as an uncaught execFileSync throw.
  const engineReadStructured = (verb, args, stage) => {
    try {
      return { ok: true, text: engineRead(judges.engineRoot, verb, args) };
    } catch (error) {
      const text = [error?.stdout, error?.stderr, error?.message]
        .map((value) => String(value ?? "")).join("\n");
      const match = text.match(/"reasonCode"\s*:\s*"([A-Z_]+)"/u);
      return {
        ok: false, stage,
        reasonCode: match?.[1] ?? "ENGINE_READ_FAILED",
        detail: text.slice(0, 300)
      };
    }
  };
  const engineRedReturn = (read) => {
    result.stage = read.stage;
    result.reasonCode = read.reasonCode;
    result.error = read.detail;
    return result;
  };

  // ---- 0. lockstep, BEFORE the anchor -------------------------------------
  const knowledgePath = join(options.fWorkspace, ".tcrn-workflow/knowledge/store.json");
  const statusRead = engineReadStructured("status", ["--workspace", options.fWorkspace], "status-before-anchor");
  if (!statusRead.ok) return engineRedReturn(statusRead);
  const statusBefore = JSON.parse(statusRead.text);
  if (existsSync(knowledgePath)) {
    const marker = JSON.parse(readFileSync(knowledgePath, "utf8"));
    const inLockstep = marker.eventHighWaterDigest === statusBefore.headEventHash;
    result.lockstep = {
      applicable: true, ok: inLockstep,
      knowledgeHighWaterDigest: marker.eventHighWaterDigest,
      chainHeadEventHash: statusBefore.headEventHash
    };
    if (!inLockstep) {
      result.reasonCode = "KNOWLEDGE_HIGH_WATER_MISMATCH";
      result.stage = "lockstep-before-anchor";
      result.remedy = "knowledge-rebase (a governed write; this driver will not perform it)";
      return result;
    }
  } else {
    result.lockstep = { applicable: false, ok: true, reason: "knowledge store absent on this chain (structural)" };
  }

  // ---- 1. anchor ----------------------------------------------------------
  const instant = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  const manifestRead = engineReadStructured("snapshot-manifest",
    ["--workspace", options.fWorkspace, "--at", instant], "anchor-snapshot-manifest");
  if (!manifestRead.ok) return engineRedReturn(manifestRead);
  const manifestText = manifestRead.text;
  const manifest = JSON.parse(manifestText);
  result.anchor = {
    instant,
    headEventHash: statusBefore.headEventHash,
    version: statusBefore.version,
    workspaceId: statusBefore.workspaceId,
    snapshotManifestDigest: sha256Text(manifestText),
    manifestAgreesWithStatus: manifest.headEventHash === statusBefore.headEventHash
  };

  // ---- 2. F side ----------------------------------------------------------
  const f = readSegments(options.fWorkspace);
  let fOrdered;
  try {
    fOrdered = judges.validateEventChain(f.events);
  } catch (error) {
    result.reasonCode = error?.reasonCode ?? "EVENT_CHAIN_CORRUPT";
    result.stage = "f-side-validateEventChain";
    result.error = String(error.message ?? error).slice(0, 300);
    return result;
  }
  const fCanonical = fOrdered.map((event) => judges.canonicalJson(event));
  const fHead = fOrdered.at(-1)?.eventHash ?? null;
  const fValidateRead = engineReadStructured("validate", ["--workspace", options.fWorkspace], "f-side-validate");
  if (!fValidateRead.ok) return engineRedReturn(fValidateRead);
  const fValidate = JSON.parse(fValidateRead.text);
  let fExport = null;
  let projectionMode = "whole-document";
  try {
    fExport = engineRead(judges.engineRoot, "export", ["--workspace", options.fWorkspace]);
  } catch (error) {
    // The 1MiB canonical ceiling is a documented reality on large partitions:
    // the projection comparison degrades to the per-event segmented path, and
    // says so instead of pretending the whole document existed.
    projectionMode = "per-event-segmented (whole-document export refused: "
      + String(error.stderr ?? error.message ?? error).slice(0, 120) + ")";
  }
  // Fix for the mutual-cell always-green: derive, from the export document's
  // OWN bytes, a per-event canonical digest stream that IS comparable to the
  // A side's. The whole-document contentSha256 stays a mutual-reference
  // record; the comparison runs on the derivable stream.
  let fExportDocDigest = null;
  let fExportEventsDigest = null;
  if (fExport !== null) {
    fExportDocDigest = sha256Text(fExport);
    try {
      const exportDoc = JSON.parse(fExport);
      if (Array.isArray(exportDoc.events)) {
        fExportEventsDigest = streamDigest(
          exportDoc.events.map((event) => sha256Text(judges.canonicalJson(event))));
      }
    } catch { fExportEventsDigest = null; }
  }
  const fAttest = listAttestDir(options.fAttestDir);
  const enableSequence = findEnableSequence(fOrdered, judges.enableOperation);

  // ---- 3. A side ----------------------------------------------------------
  const aDeclaredAbsent = options.aAbsent ?? null;
  const aPresent = !aDeclaredAbsent && typeof options.aDatabasePath === "string" && existsSync(options.aDatabasePath);
  let aRows = [], aOrdered = [], aHead = null, aVerify = null, aStore = null;
  let aContainer = null;
  if (!aDeclaredAbsent && !aPresent) {
    result.reasonCode = "A_SIDE_DATABASE_MISSING";
    result.stage = "a-side-open";
    return result;
  }
  if (aPresent) {
    // Derived BEFORE the store opens (the store's DDL would add the mirror
    // table to a foreign database and mask what was actually presented).
    try {
      aContainer = deriveAContainer(options.aDatabasePath);
    } catch (error) {
      result.reasonCode = "A_SIDE_CONTAINER_UNREADABLE";
      result.stage = "a-side-container-derivation";
      result.error = String(error.message ?? error).slice(0, 300);
      return result;
    }
    result.aContainer = aContainer;
    const mirrorModule = await import(pathToFileURL(options.mirrorModulePath
      ?? resolve(process.cwd(), "dist/packages/projection/src/index.js")).href);
    aStore = new mirrorModule.EventMirrorStore(options.aDatabasePath);
    try {
      aRows = aStore.listRows(options.partitionId);
      try {
        aOrdered = judges.validateEventChain(aRows.map((row) => JSON.parse(row.canonicalJson)));
        aVerify = aStore.verify(options.partitionId, judges);
      } catch (error) {
        result.aSideError = { reasonCode: error?.reasonCode ?? null, message: String(error.message ?? error).slice(0, 300) };
        aOrdered = [];
        aVerify = { ok: false };
      }
      aHead = aOrdered.at(-1)?.eventHash ?? null;
    } finally {
      // close later — anchor stability re-read needs it; closed at the end.
    }
  }

  // ---- 4. distinct-inode proof --------------------------------------------
  // Granularity matters here: a directory statted against a file can NEVER
  // share an inode, so that predicate was a gate that could not go red. The
  // meaningful facts are (a) the mirror database is not inside the F
  // workspace and shares no inode with any event segment file, and (b) no
  // member of the A sidecar set is a hard link to any member of the F set.
  const inodeProof = { checked: [], distinct: true };
  if (aPresent) {
    const dbResolved = resolve(options.aDatabasePath);
    const wsResolved = resolve(options.fWorkspace);
    const insideFWorkspace = dbResolved === wsResolved || dbResolved.startsWith(wsResolved + sep);
    const dbStat = statSync(dbResolved);
    const segmentCollisions = f.segments
      .map((segment) => ({ segment: segment.name, stat: statSync(join(f.eventsDir, segment.name)) }))
      .filter(({ stat }) => stat.dev === dbStat.dev && stat.ino === dbStat.ino)
      .map(({ segment }) => segment);
    inodeProof.checked.push({
      pair: "mirror-db vs f-side segment files",
      mirrorDbDevIno: `${dbStat.dev}:${dbStat.ino}`,
      mirrorDbInsideFWorkspace: insideFWorkspace,
      segmentFilesCompared: f.segments.length,
      segmentInodeCollisions: segmentCollisions
    });
    if (insideFWorkspace || segmentCollisions.length > 0) inodeProof.distinct = false;
  }
  if (fAttest.present && options.aAttestDir && existsSync(options.aAttestDir)) {
    // Member-file granularity: pnpm-style hard links live on the members, not
    // the directories. Any A member sharing dev:ino with any F member is a
    // same-bytes-both-sides predicate and is refused.
    const statMembers = (directory) => readdirSync(directory)
      .filter((name) => name.endsWith(".json")).sort()
      .map((name) => ({ name, stat: statSync(join(directory, name)) }));
    const fMembers = statMembers(options.fAttestDir);
    const aMembers = statMembers(options.aAttestDir);
    const memberCollisions = [];
    for (const fMember of fMembers) {
      for (const aMember of aMembers) {
        if (fMember.stat.dev === aMember.stat.dev && fMember.stat.ino === aMember.stat.ino) {
          memberCollisions.push({
            f: fMember.name, a: aMember.name,
            devIno: `${fMember.stat.dev}:${fMember.stat.ino}`
          });
        }
      }
    }
    inodeProof.checked.push({
      pair: "f-attest-dir members vs a-attest-dir members",
      fMembers: fMembers.length, aMembers: aMembers.length,
      pairsCompared: fMembers.length * aMembers.length,
      memberInodeCollisions: memberCollisions
    });
    if (memberCollisions.length > 0) inodeProof.distinct = false;
  }
  result.inodeProof = inodeProof;
  if (!inodeProof.distinct) {
    result.reasonCode = "MEASURED_ROOTS_SHARE_INODE";
    result.stage = "inode-proof";
    aStore?.close();
    return result;
  }

  const aAttest = listAttestDir(options.aAttestDir);
  const context = {
    // Derived from the actually-opened A storage, never a literal constant —
    // a literal here made the views-absence predicate unfalsifiable.
    aContainer: aContainer?.kind ?? "a-side-unopened",
    aPresent,
    aAttestDirPresent: aAttest.present,
    fAttestDirPresent: fAttest.present,
    attestationEnabledSequence: enableSequence
  };

  const cell = (id, facts) => {
    if (aDeclaredAbsent && !facts?.fOnly) {
      // Caller-declared absence is a structural statement, not an authority
      // to wave acceptance gates through: the R1/R3 A-side cells are recorded
      // as pending gates (never authorized n/a), and the caller's free-text
      // reason rides along as information only.
      if (FORBIDDEN_NA_CELLS.includes(id)) {
        cells.push({
          cell: id,
          verdict: "acceptance-gate-pending",
          basis: "MIN-003: append-only 记录流与哈希链的 A 侧格是验收门;A 容器缺席时此格待验收,不构成授权 n/a,整跑不通过",
          callerDeclaredAbsence: aDeclaredAbsent.reason
        });
        return;
      }
      cells.push(judgeCell({
        cell: id,
        notApplicable: {
          authorized: true,
          reason: "A 侧缺席(调用方声明的结构性事实)",
          authority: "caller-declared-a-side-absence"
        },
        note: `caller reason (informational, not an authority): ${aDeclaredAbsent.reason}`
      }));
      return;
    }
    const entry = facts.naPredicate ? whitelistLookup(whitelist, id, context) : null;
    if (facts.naPredicate && entry) {
      cells.push(judgeCell({
        cell: id,
        notApplicable: { authorized: true, reason: entry.structuralAbsence, authority: `na-whitelist:${entry.id}` },
        note: entry.coveredBy ? `covered by ${entry.coveredBy}` : null
      }));
      return;
    }
    if (facts.naPredicate && !entry) {
      cells.push(judgeCell({ cell: id, notApplicable: { authorized: false, reason: facts.naReason ?? "unjudgeable at runtime" } }));
      return;
    }
    cells.push(judgeCell({ cell: id, ...facts }));
  };

  // ---- 5. the twenty cells ------------------------------------------------
  const aTexts = aRows.map((row) => row.canonicalJson);
  const fPerEvent = fCanonical.map((text) => sha256Text(text));
  const aPerEvent = aTexts.map((text) => sha256Text(text));

  // R1 append-only 记录流
  cell("R1C1", {
    fDigest: streamDigest(fPerEvent), aDigest: streamDigest(aPerEvent),
    fOk: true, aOk: aOrdered.length === aRows.length && aRows.length === fOrdered.length,
    reasonCodeOnRed: "EVENT_STREAM_BYTES_DIVERGENT",
    note: "逐事件规范字节 sha256 序列,序号键控"
  });
  {
    let fIdempotent = true, aIdempotent = true, code = null;
    try { for (const text of fCanonical) judges.assertCanonicalJson(text); }
    catch (error) { fIdempotent = false; code = error?.reasonCode ?? "CANONICALIZATION_MISMATCH"; }
    try { for (const text of aTexts) judges.assertCanonicalJson(text); }
    catch (error) { aIdempotent = false; code = error?.reasonCode ?? "CANONICALIZATION_MISMATCH"; }
    cell("R1C2", {
      fDigest: streamDigest(fPerEvent), aDigest: streamDigest(aPerEvent),
      fOk: fIdempotent, aOk: aIdempotent, reasonCodeOnRed: code,
      note: "每记录 assertCanonicalJson(引擎判)且重规范化不变"
    });
  }
  cell("R1C3", {
    fDigest: sha256Text(`${fOrdered.length}:${fHead}`),
    aDigest: sha256Text(`${aOrdered.length}:${aHead}`),
    fOk: fValidate.reasonCode === "WORKSPACE_COMMAND_COMPLETED",
    aOk: aVerify?.ok === true,
    reasonCodeOnRed: result.aSideError?.reasonCode ?? "REPLAY_TERMINUS_DIVERGENT",
    note: "双侧过引擎 validateEventChain;A 侧 UPDATE/DELETE 触发器拒绝的红证在 red-suite R1 专项"
  });
  cell("R1C4", {
    fDigest: streamDigest(fOrdered.map((event) => `${event.sequence} ${event.eventHash}`)),
    aDigest: streamDigest(aOrdered.map((event) => `${event.sequence} ${event.eventHash}`)),
    reasonCodeOnRed: "EVENTS_SET_DIGEST_DIVERGENT",
    note: "events 集合摘要,写入互指块"
  });

  // R2 规范字节
  {
    let fFilesCanonical = true, code = null;
    try { for (const segment of f.segments) judges.assertCanonicalJson(segment.text); }
    catch (error) { fFilesCanonical = false; code = error?.reasonCode ?? "CANONICALIZATION_MISMATCH"; }
    let aRowsCanonical = true;
    try { for (const text of aTexts) judges.assertCanonicalJson(text); }
    catch (error) { aRowsCanonical = false; code = error?.reasonCode ?? "CANONICALIZATION_MISMATCH"; }
    cell("R2C1", {
      fDigest: streamDigest(fPerEvent), aDigest: streamDigest(aPerEvent),
      fOk: fFilesCanonical, aOk: aRowsCanonical, reasonCodeOnRed: code,
      note: "F 侧段文件原始字节即规范形(assertCanonicalJson 判),A 侧存储行同判;跨侧比规范事件流"
    });
  }
  {
    const fRecanon = fOrdered.map((event) => sha256Text(judges.canonicalJson(JSON.parse(judges.canonicalJson(event)))));
    const aRecanon = aTexts.map((text) => sha256Text(judges.canonicalJson(JSON.parse(text))));
    cell("R2C2", {
      fDigest: streamDigest(fRecanon), aDigest: streamDigest(aRecanon),
      reasonCodeOnRed: "CANONICALIZATION_MISMATCH",
      note: "canonicalJson∘parse 幂等,判据唯一来源=受治引擎 protocol"
    });
  }
  {
    // Replay output re-canonicalized must equal the stored canonical form.
    const fStable = fOrdered.every((event, index) => judges.canonicalJson(event) === fCanonical[index]);
    const aStable = aOrdered.length === aTexts.length
      && aOrdered.every((event, index) => judges.canonicalJson(event) === aTexts[index]);
    let exportCanonical = null;
    if (fExport !== null) {
      try { judges.assertCanonicalJson(fExport); exportCanonical = true; }
      catch { exportCanonical = false; }
    }
    cell("R2C3", {
      fDigest: streamDigest(fCanonical.map((text) => sha256Text(text))),
      aDigest: streamDigest(aOrdered.map((event) => sha256Text(judges.canonicalJson(event)))),
      fOk: fStable && exportCanonical !== false, aOk: aStable,
      reasonCodeOnRed: "NONCANONICAL_BYTES_IN_REPLAY_OUTPUT",
      note: `回放输出再规范化不渗入非规范字节;F 侧 export 文档规范性=${exportCanonical === null ? "segmented-path(1MiB)" : exportCanonical};projectionMode=${projectionMode}`
    });
  }
  // C4 mutual-reference cells. The previous shape — "equal whenever both
  // sides are strings" — never compared anything (an always-green cell, the
  // reviewed high finding). The rule now:
  //  - segmented path (no whole-document export): both sides ARE the same
  //    kind of digest (per-event canonical stream), compared directly;
  //  - whole-document path: a per-event stream digest is re-derived from the
  //    export document's own bytes and compared to the A side; the document's
  //    contentSha256 stays on record as the mutual reference;
  //  - genuinely incomparable (export exists but no comparable stream could
  //    be derived from its bytes): recorded-not-compared — recorded with both
  //    digests, EXCLUDED from summary.equal and from result.ok, said so in
  //    the cell note. Never silently "equal".
  const mutualCell = (id, note) => {
    if (aDeclaredAbsent) { cell(id, {}); return; }
    const aStream = streamDigest(aPerEvent);
    if (fExport !== null && fExportEventsDigest === null) {
      cells.push({
        cell: id,
        verdict: "recorded-not-compared",
        mutual: true,
        fDigest: fExportDocDigest,
        aDigest: aStream,
        note: `${note};整文档 export 存在但未能从其字节派生可比的逐事件规范摘要流:两侧摘要如实录入互指块,本格不计入 equal、不计入 result.ok(recorded-not-compared)`
      });
      return;
    }
    const comparisonPath = fExport !== null
      ? `整文档路径:从 export 文档字节独立重派生逐事件规范摘要流与 A 侧比对;export contentSha256=${fExportDocDigest} 录入互指块`
      : "分段路径(1MiB):两侧同为逐事件规范摘要流 streamDigest,直接比较";
    cells.push({
      ...judgeCell({
        cell: id,
        fDigest: fExport !== null ? fExportEventsDigest : streamDigest(fPerEvent),
        aDigest: aStream,
        reasonCodeOnRed: "MUTUAL_REFERENCE_DIGEST_DIVERGENT",
        note: `${note};判法=${comparisonPath}`
      }),
      mutual: true
    });
  };
  mutualCell("R2C4",
    "契约摘要互指:F=export 文档(或分段退化为规范事件流),A=规范事件流;录入互指块并由锚稳定性复读复核");

  // R3 哈希链
  const tripleLines = (events) => events.map((event) =>
    `${event.sequence}:${event.priorHash}:${event.payloadHash}:${event.eventHash}`);
  cell("R3C1", {
    fDigest: streamDigest(tripleLines(fOrdered)), aDigest: streamDigest(tripleLines(aOrdered)),
    reasonCodeOnRed: "HASH_TRIPLE_DIVERGENT",
    note: "逐事件 priorHash/payloadHash/eventHash 三字段全值比对"
  });
  {
    // Recomputation: the engine recomputes payloadHash/eventHash inside
    // validateEventChain and fails EVENT_CHAIN_CORRUPT on any drift; a green
    // here IS the recomputation verdict, not a byte echo.
    let fRecompute = true, aRecompute = aOrdered.length > 0 || aRows.length === 0, code = null;
    try { judges.validateEventChain(fOrdered.map((event) => JSON.parse(judges.canonicalJson(event)))); }
    catch (error) { fRecompute = false; code = error?.reasonCode ?? "EVENT_CHAIN_CORRUPT"; }
    if (aRows.length > 0) {
      try { judges.validateEventChain(aRows.map((row) => JSON.parse(row.canonicalJson))); }
      catch (error) { aRecompute = false; code = error?.reasonCode ?? "EVENT_CHAIN_CORRUPT"; }
    }
    cell("R3C2", {
      fDigest: streamDigest(tripleLines(fOrdered)), aDigest: streamDigest(tripleLines(aOrdered)),
      fOk: fRecompute, aOk: aRecompute, reasonCodeOnRed: code,
      note: "重算判=引擎 validateEventChain 内建重算(createEvent 同一哈希构造)"
    });
  }
  cell("R3C3", {
    fDigest: fHead ? sha256Text(fHead) : null, aDigest: aHead ? sha256Text(aHead) : null,
    fOk: fHead === statusBefore.headEventHash, aOk: aOrdered.length === fOrdered.length,
    reasonCodeOnRed: "HEAD_EVENT_HASH_DIVERGENT",
    note: "validateEventChain 双侧通过且 headEventHash 同锚;无密钥哈希挡不住尾部追加伪造——盲区由 C4 补位,红证成对见 red-suite C3(b)/C4"
  });
  cell("R3C4", {
    fDigest: fHead, aDigest: aHead,
    reasonCodeOnRed: "CHAIN_HEAD_MUTUAL_REFERENCE_DIVERGENT",
    note: "chainHeadEventHash 互指(pair-manifest 先例)"
  });

  // R4 可回放
  cell("R4C1", {
    naPredicate: true,
    naReason: "A 侧无 views 文档",
    fDigest: null, aDigest: null
  });
  cell("R4C2", {
    fDigest: sha256Text(judges.canonicalJson({ headEventHash: fHead, events: fOrdered.length, version: statusBefore.version })),
    aDigest: sha256Text(judges.canonicalJson({ headEventHash: aHead, events: aOrdered.length, version: aRows.at(-1)?.sequence ?? 0 })),
    reasonCodeOnRed: "REPLAYED_STATE_CANONICAL_PROJECTION_DIVERGENT",
    note: "回放终点的规范形投影(headEventHash/事件数/版本)经引擎 canonicalJson 双侧相等"
  });
  cell("R4C3", {
    fDigest: sha256Text(`${fHead}:${fOrdered.length}`),
    aDigest: sha256Text(`${aHead}:${aOrdered.length}`),
    fOk: fValidate.reasonCode === "WORKSPACE_COMMAND_COMPLETED",
    aOk: aVerify?.ok === true,
    reasonCodeOnRed: "REPLAY_EQUIVALENCE_BROKEN",
    note: "核心格:F 侧引擎全量回放(validate:回放态与 views 逐字节一致)vs A 侧引擎 validateEventChain 自洽回放(EventMirrorStore.verify);两侧同一引擎裁判;A 容器的独立状态归约器属切换段验收范围(MIN-003 谱系),本格按两容器当前可回放强度如实判"
  });
  mutualCell("R4C4",
    "回放结果摘要互指(F=回放态 export 文档,A=镜像回放流);由锚稳定性复读复核");

  // R5 attestation. Structural absence is proven on the SOURCE side only: an
  // F-side sidecar set with no migrated A copy is a named mismatch
  // (ATTESTATION_SIDECAR_NOT_MIGRATED) — the old shape let the A side's own
  // absence authorize the exemption.
  cell("R5C1", {
    naPredicate: !fAttest.present,
    naReason: "分区旁无 attestations/ 见证目录(源侧结构性缺席)",
    fDigest: fAttest.present ? fileSetDigest(fAttest.entries) : null,
    aDigest: aAttest.present ? fileSetDigest(aAttest.entries) : null,
    fOk: true, aOk: aAttest.present && fAttest.entries.length === aAttest.entries.length,
    reasonCodeOnRed: aAttest.present ? "ATTESTATION_SIDECAR_SET_DIVERGENT" : "ATTESTATION_SIDECAR_NOT_MIGRATED",
    note: "sidecar 文件集逐文件 sha256 与 setDigest 相等(paired-backup 同构);F 有 A 无=未迁移,判红不判 n/a"
  });
  {
    const actorLines = (events) => events
      .filter((event) => enableSequence !== null && event.sequence >= enableSequence)
      .map((event) => `${event.sequence}:${event.payload?.actor ?? ""}`);
    let fActorsValid = true, aActorsValid = true, code = null;
    if (enableSequence !== null) {
      try {
        for (const event of fOrdered.filter((event) => event.sequence >= enableSequence)) {
          judges.assertActorId(event.payload?.actor);
        }
      } catch (error) { fActorsValid = false; code = error?.reasonCode ?? "ACTOR_ID_INVALID"; }
      try {
        for (const event of aOrdered.filter((event) => event.sequence >= enableSequence)) {
          judges.assertActorId(event.payload?.actor);
        }
      } catch (error) { aActorsValid = false; code = error?.reasonCode ?? "ACTOR_ID_INVALID"; }
    }
    cell("R5C2", {
      naPredicate: enableSequence === null,
      naReason: "链上无 attestation.actor.enabled 事件",
      fDigest: streamDigest(actorLines(fOrdered)), aDigest: streamDigest(actorLines(aOrdered)),
      fOk: fActorsValid, aOk: aActorsValid, reasonCodeOnRed: code,
      note: "enable 起点后每事件 payload.actor 过引擎 assertActorId,双侧一致"
    });
    // Cardinality is folded into the digest (enableSequence:count:predicate):
    // an empty A set once made `.every` vacuously true on both sides, so a
    // zero-row partition compared equal — the empty-set always-green.
    const fEnableEvents = fOrdered.filter((event) => enableSequence !== null && event.sequence >= enableSequence);
    const aEnableEvents = aOrdered.filter((event) => enableSequence !== null && event.sequence >= enableSequence);
    const fPredicate = fEnableEvents.every((event) => typeof event.payload?.actor === "string");
    const aPredicate = aEnableEvents.every((event) => typeof event.payload?.actor === "string");
    cell("R5C3", {
      naPredicate: enableSequence === null,
      naReason: "链上无 attestation.actor.enabled 事件",
      fDigest: sha256Text(`${enableSequence}:${fEnableEvents.length}:${fPredicate}`),
      aDigest: sha256Text(`${enableSequence}:${aEnableEvents.length}:${aPredicate}`),
      fOk: fValidate.reasonCode === "WORKSPACE_COMMAND_COMPLETED" && fPredicate,
      aOk: aPredicate,
      reasonCodeOnRed: "WORKSPACE_ACTOR_REQUIRED",
      note: "同起点后全事件带 actor 的谓词双侧同判,摘要折入受测事件基数(空集不再恒真);F 侧回放门由 validate 强制(剥 actor 红证见 red-suite R5);A 侧拒无 actor 写入由镜像 ingest 经同一 validateEventChain 承接"
    });
  }
  cell("R5C4", {
    naPredicate: !fAttest.present,
    naReason: "分区旁无 attestations/ 见证目录(源侧结构性缺席)",
    fDigest: fAttest.present ? fileSetDigest(fAttest.entries) : null,
    aDigest: aAttest.present ? fileSetDigest(aAttest.entries) : null,
    reasonCodeOnRed: aAttest.present ? "ATTESTATION_SET_DIGEST_DIVERGENT" : "ATTESTATION_SIDECAR_NOT_MIGRATED",
    note: "attestationSetDigest 互指(pair-manifest 先例);F 有 A 无=未迁移,判红不判 n/a"
  });

  // ---- 6. anchor stability re-read ---------------------------------------
  const statusAfter = JSON.parse(engineRead(judges.engineRoot, "status", ["--workspace", options.fWorkspace]));
  let aRowsAfter = aRows.length, aHeadAfter = aHead;
  if (aPresent && aStore) {
    const rowsAfter = aStore.listRows(options.partitionId);
    aRowsAfter = rowsAfter.length;
    aHeadAfter = rowsAfter.at(-1)?.eventHash ?? null;
    aStore.close();
  }
  const stable = statusAfter.headEventHash === statusBefore.headEventHash
    && statusAfter.version === statusBefore.version
    && aRowsAfter === aRows.length && aHeadAfter === aHead;
  result.anchorStability = {
    stable,
    rereadHeadEventHash: statusAfter.headEventHash,
    rereadVersion: statusAfter.version,
    rereadMirrorRows: aRowsAfter
  };

  // ---- 7. mutual-reference archive block ----------------------------------
  result.mutualReference = {
    boundBy: "one anchor plus mutual digests; either side alone is not a comparison",
    anchorInstant: instant,
    chainHeadEventHash: { f: fHead, a: aHead },
    eventsSetDigest: {
      f: streamDigest(fOrdered.map((event) => `${event.sequence} ${event.eventHash}`)),
      a: streamDigest(aOrdered.map((event) => `${event.sequence} ${event.eventHash}`))
    },
    stateProjectionDigest: {
      f: fExport !== null ? sha256Text(fExport) : null,
      fMode: projectionMode,
      a: streamDigest(aPerEvent)
    },
    attestationSetDigest: {
      f: fAttest.present ? fileSetDigest(fAttest.entries) : null,
      a: aAttest.present ? fileSetDigest(aAttest.entries) : null
    }
  };

  result.sides = {
    f: {
      label: labels.f, segments: f.segments.length, events: fOrdered.length,
      validateReasonCode: fValidate.reasonCode, projectionMode,
      attestDir: { present: fAttest.present, receipts: fAttest.entries.length }
    },
    a: {
      label: labels.a, present: aPresent, declaredAbsent: aDeclaredAbsent ?? null,
      rows: aRows.length, verifyOk: aVerify?.ok ?? null,
      attestDir: { present: aAttest.present, receipts: aAttest.entries.length }
    }
  };
  result.whitelist = {
    digest: sha256Text(JSON.stringify(whitelist)),
    entries: whitelist.entries.map((entry) => entry.id)
  };
  result.cells = cells;
  // recorded-not-compared cells are honest records, not passes: they are
  // excluded from the equal count AND from the ok predicate's numerator, and
  // each carries a note saying so. acceptance-gate-pending cells (declared
  // A-side absence over R1/R3) hold ok at false outright.
  const applicable = cells.filter((entry) =>
    entry.verdict !== "not-applicable-declared"
    && entry.verdict !== "recorded-not-compared"
    && entry.verdict !== "acceptance-gate-pending");
  result.summary = {
    cells: cells.length,
    equal: cells.filter((entry) => entry.verdict === "equal").length,
    mismatch: cells.filter((entry) => entry.verdict === "mismatch").length,
    notApplicableDeclared: cells.filter((entry) => entry.verdict === "not-applicable-declared").length,
    recordedNotCompared: cells.filter((entry) => entry.verdict === "recorded-not-compared").length,
    acceptanceGatePending: cells.filter((entry) => entry.verdict === "acceptance-gate-pending").length
  };
  result.ok = aPresent
    && cells.length === 20
    && applicable.length > 0
    && applicable.every((entry) => entry.verdict === "equal")
    && cells.every((entry) => entry.verdict !== "acceptance-gate-pending")
    && stable
    && result.anchor.manifestAgreesWithStatus
    && fHead === aHead;
  if (!result.ok && !result.reasonCode) {
    result.reasonCode = aPresent ? "MATRIX_HAS_RED_OR_UNSTABLE_CELLS" : "A_SIDE_ABSENT_DECLARED";
  }
  return result;
}

// ---- CLI ------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const fWorkspace = flag("f-side");
  if (!fWorkspace) {
    console.error(JSON.stringify({ ok: false, error: "--f-side <workspaceRoot> is required" }));
    process.exit(1);
  }
  const aAbsentReason = flag("a-side-absent");
  const result = await runMatrix({
    fWorkspace: resolve(fWorkspace),
    ...(aAbsentReason ? { aAbsent: { reason: aAbsentReason } } : { aDatabasePath: resolve(flag("a-side") ?? "") }),
    partitionId: flag("partition-id") ?? basename(resolve(fWorkspace, "..")),
    fAttestDir: flag("f-attest-dir") ? resolve(flag("f-attest-dir")) : undefined,
    aAttestDir: flag("a-attest-dir") ? resolve(flag("a-attest-dir")) : undefined,
    engineRoot: flag("engine-root") ? resolve(flag("engine-root")) : undefined
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
