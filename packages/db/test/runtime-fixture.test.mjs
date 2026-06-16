import test from "node:test";
import assert from "node:assert/strict";
import { createAppliedRuntimeFixture } from "../../../dist/packages/db/src/index.js";

test("runtime fixture applies, reads back representative records, proves safety, and resets", async () => {
  const fixture = await createAppliedRuntimeFixture();
  const readback = fixture.readback();
  assert.equal(readback.ok, true);
  assert.equal(readback.storageMode, "os_temp_ephemeral");
  assert.equal(readback.runtimeDataCommitted, false);
  assert.equal(readback.operationalRecordCounts.stories, 1);
  assert.equal(readback.operationalRecordCounts.gates, 2);
  assert.equal(readback.operationalRecordCounts.knowledgeEntries, 1);
  assert.equal(readback.operationalRecordCounts.userGuideDrafts, 1);
  assert.equal(readback.operationalRecordCounts.stageMapItems, 4);

  const auditProof = await fixture.proveAuditAppendOnly();
  assert.equal(auditProof.ok, true);
  assert.equal(auditProof.afterCount, auditProof.beforeCount + 1);

  const redactionProof = await fixture.proveRestrictedPayloadRejection();
  assert.equal(redactionProof.ok, true);
  assert.equal(redactionProof.rejected, true);
  assert.equal(redactionProof.auditRecorded, true);

  const reset = await fixture.reset();
  assert.equal(reset.ok, true);
  assert.equal(reset.runtimeDataExistsAfterReset, false);
});
