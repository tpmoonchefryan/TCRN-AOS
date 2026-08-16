// SPDX-License-Identifier: Apache-2.0
// TCRN-CROSS-INIT-020 INC-080 — receipt hygiene red leg. A payload saved under a
// `.receipt.json` name is the exact defect that let four tail ceremonies ship with
// zero real receipts. These tests pin the two judgements hermetically (a temp
// reports root, no live chain):
//   RED — a payload-schema file named .receipt.json;
//   GREEN — a real receipt-schema file passes; a payload with its paired real
//           receipt is not orphaned.

import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { judgeReceiptHygiene } from "./receipt-hygiene-proof.mjs";

function tempReportsRoot() {
  return mkdtempSync(join(tmpdir(), "receipt-hygiene-"));
}

const PAYLOAD = { schemaVersion: "aos.local-client-ceremony.v1", story: "T", intent: "i", steps: [], readback: [] };
const REAL_RECEIPT = {
  schemaVersion: "aos.local-client-ceremony-receipt.v1",
  story: "T",
  intent: "i",
  startedAt: "2026-08-07T00:00:00Z",
  host: "tcrn-platform-dev",
  partition: "cross-project",
  topology: {},
  chainBefore: { workspaceId: "workspace:test", version: 1, headEventHash: "a".repeat(64) },
  steps: [{ verb: "work-annotate", ok: true, reasonCode: "WORKSPACE_COMMAND_COMPLETED" }],
  readback: [],
  chainAfter: { workspaceId: "workspace:test", version: 2, headEventHash: "b".repeat(64) },
  ok: true,
  reasonCode: "CEREMONY_COMPLETED",
};

describe("receipt hygiene (INC-080)", () => {
  test("the witness ledger is two-way: every preserved file is classified and every source is absent", () => {
    const project = tempReportsRoot();
    const reports = join(project, "docs", "reports");
    const receipts = join(project, "evidence", "mcp-ceremony-write", "receipts");
    const witnesses = join(project, "evidence", "mcp-ceremony-write", "witnesses");
    const manifestPath = join(project, "evidence", "mcp-ceremony-write", "witness-classification.json");
    mkdirSync(reports, { recursive: true });
    mkdirSync(receipts, { recursive: true });
    mkdirSync(witnesses, { recursive: true });
    const witness = Buffer.from(JSON.stringify(PAYLOAD), "utf8");
    const preservedPath = join(witnesses, "old.json");
    writeFileSync(preservedPath, witness);
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: "aos.receipt-witness-classification.v1",
      problemCount: 1,
      entries: [{
        sourcePath: "evidence/mcp-ceremony-write/receipts/old.json",
        preservedPath: "evidence/mcp-ceremony-write/witnesses/old.json",
        category: "payload-as-receipt-witness",
        problemCount: 1,
        bytes: witness.byteLength,
        sha256: createHash("sha256").update(witness).digest("hex"),
      }],
    }), "utf8");
    const result = judgeReceiptHygiene({
      reportsRoot: reports,
      evidenceRoot: receipts,
      witnessRoot: witnesses,
      witnessClassificationPath: manifestPath,
      projectRoot: project,
    });
    assert.equal(result.ok, true, JSON.stringify(result.problems));
    assert.deepEqual(result.witnesses, { enabled: true, manifest: manifestPath, files: 1, entries: 1 });
  });

  test("a sibling witness file that is not in the ledger is red", () => {
    const project = tempReportsRoot();
    const reports = join(project, "docs", "reports");
    const receipts = join(project, "evidence", "mcp-ceremony-write", "receipts");
    const witnesses = join(project, "evidence", "mcp-ceremony-write", "witnesses");
    const manifestPath = join(project, "evidence", "mcp-ceremony-write", "witness-classification.json");
    mkdirSync(reports, { recursive: true });
    mkdirSync(receipts, { recursive: true });
    mkdirSync(witnesses, { recursive: true });
    const classified = Buffer.from(JSON.stringify(PAYLOAD), "utf8");
    writeFileSync(join(witnesses, "classified.json"), classified);
    writeFileSync(join(witnesses, "unclassified.json"), JSON.stringify(PAYLOAD), "utf8");
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: "aos.receipt-witness-classification.v1",
      problemCount: 1,
      entries: [{
        sourcePath: "evidence/mcp-ceremony-write/receipts/classified.json",
        preservedPath: "evidence/mcp-ceremony-write/witnesses/classified.json",
        category: "payload-as-receipt-witness",
        problemCount: 1,
        bytes: classified.byteLength,
        sha256: createHash("sha256").update(classified).digest("hex"),
      }],
    }), "utf8");
    const result = judgeReceiptHygiene({
      reportsRoot: reports,
      evidenceRoot: receipts,
      witnessRoot: witnesses,
      witnessClassificationPath: manifestPath,
      projectRoot: project,
    });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((problem) => problem.includes("UNCLASSIFIED_WITNESS_FILE")));
  });

  test("REDS when a payload schema masquerades under a .receipt.json name", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "story-x-closeout.receipt.json"), JSON.stringify(PAYLOAD), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, false);
    assert.equal(result.reasonCode, "RECEIPT_HYGIENE_VIOLATED");
    assert.ok(result.problems.some((p) => p.includes("PAYLOAD_MASQUERADING_AS_RECEIPT")));
  });

  test("GREENS for a real receipt schema", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "story-y-closeout.receipt.json"), JSON.stringify(REAL_RECEIPT), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.reasonCode, "RECEIPT_HYGIENE_VERIFIED");
  });

  test("GREENS when an incident-window payload has its paired real receipt", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "story-z-closeout.json"), JSON.stringify(PAYLOAD), "utf8");
    writeFileSync(join(root, "init-020", "story-z-closeout.receipt.json"), JSON.stringify(REAL_RECEIPT), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, true, JSON.stringify(result.problems));
  });

  test("REDS when an incident-window payload has no paired receipt (orphan)", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "story-w-closeout.json"), JSON.stringify(PAYLOAD), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("ORPHAN_PAYLOAD")));
  });

  test("REDS when either authority head is null", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "null-head.receipt.json"), JSON.stringify({
      ...REAL_RECEIPT,
      chainBefore: null
    }), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("chainBefore is null")));
  });

  test("materialized receipts are checked against full payload bytes", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    mkdirSync(join(root, "payloads"), { recursive: true });
    const bytes = Buffer.from("full payload bytes\n", "utf8");
    writeFileSync(join(root, "payloads", "one.json"), bytes);
    const receipt = {
      ...REAL_RECEIPT,
      payload: {
        path: "payloads/one.json",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.byteLength,
        materialization: {
          schemaVersion: "aos.receipt-materialization.v1",
          mode: "full",
          cropped: false,
          cropFingerprint: null
        }
      }
    };
    writeFileSync(join(root, "init-020", "full.receipt.json"), JSON.stringify(receipt), "utf8");
    assert.equal(judgeReceiptHygiene({ reportsRoot: root }).ok, true);
    writeFileSync(join(root, "payloads", "one.json"), "cropped\n", "utf8");
    const red = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(red.ok, false);
    assert.ok(red.problems.some((p) => p.includes("MATERIALIZED_BYTES_MISMATCH")));
  });

  test("an optional authoritative event stream must contain both receipt heads", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    const receipt = { ...REAL_RECEIPT, partition: "cross-project" };
    writeFileSync(join(root, "init-020", "anchored.receipt.json"), JSON.stringify(receipt), "utf8");
    const authorityStreams = {
      "cross-project": {
        events: [
          { workspaceId: "workspace:test", version: 1, eventHash: "a".repeat(64) },
          { workspaceId: "workspace:test", version: 2, eventHash: "b".repeat(64) }
        ]
      }
    };
    const result = judgeReceiptHygiene({ reportsRoot: root, authorityStreams, requireAuthority: true });
    assert.equal(result.ok, true, JSON.stringify(result.problems));
    assert.equal(result.authority.anchoredReceipts, 1);
  });

  test("offline mode is explicitly red when authority anchoring is required", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "offline.receipt.json"), JSON.stringify(REAL_RECEIPT), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root, requireAuthority: true });
    assert.equal(result.ok, false);
    assert.equal(result.authority.reachable, false);
    assert.ok(result.problems.some((problem) => problem.includes("AUTHORITY_UNAVAILABLE")));
  });

  test("a reversed-conclusion report is preserved as a red witness and excluded from green receipts", () => {
    const project = tempReportsRoot();
    const reports = join(project, "docs", "reports");
    const init = join(reports, "init-020");
    mkdirSync(init, { recursive: true });
    const reportPath = join(init, "story-185-closeout.receipt.json");
    const bytes = Buffer.from(JSON.stringify(REAL_RECEIPT), "utf8");
    writeFileSync(reportPath, bytes);
    const manifestPath = join(init, "report-witness-classification.json");
    writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: "aos.report-witness-classification.v1",
      entries: [{
        sourcePath: "docs/reports/init-020/story-185-closeout.receipt.json",
        preservedPath: "docs/reports/init-020/story-185-closeout.receipt.json",
        category: "reversed-conclusion-stitch-witness",
        acceptanceEligible: false,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }],
    }), "utf8");
    const result = judgeReceiptHygiene({
      reportsRoot: reports,
      projectRoot: project,
      reportWitnessClassificationPath: manifestPath,
    });
    assert.equal(result.ok, true, JSON.stringify(result.problems));
    assert.deepEqual(result.reportWitnesses, {
      enabled: true,
      manifest: manifestPath,
      files: 1,
      entries: 1,
      sourcePaths: [reportPath],
    });
  });

  test("a closeout receipt without payload provenance is red even when its old payload block was deleted", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    writeFileSync(join(root, "init-020", "story-185-closeout.receipt.json"), JSON.stringify(REAL_RECEIPT), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((problem) => problem.includes("RECEIPT_PROVENANCE_MISSING")));
  });

  test("mutually exclusive outcomes for one story and one chain attempt are red", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    const shared = {
      story: "TCRN-CROSS-STORY-185",
      partition: "cross-project",
      chainBefore: REAL_RECEIPT.chainBefore,
      chainAfter: REAL_RECEIPT.chainAfter,
      steps: REAL_RECEIPT.steps,
      readback: [],
    };
    writeFileSync(join(root, "init-020", "first.receipt.json"), JSON.stringify({
      ...REAL_RECEIPT, ...shared, ok: true, reasonCode: "READBACK_MATCHES_FULL_VALUE",
    }), "utf8");
    writeFileSync(join(root, "init-020", "second.receipt.json"), JSON.stringify({
      ...REAL_RECEIPT, ...shared, ok: false, reasonCode: "READBACK_NOTHING_COMPARED",
    }), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((problem) => problem.includes("STORY_RECEIPT_OUTCOME_CONFLICT")));
  });

  test("a retry on a different chain attempt is not mislabeled as a stitched conflict", () => {
    const root = tempReportsRoot();
    mkdirSync(join(root, "init-020"), { recursive: true });
    const first = {
      ...REAL_RECEIPT,
      story: "TCRN-CROSS-STORY-185",
      ok: false,
      reasonCode: "READBACK_NOTHING_COMPARED",
    };
    const second = {
      ...first,
      chainBefore: REAL_RECEIPT.chainAfter,
      chainAfter: { workspaceId: "workspace:test", version: 3, headEventHash: "c".repeat(64) },
      ok: true,
      reasonCode: "READBACK_MATCHES_FULL_VALUE",
    };
    writeFileSync(join(root, "init-020", "retry-a.receipt.json"), JSON.stringify(first), "utf8");
    writeFileSync(join(root, "init-020", "retry-b.receipt.json"), JSON.stringify(second), "utf8");
    const result = judgeReceiptHygiene({ reportsRoot: root });
    assert.equal(result.ok, true, JSON.stringify(result.problems));
  });
});
