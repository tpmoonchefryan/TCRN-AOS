import test from "node:test";
import assert from "node:assert/strict";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";

const shellTargets = [
  "/",
  "/cockpit",
  "/work",
  "/work/board",
  "/work/backlog",
  "/work/items/AOS-128",
  "/work/gates",
  "/work/evidence",
  "/work/codex-activity",
  "/work/views/owner-feedback",
  "/work/initiatives/work-management-mvp",
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

const forbiddenPlannedVisibleLabels = [
  "Conference",
  "Dependency",
  "Resource",
  "Docs / Search / Release Linkage",
  "Dispatch Readback",
  "Settings / Admin",
  "Module placeholders"
];

const forbiddenScaffoldVisibleLabels = [
  "AOS frontend shell",
  "Frontend shell slice",
  "Local structural slice only",
  "Dummy Cockpit",
  "structural placeholder",
  "Storybook parity proof",
  "runtime readbacks",
  "Backend readback",
  "Registered slice boundary"
];

const forbiddenAosBrandAssetMarkers = [
  "tcrn-aos-wordmark",
  "aos-favicon.png",
  "favicon.ico",
  "data-admitted-brand-asset"
];

test("local service serves the AOS shell while backend readbacks stay available", async () => {
  const service = await startAosLocalServiceProof();
  try {
    for (const target of shellTargets) {
      const response = await fetch(`${service.url}${target}`);
      const html = await response.text();
      assert.equal(response.status, 200, `${target} serves the owner-quality product shell`);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      assert.match(html, /data-aos-shell="owner-quality-product-shell"/);
      assert.match(html, /data-storybook-visual-instance="aos-owner-quality-product-shell"/);
      assert.match(html, /data-visual-instance-name="AosOwnerQualityProductShell"/);
      assert.match(html, /data-visual-instance-disposition="ds_oracle_review_required_before_owner_admission"/);
      assert.match(html, /data-visual-instance-owner-quality="product-first"/);
      assert.match(html, /data-owner-quality-product-shell-oracle="true"/);
      assert.match(html, /data-design-system-source="@tcrn\/ui-react @tcrn\/ui-tokens @tcrn\/ui-copy-state"/);
      assert.match(html, /data-storybook-visual-instance-consumed="aos-owner-quality-product-shell"/);
      assert.match(html, /data-owner-quality-first-viewport="product-led"/);
      if (target.startsWith("/work")) {
        assert.match(html, /data-work-management-mockup="storybook-ds-work-management-v1"/);
        assert.match(html, /data-work-management-static-fixture="true"/);
        assert.match(html, /data-work-management-api-integration="absent"/);
        assert.match(html, /data-work-management-live-dispatch="not-enabled"/);
        assert.match(html, /data-work-management-hierarchy="initiative-epic-story-work-item-subtask-evidence-task"/);
        assert.match(html, /data-design-system-work-components="registered-package-components"/);
        assert.match(html, /data-product-local-work-component-clones="absent"/);
      } else {
        assert.match(html, /data-owner-quality-work-queue="true"/);
        assert.match(html, /data-owner-quality-gates="true"/);
        assert.match(html, /data-owner-quality-actions="true"/);
        assert.match(html, /data-owner-quality-service-health="true"/);
        assert.match(html, /data-aos-work-module-entry="owner-quality-work-queue"/);
      }
      assert.match(html, /data-aos-registered-module-boundary="cockpit-work-only"/);
      assert.match(html, /data-ds-product-shell-boundary-consumed="ProductShell useProductShellController no-global-search"/);
      assert.match(html, /data-package-backed-product-shell-boundary="side-nav-shell-v1"/);
      assert.match(html, /data-product-shell-semantic-api="collapse-theme-locale"/);
      assert.match(html, /data-product-shell-global-search="not-rendered"/);
      assert.match(html, /data-product-shell-effect-boundary="ds-owned-tokens-motion-focus"/);
      assert.match(html, /data-local-wrapper-event-delegation="absent"/);
      assert.match(html, /data-registered-brand-lockup="@tcrn\/ui-react\/ShellBrandLockup"/);
      assert.match(html, /data-registered-product-logo="@tcrn\/ui-react\/ProductLogo"/);
      assert.match(html, /data-product-id="aos"/);
      assert.match(html, /data-product-logo-asset-id="tcrn-aos-two-line"/);
      assert.match(html, /TCRN AOS/);
      assert.match(html, /AI Operation System/);
      assert.match(html, /data-tcrn-brand-mark="registered"/);
      assert.doesNotMatch(html, /<span class="tcrn-shell-brand-lockup__caption">/);
      assert.match(html, /data-package-backed-shell-control="side-nav-collapse"/);
      assert.match(html, /data-package-backed-shell-control="locale-menu"/);
      assert.match(html, /data-package-backed-shell-control="theme-toggle"/);
      assert.doesNotMatch(html, /data-package-backed-shell-control="product-shell-search"/);
      assert.doesNotMatch(html, /data-shell-control="product-shell-search"/);
      assert.doesNotMatch(html, /Ctrl\+K|⌘K|Search operations|搜索运营/);
      assert.match(html, /data-tcrn-component-style-source="@tcrn\/ui-react"/);
      assert.match(html, /data-registered-navigation-only="true"/);
      assert.match(html, /\/assets\/aos-client\.js/);
      assert.doesNotMatch(html, /ai-consumption-contract\.json/);
      for (const marker of forbiddenAosBrandAssetMarkers) {
        assert.equal(html.includes(marker), false, `${marker} is absent from shell HTML`);
      }
      if (!target.startsWith("/work")) {
        for (const label of forbiddenPlannedVisibleLabels) {
          assert.equal(html.includes(label), false, `${label} is not rendered as visible product IA`);
        }
      }
      for (const label of forbiddenScaffoldVisibleLabels) {
        assert.equal(html.includes(label), false, `${label} is not rendered in owner-quality shell HTML`);
      }
    }

    const brandMark = await fetch(`${service.url}/assets/tcrn-brand-mark.svg`);
    assert.equal(brandMark.status, 200);
    assert.match(brandMark.headers.get("content-type") ?? "", /image\/svg\+xml/);

    for (const forbiddenAsset of [
      "/assets/tcrn-aos-wordmark-geometric-dark.png",
      "/assets/tcrn-aos-wordmark.png",
      "/assets/aos-favicon.png",
      "/assets/favicon.ico"
    ]) {
      const assetResponse = await fetch(`${service.url}${forbiddenAsset}`);
      assert.equal(assetResponse.status, 404, `${forbiddenAsset} is not served`);
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
