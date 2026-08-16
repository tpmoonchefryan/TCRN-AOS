#!/usr/bin/env node
// INC-108 — live authority side of the closeout gate.
//
// The manifest is a claim. It is never allowed to supply its own authoritative
// item list or to mint a head hash. This runner reads status and the complete
// work-list from the local engine (read-only), then passes that live result to the
// generic verifier in TCRN-Workflow. A local-engine failure is a red result; there
// is no captured-file fallback. The VM facade was retired by S200 and must not be
// silently revived by a proof command.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { localEngine } from "./local-engine-read.mjs";
import { verifyCloseout } from "../../../TCRN-Workflow/scripts/closeout-verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const AOS_ROOT = resolve(HERE, "../..");
const PLATFORM_ROOT = resolve(AOS_ROOT, "..");
const DEFAULT_MANIFEST = resolve(AOS_ROOT, "docs/reports/init-020/closeout-verify-manifest.json");
const PAGE_SIZE = 200;
const MAX_PAGES = 100;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function failure(reasonCode, message, details = {}) {
  return { ok: false, reasonCode, error: String(message), ...details };
}

function isWorkId(value) {
  return typeof value === "string" && /^work:[a-f0-9]{24}$/u.test(value);
}

function normalizedExternalKey(value) {
  if (typeof value !== "string") return null;
  return value.match(/^TCRN-CROSS-(.+)$/u)?.[1] ?? value;
}

function scopeItemIds(text) {
  const ids = new Set();
  for (const match of String(text).matchAll(/\bINC-(\d+)\s*\.\.\s*(\d+)\b/gu)) {
    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start || end - start > 1000) continue;
    const width = Math.max(match[1].length, match[2].length);
    for (let value = start; value <= end; value += 1) ids.add(`INC-${String(value).padStart(width, "0")}`);
  }
  return [...ids].sort();
}

function manifestScopeWorkIds(manifest) {
  const ids = new Set();
  for (const disposition of Object.values(manifest?.dispositions ?? {})) {
    for (const value of [disposition?.ticket, disposition?.carriedBy]) {
      if (isWorkId(value)) ids.add(value);
    }
  }
  return [...ids];
}

async function readLiveWorkShow(partition, id, label) {
  const result = await localEngine("work-show", partition, { id });
  if (!result.accepted) {
    const error = new Error(`${label} work-show refused: ${result.reasonCode ?? result.exitCode}`);
    error.reasonCode = result.reasonCode ?? "CLOSEOUT_WORK_SHOW_READ_REFUSED";
    throw error;
  }
  const body = result.json ?? {};
  if (!body.record || typeof body.record !== "object") {
    throw new Error(`${label} work-show returned no record`);
  }
  return body;
}

async function readLiveAuthority(partition, manifest) {
  const observedAt = new Date().toISOString();
  const status = await localEngine("status", partition);
  if (!status.accepted) {
    const error = new Error(`status refused for ${partition}: ${status.reasonCode ?? status.exitCode}`);
    error.reasonCode = status.reasonCode ?? "CLOSEOUT_STATUS_READ_REFUSED";
    throw error;
  }
  const statusBody = status.json ?? {};
  const head = {
    workspaceId: statusBody.workspaceId,
    version: statusBody.version,
    headEventHash: statusBody.headEventHash,
  };
  // The local engine normally returns a complete work-list when no paging flags
  // are supplied. If it declares truncation, page through that same local CLI;
  // refusal is a red result rather than permission to use a captured file.
  const first = await localEngine("work-list", partition);
  if (!first.accepted) {
    const error = new Error(`work-list refused for ${partition}: ${first.reasonCode ?? first.exitCode}`);
    error.reasonCode = first.reasonCode ?? "CLOSEOUT_WORK_LIST_READ_REFUSED";
    throw error;
  }
  const firstBody = first.json ?? {};
  const firstRecords = firstBody.records ?? firstBody.work ?? firstBody.items;
  if (!Array.isArray(firstRecords)) {
    throw new Error(`work-list for ${partition} returned no records array`);
  }
  const records = [...firstRecords];
  if (firstBody.truncated === true) {
    const total = Number.isInteger(firstBody.total) ? firstBody.total : null;
    if (total === null || total <= records.length) {
      throw new Error(`work-list for ${partition} marked itself truncated without a larger total`);
    }
    for (let page = 1; records.length < total && page < MAX_PAGES; page += 1) {
      const offset = records.length;
      const listed = await localEngine("work-list", partition, {
        limit: PAGE_SIZE,
        offset,
      });
      if (!listed.accepted) {
        const error = new Error(`work-list for ${partition} is truncated and paging was refused at offset ${offset}: ${listed.reasonCode ?? listed.exitCode}`);
        error.reasonCode = listed.reasonCode ?? "CLOSEOUT_WORK_LIST_READ_REFUSED";
        throw error;
      }
      const body = listed.json ?? {};
      const pageRecords = body.records ?? body.work ?? body.items;
      if (!Array.isArray(pageRecords) || pageRecords.length === 0) {
        throw new Error(`work-list for ${partition} returned an empty page at offset ${offset}`);
      }
      records.push(...pageRecords);
    }
    if (records.length < total) {
      throw new Error(`work-list for ${partition} exceeded the ${MAX_PAGES}-page proof bound`);
    }
  }
  if (records.length === 0) throw new Error(`work-list for ${partition} was empty`);
  if (Number.isInteger(firstBody.total) && firstBody.total !== records.length) {
    throw new Error(`work-list for ${partition} total ${firstBody.total} did not match the complete read ${records.length}`);
  }
  const byId = new Map(records.map((record) => [record.id, record]));
  const byExternalKey = new Map(records.map((record) => [normalizedExternalKey(record.externalKey), record]));
  const incidentKey = normalizedExternalKey(manifest?.incident);
  const incidentRecord = byExternalKey.get(incidentKey);
  if (!incidentRecord) throw new Error(`manifest incident ${manifest?.incident ?? "<missing>"} is absent from the live work-list`);
  await readLiveWorkShow(partition, incidentRecord.id, `incident ${manifest.incident}`);

  // work-list is intentionally a compact summary and does not carry advisory
  // scope.  Read every live Story through work-show so the closeout verifier has
  // an independent, complete Story-scope authority rather than trusting a
  // manifest or validating only the incident named by that manifest.
  const storyScopes = [];
  for (const record of records.filter((candidate) => candidate?.kind === "Story"
    && candidate.tombstone !== true
    && candidate.status !== "done"
    && candidate.status !== "cancelled")) {
    const shown = await readLiveWorkShow(partition, record.id, `Story ${record.externalKey ?? record.id}`);
    storyScopes.push({
      ...record,
      advisory: shown.advisory ?? null,
      record: shown.record ?? null,
    });
  }

  const scopeCandidates = [];
  for (const workId of manifestScopeWorkIds(manifest)) {
    const sourceRecord = byId.get(workId);
    if (!sourceRecord) throw new Error(`manifest scope source ${workId} is absent from the live work-list`);
    const shown = await readLiveWorkShow(partition, workId, `scope source ${sourceRecord.externalKey}`);
    const text = shown.advisory?.scope ?? shown.record?.scope;
    const itemIds = scopeItemIds(text);
    if (itemIds.length > 0) scopeCandidates.push({ workId, externalKey: sourceRecord.externalKey, text, itemIds });
  }
  if (scopeCandidates.length === 0) {
    throw new Error("no live scope source named by the manifest carries an explicit incident item range");
  }
  const scopeFingerprint = JSON.stringify(scopeCandidates[0].itemIds);
  if (scopeCandidates.some((candidate) => JSON.stringify(candidate.itemIds) !== scopeFingerprint)) {
    throw new Error("manifest live scope sources disagree on the item set");
  }
  const scope = scopeCandidates[0];
  const scopedRecords = [];
  for (const itemId of scope.itemIds) {
    const record = byExternalKey.get(itemId);
    if (!record) throw new Error(`live scope item ${itemId} is absent from the live work-list`);
    const shown = await readLiveWorkShow(partition, record.id, `scope item ${itemId}`);
    const closeoutNote = shown.advisory?.scope ?? shown.advisory?.closeoutNote ?? shown.record?.scope ?? shown.record?.closeoutNote;
    scopedRecords.push({ ...record, closeoutNote });
  }
  const scopedIds = new Set(scopedRecords.map((record) => record.id));
  const enrichedRecords = records.map((record) => scopedIds.has(record.id)
    ? scopedRecords.find((scoped) => scoped.id === record.id)
    : record);
  return {
    schemaVersion: "tcrn.closeout-live-authority.v1",
    source: "live-local-engine:status+work-list+work-show",
    partition,
    observedAt,
    head,
    items: enrichedRecords,
    storyScopes,
    scope: {
      schemaVersion: "tcrn.closeout-scope.v1",
      source: "live-local-engine:work-show",
      workId: scope.workId,
      externalKey: scope.externalKey,
      text: scope.text,
      itemIds: scope.itemIds,
    },
    read: {
      status: { command: "status", accepted: true },
      workList: { command: "work-list", pages: Math.ceil(records.length / PAGE_SIZE), records: records.length },
      incident: { command: "work-show", id: incidentRecord.id, accepted: true },
      scope: { command: "work-show", id: scope.workId, accepted: true },
      scopeItems: { command: "work-show", count: scopedRecords.length, accepted: true },
    },
  };
}

function chainBinding(authority) {
  return {
    schemaVersion: "tcrn.closeout-chain-authority.v1",
    source: authority.source,
    partition: authority.partition,
    observedAt: authority.observedAt,
    headEventHash: authority.head.headEventHash,
    workspaceId: authority.head.workspaceId,
    version: authority.head.version,
  };
}

export async function proveCloseout({ manifestPath = DEFAULT_MANIFEST, partition } = {}) {
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    return failure("MANIFEST_UNREADABLE", `${manifestPath}: ${error?.message ?? error}`, { manifestPath });
  }
  const selectedPartition = partition ?? manifest.chainPartition;
  if (typeof selectedPartition !== "string" || selectedPartition.length === 0) {
    return failure("CLOSEOUT_PARTITION_REQUIRED", "manifest.chainPartition or --partition is required", { manifestPath });
  }
  try {
    const authority = await readLiveAuthority(selectedPartition, manifest);
    // The binding is derived from this call, never read from the manifest. If the
    // manifest already carries one, verifyCloseout compares it to the live head.
    const effectiveManifest = manifest.chainAuthority === undefined
      ? { ...manifest, chainAuthority: chainBinding(authority) }
      : manifest;
    const result = verifyCloseout(effectiveManifest, {
      authority,
      projectRoot: PLATFORM_ROOT,
      evidenceRoots: [AOS_ROOT, resolve(AOS_ROOT, "docs/reports/init-019"), resolve(AOS_ROOT, "docs/reports/init-020")],
    });
    return {
      ...result,
      manifestPath,
      authorityRead: authority,
      source: "live-chain-read",
    };
  } catch (error) {
    return failure(error?.reasonCode ?? "CLOSEOUT_AUTHORITY_UNAVAILABLE", error?.message ?? error, {
      manifestPath,
      partition: selectedPartition,
      source: "live-chain-read",
    });
  }
}

if (process.argv[1]?.endsWith("closeout-chain-proof.mjs")) {
  const manifestIndex = process.argv.indexOf("--manifest");
  const partitionIndex = process.argv.indexOf("--partition");
  const manifestPath = manifestIndex >= 0 ? resolve(process.argv[manifestIndex + 1]) : DEFAULT_MANIFEST;
  const partition = partitionIndex >= 0 ? process.argv[partitionIndex + 1] : undefined;
  const result = await proveCloseout({ manifestPath, partition });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const problem of result.problems ?? []) process.stderr.write(`  PROBLEM: ${problem}\n`);
  if (!result.ok) process.exitCode = 1;
}
