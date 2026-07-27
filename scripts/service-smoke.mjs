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
    // TCRN-AOS-INC-011: `/` is the cockpit landing page and lands on My work.
    // The owner-quality landing view it used to serve moved to /cockpit in
    // TCRN-AOS-STORY-001/002/005/006/007 (8e76ef5); that commit updated
    // apps/api/test/service-smoke.test.mjs and missed this second copy of the
    // same predicate, so this line kept asking / for a marker that had moved.
    // The marker is asserted below against the route that now carries it.
    && shellHtml.includes('data-cockpit-view="my-work"')
    && shellHtml.includes('data-partition-id="cross-project"')
    && shellHtml.includes('data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"')
    && shellHtml.includes('data-package-backed-product-shell-boundary="side-nav-shell-v1"')
    && shellHtml.includes('data-product-shell-semantic-api="collapse-theme-locale"')
    && shellHtml.includes('data-product-shell-global-search="not-rendered"')
    && !shellHtml.includes('data-shell-control="product-shell-search"')
    && cockpit.status === 200
    // TCRN-AOS-INC-011: this used to assert `data-product-shell-route="cockpit"`,
    // which is the DS Navigation item id — it says the sidebar offers a route
    // named cockpit, not that this response IS the cockpit. INIT-001 replaced
    // the nav with eleven module ids, so no nav item is called cockpit or work
    // any more. Translating the id would keep a predicate that never checked
    // what its name claimed, so both now assert the content the route renders.
    && cockpitHtml.includes('data-owner-quality-first-viewport="product-led"')
    && cockpitHtml.includes('data-owner-quality-primary-heading="true"')
    && cockpitHtml.includes('data-owner-quality-work-queue="true"')
    && cockpitHtml.includes('data-owner-quality-gates="true"')
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
    && workHtml.includes('data-work-clean-room-layout="tcrn-clean-room-work-layout-no-third-party-assets"')
    && workHtml.includes('data-design-system-work-components="registered-package-components"')
    && workHtml.includes('data-product-local-work-component-clones="absent"')
    && workHtml.includes('data-work-route-acceptance-target="/work"')
    // TCRN-AOS-INC-011, same substitution as the cockpit line above.
    && workHtml.includes('data-work-management-page="queue"')
    && workHtml.includes('data-owner-quality-first-viewport="work-operational"')
    && workBoard.status === 200
    && workBoardHtml.includes('data-work-management-page="board"')
    && workBoardHtml.includes('data-aos-work-module-entry="registered-ds-work-board"')
    && workDetail.status === 200
    && workDetailHtml.includes('data-work-management-page="detail"')
    && workDetailHtml.includes("meridian-knowledge-source")
    && workDetailHtml.includes("d385428")
    && workDetailHtml.includes("fce130df")
    && workDetailHtml.includes('data-aos-knowledge-management-consumption="public-ds-exports-v1"')
    && workDetailHtml.includes('data-ds-knowledge-components-anchor="components.html#knowledge-management-components-spec"')
    && workDetailHtml.includes('data-storybook-knowledge-components-story-id="tcrn-design-system-components--knowledge-management-components-spec"')
    && workDetailHtml.includes('data-knowledge-static-authority-disposition="aos_static_knowledge_mockup_consumes_meridian_ds_knowledge_management_contract"')
    && workDetailHtml.includes('data-knowledge-management-ds-basis="d385428"')
    && workDetailHtml.includes('data-knowledge-management-api-integration="absent"')
    && workDetailHtml.includes('data-knowledge-management-live-dispatch="not-enabled"')
    && workDetailHtml.includes('data-knowledge-management-backend-persistence="absent"')
    && workDetailHtml.includes('data-knowledge-management-global-search="not-rendered"')
    && workDetailHtml.includes('data-product-local-knowledge-component-clones="absent"')
    && workDetailHtml.includes('data-registered-ds-knowledge-component-name="KnowledgePageTree"')
    && workDetailHtml.includes('data-registered-ds-knowledge-component-name="KnowledgeSearchResults"')
    && workDetailHtml.includes("Use Atlas/source markers for retained preview freshness; PM freshness retry pending.")
    && workDetailHtml.includes("PM freshness retry pending; owner and product acceptance remain unclaimed.")
    && !workDetailHtml.includes("cae4d52")
    && !workDetailHtml.includes("7836dca")
    && !workDetailHtml.includes("pending Atlas refresh")
    && !workDetailHtml.includes("Atlas refresh required after source repair")
    && !workDetailHtml.includes("source 修复后需要 Atlas 刷新")
    && !workDetailHtml.includes("Next Atlas refresh required for this source repair")
    && !workDetailHtml.includes("Pending AOS consumption review")
    && !workDetailHtml.includes("retained preview is not refreshed")
    && !workDetailHtml.includes("不刷新保留预览")
    && !workDetailHtml.includes("Refresh retry only if this copy repair changes source")
    && !workDetailHtml.includes("Owner inspection package is blocked until gates pass")
    && !workDetailHtml.includes("Owner handoff remains blocked until review, QA, retained refresh, and PM freshness pass.")
    && !workDetailHtml.includes("retained stale until review and refresh")
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
        currentAosBasisVisible: workDetailHtml.includes("meridian-knowledge-source"),
        dsBasisVisible: workDetailHtml.includes("d385428"),
        workflowBasisVisible: workDetailHtml.includes("fce130df"),
        knowledgePublicExportConsumptionVisible: workDetailHtml.includes('data-aos-knowledge-management-consumption="public-ds-exports-v1"'),
        knowledgeDsBasisVisible: workDetailHtml.includes('data-knowledge-management-ds-basis="d385428"'),
        knowledgeNoBackendVisible: workDetailHtml.includes('data-knowledge-management-backend-persistence="absent"'),
        knowledgeNoGlobalSearchVisible: workDetailHtml.includes('data-knowledge-management-global-search="not-rendered"'),
        priorAosBasisVisible: workDetailHtml.includes("cae4d52"),
        staleAosBasisVisible: workDetailHtml.includes("7836dca"),
        atlasMarkerPostureVisible: workDetailHtml.includes("Use Atlas/source markers for retained preview freshness; PM freshness retry pending."),
        pmFreshnessRetryVisible: workDetailHtml.includes("PM freshness retry pending; owner and product acceptance remain unclaimed."),
        staleRetainedPostureVisible: workDetailHtml.includes("4317 retained preview remains stale until post-review refresh"),
        stalePendingRefreshVisible: workDetailHtml.includes("pending Atlas refresh"),
        staleAtlasRefreshRequiredVisible: workDetailHtml.includes("Atlas refresh required after source repair")
          || workDetailHtml.includes("source 修复后需要 Atlas 刷新")
          || workDetailHtml.includes("Next Atlas refresh required for this source repair"),
        staleAosConsumptionReviewVisible: workDetailHtml.includes("Pending AOS consumption review"),
        staleRetainedNotRefreshedVisible: workDetailHtml.includes("retained preview is not refreshed") || workDetailHtml.includes("不刷新保留预览"),
        staleConditionalRefreshCopyVisible: workDetailHtml.includes("Refresh retry only if this copy repair changes source"),
        staleOwnerInspectionGateVisible: workDetailHtml.includes("Owner inspection package is blocked until gates pass"),
        staleOwnerHandoffBlockedVisible: workDetailHtml.includes("Owner handoff remains blocked until review, QA, retained refresh, and PM freshness pass.")
      },
      workEvidenceStatus: workEvidence.status,
      workActivityStatus: workActivity.status,
      shellMarkerPresent: shellHtml.includes('data-aos-shell="owner-quality-product-shell"'),
      ownerQualityMarkerPresent: shellHtml.includes('data-owner-quality-product-shell-oracle="true"'),
      // TCRN-AOS-INC-011: the root landing view and the owner-quality view are
      // two different routes now, so the receipt names which route each posture
      // was read from. `productLedMarkerPresent` kept its key and changed its
      // subject; a reader comparing this receipt against an older one needs the
      // route in the name to see that the subject moved rather than regressed.
      rootCockpitLandingPresent: shellHtml.includes('data-cockpit-view="my-work"'),
      rootPartitionPresent: shellHtml.includes('data-partition-id="cross-project"'),
      productLedMarkerPresent: cockpitHtml.includes('data-owner-quality-first-viewport="product-led"'),
      productLedMarkerRoute: "/cockpit",
      workOperationalMarkerPresent: workHtml.includes('data-owner-quality-first-viewport="work-operational"'),
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
