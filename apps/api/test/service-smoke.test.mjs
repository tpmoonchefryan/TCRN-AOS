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
  "/operations-cockpit.html"
];

/**
 * The eleven routes the sidebar points at, each asserted to serve *its own* view.
 *
 * Thirteen placeholder `.html` names stood here until TCRN-AOS-INC-021, and this
 * test is the reason they survived so long: it fetched every one of them and
 * asserted the owner-quality cockpit markers, which they all carried — because
 * every one of them fell through to the cockpit. The test was not lax. It was
 * measuring the wrong thing: shell chrome is emitted by the shell on every route,
 * so asserting shell chrome cannot tell a route that renders from one that only
 * resolves. `data-cockpit-view` is the marker that distinguishes them, and it is
 * per-view, so this table now fails if a module route starts answering with a
 * neighbour's page.
 */
const moduleTargets = [
  { route: "/my-work", view: "my-work" },
  { route: "/inbox", view: "inbox" },
  { route: "/dashboard", view: "dashboard" },
  { route: "/projects", view: "projects" },
  { route: "/work-items", view: "work-items" },
  { route: "/board", view: "board" },
  { route: "/release-trains", view: "release-trains" },
  { route: "/knowledge", view: "knowledge" },
  { route: "/deliberations", view: "deliberations" },
  { route: "/audit", view: "audit" },
  { route: "/snapshots", view: "snapshots" }
];

/**
 * Names that were routes and are not surfaces. Each 404s, and 404 is the assertion:
 * a name nobody implemented must not answer 200 with somebody else's page.
 */
const retiredPlaceholderTargets = [
  "/conference",
  "/conference.html",
  "/docs",
  "/docs-search-release-readiness.html",
  "/settings",
  "/admin-access.html",
  "/project-workspace.html",
  "/initiative-detail.html",
  "/ai-employee.html",
  "/gate-queue.html",
  "/gateway-adapter.html",
  "/dependency-console.html",
  "/resource-library.html",
  "/knowledge-modules.html",
  "/aos-wide-product-design.html",
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
      const bodyHtml = html.slice(html.indexOf("<body"));
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
      if (target.startsWith("/work")) {
        assert.match(html, /data-owner-quality-first-viewport="work-operational"/);
        assert.match(html, /data-work-management-mockup="storybook-ds-work-management-v1"/);
        assert.match(html, /data-work-management-static-fixture="true"/);
        assert.match(html, /data-work-management-api-integration="absent"/);
        assert.match(html, /data-work-management-live-dispatch="not-enabled"/);
        assert.match(html, /data-work-management-hierarchy="initiative-epic-story-work-item-subtask-evidence-task"/);
        assert.match(html, /data-ds-work-components-anchor="components\.html#work-management-components-spec"/);
        assert.match(html, /data-ds-work-patterns-anchor="patterns\.html#work-management-patterns"/);
        assert.match(html, /data-storybook-components-story-id="tcrn-design-system-components--work-management-components-spec"/);
        assert.match(html, /data-storybook-patterns-story-id="tcrn-design-system-patterns--work-management-patterns"/);
        assert.match(html, /data-ai-consumption-contract-version="ai_consumption_contract_v1"/);
        assert.match(html, /data-foundation-visual-standards-registry="foundation-visual-standards-v1"/);
        assert.match(html, /data-consumer-visual-style-contract="consumerVisualStyleContract"/);
        assert.match(html, /data-storybook-doc-shell-oracle="original-storybook-doc-shell-v1"/);
        assert.match(html, /data-work-static-authority-disposition="aos_static_work_mockup_consumes_storybook_ds_work_management_contract"/);
        assert.match(html, /data-work-route-proof-targets="\/work \/work\/board \/work\/backlog \/work\/items\/AOS-128 \/work\/views\/owner-feedback \/work\/gates \/work\/evidence \/work\/codex-activity \/work\/initiatives\/work-management-mvp"/);
        assert.match(html, /data-work-mobile-proof-targets="\/work\/backlog\?locale=zh-CN&amp;theme=dark \/work\/items\/AOS-128\?locale=zh-CN&amp;theme=dark \/work\/initiatives\/work-management-mvp\?locale=zh-CN&amp;theme=dark"/);
        assert.match(html, /data-work-clean-room-layout="tcrn-clean-room-work-layout-no-third-party-assets"/);
        assert.match(html, /data-design-system-work-components="registered-package-components"/);
        assert.match(html, /data-product-local-work-component-clones="absent"/);
        assert.match(html, new RegExp(`data-work-route-acceptance-target="${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
        assert.doesNotMatch(html, /pending Atlas refresh|等待 Atlas 刷新/);
        assert.doesNotMatch(bodyHtml, /Atlassian|Jira|Confluence|Fable5|Fable|OpenProject|Linear|Plane|Huly|Twenty/);
        assert.doesNotMatch(bodyHtml, /data-doc-shell|tcrn-doc-shell|tcrn-doc-header|tcrn-doc-sidebar|tcrn-doc-nav/);
        assert.doesNotMatch(bodyHtml, /tcrn-product-shell-search|tcrn-search-input|data-product-shell-search-results|data-search-result/);
      } else if (target === "/") {
        // The root is the cockpit landing page, and the confirmed information
        // architecture lands on My work rather than the legacy operations view.
        // The legacy view keeps its own route and its own assertions below.
        assert.match(html, /data-cockpit-view="my-work"/);
        assert.match(html, /data-partition-id="cross-project"/);
      } else {
        assert.match(html, /data-owner-quality-first-viewport="product-led"/);
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
      if (target === "/work/items/AOS-128") {
        assert.match(html, /meridian-knowledge-source/);
        assert.match(html, /d385428/);
        assert.match(html, /fce130df/);
        assert.match(html, /data-aos-knowledge-management-consumption="public-ds-exports-v1"/);
        assert.match(html, /data-ds-knowledge-components-anchor="components\.html#knowledge-management-components-spec"/);
        assert.match(html, /data-storybook-knowledge-components-story-id="tcrn-design-system-components--knowledge-management-components-spec"/);
        assert.match(html, /data-knowledge-static-authority-disposition="aos_static_knowledge_mockup_consumes_meridian_ds_knowledge_management_contract"/);
        assert.match(html, /data-knowledge-management-ds-basis="d385428"/);
        assert.match(html, /data-knowledge-management-api-integration="absent"/);
        assert.match(html, /data-knowledge-management-live-dispatch="not-enabled"/);
        assert.match(html, /data-knowledge-management-backend-persistence="absent"/);
        assert.match(html, /data-knowledge-management-global-search="not-rendered"/);
        assert.match(html, /data-product-local-knowledge-component-clones="absent"/);
        assert.match(html, /data-registered-ds-knowledge-component-name="KnowledgePageTree"/);
        assert.match(html, /data-registered-ds-knowledge-component-name="KnowledgeSearchResults"/);
        assert.doesNotMatch(html, /cae4d52/);
        assert.doesNotMatch(html, /7836dca/);
        assert.match(html, /Use Atlas\/source markers for retained preview freshness; PM freshness retry pending\./);
        assert.match(html, /PM freshness retry pending; owner and product acceptance remain unclaimed\./);
        assert.doesNotMatch(html, /Atlas refresh required after source repair/);
        assert.doesNotMatch(html, /source 修复后需要 Atlas 刷新/);
        assert.doesNotMatch(html, /Next Atlas refresh required for this source repair/);
        assert.doesNotMatch(html, /Pending AOS consumption review/);
        assert.doesNotMatch(html, /retained preview is not refreshed/);
        assert.doesNotMatch(html, /不刷新保留预览/);
        assert.doesNotMatch(html, /Refresh retry only if this copy repair changes source/);
        assert.doesNotMatch(html, /4317 retained preview remains stale until post-review refresh/);
        assert.doesNotMatch(html, /Owner handoff remains blocked until review, QA, retained refresh, and PM freshness pass\./);
        assert.doesNotMatch(html, /retained stale until review and refresh/);
        assert.doesNotMatch(html, /Owner inspection package remains blocked until PM freshness accepts the repaired retained basis\./);
        assert.doesNotMatch(html, /Owner inspection package is blocked until gates pass/);
      }
    }

    for (const { route, view } of moduleTargets) {
      const response = await fetch(`${service.url}${route}`);
      const html = await response.text();
      assert.equal(response.status, 200, `${route} is served on a direct request`);
      assert.match(html, /data-aos-shell="owner-quality-product-shell"/, `${route} renders inside the shell`);
      assert.match(
        html,
        new RegExp(`data-cockpit-view="${view}"`),
        `${route} renders its own view rather than resolving to a neighbour`
      );
    }

    for (const retired of retiredPlaceholderTargets) {
      const response = await fetch(`${service.url}${retired}`);
      assert.equal(response.status, 404, `${retired} does not answer 200 with another page's bytes`);
    }

    // The document's own name, per locale. This was a hard-coded English string in
    // `<head>` — outside the tree React renders and outside any locale scope — so
    // the browser tab and the first thing a screen reader announces stayed English
    // on all five routes while the page under them translated. `TCRN AOS` is the
    // wordmark and is Latin on purpose; only the module name translates.
    const expectedDocumentTitles = {
      "zh-CN": "TCRN AOS 运营驾驶舱",
      en: "TCRN AOS Operations Cockpit",
      ja: "TCRN AOS 運用コックピット",
      ko: "TCRN AOS 운영 콕핏",
      fr: "TCRN AOS Cockpit opérations"
    };
    for (const [locale, expectedTitle] of Object.entries(expectedDocumentTitles)) {
      const localizedHtml = await fetch(`${service.url}/cockpit?locale=${encodeURIComponent(locale)}`)
        .then((response) => response.text());
      const renderedTitle = /<title>([^<]*)<\/title>/u.exec(localizedHtml)?.[1] ?? null;
      assert.equal(renderedTitle, expectedTitle, `${locale} document title is said in the reader's language`);
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
