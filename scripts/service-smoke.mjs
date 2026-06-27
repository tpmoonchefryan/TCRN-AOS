import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const service = await startAosLocalServiceProof();
let closed = false;

try {
  const health = await fetch(`${service.url}/health`).then((response) => response.json());
  const readback = await fetch(`${service.url}/readback`).then((response) => response.json());
  const removedFrontend = await fetch(`${service.url}/api/cockpit`);
  const removedFrontendPayload = await removedFrontend.json();
  const closeResult = await service.close();
  closed = closeResult.stopped && closeResult.runtimeReset;
  const ok = health.ok
    && health.runtimeDatabase === "local_fixture"
    && health.runtimeDataCommitted === false
    && health.externalQueue === "none"
    && health.liveCodexDispatchAuthorized === false
    && readback.ok
    && readback.operationalRecordCounts.stories === 2
    && removedFrontend.status === 410
    && removedFrontendPayload.error === "aos_frontend_removed"
    && removedFrontendPayload.frontendCodeDisposition === "removed_pending_owner_led_design_restart"
    && removedFrontendPayload.ownerReviewRequired === true
    && removedFrontendPayload.replacementSurfaceAvailable === false
    && closed;

  console.log(JSON.stringify({
    ok,
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    },
    health: {
      ok: health.ok,
      runtimeDatabase: health.runtimeDatabase,
      runtimeDataCommitted: health.runtimeDataCommitted,
      externalQueue: health.externalQueue,
      liveCodexDispatchAuthorized: health.liveCodexDispatchAuthorized,
      copiedHelperExecution: health.copiedHelperExecution
    },
    frontend: {
      status: removedFrontend.status,
      error: removedFrontendPayload.error,
      codeDisposition: removedFrontendPayload.frontendCodeDisposition,
      ownerReviewRequired: removedFrontendPayload.ownerReviewRequired,
      replacementSurfaceAvailable: removedFrontendPayload.replacementSurfaceAvailable
    },
    readbackCounts: readback.operationalRecordCounts
  }, null, 2));

  if (!ok) {
    process.exit(1);
  }
} finally {
  if (!closed) {
    await service.close().catch(() => undefined);
  }
}
