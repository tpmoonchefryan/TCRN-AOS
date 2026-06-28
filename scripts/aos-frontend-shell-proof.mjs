import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { findForbiddenPositiveClaimHits, tcrnLocaleMetadata } from "@tcrn/ui-copy-state";
import { frontendShellRoutes, forbiddenHumanAiTopbarMarkers } from "../dist/apps/web/src/data.js";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const shellPath = new URL("../apps/web/dist/index.html", import.meta.url);
assert.equal(existsSync(shellPath), true, "apps/web/dist/index.html exists after pnpm build");

const html = readFileSync(shellPath, "utf8");
const requiredMarkers = [
  'data-aos-shell="first-frontend-slice"',
  'data-design-system-source="@tcrn/ui-react @tcrn/ui-tokens @tcrn/ui-copy-state"',
  'data-storybook-contract-consumed="shell-theme-locale-search-state-copy"',
  'data-tcrn-theme="light"',
  'data-theme-toggle="true"',
  'data-aos-shell-search="true"',
  'data-locale-control="native-name-menu"',
  'data-side-nav-toggle="true"',
  'data-side-nav-persisted-key="tcrn-aos-side-nav-collapsed"',
  'data-registered-navigation-only="true"',
  'data-admitted-brand-asset="tcrn-aos-wordmark-geometric-dark"',
  'data-brand-asset-path="/assets/tcrn-aos-wordmark-geometric-dark.png"',
  'data-visible-brand-wordmark="true"',
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

const missingMarkers = requiredMarkers.filter((marker) => !html.includes(marker));
const missingLocales = tcrnLocaleMetadata.map((entry) => entry.nativeName).filter((name) => !html.includes(name));
const forbiddenAiMarkers = forbiddenHumanAiTopbarMarkers.filter((marker) => html.includes(marker));
const forbiddenPositiveClaimHits = findForbiddenPositiveClaimHits(html);
const forbiddenPlannedStaticHits = forbiddenPlannedPrimaryLabels.filter((label) => html.includes(label));

assert.deepEqual(missingMarkers, [], "required shell and DS-consumption markers are present");
assert.deepEqual(missingLocales, [], "locale menu uses native locale names");
assert.deepEqual(forbiddenAiMarkers, [], "AI consumption contract is not exposed as a human top-bar control");
assert.deepEqual(forbiddenPositiveClaimHits, [], "shell HTML has no forbidden positive-claim phrases");
assert.deepEqual(forbiddenPlannedStaticHits, [], "planned/unregistered modules are not visible as primary navigation or module cards");

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
      plannedPrimaryHits: forbiddenPlannedPrimaryLabels.filter((label) => body.includes(label))
    });
  }

  const asset = await fetch(`${service.url}/assets/tcrn-aos-wordmark-geometric-dark.png`);
  const health = await fetch(`${service.url}/api/health`).then((response) => response.json());
  const readback = await fetch(`${service.url}/api/readback`).then((response) => response.json());
  const policy = await fetch(`${service.url}/api/policy`).then((response) => response.json());
  const cockpitApi = await fetch(`${service.url}/api/cockpit`);
  const cockpitApiPayload = await cockpitApi.json();
  const browserProof = await runBrowserProof(service.url);

  const stopped = await service.close();
  closed = stopped.stopped && stopped.runtimeReset;

  const ok = routeReadbacks.every((entry) => entry.status === 200 && entry.html && entry.shellMarker && entry.dummyCockpitMarker && entry.workMarker && entry.registeredNavigationOnly && entry.plannedPrimaryHits.length === 0)
    && asset.status === 200
    && (asset.headers.get("content-type") ?? "").includes("image/png")
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
    dsContractConsumption: {
      packages: ["@tcrn/ui-react", "@tcrn/ui-tokens", "@tcrn/ui-copy-state"],
      themeControl: "compact_icon_only_explicit_toggle",
      themeTransition: "whole_page_wash",
      localeSelector: "globe_trigger_native_names_with_escape_outside_selection_close",
      sideNavigation: "package_backed_side_nav_with_persisted_collapse",
      search: "compact_rest_expands_on_focus_with_results",
      readbackUx: "readback_panel_key_value_evidence_primary_raw_json_secondary_disclosure",
      brandAsset: "/assets/tcrn-aos-wordmark-geometric-dark.png",
      aiContractHumanTopbarLink: false
    },
    browserProof,
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
      forbiddenPlannedStaticHits
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
      colorScheme: "dark",
      locale: "zh-CN",
      timezoneId: "UTC",
      reducedMotion: "reduce",
      deviceScaleFactor: 1
    });
    const desktopPage = await desktopContext.newPage();
    capturePageHealth(desktopPage, consoleMessages, pageErrors, requestFailures);
    await desktopPage.goto(`${baseUrl}/cockpit?locale=zh-CN&theme=dark`, { waitUntil: "networkidle" });
    await desktopPage.waitForSelector('[data-aos-shell="first-frontend-slice"]');
    await desktopPage.waitForFunction(() => document.querySelector("[data-api-state]")?.textContent?.includes("available"));

    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "dark", "dark theme query applies");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "zh-CN", "zh-CN locale query applies");

    const brandReadback = await desktopPage.locator("[data-visible-brand-wordmark]").evaluate((img) => {
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
    assert.equal(brandReadback.src, "/assets/tcrn-aos-wordmark-geometric-dark.png");
    assert.equal(brandReadback.alt, "TCRN AOS geometric wordmark");
    assert.equal(brandReadback.naturalWidth > 0, true, "brand asset loads");
    assert.equal(brandReadback.width >= 120, true, "expanded brand is visibly sized");
    assert.equal(brandReadback.height >= 30, true, "expanded brand has visible height");

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
    await desktopPage.locator('[data-locale-option="en"]').click();
    assert.equal(await localeTrigger.getAttribute("aria-expanded"), "false", "selection closes locale menu");
    assert.equal(await desktopPage.locator("html").getAttribute("lang"), "en", "selection updates locale");
    assert.equal(await desktopPage.evaluate(() => document.activeElement?.matches("[data-locale-menu-toggle]")), true, "selection returns focus to locale trigger");

    const sideNavToggle = desktopPage.locator("[data-side-nav-toggle]");
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "true", "side nav starts expanded");
    assert.equal(await desktopPage.locator('[data-route-path="/cockpit"]').getAttribute("aria-current"), "page", "active cockpit route is marked");
    await sideNavToggle.click();
    assert.equal(await sideNavToggle.getAttribute("aria-expanded"), "false", "collapse sets aria-expanded false");
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "shell records collapsed side nav");
    assert.equal(await desktopPage.evaluate(() => localStorage.getItem("tcrn-aos-side-nav-collapsed")), "true", "side nav collapse persists");
    assert.equal(await desktopPage.locator('[data-route-path="/cockpit"]').getAttribute("aria-current"), "page", "active cockpit route preserved while collapsed");
    await desktopPage.reload({ waitUntil: "networkidle" });
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "side nav collapse survives reload");
    assert.equal(await desktopPage.locator("[data-side-nav-toggle]").getAttribute("aria-expanded"), "false", "side nav toggle reflects persisted collapse");
    await desktopPage.locator("[data-side-nav-toggle]").click();
    assert.equal(await desktopPage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "false", "side nav expands");

    await desktopPage.locator("[data-theme-toggle]").click();
    await desktopPage.waitForFunction(() => document.documentElement.dataset.tcrnTheme === "light");
    assert.equal(await desktopPage.locator("html").getAttribute("data-tcrn-theme"), "light", "theme toggle switches to light");

    const visibleText = await desktopPage.locator("body").innerText();
    for (const label of forbiddenPlannedPrimaryLabels) {
      assert.equal(visibleText.includes(label), false, `${label} is not visible in product IA`);
    }
    assert.equal(visibleText.includes("ai-consumption-contract.json"), false, "AI contract JSON is not a human top-bar link");
    assert.equal(await desktopPage.locator(".aos-api-json").isVisible(), false, "raw JSON is not primary visible Cockpit UX");
    assert.equal(await desktopPage.locator('[data-raw-json-disclosure="secondary"]').isVisible(), true, "raw payload is available only through secondary disclosure");

    const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.equal(desktopOverflow, true, "desktop shell has no horizontal overflow");

    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "light",
      locale: "ja",
      timezoneId: "UTC",
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();
    capturePageHealth(mobilePage, consoleMessages, pageErrors, requestFailures);
    await mobilePage.goto(`${baseUrl}/work?locale=ja&theme=light`, { waitUntil: "networkidle" });
    await mobilePage.waitForSelector('[data-aos-work-module-entry="jira-like"]');
    assert.equal(await mobilePage.locator('[data-route-path="/work"]').getAttribute("aria-current"), "page", "mobile active work route is preserved");
    await mobilePage.locator("[data-side-nav-toggle]").click();
    assert.equal(await mobilePage.locator("[data-aos-shell]").getAttribute("data-side-nav-collapsed"), "true", "mobile side nav collapse state updates");
    const mobileNoOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.equal(mobileNoOverflow, true, "mobile shell has no horizontal page overflow");
    assert.equal(await mobilePage.locator('[data-visible-brand-wordmark]').isVisible(), true, "mobile brand asset remains visible");
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
        localeOutsideDismissal: true,
        localeEscapeDismissalFocusReturn: true,
        localeSelectionFocusReturn: true,
        sideNavCollapseExpandAriaPersistence: true,
        brandAssetVisible: true,
        plannedModuleNavigationAbsent: true,
        rawJsonNotPrimary: true,
        lightDarkThemeChecked: true,
        desktopMobileOverflowChecked: true
      }
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
