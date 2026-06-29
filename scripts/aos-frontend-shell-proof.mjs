import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { findForbiddenPositiveClaimHits, tcrnLocaleMetadata } from "@tcrn/ui-copy-state";
import { frontendShellRoutes, forbiddenHumanAiTopbarMarkers } from "../dist/apps/web/src/data.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const shellPath = new URL("../apps/web/dist/index.html", import.meta.url);
assert.equal(existsSync(shellPath), true, "apps/web/dist/index.html exists after pnpm build");

const screenshotRoot = "/tmp/tcrn-aos-shell-qa";
rmSync(screenshotRoot, { recursive: true, force: true });
mkdirSync(screenshotRoot, { recursive: true });

const html = readFileSync(shellPath, "utf8");
const appSource = readFileSync(new URL("../apps/web/src/app.tsx", import.meta.url), "utf8");
const requiredMarkers = [
  'data-aos-shell="first-frontend-slice"',
  'data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"',
  'data-storybook-contract-consumed="product-shell-semantic-boundary"',
  'data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"',
  'data-package-backed-product-shell-boundary="side-nav-shell-v1"',
  'data-product-shell-semantic-api="collapse-theme-locale-search"',
  'data-product-shell-effect-boundary="ds-owned-tokens-motion-focus"',
  'data-product-shell-consumer-scope="ia-data-route-labels-content-callbacks"',
  'data-search-semantic-api="onQueryChange-onExpandedChange-onDismiss-onResultActivate"',
  'data-search-dismissal-contract="blur-outside-pointer-tab-escape"',
  'data-local-wrapper-event-delegation="absent"',
  'data-local-shell-effect-clones="removed"',
  'data-tcrn-theme="light"',
  'data-side-nav-toggle="true"',
  'data-side-nav-persisted-key="tcrn-aos-side-nav-collapsed"',
  'data-registered-navigation-only="true"',
  'data-registered-brand-lockup="@tcrn/ui-react/ShellBrandLockup"',
  'data-tcrn-brand-mark="registered"',
  'data-package-backed-brand-lockup="shell"',
  'data-package-backed-shell-control="locale-menu"',
  'data-package-backed-shell-control="theme-toggle"',
  'data-package-backed-shell-control="side-nav-collapse"',
  'data-package-backed-shell-control="product-shell-search"',
  'data-tcrn-component-style-source="@tcrn/ui-react"',
  'data-product-document-baseline="tcrn-token-inheritance"',
  'data-product-shell-client="ds-product-shell-semantic-boundary"',
  '/assets/aos-client.js',
  'data-aos-dummy-cockpit="true"',
  'data-aos-work-module-entry="jira-like"',
  'data-aos-registered-module-boundary="cockpit-work-only"',
  'data-raw-json-disclosure="secondary"',
  'data-cockpit-aggregation="deferred"',
  'data-product-acceptance="not-claimed"',
  'data-release-readiness="not-claimed"',
  'data-live-dispatch="not-enabled"',
  "useProductShellController",
  "ProductShell"
];

const forbiddenPlannedPrimaryLabels = [
  "Conference",
  "Dependency",
  "Resource",
  "Docs / Search / Release Linkage",
  "Dispatch Readback",
  "Settings / Admin",
  "Module placeholders"
];

const forbiddenAosBrandAssetMarkers = [
  "tcrn-aos-wordmark",
  "aos-favicon.png",
  "favicon.ico",
  "data-admitted-brand-asset"
];

const missingMarkers = requiredMarkers.filter((marker) => !html.includes(marker));
const missingLocales = tcrnLocaleMetadata.map((entry) => entry.nativeName).filter((name) => !html.includes(name));
const forbiddenAiMarkers = forbiddenHumanAiTopbarMarkers.filter((marker) => html.includes(marker));
const forbiddenPositiveClaimHits = findForbiddenPositiveClaimHits(html);
const forbiddenPlannedStaticHits = forbiddenPlannedPrimaryLabels.filter((label) => html.includes(label));
const forbiddenAosBrandHtmlHits = forbiddenAosBrandAssetMarkers.filter((marker) => html.includes(marker));
const concatenatedBannerStaticHits = ["sliceLocal", "onlyLocal", "onlyLocal fixture"].filter((marker) => html.includes(marker));
const forbiddenAosBrandDistHits = listRelativeFiles(new URL("../apps/web/dist", import.meta.url))
  .filter((file) => forbiddenAosBrandAssetMarkers.some((marker) => file.includes(marker.replace(/^\//, ""))));
const forbiddenAosBrandDocHits = [
  "../README.md",
  "../docs/architecture.md",
  "../docs/story-coverage.md",
  "../evidence/aos-frontend-shell-proof.md"
].flatMap((relativePath) => {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return forbiddenAosBrandAssetMarkers
    .filter((marker) => source.includes(marker))
    .map((marker) => ({ file: relativePath.replace(/^\.\.\//, ""), marker }));
});
const forbiddenLocalShellEffectPatterns = [
  "createClientScript",
  "createShellCss",
  "MetricCard",
  "data-aos-shell-style",
  'className="aos-',
  "className='aos-",
  ".aos-",
  "style={{",
  "document.querySelector",
  "document.querySelector(\"[data-theme-toggle]\")?.addEventListener",
  "document.querySelector(\"[data-side-nav-toggle]\")?.addEventListener",
  "document.addEventListener(\"pointerdown\"",
  "data-aos-shell-search",
  ".aos-search-wrap",
  ".aos-sidebar",
  "aos-theme-wash",
  "transitionTheme("
].filter((marker) => appSource.includes(marker));

const clientBundlePath = new URL("../apps/web/dist/assets/aos-client.js", import.meta.url);
const clientBundle = existsSync(clientBundlePath) ? readFileSync(clientBundlePath, "utf8") : "";
const strictRegisteredSurfaceSourceHits = [
  { label: "MetricCard function", regex: /\b(function|const)\s+MetricCard\b/ },
  { label: "createShellCss helper", regex: /\bcreateShellCss\b/ },
  { label: "AOS visible className", regex: /className\s*=\s*(?:"|'|{\s*(?:"|'|`))[^"'`]*aos-/ },
  { label: "AOS visible CSS selector", regex: /\.(?:aos-[A-Za-z0-9_-]+)/ },
  { label: "AOS shell style tag", regex: /data-aos-shell-style/ },
  { label: "inline primary layout style", regex: /style=\{\{/ },
  { label: "wrapper DOM delegation", regex: /document\.querySelector|document\.addEventListener\("pointerdown"/ },
  { label: "Storybook shell demo class", regex: /tcrn-(?:shell-demo|compact-shell|knowledge-shell)/ },
  { label: "Storybook-only shell demo import", regex: /TmsDenseShellDemo|KnowledgeBaseShellDemo|CompactToolShellDemo/ }
].filter((entry) => entry.regex.test(appSource)).map((entry) => entry.label);
const strictRegisteredSurfaceBuiltHits = [
  { label: "AOS class in built HTML", value: html, regex: /class="[^"]*\baos-/ },
  { label: "AOS CSS selector in built HTML", value: html, regex: /\.(?:aos-[A-Za-z0-9_-]+)/ },
  { label: "AOS shell style in built HTML", value: html, regex: /data-aos-shell-style/ },
  { label: "MetricCard in built HTML/client", value: `${html}\n${clientBundle}`, regex: /MetricCard|tcrn-compact-shell__metric/ },
  { label: "Storybook shell demo in built HTML/client", value: `${html}\n${clientBundle}`, regex: /tcrn-(?:shell-demo|compact-shell|knowledge-shell)/ },
  { label: "AOS class in client bundle", value: clientBundle, regex: /className[=:][^,\n}]*aos-|class="[^"]*\baos-/ },
  { label: "AOS CSS selector in client bundle", value: clientBundle, regex: /\.(?:aos-[A-Za-z0-9_-]+)/ }
].filter((entry) => entry.regex.test(entry.value)).map((entry) => entry.label);

assert.deepEqual(missingMarkers, [], "required shell and DS-consumption markers are present");
assert.deepEqual(missingLocales, [], "locale menu uses native locale names");
assert.deepEqual(forbiddenAiMarkers, [], "AI consumption contract is not exposed as a human top-bar control");
assert.deepEqual(forbiddenPositiveClaimHits, [], "shell HTML has no forbidden positive-claim phrases");
assert.deepEqual(forbiddenPlannedStaticHits, [], "planned/unregistered modules are not visible as primary navigation or module cards");
assert.deepEqual(forbiddenAosBrandHtmlHits, [], "forbidden AOS wordmark/favicon markers are absent from shell HTML");
assert.deepEqual(concatenatedBannerStaticHits, [], "banner and alert text are not statically concatenated");
assert.deepEqual(forbiddenAosBrandDistHits, [], "forbidden AOS wordmark/favicon files are absent from built dist assets");
assert.deepEqual(forbiddenAosBrandDocHits, [], "current docs/evidence do not reference forbidden AOS wordmark/favicon assets");
assert.deepEqual(forbiddenLocalShellEffectPatterns, [], "AOS source does not own DS shell/search/locale/theme event delegation or local shell effects");
assert.deepEqual(strictRegisteredSurfaceSourceHits, [], "AOS source has no unregistered local visible UI components/classes/selectors/effects");
assert.deepEqual(strictRegisteredSurfaceBuiltHits, [], "built shell has no unregistered AOS local visible classes/CSS/demo surfaces");

const service = await startAosLocalServiceProof();
let closed = false;
const routeReadbacks = [];

try {
  for (const route of ["/", "/cockpit", "/work", "/conference", "/docs", "/settings"]) {
    const response = await fetch(`${service.url}${route}`);
    const body = await response.text();
    routeReadbacks.push({
      route,
      status: response.status,
      html: response.headers.get("content-type")?.includes("text/html") ?? false,
      shellMarker: body.includes('data-aos-shell="first-frontend-slice"'),
      dummyCockpitMarker: body.includes('data-aos-dummy-cockpit="true"'),
      workMarker: body.includes('data-aos-work-module-entry="jira-like"'),
      registeredNavigationOnly: body.includes('data-registered-navigation-only="true"'),
      registeredBrandLockup: body.includes('data-registered-brand-lockup="@tcrn/ui-react/ShellBrandLockup"'),
      productShellBoundary: body.includes('data-ds-product-shell-boundary-consumed="ProductShell useProductShellController ProductShellSearch"')
        && body.includes('data-package-backed-product-shell-boundary="side-nav-shell-v1"')
        && body.includes('data-product-shell-semantic-api="collapse-theme-locale-search"')
        && body.includes('data-local-wrapper-event-delegation="absent"')
        && body.includes('data-local-shell-effect-clones="removed"'),
      packageBackedShellControls: [
        'data-package-backed-shell-control="locale-menu"',
        'data-package-backed-shell-control="theme-toggle"',
        'data-package-backed-shell-control="side-nav-collapse"',
        'data-package-backed-shell-control="product-shell-search"'
      ].every((marker) => body.includes(marker)),
      strictRegisteredSurface: !/class="[^"]*\baos-/.test(body)
        && !/\.(?:aos-[A-Za-z0-9_-]+)/.test(body)
        && !body.includes("MetricCard")
        && !body.includes("data-aos-shell-style")
        && body.includes('data-product-document-baseline="tcrn-token-inheritance"'),
      plannedPrimaryHits: forbiddenPlannedPrimaryLabels.filter((label) => body.includes(label)),
      forbiddenBrandHits: forbiddenAosBrandAssetMarkers.filter((marker) => body.includes(marker))
    });
  }

  const asset = await fetch(`${service.url}/assets/tcrn-brand-mark.svg`);
  const forbiddenAssetReadbacks = [];
  for (const forbiddenAsset of [
    "/assets/tcrn-aos-wordmark-geometric-dark.png",
    "/assets/tcrn-aos-wordmark.png",
    "/assets/aos-favicon.png",
    "/assets/favicon.ico"
  ]) {
    const assetResponse = await fetch(`${service.url}${forbiddenAsset}`);
    forbiddenAssetReadbacks.push({ asset: forbiddenAsset, status: assetResponse.status });
  }
  const health = await fetch(`${service.url}/api/health`).then((response) => response.json());
  const readback = await fetch(`${service.url}/api/readback`).then((response) => response.json());
  const policy = await fetch(`${service.url}/api/policy`).then((response) => response.json());
  const cockpitApi = await fetch(`${service.url}/api/cockpit`);
  const cockpitApiPayload = await cockpitApi.json();
  const browserProof = await runBrowserProof(service.url);

  const stopped = await service.close();
  closed = stopped.stopped && stopped.runtimeReset;

  const ok = routeReadbacks.every((entry) => entry.status === 200 && entry.html && entry.shellMarker && entry.dummyCockpitMarker && entry.workMarker && entry.registeredNavigationOnly && entry.registeredBrandLockup && entry.productShellBoundary && entry.packageBackedShellControls && entry.strictRegisteredSurface && entry.plannedPrimaryHits.length === 0 && entry.forbiddenBrandHits.length === 0)
    && asset.status === 200
    && (asset.headers.get("content-type") ?? "").includes("image/svg+xml")
    && forbiddenAssetReadbacks.every((entry) => entry.status === 404)
    && health.ok === true
    && health.externalQueue === "none"
    && health.liveCodexDispatchAuthorized === false
    && readback.ok === true
    && readback.runtimeDataCommitted === false
    && readback.operationalRecordCounts.stories === 2
    && policy.ok === true
    && policy.serviceProofOnly === true
    && cockpitApi.status === 410
    && cockpitApiPayload.error === "aos_cockpit_api_deferred"
    && cockpitApiPayload.dummyCockpitOnly === true
    && cockpitApiPayload.finalCockpitAggregationAvailable === false
    && cockpitApiPayload.liveDispatch === false
    && browserProof.ok === true
    && closed;

  const result = {
    ok,
    proof: "aos_frontend_shell_ds_contract_reconciliation",
    builtShell: "apps/web/dist/index.html",
    frontendShellRouteCount: frontendShellRoutes.length,
    visibleRegisteredNavigation: ["Cockpit", "Work"],
    routeReadbacks,
    assetReadback: {
      status: asset.status,
      contentType: asset.headers.get("content-type")
    },
    forbiddenAssetReadbacks,
    dsContractConsumption: {
      packages: ["@tcrn/ui-react", "@tcrn/ui-tokens", "@tcrn/ui-copy-state"],
      componentStylesheet: "tcrnComponentCss",
      productShellBoundary: "ProductShell/useProductShellController/ProductShellSearch",
      localWrapperEventDelegation: false,
      localShellEffectClones: false,
      visibleClassNamespace: "DS-owned tcrn-* only under product shell content",
      storybookComparator: "components.html#navigation-shell-spec package-backed ProductShell comparator",
      themeControl: "compact_icon_only_explicit_toggle",
      themeTransition: "ds_product_shell_controller",
      localeSelector: "globe_trigger_native_names_with_escape_outside_selection_close",
      sideNavigation: "ProductShell package boundary with persisted collapse callback",
      search: "ProductShellSearch controlled by useProductShellController with dismissal/result callbacks",
      readbackUx: "readback_panel_key_value_evidence_primary_raw_json_secondary_disclosure",
      brandAsset: "/assets/tcrn-brand-mark.svg",
      brandLockup: "@tcrn/ui-react/ShellBrandLockup",
      aiContractHumanTopbarLink: false
    },
    browserProof,
    screenshotReadback: browserProof.screenshots,
    apiReadbacks: {
      health: {
        ok: health.ok,
        runtimeDatabase: health.runtimeDatabase,
        externalQueue: health.externalQueue,
        liveCodexDispatchAuthorized: health.liveCodexDispatchAuthorized
      },
      readbackCounts: readback.operationalRecordCounts,
      policy: {
        allowedRuntimeMutation: policy.allowedRuntimeMutation,
        serviceProofOnly: policy.serviceProofOnly
      },
      cockpitApi: {
        status: cockpitApi.status,
        error: cockpitApiPayload.error,
        dummyCockpitOnly: cockpitApiPayload.dummyCockpitOnly,
        finalCockpitAggregationAvailable: cockpitApiPayload.finalCockpitAggregationAvailable
      }
    },
    noOverclaim: {
      productAcceptance: false,
      releaseReadiness: false,
      liveDispatch: false,
      externalQueue: "none",
      finalCockpitAggregation: false,
      forbiddenPositiveClaimHits,
      forbiddenAiMarkers,
      forbiddenPlannedStaticHits,
      forbiddenAosBrandHtmlHits,
      concatenatedBannerStaticHits,
      forbiddenAosBrandDistHits,
      forbiddenAosBrandDocHits
    },
    serviceLifecycle: {
      loopbackOnly: true,
      ephemeralPort: true,
      stopped: closed
    }
  };

  console.log(JSON.stringify(result, null, 2));
  if (!ok) {
    process.exit(1);
  }
} finally {
  if (!closed) {
    await service.close().catch(() => undefined);
  }
}

async function runBrowserProof(baseUrl) {
  const { chromium, source } = loadPlaywrightChromium();
  const executablePath = findLocalChromeExecutable();
  const dsComparatorServer = await startDesignSystemComparatorServer();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  });
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];

  try {
    const visualComparatorProof = await runVisualComparatorProof(browser, baseUrl, dsComparatorServer.url);

    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      timezoneId: "UTC",
      reducedMotion: "no-preference",
      deviceScaleFactor: 1
    });
    const desktopPage = await desktopContext.newPage();
    capturePageHealth(desktopPage, consoleMessages, pageErrors, requestFailures);
    await desktopPage.goto(`${baseUrl}/cockpit`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-shell="first-frontend-slice"]');
    await desktopPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));

    assert.equal(await desktopPage.title(), "TCRN AOS Rebuild Workspace", "desktop page identity is correct");
    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "light", "default theme is light");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "en", "default locale is en");

    const desktopContentReadback = await inspectContentRegion(desktopPage);
    assert.deepEqual(desktopContentReadback.aosClassHits, [], "desktop content region has no AOS-local visible class namespace");
    assert.deepEqual(desktopContentReadback.storybookDemoClassHits, [], "desktop content region has no Storybook-only shell demo classes");
    assert.equal(desktopContentReadback.environmentBannerVisible, true, "environment banner is rendered by DS");
    assert.equal(desktopContentReadback.inlineAlertVisible, true, "no-overclaim alert is rendered by DS");
    assert.equal(desktopContentReadback.text.includes("sliceLocal"), false, "environment banner text is not concatenated");
    assert.equal(desktopContentReadback.text.includes("onlyLocal"), false, "alert text is not concatenated");
    assert.equal(desktopContentReadback.bannerOverlap, false, "environment banner and alert do not overlap");
    assert.equal(desktopContentReadback.dsOwnedClassCount > 0, true, "primary UX uses DS-owned tcrn-* classes");

    await desktopPage.screenshot({ path: `${screenshotRoot}/01-desktop-cockpit-default.png`, fullPage: false });

    const brandReadback = await desktopPage.locator('[data-tcrn-brand-mark="registered"]').evaluate((img) => {
      const image = img;
      const rect = image.getBoundingClientRect();
      return {
        src: image.getAttribute("src"),
        alt: image.getAttribute("alt"),
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        width: rect.width,
        height: rect.height
      };
    });
    assert.equal(brandReadback.src, "/assets/tcrn-brand-mark.svg");
    assert.equal(brandReadback.alt, "TCRN registered brand mark");
    assert.equal(brandReadback.naturalWidth > 0, true, "brand asset loads");
    assert.equal(brandReadback.width >= 34, true, "registered brand mark is visibly sized");
    assert.equal(brandReadback.height >= 30, true, "expanded brand has visible height");
    assert.equal(await desktopPage.locator('[data-package-backed-brand-lockup="shell"]').isVisible(), true, "package-backed shell brand lockup is visible");

    const localeTrigger = desktopPage.locator("[data-locale-menu-toggle]");
    const localeMenu = desktopPage.locator("[data-locale-menu]");
    await localeTrigger.click();
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "true", "locale opens with aria-expanded true");
    assert.equal(await localeMenu.isVisible(), true, "locale menu visible after click");
    await clickStableContentPoint(desktopPage);
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "outside click closes locale menu");
    assert.equal(await localeMenu.isVisible(), false, "locale menu hidden after outside click");

    await localeTrigger.click();
    await desktopPage.keyboard.press("Escape");
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "Escape closes locale menu");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches("[data-locale-menu-toggle]")), true, "Escape returns focus to locale trigger");

    await localeTrigger.click();
    await desktopPage.locator('[data-locale-option="zh-CN"]').click();
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "selection closes locale menu");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "zh-CN", "selection updates locale");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches("[data-locale-menu-toggle]")), true, "selection returns focus to locale trigger");

    const sideNavToggle = desktopPage.locator("[data-side-nav-toggle]");
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "true", "side nav starts expanded");
    assert.equal(await desktopPage.locator('[data-product-shell-route="cockpit"]').getAttribute("aria-current"), "page", "active cockpit route is marked");
    const expandedSideNavWidth = await desktopPage.locator(".tcrn-product-shell__sidebar").evaluate((node) => node.getBoundingClientRect().width);
    await sideNavToggle.click();
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "false", "collapse sets aria-expanded false");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "shell records collapsed side nav");
    assert.equal(await desktopPage.evaluate(() => localStorage.getItem("tcrn-aos-side-nav-collapsed")), "true", "side nav collapse persists in route-owned local storage");
    assert.equal(await desktopPage.locator('[data-product-shell-route="cockpit"]').getAttribute("aria-current"), "page", "active cockpit route preserved while collapsed");
    await desktopPage.waitForFunction((expandedWidth) => {
      const width = document.querySelector(".tcrn-product-shell__sidebar")?.getBoundingClientRect().width ?? expandedWidth;
      return width < expandedWidth - 90;
    }, expandedSideNavWidth);
    const collapsedSideNavWidth = await desktopPage.locator(".tcrn-product-shell__sidebar").evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(collapsedSideNavWidth < expandedSideNavWidth - 90, true, "collapsed side nav has a deliberate narrower visual state");
    await desktopPage.screenshot({ path: `${screenshotRoot}/02-desktop-cockpit-collapsed.png`, fullPage: false });
    await desktopPage.reload({ waitUntil: "networkidle" });
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "side nav collapse survives reload");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("aria-expanded"), "false", "side nav toggle reflects persisted collapse");
    await desktopPage.locator("[data-side-nav-toggle]").click();
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "side nav expands");

    const searchWrap = desktopPage.locator('[data-shell-control="product-shell-search"]');
    const searchInput = desktopPage.locator('.tcrn-product-shell-search input[aria-label="Search AOS shell"]');
    const searchWidthAtRest = await searchWrap.evaluate((node) => node.getBoundingClientRect().width);
    await searchInput.focus();
    await desktopPage.waitForFunction(() => document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "true");
    const searchWidthFocused = await searchWrap.evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(searchWidthFocused >= searchWidthAtRest, true, "search expands or preserves full width on focus");
    await searchInput.fill("shell");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-product-shell-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    assert.equal(await desktopPage.locator("[data-search-result]").count() > 0, true, "search shows local results while focused");
    await clickStableContentPoint(desktopPage);
    await desktopPage.waitForFunction(() => document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false");
    assert.equal(await desktopPage.locator("[data-product-shell-search-results]").isVisible(), false, "search collapses and hides results on blur");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches('.tcrn-product-shell-search input[aria-label="Search AOS shell"]')), false, "real outside click moves focus away from shell search");

    await searchInput.focus();
    await searchInput.fill("shell");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-product-shell-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    await clickStableContentPoint(desktopPage);
    await desktopPage.waitForFunction(() => {
      const input = document.querySelector('.tcrn-product-shell-search input[aria-label="Search AOS shell"]');
      const layer = document.querySelector("[data-product-shell-search-results]");
      return document.activeElement !== input
        && document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false"
        && layer?.hasAttribute("hidden") === true;
    });
    const outsidePointerSearchReadback = await desktopPage.evaluate(() => ({
      searchExpanded: document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "true",
      resultsHidden: document.querySelector("[data-product-shell-search-results]")?.hasAttribute("hidden") ?? false
    }));
    assert.equal(outsidePointerSearchReadback.searchExpanded, false, "outside pointer dismissal returns search to compact rest state");
    assert.equal(outsidePointerSearchReadback.resultsHidden, true, "outside pointer dismissal hides search results");

    await searchInput.focus();
    await searchInput.fill("shell");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-product-shell-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    await desktopPage.keyboard.press("Tab");
    await desktopPage.waitForFunction(() => {
      const input = document.querySelector('.tcrn-product-shell-search input[aria-label="Search AOS shell"]');
      const layer = document.querySelector("[data-product-shell-search-results]");
      return document.activeElement !== input
        && document.querySelector('[data-shell-control="product-shell-search"]')?.getAttribute("data-search-expanded") === "false"
        && layer?.hasAttribute("hidden") === true;
    });
    await searchInput.focus();
    await searchInput.fill("Cockpit");
    await desktopPage.waitForSelector("[data-search-result]");
    await desktopPage.locator("[data-search-result]").first().click();
    assert.equal(await desktopPage.evaluate(() => sessionStorage.getItem("tcrn-aos-last-search-result") ?? localStorage.getItem("tcrn-aos-last-search-result")), "route-cockpit", "search result activation flows through DS semantic callback");

    const visibleText = await desktopPage.locator("body").innerText();
    for (const label of forbiddenPlannedPrimaryLabels) {
      assert.equal(visibleText.includes(label), false, `${label} is not visible in product IA`);
    }
    assert.equal(visibleText.includes("ai-consumption-contract.json"), false, "AI contract JSON is not a human top-bar link");
    for (const marker of forbiddenAosBrandAssetMarkers) {
      assert.equal(await desktopPage.locator("body").evaluate((body, value) => body.innerHTML.includes(value), marker), false, `${marker} is not present in rendered browser DOM`);
    }
    assert.equal(await desktopPage.locator("[data-api-summary]").isVisible(), false, "raw JSON is not primary visible Cockpit UX");
    assert.equal(await desktopPage.locator('[data-raw-json-disclosure="secondary"]').isVisible(), true, "raw payload is available only through secondary disclosure");

    const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.equal(desktopOverflow, true, "desktop shell has no horizontal overflow");

    await desktopPage.goto(`${baseUrl}/work?locale=zh-CN&theme=dark`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-work-module-entry="jira-like"]');
    await desktopPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));
    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "dark", "dark theme query applies");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "zh-CN", "zh-CN locale query applies");
    assert.equal(await desktopPage.locator('[data-product-shell-route="work"]').getAttribute("aria-current"), "page", "active work route is marked in dark proof");
    const darkContentReadback = await inspectContentRegion(desktopPage);
    assert.deepEqual(darkContentReadback.aosClassHits, [], "dark work content region has no AOS-local visible classes");
    const warningContrast = await desktopPage.locator(".tcrn-inline-alert--warning").evaluate((node) => {
      function parseRgb(value) {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return [0, 0, 0];
        return match[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part.trim()));
      }
      function channel(value) {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }
      function luminance(rgb) {
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
      }
      const style = getComputedStyle(node);
      const fg = luminance(parseRgb(style.color));
      const bg = luminance(parseRgb(style.backgroundColor));
      const lighter = Math.max(fg, bg);
      const darker = Math.min(fg, bg);
      return (lighter + 0.05) / (darker + 0.05);
    });
    assert.equal(warningContrast >= 4.5, true, "dark warning/no-overclaim banner keeps readable contrast");
    await desktopPage.screenshot({ path: `${screenshotRoot}/03-desktop-work-dark.png`, fullPage: false });

    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      locale: "zh-CN",
      timezoneId: "UTC",
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();
    capturePageHealth(mobilePage, consoleMessages, pageErrors, requestFailures);
    await mobilePage.goto(`${baseUrl}/work?locale=zh-CN&theme=dark`, { waitUntil: "networkidle" });
    await mobilePage.waitForSelector('[data-aos-work-module-entry="jira-like"]');
    assert.equal(await mobilePage.locator("html").getAttribute("data-tcrn-theme"), "dark", "mobile dark theme query applies");
    assert.equal(await mobilePage.locator("html").getAttribute("lang"), "zh-CN", "mobile zh-CN locale query applies");
    assert.equal(await mobilePage.locator('[data-product-shell-route="work"]').getAttribute("aria-current"), "page", "mobile active work route is preserved");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "mobile first viewport starts with navigation collapsed");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-product-shell-responsive"), "desktop-attached-mobile-stacked", "mobile uses DS product shell responsive posture");
    const mobileContentReadback = await inspectContentRegion(mobilePage);
    assert.deepEqual(mobileContentReadback.aosClassHits, [], "mobile content region has no AOS-local visible classes");
    assert.deepEqual(mobileContentReadback.storybookDemoClassHits, [], "mobile content region has no Storybook-only shell demo classes");
    const mobileHeadingTop = await mobilePage.locator("#shell-overview-heading").evaluate((node) => node.getBoundingClientRect().top);
    const mobileEnvironmentTop = await mobilePage.locator(".tcrn-environment-banner").evaluate((node) => node.getBoundingClientRect().top);
    assert.equal(mobileEnvironmentTop < 560, true, "mobile first viewport reaches proof/readback content after the DS shell controls");
    assert.equal(mobileHeadingTop < 760, true, "mobile first viewport reaches the main shell heading within the DS stacked shell posture");
    await mobilePage.screenshot({ path: `${screenshotRoot}/04-mobile-work-dark.png`, fullPage: false });
    await mobilePage.locator("[data-side-nav-toggle]").click();
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "mobile side nav expands from compact first viewport");
    assert.equal(await mobilePage.locator(".tcrn-product-shell__nav").isVisible(), true, "mobile expanded navigation is visible on demand");
    const mobileNoOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.equal(mobileNoOverflow, true, "mobile shell has no horizontal page overflow");
    assert.equal(await mobilePage.locator('[data-tcrn-brand-mark="registered"]').isVisible(), true, "mobile registered brand mark remains visible");
    await mobileContext.close();

    const relevantConsoleMessages = consoleMessages.filter((message) => !/favicon|DevTools/.test(message.text));
    assert.deepEqual(pageErrors, [], "browser page errors are absent");
    assert.deepEqual(requestFailures, [], "browser request failures are absent");
    assert.deepEqual(relevantConsoleMessages, [], "browser console warnings/errors are absent");

    return {
      ok: true,
      runner: source,
      browserExecutable: executablePath ? "local_chrome" : "playwright_default",
      dsStorybookComparatorProof: visualComparatorProof,
      viewports: ["desktop-1440x900", "mobile-390x844"],
      checks: {
        renderedMetricParityAgainstDsStorybook: visualComparatorProof.ok,
        motionParityAgainstDsStorybook: visualComparatorProof.motionParityOk,
        bannerSpacingNoConcatenation: true,
        localeOutsideDismissal: true,
        localeEscapeDismissalFocusReturn: true,
        localeSelectionFocusReturn: true,
        searchFocusExpansionBlurCollapse: true,
        searchOutsidePointerCollapse: true,
        searchTabCollapse: true,
        sideNavCollapseExpandAriaPersistence: true,
        brandAssetVisible: true,
        plannedModuleNavigationAbsent: true,
        rawJsonNotPrimary: true,
        strictRegisteredSurfaceContentClasses: true,
        lightDarkThemeReadabilityChecked: true,
        mobileNavigationCompactFirstViewport: true,
        desktopMobileOverflowChecked: true
      },
      screenshots: [
        `${screenshotRoot}/01-desktop-cockpit-default.png`,
        `${screenshotRoot}/02-desktop-cockpit-collapsed.png`,
        `${screenshotRoot}/03-desktop-work-dark.png`,
        `${screenshotRoot}/04-mobile-work-dark.png`
      ]
    };
  } finally {
    await browser.close();
    await dsComparatorServer.close();
  }
}

async function runVisualComparatorProof(browser, aosBaseUrl, dsBaseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en",
    timezoneId: "UTC",
    reducedMotion: "no-preference",
    deviceScaleFactor: 1
  });
  const reducedMotionContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    deviceScaleFactor: 1
  });

  try {
    const dsPage = await context.newPage();
    const aosPage = await context.newPage();
    await dsPage.goto(`${dsBaseUrl}/components.html#navigation-shell-spec`, { waitUntil: "networkidle" });
    await aosPage.goto(`${aosBaseUrl}/cockpit?locale=en&theme=light`, { waitUntil: "networkidle" });
    await dsPage.waitForSelector(".tcrn-product-shell-contract-proof .tcrn-product-shell");
    await aosPage.waitForSelector('[data-aos-shell="first-frontend-slice"]');
    const dsMetrics = await collectProductShellComparatorMetrics(dsPage, ".tcrn-product-shell-contract-proof .tcrn-product-shell");
    const aosMetrics = await collectProductShellComparatorMetrics(aosPage, '[data-aos-shell="first-frontend-slice"]');

    const reducedDsPage = await reducedMotionContext.newPage();
    const reducedAosPage = await reducedMotionContext.newPage();
    await reducedDsPage.goto(`${dsBaseUrl}/components.html#navigation-shell-spec`, { waitUntil: "networkidle" });
    await reducedAosPage.goto(`${aosBaseUrl}/cockpit?locale=en&theme=light`, { waitUntil: "networkidle" });
    await reducedDsPage.waitForSelector(".tcrn-product-shell-contract-proof .tcrn-product-shell");
    await reducedAosPage.waitForSelector('[data-aos-shell="first-frontend-slice"]');
    const reducedDsMetrics = await collectProductShellComparatorMetrics(reducedDsPage, ".tcrn-product-shell-contract-proof .tcrn-product-shell");
    const reducedAosMetrics = await collectProductShellComparatorMetrics(reducedAosPage, '[data-aos-shell="first-frontend-slice"]');

    const parity = compareProductShellMetrics(dsMetrics, aosMetrics);
    const reducedParity = compareReducedMotionMetrics(reducedDsMetrics, reducedAosMetrics);
    assert.deepEqual(parity.failures, [], "AOS rendered ProductShell controls match the DS Storybook package-backed comparator");
    assert.deepEqual(reducedParity.failures, [], "AOS reduced-motion ProductShell behavior matches the DS Storybook package-backed comparator");
    return {
      ok: true,
      comparator: "DS Storybook components.html#navigation-shell-spec",
      comparatorStyleSource: "@tcrn/ui-react/tcrnComponentCss",
      aosRoute: "/cockpit?locale=en&theme=light",
      dsMetrics,
      aosMetrics,
      parityChecks: parity.checks,
      parityFailures: parity.failures,
      reducedMotionChecks: reducedParity.checks,
      reducedMotionFailures: reducedParity.failures,
      motionParityOk: true
    };
  } finally {
    await context.close();
    await reducedMotionContext.close();
  }
}

async function collectProductShellComparatorMetrics(page, rootSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return { missing: true, selector };
    const readMetric = (name, childSelector) => {
      const element = root.querySelector(childSelector);
      if (!element) return { missing: true, selector: childSelector };
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        name,
        selector: childSelector,
        width: Number(rect.width.toFixed(3)),
        height: Number(rect.height.toFixed(3)),
        display: style.display,
        position: style.position,
        gridTemplateColumns: style.gridTemplateColumns,
        gap: style.gap,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        borderRadius: style.borderRadius,
        borderStyle: style.borderStyle,
        borderWidth: style.borderWidth,
        backgroundColor: style.backgroundColor,
        color: style.color,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        animationName: style.animationName
      };
    };
    const shellStyle = getComputedStyle(root);
    const shellAfterStyle = getComputedStyle(root, "::after");
    return {
      missing: false,
      selector,
      sourceMarkers: {
        packageBoundary: root.getAttribute("data-package-backed-product-shell-boundary"),
        effectBoundary: root.getAttribute("data-product-shell-effect-boundary"),
        semanticApi: root.getAttribute("data-product-shell-semantic-api"),
        responsive: root.getAttribute("data-product-shell-responsive")
      },
      shell: {
        width: Number(root.getBoundingClientRect().width.toFixed(3)),
        height: Number(root.getBoundingClientRect().height.toFixed(3)),
        gridTemplateColumns: shellStyle.gridTemplateColumns,
        transitionProperty: shellStyle.transitionProperty,
        transitionDuration: shellStyle.transitionDuration,
        backgroundColor: shellStyle.backgroundColor,
        color: shellStyle.color,
        themeWashAnimationName: shellAfterStyle.animationName,
        themeWashAnimationDuration: shellAfterStyle.animationDuration
      },
      measured: {
        themeToggle: readMetric("themeToggle", ".tcrn-shell-theme-toggle"),
        localeTrigger: readMetric("localeTrigger", ".tcrn-shell-locale-menu__trigger"),
        sideNavToggle: readMetric("sideNavToggle", ".tcrn-shell-side-nav-toggle"),
        searchWrapper: readMetric("searchWrapper", ".tcrn-product-shell-search"),
        searchInput: readMetric("searchInput", ".tcrn-search-input"),
        topBar: readMetric("topBar", ".tcrn-top-bar"),
        selectedNavItem: readMetric("selectedNavItem", ".tcrn-nav-item[data-selected=\"true\"]")
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      }
    };
  }, rootSelector);
}

function compareProductShellMetrics(dsMetrics, aosMetrics) {
  const failures = [];
  const checks = [];
  const add = (name, passed, readback) => {
    checks.push({ name, passed, ...readback });
    if (!passed) failures.push({ name, ...readback });
  };
  add("shell-present", dsMetrics.missing === false && aosMetrics.missing === false, { dsMissing: dsMetrics.missing, aosMissing: aosMetrics.missing });
  for (const key of ["packageBoundary", "effectBoundary", "semanticApi", "responsive"]) {
    add(`source-marker-${key}`, dsMetrics.sourceMarkers?.[key] === aosMetrics.sourceMarkers?.[key], {
      ds: dsMetrics.sourceMarkers?.[key],
      aos: aosMetrics.sourceMarkers?.[key]
    });
  }
  for (const control of ["themeToggle", "sideNavToggle"]) {
    compareNumber(add, `${control}.width`, dsMetrics.measured[control].width, aosMetrics.measured[control].width, 0.5);
    compareNumber(add, `${control}.height`, dsMetrics.measured[control].height, aosMetrics.measured[control].height, 0.5);
    compareString(add, `${control}.borderRadius`, dsMetrics.measured[control].borderRadius, aosMetrics.measured[control].borderRadius);
    compareString(add, `${control}.display`, dsMetrics.measured[control].display, aosMetrics.measured[control].display);
  }
  compareNumber(add, "localeTrigger.height", dsMetrics.measured.localeTrigger.height, aosMetrics.measured.localeTrigger.height, 0.5);
  compareString(add, "localeTrigger.borderRadius", dsMetrics.measured.localeTrigger.borderRadius, aosMetrics.measured.localeTrigger.borderRadius);
  compareString(add, "localeTrigger.display", dsMetrics.measured.localeTrigger.display, aosMetrics.measured.localeTrigger.display);
  compareResponsiveSearchWidth(add, "searchWrapper.width", dsMetrics.measured.searchWrapper.width, aosMetrics.measured.searchWrapper.width);
  compareNumber(add, "searchWrapper.height", dsMetrics.measured.searchWrapper.height, aosMetrics.measured.searchWrapper.height, 0.5);
  compareString(add, "searchWrapper.transitionProperty", dsMetrics.measured.searchWrapper.transitionProperty, aosMetrics.measured.searchWrapper.transitionProperty);
  compareResponsiveSearchWidth(add, "searchInput.width", dsMetrics.measured.searchInput.width, aosMetrics.measured.searchInput.width);
  compareNumber(add, "searchInput.height", dsMetrics.measured.searchInput.height, aosMetrics.measured.searchInput.height, 0.5);
  compareString(add, "searchInput.borderRadius", dsMetrics.measured.searchInput.borderRadius, aosMetrics.measured.searchInput.borderRadius);
  compareString(add, "searchInput.display", dsMetrics.measured.searchInput.display, aosMetrics.measured.searchInput.display);
  compareSearchGrid(add, "searchInput.gridTemplateColumns", dsMetrics.measured.searchInput.gridTemplateColumns, aosMetrics.measured.searchInput.gridTemplateColumns);
  compareNumber(add, "topBar.height", dsMetrics.measured.topBar.height, aosMetrics.measured.topBar.height, 0.5);
  compareString(add, "topBar.display", dsMetrics.measured.topBar.display, aosMetrics.measured.topBar.display);
  compareString(add, "topBar.position", dsMetrics.measured.topBar.position, aosMetrics.measured.topBar.position);
  compareString(add, "topBar.gap", dsMetrics.measured.topBar.gap, aosMetrics.measured.topBar.gap);
  compareString(add, "topBar.paddingLeft", dsMetrics.measured.topBar.paddingLeft, aosMetrics.measured.topBar.paddingLeft);
  compareString(add, "topBar.paddingRight", dsMetrics.measured.topBar.paddingRight, aosMetrics.measured.topBar.paddingRight);
  compareString(add, "topBar.borderRadius", dsMetrics.measured.topBar.borderRadius, aosMetrics.measured.topBar.borderRadius);
  compareString(add, "topBar.borderStyle", dsMetrics.measured.topBar.borderStyle, aosMetrics.measured.topBar.borderStyle);
  compareString(add, "topBar.borderWidth", dsMetrics.measured.topBar.borderWidth, aosMetrics.measured.topBar.borderWidth);
  compareString(add, "topBar.backgroundColor", dsMetrics.measured.topBar.backgroundColor, aosMetrics.measured.topBar.backgroundColor);
  compareTopBarGrid(add, "topBar.gridTemplateColumns", dsMetrics.measured.topBar.gridTemplateColumns, aosMetrics.measured.topBar.gridTemplateColumns);
  compareString(add, "shell.transitionProperty", dsMetrics.shell.transitionProperty, aosMetrics.shell.transitionProperty);
  compareString(add, "shell.themeWashAnimationName", dsMetrics.shell.themeWashAnimationName, aosMetrics.shell.themeWashAnimationName);
  add("aos-no-horizontal-overflow", aosMetrics.viewport.hasHorizontalOverflow === false, { aosHasHorizontalOverflow: aosMetrics.viewport.hasHorizontalOverflow });
  return { checks, failures };
}

function compareReducedMotionMetrics(dsMetrics, aosMetrics) {
  const failures = [];
  const checks = [];
  const add = (name, passed, readback) => {
    checks.push({ name, passed, ...readback });
    if (!passed) failures.push({ name, ...readback });
  };
  compareString(add, "reduced.shell.transitionProperty", dsMetrics.shell.transitionProperty, aosMetrics.shell.transitionProperty);
  compareString(add, "reduced.shell.themeWashAnimationName", dsMetrics.shell.themeWashAnimationName, aosMetrics.shell.themeWashAnimationName);
  compareString(add, "reduced.themeToggle.transitionProperty", dsMetrics.measured.themeToggle.transitionProperty, aosMetrics.measured.themeToggle.transitionProperty);
  compareString(add, "reduced.localeTrigger.transitionProperty", dsMetrics.measured.localeTrigger.transitionProperty, aosMetrics.measured.localeTrigger.transitionProperty);
  compareString(add, "reduced.sideNavToggle.transitionProperty", dsMetrics.measured.sideNavToggle.transitionProperty, aosMetrics.measured.sideNavToggle.transitionProperty);
  compareString(add, "reduced.searchWrapper.transitionProperty", dsMetrics.measured.searchWrapper.transitionProperty, aosMetrics.measured.searchWrapper.transitionProperty);
  return { checks, failures };
}

function compareNumber(add, name, ds, aos, tolerance) {
  const delta = Math.abs(Number(ds) - Number(aos));
  add(name, delta <= tolerance, { ds, aos, tolerance, delta: Number(delta.toFixed(3)) });
}

function compareString(add, name, ds, aos) {
  add(name, ds === aos, { ds, aos });
}

function compareResponsiveSearchWidth(add, name, ds, aos) {
  const dsNumber = Number(ds);
  const aosNumber = Number(aos);
  const minAllowed = 220;
  const maxAllowed = 260;
  const passed = dsNumber >= minAllowed && dsNumber <= maxAllowed && aosNumber >= minAllowed && aosNumber <= maxAllowed;
  add(name, passed, {
    ds,
    aos,
    allowedRange: `${minAllowed}-${maxAllowed}`,
    disposition: "same DS ProductShellSearch width rule; value may differ with comparator story vs product topbar available width"
  });
}

function compareSearchGrid(add, name, ds, aos) {
  const parse = (value) => String(value).split(/\s+/).filter(Boolean);
  const dsColumns = parse(ds);
  const aosColumns = parse(aos);
  const passed = dsColumns.length === 3
    && aosColumns.length === 3
    && dsColumns[0] === aosColumns[0]
    && dsColumns[0] === "22px";
  add(name, passed, {
    ds,
    aos,
    disposition: "same DS three-column SearchInput grid; middle/shortcut tracks respond to available width"
  });
}

function compareTopBarGrid(add, name, ds, aos) {
  const parse = (value) => String(value).split(/\s+/).filter(Boolean);
  const dsColumns = parse(ds);
  const aosColumns = parse(aos);
  const passed = dsColumns.length === 3 && aosColumns.length === 3;
  add(name, passed, {
    ds,
    aos,
    disposition: "same DS ProductShell topbar three-column grid; column widths vary by shell workspace width"
  });
}

async function startDesignSystemComparatorServer() {
  return startStaticFileServer(findDesignSystemStaticRoot());
}

function findDesignSystemStaticRoot() {
  const candidates = [
    new URL("../../TCRN-DESIGN-SYSTEM/apps/storybook/storybook-static/", import.meta.url),
    new URL("../../TCRN-Design-System/apps/storybook/storybook-static/", import.meta.url)
  ];
  const found = candidates.find((candidate) => existsSync(fileURLToPath(new URL("components.html", candidate))));
  assert.ok(found, "local DS Storybook static comparator exists at apps/storybook/storybook-static/components.html");
  return found;
}

async function startStaticFileServer(rootUrl) {
  const rootPath = fileURLToPath(rootUrl);
  const server = createServer((request, response) => {
    const rawPath = decodeURIComponent((request.url ?? "/").split("?")[0].split("#")[0]);
    const relativePath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
    const filePath = join(rootPath, relativePath);
    if (!filePath.startsWith(rootPath) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentTypeForPath(filePath) });
    response.end(readFileSync(filePath));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object", "static comparator server has a port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function contentTypeForPath(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function inspectContentRegion(page) {
  return page.locator('[data-product-shell-region="content"]').evaluate((content) => {
    const classedNodes = Array.from(content.querySelectorAll("[class]"));
    const aosClassHits = [];
    const storybookDemoClassHits = [];
    let dsOwnedClassCount = 0;
    for (const node of classedNodes) {
      for (const className of Array.from(node.classList)) {
        if (className.startsWith("aos-")) {
          aosClassHits.push({ tagName: node.tagName.toLowerCase(), className });
        }
        if (/^tcrn-(shell-demo|compact-shell|knowledge-shell)/.test(className)) {
          storybookDemoClassHits.push({ tagName: node.tagName.toLowerCase(), className });
        }
        if (className.startsWith("tcrn-")) {
          dsOwnedClassCount += 1;
        }
      }
    }
    const environmentBanner = content.querySelector(".tcrn-environment-banner");
    const inlineAlert = content.querySelector(".tcrn-inline-alert--warning");
    const environmentRect = environmentBanner?.getBoundingClientRect();
    const alertRect = inlineAlert?.getBoundingClientRect();
    return {
      text: content.innerText ?? "",
      aosClassHits,
      storybookDemoClassHits,
      dsOwnedClassCount,
      environmentBannerVisible: Boolean(environmentRect && environmentRect.width > 0 && environmentRect.height > 0),
      inlineAlertVisible: Boolean(alertRect && alertRect.width > 0 && alertRect.height > 0),
      bannerOverlap: Boolean(environmentRect && alertRect && alertRect.top < environmentRect.bottom && alertRect.bottom > environmentRect.top)
    };
  });
}

async function clickStableContentPoint(page) {
  const point = await page.evaluate(() => {
    const content = document.querySelector('[data-product-shell-region="content"]');
    const topBar = document.querySelector(".tcrn-top-bar");
    const contentRect = content?.getBoundingClientRect();
    const topBarRect = topBar?.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 24, Math.max(24, (contentRect?.left ?? 0) + 48));
    const yFloor = (topBarRect?.bottom ?? 0) + 96;
    const contentY = (contentRect?.top ?? 0) + 96;
    const y = Math.min(window.innerHeight - 24, Math.max(96, yFloor, contentY));
    return { x, y };
  });
  await page.mouse.click(point.x, point.y);
}

function loadPlaywrightChromium() {
  try {
    const require = createRequire(import.meta.url);
    const playwright = require("@playwright/test");
    return { chromium: playwright.chromium, source: "aos_dev_dependency" };
  } catch {
    const requireFromDesignSystem = createRequire(new URL("../../TCRN-Design-System/package.json", import.meta.url));
    const playwright = requireFromDesignSystem("@playwright/test");
    return { chromium: playwright.chromium, source: "sibling_design_system_dev_dependency" };
  }
}

function findLocalChromeExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? undefined;
}

function listRelativeFiles(rootUrl) {
  const rootPath = fileURLToPath(rootUrl);
  if (!existsSync(rootPath)) return [];
  const files = [];
  const visit = (dir, prefix = "") => {
    for (const entry of readdirSync(dir)) {
      const fullPath = `${dir}/${entry}`;
      const relative = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(fullPath).isDirectory()) {
        visit(fullPath, relative);
      } else {
        files.push(relative);
      }
    }
  };
  visit(rootPath);
  return files;
}

function capturePageHealth(page, consoleMessages, pageErrors, requestFailures) {
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" });
  });
}
