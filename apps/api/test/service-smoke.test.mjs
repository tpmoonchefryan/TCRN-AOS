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
  "/gateway-adapter.html",
  "/dependency-console.html",
  "/resource-library.html",
  "/knowledge-modules.html",
  "/admin-access.html",
  "/github-release-linkage.html"
];

test("local service now serves the reset shell plus cockpit, docs, target-set, project-workspace, initiative-detail, ai-employee, gate-queue, conference, gateway-adapter, dependency-console, resource-library, knowledge-modules, admin-access, and GitHub release-linkage slices while APIs remain available", async () => {
  const service = await startAosLocalServiceProof();
  try {
    for (const target of retiredFrontendTargets) {
      const html = await fetch(`${service.url}${target}`).then((response) => response.text());
      assert.match(html, /data-surface="aos-rebuild-workspace"/, `${target} serves reset checkpoint`);
      assert.match(html, /AOS Rebuild Workspace/, `${target} exposes rebuild workspace heading`);
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
      assert.match(html, /Gateway and adapter starting surface/, `${target} exposes the gateway adapter slice`);
      assert.match(html, /Gateway and adapter rows/, `${target} exposes the gateway adapter rows`);
      assert.match(html, /Dependency console starting surface/, `${target} exposes the dependency console slice`);
      assert.match(html, /Dependency governance rows/, `${target} exposes the dependency console rows`);
      assert.match(html, /Resource library starting surface/, `${target} exposes the resource library slice`);
      assert.match(html, /Resource library rows/, `${target} exposes the resource library rows`);
      assert.match(html, /Knowledge modules starting surface/, `${target} exposes the knowledge modules slice`);
      assert.match(html, /Knowledge module rows/, `${target} exposes the knowledge module rows`);
      assert.match(html, /Admin and access starting surface/, `${target} exposes the admin and access slice`);
      assert.match(html, /Admin and access rows/, `${target} exposes the admin and access rows`);
      assert.match(html, /GitHub release linkage starting surface/, `${target} exposes the GitHub release linkage slice`);
      assert.match(html, /GitHub release linkage rows/, `${target} exposes the GitHub release linkage rows`);
      assert.match(html, /Fresh rebuilt module is active in the shared workspace while the standalone page remains retired\./, `${target} exposes the active rebuilt module note`);
      assert.match(html, /Rebuilt module directory/, `${target} exposes rebuilt module directory`);
      assert.match(html, /Legacy standalone scope/, `${target} exposes legacy standalone scope`);
      assert.match(html, /Current module entry/, `${target} exposes the current module entry panel`);
      assert.equal(Array.from(html.matchAll(/Fresh rebuild surface not started yet\./g)).length, 0, `${target} only keeps later queued checklist rows`);
      assert.doesNotMatch(html, /package-runtime pilot|unavailable in this route|not_claimed/i, `${target} avoids stale internal copy`);

      if (target === "/gateway-adapter.html") {
        assert.match(html, /Current path/, `${target} exposes current-path navigation`);
        assert.match(html, /Current path actions/, `${target} exposes current-path action lane`);
        assert.match(html, /Open Gateway \/ Adapter/, `${target} exposes focused module action`);
        assert.match(html, /Open Dependency Console/, `${target} exposes related module action`);
        assert.match(html, /Gateway \/ Adapter is foregrounded in the rebuilt workspace/, `${target} exposes route-aware summary copy`);
        assert.match(html, /Related rebuilt modules/, `${target} exposes related rebuilt module links`);
        assert.match(html, /Health and governance/, `${target} exposes related module focus context`);
        assert.match(html, /Release records/, `${target} exposes release linkage context`);
        assert.ok(
          html.indexOf('data-region="gateway-adapter-start"') < html.indexOf('data-region="cockpit-start"'),
          `${target} foregrounds the gateway adapter section before the default cockpit section`
        );
        assert.ok(
          html.indexOf('data-region="dependency-console-start"') < html.indexOf('data-region="cockpit-start"'),
          `${target} foregrounds the dependency console section before the default cockpit section`
        );
        assert.ok(
          html.indexOf('data-region="github-release-linkage-start"') < html.indexOf('data-region="cockpit-start"'),
          `${target} foregrounds the GitHub release linkage section before the default cockpit section`
        );
        const checklistHtml = html.slice(html.indexOf("Rebuilt module directory"), html.indexOf("Legacy standalone scope"));
        assert.ok(
          checklistHtml.indexOf("Gateway / Adapter") < checklistHtml.indexOf("Operations Cockpit"),
          `${target} foregrounds the gateway adapter row before the default checklist ordering`
        );
        assert.ok(
          checklistHtml.indexOf("Dependency Console") < checklistHtml.indexOf("Operations Cockpit"),
          `${target} foregrounds related rows before the default checklist ordering`
        );
        assert.ok(
          checklistHtml.indexOf("GitHub Release Linkage") < checklistHtml.indexOf("Operations Cockpit"),
          `${target} foregrounds related GitHub release linkage rows before the default checklist ordering`
        );
      }
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
