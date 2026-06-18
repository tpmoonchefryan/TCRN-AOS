import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

test("local service proof serves owner-trial UI, health, and readback, then stops cleanly", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const cockpit = await fetch(`${service.url}/`).then((response) => response.text());
    assert.match(cockpit, /data-surface="operations-cockpit"/);
    assert.match(cockpit, /TCRN/);
    assert.match(cockpit, /AOS/);

    const cockpitAlias = await fetch(`${service.url}/cockpit`).then((response) => response.text());
    assert.match(cockpitAlias, /data-surface="operations-cockpit"/);

    const docsReadiness = await fetch(`${service.url}/docs-readiness`).then((response) => response.text());
    assert.match(docsReadiness, /data-region="docs-surface-shell"/);

    const productDesign = await fetch(`${service.url}/aos-wide-product-design`).then((response) => response.text());
    assert.match(productDesign, /data-surface="aos-wide-product-design"/);

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
