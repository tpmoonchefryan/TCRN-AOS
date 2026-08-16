import test from "node:test";
import assert from "node:assert/strict";

import { PROTOCOL_CLAUSES, judgeS197Protocol } from "./s197-protocol-proof.mjs";

test("both governing documents carry the complete S197 protocol", () => {
  const result = judgeS197Protocol();
  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, "S197_PROTOCOL_VERIFIED");
  assert.equal(result.documents.length, 2);
  assert.ok(PROTOCOL_CLAUSES.length >= 10);
});

test("a missing emergency clause makes the document proof red", () => {
  const result = judgeS197Protocol({
    documents: [{ id: "fixture", path: "fixture.md" }],
    read: () => ({ ok: true, text: "2026-08-08 非紧急开发冻结" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "S197_PROTOCOL_INCOMPLETE");
  assert.ok(result.documents[0].missing.includes("emergency-security"));
});
