import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

const shellTargets = [
  "/",
  "/cockpit",
  "/work",
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

test("local service serves the AOS shell while backend readbacks stay available", async () => {
  const service = await startAosLocalServiceProof();
  try {
    for (const target of shellTargets) {
      const response = await fetch(`${service.url}${target}`);
      const html = await response.text();
      assert.equal(response.status, 200, `${target} serves the first shell slice`);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      assert.match(html, /data-aos-shell="first-frontend-slice"/);
      assert.match(html, /data-design-system-source="@tcrn\/ui-react @tcrn\/ui-tokens @tcrn\/ui-copy-state"/);
      assert.match(html, /data-aos-dummy-cockpit="true"/);
      assert.match(html, /data-aos-work-module-entry="jira-like"/);
      assert.doesNotMatch(html, /ai-consumption-contract\.json/);
    }

    const cockpitApi = await fetch(`${service.url}/api/cockpit`);
    const cockpitPayload = await cockpitApi.json();
    assert.equal(cockpitApi.status, 410);
    assert.equal(cockpitPayload.error, "aos_cockpit_api_deferred");
    assert.equal(cockpitPayload.dummyCockpitOnly, true);
    assert.equal(cockpitPayload.finalCockpitAggregationAvailable, false);
    assert.equal(cockpitPayload.liveDispatch, false);

    const health = await fetch(`${service.url}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.runtimeDatabase, "local_fixture");
    assert.equal(health.runtimeDataCommitted, false);
    assert.equal(health.externalQueue, "none");
    assert.equal(health.liveCodexDispatchAuthorized, false);
    assert.equal(health.copiedHelperExecution, false);

    const policy = await fetch(`${service.url}/policy`).then((response) => response.json());
    assert.equal(policy.ok, true);
    assert.equal(policy.runtimeServerStarted, true);
    assert.equal(policy.serviceProofOnly, true);

    const readback = await fetch(`${service.url}/readback`).then((response) => response.json());
    assert.equal(readback.ok, true);
    assert.equal(readback.operationalRecordCounts.stories, 2);
    assert.equal(readback.operationalRecordCounts.auditEvents >= 1, true);
  } finally {
    const stopped = await service.close();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.runtimeReset, true);
  }
});
