import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

test("local service proof serves owner-trial UI, health, and readback, then stops cleanly", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const cockpitHtml = await fetch(`${service.url}/operations-cockpit.html`).then((response) => response.text());
    assert.match(cockpitHtml, /data-surface="operations-cockpit"/, "/operations-cockpit.html serves rebuilt cockpit");
    assert.match(cockpitHtml, /TCRN AOS Operations Cockpit/, "/operations-cockpit.html exposes cockpit title");
    assert.match(cockpitHtml, /Work Index/, "/operations-cockpit.html exposes rebuilt cockpit work index");
    assert.doesNotMatch(cockpitHtml, /AOS Rebuild Workspace/, "/operations-cockpit.html is no longer the reset baseline");

    const docsHtml = await fetch(`${service.url}/docs-search-release-readiness.html`).then((response) => response.text());
    assert.match(docsHtml, /data-surface="docs-search-release-readiness"/, "/docs-search-release-readiness.html serves rebuilt docs readiness");
    assert.match(docsHtml, /TCRN AOS Docs Readiness Inspection/, "/docs-search-release-readiness.html exposes docs readiness title");
    assert.match(docsHtml, /Docs Readiness/, "/docs-search-release-readiness.html exposes docs readiness module heading");
    assert.doesNotMatch(docsHtml, /AOS Rebuild Workspace/, "/docs-search-release-readiness.html is no longer the reset baseline");

    const aosWideHtml = await fetch(`${service.url}/aos-wide-product-design.html`).then((response) => response.text());
    assert.match(aosWideHtml, /data-surface="aos-wide-product-design"/, "/aos-wide-product-design.html serves rebuilt product design target set");
    assert.match(aosWideHtml, /TCRN AOS Product Design Surface Set/, "/aos-wide-product-design.html exposes product design title");
    assert.match(aosWideHtml, /Product Design/, "/aos-wide-product-design.html exposes product design module heading");
    assert.doesNotMatch(aosWideHtml, /AOS Rebuild Workspace/, "/aos-wide-product-design.html is no longer the reset baseline");

    const projectWorkspaceHtml = await fetch(`${service.url}/project-workspace.html`).then((response) => response.text());
    assert.match(projectWorkspaceHtml, /data-surface="project-workspace"/, "/project-workspace.html serves rebuilt project workspace");
    assert.match(projectWorkspaceHtml, /TCRN AOS Project Workspace/, "/project-workspace.html exposes project workspace title");
    assert.match(projectWorkspaceHtml, /Project Workspace/, "/project-workspace.html exposes project workspace module heading");
    assert.doesNotMatch(projectWorkspaceHtml, /AOS Rebuild Workspace/, "/project-workspace.html is no longer the reset baseline");

    const initiativeDetailHtml = await fetch(`${service.url}/initiative-detail.html`).then((response) => response.text());
    assert.match(initiativeDetailHtml, /data-surface="initiative-detail"/, "/initiative-detail.html serves rebuilt initiative detail");
    assert.match(initiativeDetailHtml, /TCRN AOS Initiative Detail/, "/initiative-detail.html exposes initiative detail title");
    assert.match(initiativeDetailHtml, /Initiative Detail/, "/initiative-detail.html exposes initiative detail module heading");
    assert.doesNotMatch(initiativeDetailHtml, /AOS Rebuild Workspace/, "/initiative-detail.html is no longer the reset baseline");

    const aiEmployeeHtml = await fetch(`${service.url}/ai-employee.html`).then((response) => response.text());
    assert.match(aiEmployeeHtml, /data-surface="ai-employee"/, "/ai-employee.html serves rebuilt AI employee");
    assert.match(aiEmployeeHtml, /TCRN AOS AI Employee/, "/ai-employee.html exposes AI employee title");
    assert.match(aiEmployeeHtml, /AI Employee/, "/ai-employee.html exposes AI employee module heading");
    assert.doesNotMatch(aiEmployeeHtml, /AOS Rebuild Workspace/, "/ai-employee.html is no longer the reset baseline");

    const gateQueueHtml = await fetch(`${service.url}/gate-queue.html`).then((response) => response.text());
    assert.match(gateQueueHtml, /data-surface="gate-queue"/, "/gate-queue.html serves rebuilt gate queue");
    assert.match(gateQueueHtml, /TCRN AOS Gate Queue/, "/gate-queue.html exposes gate queue title");
    assert.match(gateQueueHtml, /Gate Queue/, "/gate-queue.html exposes gate queue module heading");
    assert.doesNotMatch(gateQueueHtml, /AOS Rebuild Workspace/, "/gate-queue.html is no longer the reset baseline");

    const conferenceHtml = await fetch(`${service.url}/conference.html`).then((response) => response.text());
    assert.match(conferenceHtml, /data-surface="conference"/, "/conference.html serves rebuilt conference");
    assert.match(conferenceHtml, /TCRN AOS Conference/, "/conference.html exposes conference title");
    assert.match(conferenceHtml, /Conference/, "/conference.html exposes conference module heading");
    assert.doesNotMatch(conferenceHtml, /AOS Rebuild Workspace/, "/conference.html is no longer the reset baseline");

    const rebuildTargets = [
      "/",
      "/dependency-console.html"
    ];
    for (const target of rebuildTargets) {
      const html = await fetch(`${service.url}${target}`).then((response) => response.text());
      assert.match(html, /data-surface="aos-rebuild-workspace"/, `${target} serves rebuild baseline`);
      assert.match(html, /AOS Rebuild Workspace/, `${target} exposes rebuild heading`);
      assert.match(html, /Module rebuild checklist/, `${target} exposes rebuild checklist`);
      assert.doesNotMatch(html, /package-runtime pilot|unavailable in this route|not_claimed/i, `${target} avoids stale internal copy`);
    }

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
