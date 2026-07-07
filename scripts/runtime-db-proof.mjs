import { createAppliedRuntimeFixture } from "../dist/packages/db/src/index.js";

const fixture = await createAppliedRuntimeFixture();
const readback = fixture.readback();
const auditProof = await fixture.proveAuditAppendOnly();
const redactionProof = await fixture.proveRestrictedPayloadRejection();
const resetProof = await fixture.reset();

const ok = readback.ok
  && readback.operationalRecordCounts.stageMapItems === 4
  && auditProof.ok
  && redactionProof.ok
  && resetProof.ok;

console.log(JSON.stringify({
  ok,
  storageMode: readback.storageMode,
  runtimeDataCommitted: readback.runtimeDataCommitted,
  operationalRecordCounts: readback.operationalRecordCounts,
  auditProof,
  redactionProof,
  resetProof
}, null, 2));

if (!ok) {
  process.exit(1);
}
