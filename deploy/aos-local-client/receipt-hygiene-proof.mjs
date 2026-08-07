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

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RECEIPT_SCHEMAS = new Set(["aos.local-client-ceremony-receipt.v1", "aos.facade-write-receipt.v1"]);
const PAYLOAD_SCHEMA = "aos.local-client-ceremony.v1";
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

function validateReceiptEvidence(receipt, base, problems) {
  if (receipt?.payload !== null && receipt?.payload !== undefined) {
    const payloadPathOk = receipt.payload.path === undefined
      || (typeof receipt.payload.path === "string" && !receipt.payload.path.startsWith("/")
        && !receipt.payload.path.split("/").includes(".."));
    if (typeof receipt.payload !== "object" || !HASH.test(receipt.payload.sha256 ?? "")
      || !Number.isSafeInteger(receipt.payload.bytes) || receipt.payload.bytes < 0 || !payloadPathOk) {
      problems.push(`${base}: invalid payload digest/path/byte shape`);
    }
  }
  for (const side of ["chainBefore", "chainAfter"]) {
    const head = receipt?.[side];
    if (head === null || head === undefined) continue;
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
    || !Number.isSafeInteger(anchor.version) || anchor.version < 0)) {
    problems.push(`${base}: authorityAnchor is not a canonical live-head anchor`);
  }
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

export function judgeReceiptHygiene({ reportsRoot, evidenceRoot } = {}) {
  const problems = [];
  const scanned = [];
  const root = reportsRoot ?? null;
  const reportFiles = root === null ? [] : walk(root).filter((path) => relative(root, path).endsWith(".receipt.json"));
  const evidence = evidenceRoot === undefined ? [] : walk(evidenceRoot);
  const receiptFiles = [
    ...reportFiles.map((path) => ({ path, root, label: relative(root, path) })),
    ...evidence.map((path) => ({ path, root: evidenceRoot, label: `evidence/${relative(evidenceRoot, path)}` }))
  ];
  for (const { path, label: base } of receiptFiles.sort((a, b) => a.label.localeCompare(b.label))) {
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
      validateReceiptEvidence(receipt, base, problems);
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
    problems,
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("receipt-hygiene-proof.mjs")) {
  const reportsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/reports");
  const evidenceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../evidence/mcp-ceremony-write/receipts");
  const result = judgeReceiptHygiene({ reportsRoot, evidenceRoot });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const p of result.problems ?? []) process.stderr.write(`  PROBLEM: ${p}\n`);
  if (!result.ok) process.exitCode = 1;
}
