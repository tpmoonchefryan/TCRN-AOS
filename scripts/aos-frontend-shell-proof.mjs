import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { findForbiddenPositiveClaimHits, tcrnLocaleMetadata } from "@tcrn/ui-copy-state";
import { frontendShellRoutes, forbiddenHumanAiTopbarMarkers } from "../dist/apps/web/src/data.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const shellPath = new URL("../apps/web/dist/index.html", import.meta.url);
assert.equal(existsSync(shellPath), true, "apps/web/dist/index.html exists after pnpm build");

const screenshotRoot = "/tmp/tcrn-aos-shell-qa";
rmSync(screenshotRoot, { recursive: true, force: true });
mkdirSync(screenshotRoot, { recursive: true });

const html = readFileSync(shellPath, "utf8");
const requiredMarkers = [
  'data-aos-shell="first-frontend-slice"',
  'data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"',
  'data-storybook-contract-consumed="shell-theme-locale-search-state-copy"',
  'data-aos-proof-banner-stack="spaced"',
  'data-side-nav-storage="session"',
  'data-responsive-shell-posture="desktop-expanded-mobile-collapsed"',
  'data-tcrn-theme="light"',
  'data-theme-toggle="true"',
  'data-aos-shell-search="true"',
  'data-locale-control="native-name-menu"',
  'data-side-nav-toggle="true"',
  'data-side-nav-persisted-key="tcrn-aos-side-nav-collapsed"',
  'data-registered-navigation-only="true"',
  'data-registered-brand-lockup="@tcrn/ui-react/ShellBrandLockup"',
  'data-brand-asset-path="/assets/tcrn-brand-mark.svg"',
  'data-tcrn-brand-mark="registered"',
  'data-package-backed-brand-lockup="shell"',
  'data-package-backed-shell-control="locale-menu"',
  'data-package-backed-shell-control="theme-toggle"',
  'data-package-backed-shell-control="side-nav-collapse"',
  'data-tcrn-component-style-source="@tcrn/ui-react"',
  'data-aos-dummy-cockpit="true"',
  'data-aos-work-module-entry="jira-like"',
  'data-aos-registered-module-boundary="cockpit-work-only"',
  'data-raw-json-disclosure="secondary"',
  'data-aos-no-overclaim-banner="true"',
  'data-cockpit-aggregation="deferred"',
  'data-product-acceptance="not-claimed"',
  'data-release-readiness="not-claimed"',
  'data-live-dispatch="not-enabled"',
  'body[data-theme-switching="true"]::after',
  "aos-theme-wash"
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

assert.deepEqual(missingMarkers, [], "required shell and DS-consumption markers are present");
assert.deepEqual(missingLocales, [], "locale menu uses native locale names");
assert.deepEqual(forbiddenAiMarkers, [], "AI consumption contract is not exposed as a human top-bar control");
assert.deepEqual(forbiddenPositiveClaimHits, [], "shell HTML has no forbidden positive-claim phrases");
assert.deepEqual(forbiddenPlannedStaticHits, [], "planned/unregistered modules are not visible as primary navigation or module cards");
assert.deepEqual(forbiddenAosBrandHtmlHits, [], "forbidden AOS wordmark/favicon markers are absent from shell HTML");
assert.deepEqual(concatenatedBannerStaticHits, [], "banner and alert text are not statically concatenated");
assert.deepEqual(forbiddenAosBrandDistHits, [], "forbidden AOS wordmark/favicon files are absent from built dist assets");
assert.deepEqual(forbiddenAosBrandDocHits, [], "current docs/evidence do not reference forbidden AOS wordmark/favicon assets");

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
      packageBackedShellControls: [
        'data-package-backed-shell-control="locale-menu"',
        'data-package-backed-shell-control="theme-toggle"',
        'data-package-backed-shell-control="side-nav-collapse"'
      ].every((marker) => body.includes(marker)),
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

  const ok = routeReadbacks.every((entry) => entry.status === 200 && entry.html && entry.shellMarker && entry.dummyCockpitMarker && entry.workMarker && entry.registeredNavigationOnly && entry.registeredBrandLockup && entry.packageBackedShellControls && entry.plannedPrimaryHits.length === 0 && entry.forbiddenBrandHits.length === 0)
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
      themeControl: "compact_icon_only_explicit_toggle",
      themeTransition: "whole_page_wash",
      localeSelector: "globe_trigger_native_names_with_escape_outside_selection_close",
      sideNavigation: "package_backed_side_nav_with_persisted_collapse",
      search: "compact_rest_expands_on_focus_with_results_and_outside_tab_dismissal",
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
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  });
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];

  try {
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      locale: "en",
      timezoneId: "UTC",
      reducedMotion: "reduce",
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

    const bannerReadback = await desktopPage.locator('[data-aos-proof-banner-stack="spaced"]').evaluate((stack) => {
      const environmentBanner = stack.querySelector(".tcrn-environment-banner");
      const alert = stack.querySelector("[data-aos-no-overclaim-banner]");
      const environmentStyle = environmentBanner ? getComputedStyle(environmentBanner) : null;
      const alertStyle = alert ? getComputedStyle(alert) : null;
      const environmentRect = environmentBanner?.getBoundingClientRect();
      const alertRect = alert?.getBoundingClientRect();
      const environmentLabelRect = environmentBanner?.querySelector("strong")?.getBoundingClientRect();
      const environmentCopyRect = environmentBanner?.querySelector("span")?.getBoundingClientRect();
      const alertLabelRect = alert?.querySelector("strong")?.getBoundingClientRect();
      const alertCopyRect = alert?.querySelector(".aos-alert-copy")?.getBoundingClientRect();
      return {
        text: stack.innerText ?? "",
        environmentDisplay: environmentStyle?.display,
        environmentColumnGap: environmentStyle?.columnGap,
        environmentVisualGap: environmentLabelRect && environmentCopyRect ? environmentCopyRect.left - environmentLabelRect.right : 0,
        alertDisplay: alertStyle?.display,
        alertColumnGap: alertStyle?.columnGap,
        alertVisualGap: alertLabelRect && alertCopyRect ? alertCopyRect.left - alertLabelRect.right : 0,
        verticalGap: environmentRect && alertRect ? alertRect.top - environmentRect.bottom : 0
      };
    });
    assert.equal(bannerReadback.text.includes("sliceLocal"), false, "environment banner text is not concatenated");
    assert.equal(bannerReadback.text.includes("onlyLocal"), false, "alert text is not concatenated");
    assert.equal(bannerReadback.environmentDisplay, "grid", "environment banner uses explicit product spacing grid");
    assert.equal(bannerReadback.alertDisplay, "grid", "alert banner uses explicit product spacing grid");
    assert.equal(parseFloat(bannerReadback.environmentColumnGap) >= 8, true, "environment banner has visible column gap");
    assert.equal(parseFloat(bannerReadback.alertColumnGap) >= 8, true, "alert banner has visible column gap");
    assert.equal(bannerReadback.environmentVisualGap >= 8, true, "environment label and state are visibly separated");
    assert.equal(bannerReadback.alertVisualGap >= 8, true, "alert label and copy are visibly separated");
    assert.equal(bannerReadback.verticalGap >= 8, true, "proof banners have visible vertical spacing");

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
    await desktopPage.locator("#content").click({ position: { x: 20, y: 20 } });
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
    assert.equal(await desktopPage.locator('[data-route-path="/cockpit"]').getAttribute("aria-current"), "page", "active cockpit route is marked");
    const expandedSideNavWidth = await desktopPage.locator(".aos-sidebar").evaluate((node) => node.getBoundingClientRect().width);
    await sideNavToggle.click();
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "false", "collapse sets aria-expanded false");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "shell records collapsed side nav");
    assert.equal(await desktopPage.evaluate(() => sessionStorage.getItem("tcrn-aos-side-nav-collapsed")), "true", "side nav collapse persists in route-owned session storage");
    assert.equal(await desktopPage.locator('[data-route-path="/cockpit"]').getAttribute("aria-current"), "page", "active cockpit route preserved while collapsed");
    await desktopPage.waitForFunction((expandedWidth) => {
      const width = document.querySelector(".aos-sidebar")?.getBoundingClientRect().width ?? expandedWidth;
      return width < expandedWidth - 90;
    }, expandedSideNavWidth);
    const collapsedSideNavWidth = await desktopPage.locator(".aos-sidebar").evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(collapsedSideNavWidth < expandedSideNavWidth - 90, true, "collapsed side nav has a deliberate narrower visual state");
    await desktopPage.screenshot({ path: `${screenshotRoot}/02-desktop-cockpit-collapsed.png`, fullPage: false });
    await desktopPage.reload({ waitUntil: "networkidle" });
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "side nav collapse survives reload");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("aria-expanded"), "false", "side nav toggle reflects persisted collapse");
    await desktopPage.locator("[data-side-nav-toggle]").click();
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "side nav expands");

    const searchWrap = desktopPage.locator(".aos-search-wrap");
    const searchInput = desktopPage.locator("[data-aos-shell-search]");
    const searchWidthAtRest = await searchWrap.evaluate((node) => node.getBoundingClientRect().width);
    await searchInput.focus();
    await desktopPage.waitForFunction(() => document.querySelector(".aos-search-wrap")?.classList.contains("is-searching"));
    const searchWidthFocused = await searchWrap.evaluate((node) => node.getBoundingClientRect().width);
    assert.equal(searchWidthFocused >= searchWidthAtRest, true, "search expands or preserves full width on focus");
    await searchInput.fill("shell");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    assert.equal(await desktopPage.locator("[data-search-result]").count() > 0, true, "search shows local results while focused");
    await desktopPage.locator("#content").click({ position: { x: 24, y: 24 } });
    await desktopPage.waitForFunction(() => !document.querySelector(".aos-search-wrap")?.classList.contains("is-searching"));
    assert.equal(await desktopPage.locator("[data-search-results]").isVisible(), false, "search collapses and hides results on blur");

    await searchInput.focus();
    await searchInput.fill("shell");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    const outsidePointerSearchReadback = await desktopPage.evaluate(() => {
      const input = document.querySelector("[data-aos-shell-search]");
      const content = document.querySelector("#content");
      content?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
      content?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      content?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      content?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        activeIsSearch: document.activeElement === input,
        wrapSearching: input?.closest(".aos-search-wrap")?.classList.contains("is-searching") ?? false,
        resultsHidden: document.querySelector("[data-search-results]")?.hidden ?? false
      };
    });
    assert.equal(outsidePointerSearchReadback.activeIsSearch, false, "outside pointer dismissal intentionally blurs shell search");
    assert.equal(outsidePointerSearchReadback.wrapSearching, false, "outside pointer dismissal returns search to compact rest state");
    assert.equal(outsidePointerSearchReadback.resultsHidden, true, "outside pointer dismissal hides search results");

    await searchInput.focus();
    await searchInput.fill("shell");
    await desktopPage.waitForFunction(() => {
      const layer = document.querySelector("[data-search-results]");
      return layer && !layer.hidden && layer.querySelector("[data-search-result]");
    });
    await desktopPage.keyboard.press("Tab");
    await desktopPage.waitForFunction(() => {
      const input = document.querySelector("[data-aos-shell-search]");
      const layer = document.querySelector("[data-search-results]");
      return document.activeElement !== input
        && !document.querySelector(".aos-search-wrap")?.classList.contains("is-searching")
        && layer?.hidden === true;
    });

    const visibleText = await desktopPage.locator("body").innerText();
    for (const label of forbiddenPlannedPrimaryLabels) {
      assert.equal(visibleText.includes(label), false, `${label} is not visible in product IA`);
    }
    assert.equal(visibleText.includes("ai-consumption-contract.json"), false, "AI contract JSON is not a human top-bar link");
    for (const marker of forbiddenAosBrandAssetMarkers) {
      assert.equal(await desktopPage.locator("body").evaluate((body, value) => body.innerHTML.includes(value), marker), false, `${marker} is not present in rendered browser DOM`);
    }
    assert.equal(await desktopPage.locator(".aos-api-json").isVisible(), false, "raw JSON is not primary visible Cockpit UX");
    assert.equal(await desktopPage.locator('[data-raw-json-disclosure="secondary"]').isVisible(), true, "raw payload is available only through secondary disclosure");

    const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.equal(desktopOverflow, true, "desktop shell has no horizontal overflow");

    await desktopPage.goto(`${baseUrl}/work?locale=zh-CN&theme=dark`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-work-module-entry="jira-like"]');
    await desktopPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));
    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "dark", "dark theme query applies");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "zh-CN", "zh-CN locale query applies");
    assert.equal(await desktopPage.locator('[data-route-path="/work"]').getAttribute("aria-current"), "page", "active work route is marked in dark proof");
    const warningContrast = await desktopPage.locator("[data-aos-no-overclaim-banner]").evaluate((node) => {
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
    assert.equal(await mobilePage.locator('[data-route-path="/work"]').getAttribute("aria-current"), "page", "mobile active work route is preserved");
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "mobile first viewport starts with navigation collapsed");
    assert.equal(await mobilePage.locator(".aos-nav").isVisible(), false, "mobile collapsed navigation is tucked away from first viewport");
    const mobileHeadingTop = await mobilePage.locator("#aos-overview-heading").evaluate((node) => node.getBoundingClientRect().top);
    assert.equal(mobileHeadingTop < 560, true, "mobile first viewport reaches the main shell content promptly");
    await mobilePage.screenshot({ path: `${screenshotRoot}/04-mobile-work-dark.png`, fullPage: false });
    await mobilePage.locator("[data-side-nav-toggle]").click();
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "mobile side nav expands from compact first viewport");
    assert.equal(await mobilePage.locator(".aos-nav").isVisible(), true, "mobile expanded navigation is visible on demand");
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
      viewports: ["desktop-1440x900", "mobile-390x844"],
      checks: {
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
  }
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
