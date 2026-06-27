import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

const removedFrontendTargets = [
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
  "/github-release-linkage.html",
  "/api/cockpit"
];

test("local service keeps backend readbacks available while AOS frontend routes stay removed", async () => {
  const service = await startAosLocalServiceProof();
  try {
    for (const target of removedFrontendTargets) {
      const response = await fetch(`${service.url}${target}`);
      const payload = await response.json();
      assert.equal(response.status, 410, `${target} is gone after frontend reset`);
      assert.equal(payload.ok, false);
      assert.equal(payload.error, "aos_frontend_removed");
      assert.equal(payload.frontendCodeDisposition, "removed_pending_owner_led_design_restart");
      assert.equal(payload.ownerReviewRequired, true);
      assert.equal(payload.replacementSurfaceAvailable, false);
      assert.equal(payload.productUiAcceptance, false);
      assert.equal(payload.releaseReadiness, false);
      assert.equal(payload.liveDispatch, false);
    }

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
