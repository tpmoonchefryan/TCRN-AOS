#!/usr/bin/env node
// TCRN-CROSS-INIT-020 INC-080 — receipt hygiene gate. "A write nobody read back
// is not proven." During the INIT-020 tail, four ceremonies shipped with zero real
// receipts, and the one file named `.receipt.json` was a PAYLOAD copy (same
// schema, same bytes) — nobody noticed, because nothing checked the schema of a
// file that claimed to be a receipt.
//
// Judgements (both must hold for the gate to pass):
//   1. A file named `*.receipt.json` MUST be a receipt schema — one carrying
//      chainBefore, chainAfter and per-step results. A payload schema masquerading
//      as a receipt reds (PAYLOAD_MASQUERADING_AS_RECEIPT).
//   2. Every payload under docs/reports must have a paired receipt file
//      (same basename + `.receipt.json`). An unpaired payload reds
//      (ORPHAN_PAYLOAD).
//
// First run on the committed state must red: docs/reports/init-020/
// story-185-closeout.receipt.json is a payload copy. INC-081 re-records the real
// receipts; this gate is the守门方 that makes the re-record checkable.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AOS_PARTITIONS } from "./aos-partitions.mjs";
import { localEngine } from "./local-engine-read.mjs";

const RECEIPT_SCHEMAS = new Set(["aos.local-client-ceremony-receipt.v1", "aos.facade-write-receipt.v1"]);
const PAYLOAD_SCHEMA = "aos.local-client-ceremony.v1";
const MATERIALIZATION_SCHEMA = "aos.receipt-materialization.v1";
const WITNESS_SCHEMA = "aos.receipt-witness-classification.v1";
const REPORT_WITNESS_SCHEMA = "aos.report-witness-classification.v1";
const WITNESS_CATEGORIES = new Set(["historical-null-head-witness", "payload-as-receipt-witness"]);
const REPORT_WITNESS_CATEGORIES = new Set(["reversed-conclusion-stitch-witness"]);
const LIVE_EVENT_PAGE_SIZE = 200;
const LIVE_EVENT_MAX_PAGES = 100;
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function parseJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isReceiptShape(record) {
  const top = record;
  const receipt = top?.receipt && typeof top.receipt === "object" ? top.receipt : top;
  const hasBefore = Object.hasOwn(receipt ?? {}, "chainBefore");
  const hasAfter = Object.hasOwn(receipt ?? {}, "chainAfter");
  const steps = Array.isArray(receipt?.steps);
  const stepResults = steps && (receipt.steps.length === 0 || receipt.steps.every((step) => step && (step.reasonCode !== undefined || step.ok !== undefined)));
  return hasBefore && hasAfter && stepResults;
}

const HASH = /^[a-f0-9]{64}$/u;

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/")
    && !value.split("/").includes("..") && !value.includes("\\");
}

function pathInside(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && !rel.includes("\\"));
}

function resolveDeclaredPath(projectRoot, value) {
  if (typeof value !== "string" || !safeRelativePath(value)) return null;
  const candidate = resolve(projectRoot, value);
  return pathInside(projectRoot, candidate) ? candidate : null;
}

function validateWitnessLedger({ witnessRoot, classificationPath, projectRoot, problems }) {
  const result = { enabled: true, manifest: classificationPath ?? null, files: 0, entries: 0 };
  if (typeof witnessRoot !== "string" || typeof classificationPath !== "string") {
    problems.push("WITNESS_LEDGER_UNCONFIGURED — witnessRoot and witnessClassificationPath are required for the evidence lane");
    return result;
  }
  const manifest = parseJson(classificationPath);
  if (manifest === null) {
    problems.push(`WITNESS_LEDGER_UNREADABLE — ${classificationPath}`);
    return result;
  }
  if (manifest.schemaVersion !== WITNESS_SCHEMA) {
    problems.push(`WITNESS_LEDGER_SCHEMA_INVALID — expected ${WITNESS_SCHEMA}`);
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    problems.push("WITNESS_LEDGER_EMPTY — classification must enumerate every preserved witness");
    return result;
  }
  result.entries = manifest.entries.length;
  if (!Number.isSafeInteger(manifest.problemCount) || manifest.problemCount <= 0) {
    problems.push("WITNESS_LEDGER_PROBLEM_COUNT_INVALID");
  }
  const seenSources = new Set();
  const seenPreserved = new Set();
  let problemCount = 0;
  for (const entry of manifest.entries) {
    const source = resolveDeclaredPath(projectRoot, entry?.sourcePath);
    const preserved = resolveDeclaredPath(projectRoot, entry?.preservedPath);
    if (source === null || preserved === null) {
      problems.push("WITNESS_LEDGER_PATH_INVALID — sourcePath/preservedPath must be safe project-relative paths");
      continue;
    }
    if (!pathInside(witnessRoot, preserved)) {
      problems.push(`WITNESS_LEDGER_PATH_OUTSIDE_WITNESSES — ${entry.preservedPath}`);
    }
    if (!pathInside(resolve(witnessRoot, "..", "receipts"), source)) {
      problems.push(`WITNESS_LEDGER_SOURCE_OUTSIDE_RECEIPTS — ${entry.sourcePath}`);
    }
    if (seenSources.has(entry.sourcePath)) problems.push(`WITNESS_LEDGER_DUPLICATE_SOURCE — ${entry.sourcePath}`);
    if (seenPreserved.has(entry.preservedPath)) problems.push(`WITNESS_LEDGER_DUPLICATE_PRESERVED — ${entry.preservedPath}`);
    seenSources.add(entry.sourcePath);
    seenPreserved.add(entry.preservedPath);
    if (existsSync(source)) problems.push(`WITNESS_SOURCE_STILL_IN_RECEIPTS — ${entry.sourcePath}`);
    if (!existsSync(preserved)) {
      problems.push(`WITNESS_PRESERVED_MISSING — ${entry.preservedPath}`);
      continue;
    }
    const bytes = readFileSync(preserved);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes !== bytes.byteLength) {
      problems.push(`WITNESS_BYTES_MISMATCH — ${entry.preservedPath}`);
    }
    if (!HASH.test(entry.sha256 ?? "") || entry.sha256 !== sha256Bytes(bytes)) {
      problems.push(`WITNESS_SHA256_MISMATCH — ${entry.preservedPath}`);
    }
    if (!WITNESS_CATEGORIES.has(entry.category)) {
      problems.push(`WITNESS_CATEGORY_INVALID — ${entry.preservedPath}`);
    }
    if (!Number.isSafeInteger(entry.problemCount) || entry.problemCount <= 0) {
      problems.push(`WITNESS_ENTRY_PROBLEM_COUNT_INVALID — ${entry.preservedPath}`);
    } else {
      problemCount += entry.problemCount;
    }
  }
  if (Number.isSafeInteger(manifest.problemCount) && manifest.problemCount !== problemCount) {
    problems.push(`WITNESS_PROBLEM_COUNT_MISMATCH — manifest=${manifest.problemCount} entries=${problemCount}`);
  }
  const witnessFiles = walk(witnessRoot).filter((path) => path.endsWith(".json"));
  result.files = witnessFiles.length;
  const actualPreserved = new Set(witnessFiles.map((path) => relative(projectRoot, path).split("\\").join("/")));
  for (const path of actualPreserved) {
    if (!seenPreserved.has(path)) problems.push(`UNCLASSIFIED_WITNESS_FILE — ${path}`);
  }
  for (const path of seenPreserved) {
    if (!actualPreserved.has(path)) problems.push(`WITNESS_LEDGER_FILE_MISSING — ${path}`);
  }
  return result;
}

// Reports live beside the product documentation, not under the evidence receipt
// root. A report can therefore not be downgraded by merely moving it into the
// evidence witness directory. This second ledger is the explicit, byte-bound
// escape hatch for a preserved bad report: it removes the file from the acceptance
// receipt set, keeps the original bytes, and records that the file is a red witness,
// never a green receipt.
function validateReportWitnessLedger({ classificationPath, projectRoot, problems }) {
  const result = { enabled: false, manifest: classificationPath ?? null, files: 0, entries: 0, sourcePaths: [] };
  if (typeof classificationPath !== "string") return result;
  result.enabled = true;
  const manifest = parseJson(classificationPath);
  if (manifest === null) {
    problems.push(`REPORT_WITNESS_LEDGER_UNREADABLE — ${classificationPath}`);
    return result;
  }
  if (manifest.schemaVersion !== REPORT_WITNESS_SCHEMA) {
    problems.push(`REPORT_WITNESS_LEDGER_SCHEMA_INVALID — expected ${REPORT_WITNESS_SCHEMA}`);
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    problems.push("REPORT_WITNESS_LEDGER_EMPTY — every downgraded report must be enumerated");
    return result;
  }
  result.entries = manifest.entries.length;
  const seen = new Set();
  for (const entry of manifest.entries) {
    const source = resolveDeclaredPath(projectRoot, entry?.sourcePath);
    const preserved = resolveDeclaredPath(projectRoot, entry?.preservedPath ?? entry?.sourcePath);
    if (source === null || preserved === null) {
      problems.push("REPORT_WITNESS_PATH_INVALID — sourcePath/preservedPath must be safe project-relative paths");
      continue;
    }
    const sourceKey = relative(projectRoot, source).split("\\").join("/");
    if (seen.has(sourceKey)) problems.push(`REPORT_WITNESS_DUPLICATE_SOURCE — ${sourceKey}`);
    seen.add(sourceKey);
    if (entry.acceptanceEligible !== false) {
      problems.push(`REPORT_WITNESS_NOT_RED — ${sourceKey} must declare acceptanceEligible:false`);
    }
    if (!REPORT_WITNESS_CATEGORIES.has(entry.category)) {
      problems.push(`REPORT_WITNESS_CATEGORY_INVALID — ${sourceKey}`);
    }
    if (!existsSync(source)) {
      problems.push(`REPORT_WITNESS_SOURCE_MISSING — ${sourceKey}`);
      continue;
    }
    const sourceBytes = readFileSync(source);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes !== sourceBytes.byteLength) {
      problems.push(`REPORT_WITNESS_BYTES_MISMATCH — ${sourceKey}`);
    }
    if (!HASH.test(entry.sha256 ?? "") || entry.sha256 !== sha256Bytes(sourceBytes)) {
      problems.push(`REPORT_WITNESS_SHA256_MISMATCH — ${sourceKey}`);
    }
    if (!existsSync(preserved)) {
      problems.push(`REPORT_WITNESS_PRESERVED_MISSING — ${entry.preservedPath ?? entry.sourcePath}`);
    } else {
      const preservedBytes = readFileSync(preserved);
      if (sha256Bytes(preservedBytes) !== sha256Bytes(sourceBytes) || preservedBytes.byteLength !== sourceBytes.byteLength) {
        problems.push(`REPORT_WITNESS_PRESERVED_BYTES_MISMATCH — ${entry.preservedPath ?? entry.sourcePath}`);
      }
    }
    result.sourcePaths.push(source);
  }
  result.files = result.sourcePaths.length;
  return result;
}

function receiptEnvelope(record) {
  return record?.receipt && typeof record.receipt === "object" ? record.receipt : record;
}

function storyKeys(record) {
  const envelope = receiptEnvelope(record);
  const keys = new Set();
  const add = (value) => {
    if (typeof value !== "string") return;
    for (const match of value.matchAll(/TCRN-CROSS-(?:STORY|INC)-\d+/gu)) keys.add(match[0]);
  };
  add(record?.story);
  add(envelope?.story);
  for (const readback of envelope?.readback ?? record?.readback ?? []) {
    add(readback?.record?.externalKey);
    add(readback?.record?.scope);
  }
  return keys;
}

function receiptOutcome(record) {
  const envelope = receiptEnvelope(record);
  const readback = envelope?.readback ?? record?.readback ?? [];
  const verdicts = Array.isArray(readback)
    ? readback.map((entry) => entry?.verdict?.reasonCode ?? entry?.reasonCode).filter(Boolean)
    : [];
  return JSON.stringify({
    ok: record?.ok ?? envelope?.ok ?? null,
    reasonCode: record?.reasonCode ?? envelope?.reasonCode ?? null,
    verdicts,
  });
}

function receiptAttemptKey(record) {
  const envelope = receiptEnvelope(record);
  const before = envelope?.chainBefore;
  const after = envelope?.chainAfter;
  return JSON.stringify({
    before: before && [before.workspaceId, before.version, before.headEventHash],
    after: after && [after.workspaceId, after.version, after.headEventHash],
    attempt: record?.attemptId ?? envelope?.attemptId ?? null,
  });
}

function storyReceiptConflicts(receiptFiles, excludedPaths, problems) {
  const groups = new Map();
  for (const { path, label } of receiptFiles) {
    if (excludedPaths.has(path)) continue;
    const record = parseJson(path);
    if (record === null) continue;
    const outcome = receiptOutcome(record);
    const attempt = receiptAttemptKey(record);
    for (const story of storyKeys(record)) {
      const key = `${story}\u0000${attempt}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ label, outcome });
    }
  }
  for (const [key, entries] of groups) {
    const outcomes = new Set(entries.map((entry) => entry.outcome));
    if (outcomes.size > 1) {
      const story = key.split("\u0000", 1)[0];
      problems.push(`STORY_RECEIPT_OUTCOME_CONFLICT — ${story} has mutually exclusive outcomes for one chain attempt: ${entries.map((entry) => entry.label).join(", ")}`);
    }
  }
}

function validateReceiptEvidence(receipt, base, problems, { materializationRoot } = {}) {
  const payload = receipt?.payload;
  if (/(?:^|\/)story-\d+-closeout\.receipt\.json$/u.test(base) && payload === undefined) {
    problems.push(`${base}: RECEIPT_PROVENANCE_MISSING — closeout receipts must carry payload provenance; deleting the payload block does not evade the anti-stitch gate`);
  }
  if (payload !== null && payload !== undefined) {
    const payloadPathOk = payload && typeof payload === "object"
      && (payload.path === undefined || safeRelativePath(payload.path));
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)
      || !HASH.test(payload.sha256 ?? "")
      || !Number.isSafeInteger(payload.bytes) || payload.bytes < 0 || !payloadPathOk) {
      problems.push(`${base}: invalid payload digest/path/byte shape`);
    }
    const materialization = payload && typeof payload === "object" ? payload.materialization : undefined;
    if (materialization !== undefined) {
      const validShape = typeof materialization === "object" && materialization !== null
        && materialization.schemaVersion === MATERIALIZATION_SCHEMA
        && materialization.mode === "full"
        && materialization.cropped === false
        && (materialization.cropFingerprint === null || HASH.test(materialization.cropFingerprint ?? ""));
      if (!validShape) {
        problems.push(`${base}: RECEIPT_MATERIALIZATION_INVALID — materialized evidence must declare full bytes and a named crop fingerprint`);
      }
      if (materialization?.cropped === true) {
        problems.push(`${base}: RECEIPT_CROPPED — a receipt may not be archived as a cropped derivative`);
      }
      if (materializationRoot && safeRelativePath(payload?.path)) {
        const candidate = resolve(materializationRoot, payload.path);
        const rel = relative(materializationRoot, candidate);
        if (rel.startsWith("..") || rel.includes("\\")) {
          problems.push(`${base}: materialized payload path escapes its evidence root`);
        } else {
          try {
            const bytes = readFileSync(candidate);
            if (sha256Bytes(bytes) !== payload.sha256 || bytes.byteLength !== payload.bytes) {
              problems.push(`${base}: MATERIALIZED_BYTES_MISMATCH — receipt digest/bytes do not match the materialized payload`);
            }
          } catch {
            problems.push(`${base}: MATERIALIZED_BYTES_MISSING — receipt names materialized bytes that are not present`);
          }
        }
      }
    }
  }
  for (const side of ["chainBefore", "chainAfter"]) {
    const head = receipt?.[side];
    if (head === null || head === undefined) {
      problems.push(`${base}: ${side} is null; a receipt without a live authority-head anchor is red`);
      continue;
    }
    if (typeof head !== "object" || !Number.isSafeInteger(head.version) || head.version < 0
      || typeof head.workspaceId !== "string" || !HASH.test(head.headEventHash ?? "")) {
      problems.push(`${base}: ${side} is not a canonical authority-head anchor`);
    }
  }
  if (receipt?.chainBefore?.version !== undefined && receipt?.chainAfter?.version !== undefined
    && receipt.chainAfter.version < receipt.chainBefore.version) {
    problems.push(`${base}: chainAfter.version regresses behind chainBefore.version`);
  }
  const anchor = receipt?.authorityAnchor;
  if (anchor !== undefined && (typeof anchor !== "object" || !HASH.test(anchor.headEventHash ?? "")
    || !Number.isSafeInteger(anchor.version) || anchor.version < 0
    || typeof anchor.workspaceId !== "string")) {
    problems.push(`${base}: authorityAnchor is not a canonical live-head anchor`);
  }
}

function authorityHeadSet(authority) {
  const entries = [];
  if (Array.isArray(authority)) entries.push(...authority);
  if (Array.isArray(authority?.events)) entries.push(...authority.events);
  if (authority?.head && typeof authority.head === "object") entries.push(authority.head);
  if (authority && typeof authority === "object" && !Array.isArray(authority)
    && (authority.version !== undefined || authority.sequence !== undefined)) entries.push(authority);
  return new Set(entries.map((entry) => {
    const version = entry?.version ?? entry?.sequence;
    const hash = entry?.headEventHash ?? entry?.eventHash;
    return typeof entry?.workspaceId === "string" && Number.isSafeInteger(version) && HASH.test(hash ?? "")
      ? `${entry.workspaceId}:${version}:${hash}` : null;
  }).filter(Boolean));
}

function authorityForPartition(authorityStreams, partition) {
  if (authorityStreams === undefined || authorityStreams === null) return undefined;
  if (Array.isArray(authorityStreams)) return authorityStreams;
  return authorityStreams[partition] ?? authorityStreams.default;
}

/**
 * Read every event hash needed to anchor historical receipts. This is a read
 * face only: status and event-list come from the local engine, and a refusal is
 * returned to the caller rather than replaced by local receipt bytes.
 */
export async function readLiveAuthorityStreams(partitions = Object.keys(AOS_PARTITIONS)) {
  const streams = {};
  for (const partition of partitions) {
    const status = await localEngine("status", partition);
    if (!status.accepted) {
      throw Object.assign(new Error(`status refused for ${partition}: ${status.reasonCode ?? status.exitCode}`), { reasonCode: status.reasonCode });
    }
    const statusBody = status.json ?? {};
    const head = {
      workspaceId: statusBody.workspaceId,
      version: statusBody.version,
      headEventHash: statusBody.headEventHash,
    };
    const first = await localEngine("event-list", partition);
    if (!first.accepted) {
      throw Object.assign(new Error(`event-list refused for ${partition}: ${first.reasonCode ?? first.exitCode}`), { reasonCode: first.reasonCode });
    }
    const firstBody = first.json ?? {};
    if (!Array.isArray(firstBody.records)) throw new Error(`event-list for ${partition} returned no records array`);
    const records = [...firstBody.records];
    const total = Number.isInteger(firstBody.total) ? firstBody.total : records.length;
    for (let page = 1; firstBody.truncated === true && records.length < total && page <= LIVE_EVENT_MAX_PAGES; page += 1) {
      const offset = records.length;
      const next = await localEngine("event-list", partition, { limit: LIVE_EVENT_PAGE_SIZE, offset });
      if (!next.accepted) {
        throw Object.assign(new Error(`event-list paging refused for ${partition} at offset ${offset}: ${next.reasonCode ?? next.exitCode}`), { reasonCode: next.reasonCode });
      }
      const body = next.json ?? {};
      if (!Array.isArray(body.records) || body.records.length === 0) throw new Error(`event-list for ${partition} returned an empty page at offset ${offset}`);
      records.push(...body.records);
    }
    if (records.length !== total) throw new Error(`event-list for ${partition} returned ${records.length} of ${total} events`);
    streams[partition] = {
      schemaVersion: "aos.live-authority-event-stream.v1",
      source: "live-local-engine:status+event-list",
      partition,
      head,
      events: records.map((event) => ({
        workspaceId: head.workspaceId,
        version: event.sequence,
        eventHash: event.eventHash,
      })),
    };
  }
  return streams;
}

function currentIncidentScope(root) {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^init-\d+$/u.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .at(-1);
  } catch {
    return undefined;
  }
}

export function judgeReceiptHygiene({
  reportsRoot,
  evidenceRoot,
  witnessRoot,
  witnessClassificationPath,
  reportWitnessClassificationPath,
  projectRoot,
  authorityStreams,
  requireAuthority = false,
} = {}) {
  const problems = [];
  const scanned = [];
  const root = reportsRoot ?? null;
  const evidenceProjectRoot = projectRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const reportWitnesses = validateReportWitnessLedger({
    classificationPath: reportWitnessClassificationPath,
    projectRoot: evidenceProjectRoot,
    problems,
  });
  const excludedReportWitnesses = new Set(reportWitnesses.sourcePaths);
  const reportFiles = root === null ? [] : walk(root).filter((path) =>
    relative(root, path).endsWith(".receipt.json") && !excludedReportWitnesses.has(path));
  const evidence = evidenceRoot === undefined ? [] : walk(evidenceRoot);
  const witnesses = witnessRoot === undefined
    ? { enabled: false, manifest: null, files: 0, entries: 0 }
    : validateWitnessLedger({ witnessRoot, classificationPath: witnessClassificationPath, projectRoot: evidenceProjectRoot, problems });
  const receiptFiles = [
    ...reportFiles.map((path) => ({ path, root, label: relative(root, path) })),
    ...evidence.map((path) => ({ path, root: evidenceRoot, label: `evidence/${relative(evidenceRoot, path)}` }))
  ];
  storyReceiptConflicts(receiptFiles, excludedReportWitnesses, problems);
  let authorityAnchored = 0;
  for (const { path, root: fileRoot, label: base } of receiptFiles.sort((a, b) => a.label.localeCompare(b.label))) {
    scanned.push(base);
    const record = parseJson(path);
    if (record === null) {
      problems.push(`${base}: unreadable receipt JSON`);
      continue;
    }
    const schema = record.schemaVersion ?? record.receipt?.schemaVersion;
    if (typeof schema === "string" && RECEIPT_SCHEMAS.has(schema)) {
      if (!isReceiptShape(record)) {
        problems.push(`${base}: receipt schema but missing chainBefore/chainAfter or per-step results`);
      }
      const receipt = record?.receipt && typeof record.receipt === "object" ? record.receipt : record;
      validateReceiptEvidence(receipt, base, problems, {
        // Evidence receipts are siblings of payloads; report receipts normally
        // use the report tree itself as their materialization root.
        materializationRoot: fileRoot === evidenceRoot && evidenceRoot !== undefined
          ? resolve(evidenceRoot, "..") : fileRoot
      });
      const authority = authorityForPartition(authorityStreams, receipt.partition);
      const heads = authorityHeadSet(authority);
      if (requireAuthority && heads.size === 0) {
        problems.push(`${base}: AUTHORITY_UNAVAILABLE — no authoritative event stream was supplied for ${receipt.partition ?? "<unknown>"}`);
      }
      if (heads.size > 0) {
        let receiptAnchored = true;
        for (const side of ["chainBefore", "chainAfter"]) {
          const head = receipt[side];
          const key = head && `${head.workspaceId}:${head.version}:${head.headEventHash}`;
          if (!heads.has(key)) {
            problems.push(`${base}: RECEIPT_AUTHORITY_MISMATCH — ${side} is not present in the authoritative event stream`);
            receiptAnchored = false;
          }
        }
        if (receiptAnchored) authorityAnchored += 1;
      }
      continue;
    }
    if (schema === PAYLOAD_SCHEMA) {
      problems.push(`${base}: PAYLOAD_MASQUERADING_AS_RECEIPT — a payload (${PAYLOAD_SCHEMA}) saved under a .receipt.json name`);
      continue;
    }
    problems.push(`${base}: unknown schemaVersion ${String(schema ?? "<none>")}`);
  }
  // Orphan payloads (scoped to the incident window): a payload (payload schema,
  // non-receipt) with no sibling `.receipt.json` for the same basename.
  const files = root === null ? [] : walk(root);
  const scope = root === null ? undefined : currentIncidentScope(root);
  const orphanScopePrefix = scope === undefined ? null : `${scope}/`;
  const payloadFiles = files.filter((path) => !relative(root, path).endsWith(".receipt.json"));
  for (const path of payloadFiles.sort()) {
    const base = relative(root, path);
    if (orphanScopePrefix === null || !base.startsWith(orphanScopePrefix)) continue;
    const record = parseJson(path);
    if (record === null || record.schemaVersion !== PAYLOAD_SCHEMA) continue;
    const sibling = join(root, base.replace(/\.json$/u, ".receipt.json"));
    let exists = false;
    try { statSync(sibling); exists = true; } catch { exists = false; }
    if (!exists) {
      problems.push(`${base}: ORPHAN_PAYLOAD — no paired ${base.replace(/\.json$/u, ".receipt.json")}`);
    }
  }
  return {
    ok: problems.length === 0,
    reasonCode: problems.length === 0 ? "RECEIPT_HYGIENE_VERIFIED" : "RECEIPT_HYGIENE_VIOLATED",
    scannedReceipts: scanned.length,
    orphanScope: orphanScopePrefix,
    authority: {
      required: requireAuthority,
      anchoredReceipts: authorityAnchored,
      reachable: authorityAnchored > 0,
      reasonCode: authorityAnchored > 0 ? "AUTHORITY_ANCHORED" : (requireAuthority ? "AUTHORITY_UNAVAILABLE" : "AUTHORITY_NOT_REQUESTED"),
    },
    witnesses,
    reportWitnesses,
    problems,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("receipt-hygiene-proof.mjs")) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const reportsRoot = resolve(projectRoot, "docs/reports");
  const evidenceRoot = resolve(projectRoot, "evidence/mcp-ceremony-write/receipts");
  const witnessRoot = resolve(projectRoot, "evidence/mcp-ceremony-write/witnesses");
  const witnessClassificationPath = resolve(projectRoot, "evidence/mcp-ceremony-write/witness-classification-2026-08-07-qa4.json");
  const reportWitnessClassificationPath = resolve(projectRoot, "docs/reports/init-020/report-witness-classification.json");
  const authorityIndex = process.argv.indexOf("--authority");
  const authorityPath = authorityIndex >= 0 ? process.argv[authorityIndex + 1] : process.env.TCRN_RECEIPT_AUTHORITY_FILE;
  let authorityStreams;
  let authorityReadError = null;
  if (authorityPath) authorityStreams = parseJson(resolve(authorityPath));
  else {
    try {
      authorityStreams = await readLiveAuthorityStreams();
    } catch (error) {
      authorityReadError = { reasonCode: error?.reasonCode ?? "AUTHORITY_UNAVAILABLE", error: error?.message ?? String(error) };
      authorityStreams = {};
    }
  }
  const result = judgeReceiptHygiene({
    reportsRoot,
    evidenceRoot,
    witnessRoot,
    witnessClassificationPath,
    reportWitnessClassificationPath,
    projectRoot,
    authorityStreams,
    requireAuthority: true,
  });
  if (authorityReadError !== null) result.authorityReadError = authorityReadError;
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const p of result.problems ?? []) process.stderr.write(`  PROBLEM: ${p}\n`);
  if (!result.ok) process.exitCode = 1;
}
