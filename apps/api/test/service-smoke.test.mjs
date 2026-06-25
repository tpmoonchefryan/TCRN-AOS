import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

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

test("local service now serves the reset shell plus cockpit, docs, target-set, project-workspace, initiative-detail, ai-employee, gate-queue, conference, dependency-console, resource-library, and knowledge-modules slices while APIs remain available", async () => {
  const service = await startAosLocalServiceProof();
  try {
    for (const target of retiredFrontendTargets) {
      const html = await fetch(`${service.url}${target}`).then((response) => response.text());
      assert.match(html, /data-surface="aos-rebuild-workspace"/, `${target} serves reset checkpoint`);
      assert.match(html, /AOS Frontend Reset Notice/, `${target} exposes reset notice heading`);
      assert.match(html, /Operations cockpit starting surface/, `${target} exposes the first fresh cockpit section`);
      assert.match(html, /Operations cockpit starting work/, `${target} exposes cockpit work index`);
      assert.match(html, /Docs readiness starting surface/, `${target} exposes the docs slice`);
      assert.match(html, /Docs inspection rows/, `${target} exposes docs inspection rows`);
      assert.match(html, /Product design target-set starting surface/, `${target} exposes the target-set slice`);
      assert.match(html, /AOS-wide surface index/, `${target} exposes the target-set work index`);
      assert.match(html, /Project workspace starting surface/, `${target} exposes the project workspace slice`);
      assert.match(html, /Project workspace current work/, `${target} exposes the project workspace work index`);
      assert.match(html, /Initiative detail starting surface/, `${target} exposes the initiative detail slice`);
      assert.match(html, /Initiative detail linked records/, `${target} exposes the initiative detail linked records`);
      assert.match(html, /AI employee starting surface/, `${target} exposes the ai employee slice`);
      assert.match(html, /AI employee roster/, `${target} exposes the ai employee roster`);
      assert.match(html, /Gate queue starting surface/, `${target} exposes the gate queue slice`);
      assert.match(html, /Gate queue rows/, `${target} exposes the gate queue rows`);
      assert.match(html, /Conference starting surface/, `${target} exposes the conference slice`);
      assert.match(html, /Conference list/, `${target} exposes the conference list`);
      assert.match(html, /Dependency console starting surface/, `${target} exposes the dependency console slice`);
      assert.match(html, /Dependency governance rows/, `${target} exposes the dependency console rows`);
      assert.match(html, /Resource library starting surface/, `${target} exposes the resource library slice`);
      assert.match(html, /Resource library rows/, `${target} exposes the resource library rows`);
      assert.match(html, /Knowledge modules starting surface/, `${target} exposes the knowledge modules slice`);
      assert.match(html, /Knowledge module rows/, `${target} exposes the knowledge module rows`);
      assert.match(html, /Fresh rebuild section is now active inside the replacement workspace while the standalone surface remains retired\./, `${target} exposes the active resource library checklist note`);
      assert.match(html, /Retired frontend inventory/, `${target} exposes retired inventory`);
      assert.match(html, /Retired served scope/, `${target} exposes retired served scope`);
      assert.equal(Array.from(html.matchAll(/Fresh rebuild surface not started yet\./g)).length, 1, `${target} only keeps later queued checklist rows`);
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
    assert.equal(cockpitModel.ownerTrial.rootServiceUrl, "/");
    assert.equal(cockpitModel.ownerTrial.nonClaims.productAcceptance, false);
    assert.equal(cockpitModel.ownerTrial.nonClaims.parentGoalCompletion, false);
  } finally {
    const stopped = await service.close();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.runtimeReset, true);
  }
});
