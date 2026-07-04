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
  const workBoard = await fetch(`${service.url}/work/board`);
  const workBoardHtml = await workBoard.text();
  const workDetail = await fetch(`${service.url}/work/items/AOS-128`);
  const workDetailHtml = await workDetail.text();
  const workEvidence = await fetch(`${service.url}/work/evidence`);
  const workEvidenceHtml = await workEvidence.text();
  const workActivity = await fetch(`${service.url}/work/codex-activity`);
  const workActivityHtml = await workActivity.text();
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
    && workHtml.includes('data-work-management-mockup="storybook-ds-work-management-v1"')
    && workHtml.includes('data-work-management-static-fixture="true"')
    && workHtml.includes('data-work-management-api-integration="absent"')
    && workHtml.includes('data-work-management-live-dispatch="not-enabled"')
    && workHtml.includes('data-work-management-hierarchy="initiative-epic-story-work-item-subtask-evidence-task"')
    && workHtml.includes('data-ds-work-components-anchor="components.html#work-management-components-spec"')
    && workHtml.includes('data-ds-work-patterns-anchor="patterns.html#work-management-patterns"')
    && workHtml.includes('data-storybook-components-story-id="tcrn-design-system-components--work-management-components-spec"')
    && workHtml.includes('data-storybook-patterns-story-id="tcrn-design-system-patterns--work-management-patterns"')
    && workHtml.includes('data-ai-consumption-contract-version="ai_consumption_contract_v1"')
    && workHtml.includes('data-foundation-visual-standards-registry="foundation-visual-standards-v1"')
    && workHtml.includes('data-consumer-visual-style-contract="consumerVisualStyleContract"')
    && workHtml.includes('data-storybook-doc-shell-oracle="original-storybook-doc-shell-v1"')
    && workHtml.includes('data-work-static-authority-disposition="aos_static_work_mockup_consumes_storybook_ds_work_management_contract"')
    && workHtml.includes('data-work-route-proof-targets="/work /work/board /work/backlog /work/items/AOS-128 /work/views/owner-feedback /work/gates /work/evidence /work/codex-activity /work/initiatives/work-management-mvp"')
    && workHtml.includes('data-work-mobile-proof-targets="/work/backlog?locale=zh-CN&amp;theme=dark /work/items/AOS-128?locale=zh-CN&amp;theme=dark /work/initiatives/work-management-mvp?locale=zh-CN&amp;theme=dark"')
    && workHtml.includes('data-work-clean-room-layout="issue-style-tcrn-owned-no-atlassian-assets"')
    && workHtml.includes('data-design-system-work-components="registered-package-components"')
    && workHtml.includes('data-product-local-work-component-clones="absent"')
    && workHtml.includes('data-work-route-acceptance-target="/work"')
    && workHtml.includes('data-product-shell-route="work"')
    && workBoard.status === 200
    && workBoardHtml.includes('data-work-management-page="board"')
    && workBoardHtml.includes('data-work-management-pattern="work-board"')
    && workDetail.status === 200
    && workDetailHtml.includes('data-work-management-pattern="work-item-inspector"')
    && workDetailHtml.includes('data-full-token="cae4d52"')
    && workDetailHtml.includes("4317 retained preview refreshed; PM freshness retry pending")
    && !workDetailHtml.includes("7836dca")
    && !workDetailHtml.includes("pending Atlas refresh")
    && !workDetailHtml.includes("Owner inspection package is blocked until gates pass")
    && workEvidence.status === 200
    && workEvidenceHtml.includes('data-work-evidence-page="true"')
    && workEvidenceHtml.includes('data-work-management-pattern="evidence-attachment-list"')
    && workActivity.status === 200
    && workActivityHtml.includes('data-work-codex-activity-page="true"')
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
      workBoardStatus: workBoard.status,
      workDetailStatus: workDetail.status,
      workDetailBasisPosture: {
        currentAosBasisVisible: workDetailHtml.includes('data-full-token="cae4d52"'),
        staleAosBasisVisible: workDetailHtml.includes("7836dca"),
        retainedRefreshPostureVisible: workDetailHtml.includes("4317 retained preview refreshed; PM freshness retry pending"),
        stalePendingRefreshVisible: workDetailHtml.includes("pending Atlas refresh"),
        staleOwnerInspectionGateVisible: workDetailHtml.includes("Owner inspection package is blocked until gates pass")
      },
      workEvidenceStatus: workEvidence.status,
      workActivityStatus: workActivity.status,
      shellMarkerPresent: shellHtml.includes('data-aos-shell="owner-quality-product-shell"'),
      ownerQualityMarkerPresent: shellHtml.includes('data-owner-quality-product-shell-oracle="true"'),
      productLedMarkerPresent: shellHtml.includes('data-owner-quality-first-viewport="product-led"'),
      productShellBoundaryPresent: shellHtml.includes('data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"'),
      globalSearchAbsent: !shellHtml.includes('data-shell-control="product-shell-search"'),
      workModuleMarkerPresent: workHtml.includes('data-work-management-mockup="storybook-ds-work-management-v1"'),
      workMockupStaticFixture: workHtml.includes('data-work-management-static-fixture="true"'),
      workMockupNoApiIntegration: workHtml.includes('data-work-management-api-integration="absent"'),
      workMockupRegisteredDsComponents: workHtml.includes('data-design-system-work-components="registered-package-components"'),
      workMockupLocalClonesAbsent: workHtml.includes('data-product-local-work-component-clones="absent"'),
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
