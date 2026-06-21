import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

test("local service proof serves owner-trial UI, health, and readback, then stops cleanly", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const cockpit = await fetch(`${service.url}/`).then((response) => response.text());
    assert.match(cockpit, /data-surface="operations-cockpit"/);
    assert.match(cockpit, /data-service-backed="true"/);
    assert.match(cockpit, /data-cockpit-api="\/api\/cockpit"/);
    assert.match(cockpit, /data-refresh-readback/);
    assert.match(cockpit, /data-work-table/);
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

    const cockpitModel = await fetch(`${service.url}/api/cockpit`).then((response) => response.json());
    assert.equal(cockpitModel.ok, true);
    assert.equal(cockpitModel.serviceBacked, true);
    assert.equal(cockpitModel.runtimeDataCommitted, false);
    assert.equal(cockpitModel.liveCodexDispatchAuthorized, false);
    assert.equal(cockpitModel.boundaries.productAcceptance, false);
    assert.equal(cockpitModel.boundaries.finalMvpAcceptance, false);
    assert.equal(cockpitModel.model.contextHeader.localCheckpoint, "owner-trial-service-readback");
    assert.equal(cockpitModel.model.workstreams[0].rows.length, 1);
    assert.equal(cockpitModel.model.detailPanel.selectedType, "story");
    assert.equal(cockpitModel.serviceReadModel.schemaVersion, "aos.cockpit.service_read_model.v1");
    assert.equal(cockpitModel.serviceReadModel.source, "service_api_read");
    assert.equal(cockpitModel.serviceReadModel.surfaces.cockpit.serviceBacked, true);
    assert.equal(cockpitModel.serviceReadModel.surfaces.workIndex.rowCount, 1);
    assert.equal(cockpitModel.serviceReadModel.surfaces.gate.autoExecutableCount, 0);
    assert.equal(cockpitModel.serviceReadModel.surfaces.readback.productAcceptance, false);
    assert.equal(cockpitModel.serviceReadModel.noClaims.broadUiReactMigration, false);

    const selectedStoryId = cockpitModel.model.workstreams[0].rows[0].storyId;
    const selectedCockpitModel = await fetch(`${service.url}/api/cockpit?selectedType=story&selectedId=${selectedStoryId}`).then((response) => response.json());
    assert.equal(selectedCockpitModel.model.detailPanel.selectedId, selectedStoryId);
    assert.equal(selectedCockpitModel.serviceReadModel.surfaces.workIndex.selectedStoryId, selectedStoryId);
    assert.equal(selectedCockpitModel.serviceReadModel.surfaces.detail.selectedId, selectedStoryId);
  } finally {
    const stopped = await service.close();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.runtimeReset, true);
  }
});
