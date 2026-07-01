import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const service = await startAosLocalServiceProof();
let closed = false;

try {
  const health = await fetch(`${service.url}/health`).then((response) => response.json());
  const readback = await fetch(`${service.url}/readback`).then((response) => response.json());
  const shell = await fetch(`${service.url}/`);
  const shellHtml = await shell.text();
  const cockpit = await fetch(`${service.url}/cockpit`);
  const cockpitHtml = await cockpit.text();
  const work = await fetch(`${service.url}/work`);
  const workHtml = await work.text();
  const deferredCockpitApi = await fetch(`${service.url}/api/cockpit`);
  const deferredCockpitApiPayload = await deferredCockpitApi.json();
  const closeResult = await service.close();
  closed = closeResult.stopped && closeResult.runtimeReset;
  const ok = health.ok
    && health.runtimeDatabase === "local_fixture"
    && health.runtimeDataCommitted === false
    && health.externalQueue === "none"
    && health.liveCodexDispatchAuthorized === false
    && readback.ok
    && readback.operationalRecordCounts.stories === 2
    && shell.status === 200
    && shellHtml.includes('data-aos-shell="owner-quality-product-shell"')
    && shellHtml.includes('data-owner-quality-product-shell-oracle="true"')
    && shellHtml.includes('data-owner-quality-first-viewport="product-led"')
    && shellHtml.includes('data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"')
    && shellHtml.includes('data-package-backed-product-shell-boundary="side-nav-shell-v1"')
    && shellHtml.includes('data-product-shell-semantic-api="collapse-theme-locale"')
    && shellHtml.includes('data-product-shell-global-search="not-rendered"')
    && !shellHtml.includes('data-shell-control="product-shell-search"')
    && cockpit.status === 200
    && cockpitHtml.includes('data-product-shell-route="cockpit"')
    && work.status === 200
    && workHtml.includes('data-aos-work-module-entry="owner-quality-work-queue"')
    && workHtml.includes('data-product-shell-route="work"')
    && deferredCockpitApi.status === 410
    && deferredCockpitApiPayload.error === "aos_cockpit_api_deferred"
    && deferredCockpitApiPayload.dummyCockpitOnly === true
    && deferredCockpitApiPayload.finalCockpitAggregationAvailable === false
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
    frontendShell: {
      shellStatus: shell.status,
      cockpitStatus: cockpit.status,
      workStatus: work.status,
      shellMarkerPresent: shellHtml.includes('data-aos-shell="owner-quality-product-shell"'),
      ownerQualityMarkerPresent: shellHtml.includes('data-owner-quality-product-shell-oracle="true"'),
      productLedMarkerPresent: shellHtml.includes('data-owner-quality-first-viewport="product-led"'),
      productShellBoundaryPresent: shellHtml.includes('data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"'),
      globalSearchAbsent: !shellHtml.includes('data-shell-control="product-shell-search"'),
      workModuleMarkerPresent: workHtml.includes('data-aos-work-module-entry="owner-quality-work-queue"'),
      deferredCockpitApiStatus: deferredCockpitApi.status,
      deferredCockpitApiError: deferredCockpitApiPayload.error
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
