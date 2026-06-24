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

    const projectWorkspace = await fetch(`${service.url}/project-workspace`).then((response) => response.text());
    assert.match(projectWorkspace, /data-surface="project-workspace"/);
    assert.match(projectWorkspace, /data-region="project-workspace-nav"/);
    assert.match(projectWorkspace, /data-ds-standard-ids="ds-aos-target-set-v1 ds-aos-operations-cockpit-v1"/);
    assert.match(projectWorkspace, /href="\/gate-queue.html"/);
    assert.match(projectWorkspace, /href="\/initiative-detail.html"/);

    const gateQueue = await fetch(`${service.url}/gate-queue`).then((response) => response.text());
    assert.match(gateQueue, /data-surface="gate-queue"/);
    assert.match(gateQueue, /data-region="gate-queue-list"/);
    assert.match(gateQueue, /data-ds-standard-ids="ds-aos-target-set-v1 ds-aos-operations-cockpit-v1"/);
    assert.match(gateQueue, /Action approvals and role reviews from the local service model\./);
    assert.doesNotMatch(gateQueue, /owner intent|owner_intent_required|package-runtime pilot|unavailable in this route/i);

    const initiativeDetail = await fetch(`${service.url}/initiative-detail`).then((response) => response.text());
    assert.match(initiativeDetail, /data-surface="initiative-detail"/);
    assert.match(initiativeDetail, /data-region="initiative-detail-ticket"/);
    assert.match(initiativeDetail, /data-ds-standard-ids="ds-aos-target-set-v1 ds-aos-operations-cockpit-v1"/);
    assert.match(initiativeDetail, /Ticket Drill-through/);
    assert.doesNotMatch(initiativeDetail, /local implementation slice|package-runtime pilot|unavailable in this route/i);

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
    assert.equal(readback.operationalRecordCounts.stories, 2);
    assert.equal(readback.operationalRecordCounts.auditEvents >= 1, true);

    const cockpitModel = await fetch(`${service.url}/api/cockpit`).then((response) => response.json());
    assert.equal(cockpitModel.ok, true);
    assert.equal(cockpitModel.serviceBacked, true);
    assert.equal(cockpitModel.runtimeDataCommitted, false);
    assert.equal(cockpitModel.liveCodexDispatchAuthorized, false);
    assert.equal(cockpitModel.boundaries.productAcceptance, false);
    assert.equal(cockpitModel.boundaries.finalMvpAcceptance, false);
    assert.equal(cockpitModel.model.contextHeader.localCheckpoint, "owner-trial-service-readback");
    assert.equal(cockpitModel.model.workstreams[0].rows.length, 2);
    assert.equal(cockpitModel.model.detailPanel.selectedType, "story");
    assert.equal(cockpitModel.serviceReadModel.schemaVersion, "aos.cockpit.service_read_model.v1");
    assert.equal(cockpitModel.serviceReadModel.source, "service_api_read");
    assert.equal(cockpitModel.serviceReadModel.surfaces.cockpit.serviceBacked, true);
    assert.equal(cockpitModel.serviceReadModel.surfaces.workIndex.rowCount, 2);
    assert.equal(cockpitModel.ownerTrial.schemaVersion, "aos.owner_trial_service_frontend.v1");
    assert.equal(cockpitModel.ownerTrial.workIndex.rowCount, 2);
    assert.equal(cockpitModel.ownerTrial.readinessLane.serviceBackedState, true);
    assert.equal(cockpitModel.ownerTrial.nonClaims.productAcceptance, false);
    assert.equal(cockpitModel.ownerTrial.nonClaims.parentGoalCompletion, false);
    assert.equal(cockpitModel.serviceReadModel.surfaces.gate.autoExecutableCount, 0);
    assert.equal(cockpitModel.serviceReadModel.surfaces.readback.productAcceptance, false);
    assert.equal(cockpitModel.serviceReadModel.noClaims.broadUiReactMigration, false);

    const selectedStoryId = cockpitModel.model.workstreams[0].rows[0].storyId;
    const selectedCockpitModel = await fetch(`${service.url}/api/cockpit?selectedType=story&selectedId=${selectedStoryId}`).then((response) => response.json());
    assert.equal(selectedCockpitModel.model.detailPanel.selectedId, selectedStoryId);
    assert.equal(selectedCockpitModel.serviceReadModel.surfaces.workIndex.selectedStoryId, selectedStoryId);
    assert.equal(selectedCockpitModel.serviceReadModel.surfaces.detail.selectedId, selectedStoryId);

    const secondStoryId = cockpitModel.model.workstreams[0].rows[1].storyId;
    const secondSelectedCockpitModel = await fetch(`${service.url}/api/cockpit?selectedType=story&selectedId=${secondStoryId}`).then((response) => response.json());
    assert.equal(secondSelectedCockpitModel.model.detailPanel.selectedId, secondStoryId);
    assert.equal(secondSelectedCockpitModel.serviceReadModel.surfaces.workIndex.selectedStoryId, secondStoryId);
    assert.equal(secondSelectedCockpitModel.serviceReadModel.surfaces.detail.selectedId, secondStoryId);
    assert.notEqual(secondSelectedCockpitModel.serviceReadModel.surfaces.detail.selectedId, selectedStoryId);
  } finally {
    const stopped = await service.close();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.runtimeReset, true);
  }
});
