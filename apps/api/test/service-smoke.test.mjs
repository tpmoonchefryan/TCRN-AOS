import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

test("local service proof serves owner-trial UI, health, and readback, then stops cleanly", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const retiredFrontendTargets = [
      "/",
      "/cockpit",
      "/operations-cockpit.html",
      "/docs-search-release-readiness.html",
      "/aos-wide-product-design.html",
      "/project-workspace.html",
      "/initiative-detail.html",
      "/ai-employee.html",
      "/gate-queue.html",
      "/conference.html",
      "/dependency-console.html"
    ];
    for (const target of retiredFrontendTargets) {
      const html = await fetch(`${service.url}${target}`).then((response) => response.text());
      assert.match(html, /data-surface="aos-rebuild-workspace"/, `${target} serves rebuild baseline`);
      assert.match(html, /AOS Frontend Replacement Workspace/, `${target} exposes replacement heading`);
      assert.match(html, /Operations cockpit starting surface/, `${target} exposes the first fresh cockpit surface`);
      assert.match(html, /Operations cockpit starting work/, `${target} exposes cockpit work index`);
      assert.match(html, /Docs readiness starting surface/, `${target} exposes the next fresh docs surface`);
      assert.match(html, /Docs inspection rows/, `${target} exposes docs inspection rows`);
      assert.match(html, /Product design target-set starting surface/, `${target} exposes the next fresh target-set surface`);
      assert.match(html, /AOS-wide surface index/, `${target} exposes target-set surface index`);
      assert.match(html, /Project workspace starting surface/, `${target} exposes the next fresh project workspace surface`);
      assert.match(html, /Project workspace current work/, `${target} exposes project workspace current work`);
      assert.match(html, /Initiative detail starting surface/, `${target} exposes the next fresh initiative detail surface`);
      assert.match(html, /Initiative detail linked records/, `${target} exposes initiative detail linked records`);
      assert.match(html, /AI employee starting surface/, `${target} exposes the next fresh AI employee surface`);
      assert.match(html, /AI employee roster/, `${target} exposes AI employee roster`);
      assert.match(html, /Gate queue starting surface/, `${target} exposes the next fresh gate queue surface`);
      assert.match(html, /Gate queue rows/, `${target} exposes gate queue rows`);
      assert.match(html, /Conference starting surface/, `${target} exposes the next fresh conference surface`);
      assert.match(html, /Conference list/, `${target} exposes conference list`);
      assert.match(html, /Dependency console starting surface/, `${target} exposes the next fresh dependency console surface`);
      assert.match(html, /Dependency governance rows/, `${target} exposes dependency governance rows`);
      assert.match(html, /Resource library starting surface/, `${target} exposes the next fresh resource library surface`);
      assert.match(html, /Resource library rows/, `${target} exposes resource library rows`);
      assert.match(html, /Retired frontend inventory/, `${target} exposes retirement inventory`);
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
    assert.equal(cockpitModel.ownerTrial.rootServiceUrl, "/");
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
