import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

test("local service proof serves health and readback, then stops cleanly", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const health = await fetch(`${service.url}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.runtimeDatabase, "local_fixture");
    assert.equal(health.runtimeDataCommitted, false);
    assert.equal(health.externalQueue, "none");
    assert.equal(health.liveCodexDispatchAuthorized, false);
    assert.equal(health.copiedHelperExecution, false);

    const readback = await fetch(`${service.url}/readback`).then((response) => response.json());
    assert.equal(readback.operationalRecordCounts.stories, 1);
    assert.equal(readback.operationalRecordCounts.auditEvents >= 1, true);
  } finally {
    const stopped = await service.close();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.runtimeReset, true);
  }
});
