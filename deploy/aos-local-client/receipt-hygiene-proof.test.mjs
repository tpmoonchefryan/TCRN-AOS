// SPDX-License-Identifier: Apache-2.0
// TCRN-CROSS-INIT-020 INC-080 — receipt hygiene red leg. A payload saved under a
// `.receipt.json` name is the exact defect that let four tail ceremonies ship with
// zero real receipts. These tests pin the two judgements hermetically (a temp
// reports root, no live chain):
//   RED — a payload-schema file named .receipt.json;
//   GREEN — a real receipt-schema file passes; a payload with its paired real
//           receipt is not orphaned.

import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
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
});
