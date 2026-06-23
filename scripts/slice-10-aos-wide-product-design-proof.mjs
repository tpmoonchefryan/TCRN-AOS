import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createAOSWideProductDesignModel,
  forbiddenAosWidePositiveCopy,
  renderAOSWideProductDesignHtml,
  requiredAosWideSelectors,
  slice10LocalCheckpoint,
  slice10PreImplementationBasis,
  slice10WorkflowPacketBasis
} from "../dist/apps/web/src/aos-wide-product-design-view.js";

const repoRoot = process.cwd();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkCurrentSource = process.argv.includes("--check-current-source");
const model = createAOSWideProductDesignModel();
const html = renderAOSWideProductDesignHtml(model);
const staticPath = join(repoRoot, "apps/web/static/aos-wide-product-design.html");
const browserEvidenceRoot = join(repoRoot, "evidence", "slice-10-aos-wide-product-design-browser");
const browserEvidenceDir = join(browserEvidenceRoot, sourceHead);
const browserSummaryPath = join(browserEvidenceDir, "browser-evidence-summary.json");
const stableBrowserSummaryPath = join(browserEvidenceRoot, "browser-evidence-summary.json");
const markdownPath = join(repoRoot, "evidence", "slice-10-aos-wide-product-design-surface-set-proof.md");
const sourceFreshnessReadback = inspectSourceContentDigest();
const productVisibleInternalTerms = [
  "readback",
  "checkpoint",
  "route",
  "fixture",
  "proof required",
  "external proof required",
  "package-runtime pilot",
  "functional contract readback only",
  "held for later",
  "unavailable in this route",
  "not claimed",
  "not_claimed"
];

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(stableBrowserSummaryPath, "utf8"));
  const retainedDigest = retained.sourceFreshnessReadback?.sourceContentDigest;
  const retainedStrategy = retained.sourceFreshnessReadback?.strategy;
  const ok = retainedDigest === sourceFreshnessReadback.sourceContentDigest
    && retainedStrategy === sourceFreshnessReadback.strategy
    && retained.ok === true;
  const result = {
    ok,
    command: "node scripts/slice-10-aos-wide-product-design-proof.mjs --check-current-source",
    retainedSummaryPath: "evidence/slice-10-aos-wide-product-design-browser/browser-evidence-summary.json",
    retainedSourceHeadAtProofRun: retained.sourceHead,
    retainedStrategy,
    currentStrategy: sourceFreshnessReadback.strategy,
    retainedDigest,
    currentDigest: sourceFreshnessReadback.sourceContentDigest
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) {
    process.exit(1);
  }
  process.exit(0);
}

mkdirSync(dirname(staticPath), { recursive: true });
mkdirSync(browserEvidenceDir, { recursive: true });
writeFileSync(staticPath, html);

const targetPaths = {
  operationsCockpit: "apps/web/static/operations-cockpit.html",
  docsSearchRelease: "apps/web/static/docs-search-release-readiness.html",
  aosWideTarget: "apps/web/static/aos-wide-product-design.html"
};
const targetPathReadback = Object.fromEntries(
  Object.entries(targetPaths).map(([key, value]) => [key, { path: value, exists: existsSync(join(repoRoot, value)) }])
);
const selectorProof = requiredAosWideSelectors.map((selector) => {
  const dataRegion = selector.match(/data-region='([^']+)'/)?.[1];
  const present = dataRegion ? html.includes(`data-region="${dataRegion}"`) : false;
  return { selector, present };
});
const forbiddenHits = forbiddenAosWidePositiveCopy.filter((phrase) => html.toLowerCase().includes(phrase.toLowerCase()));
const productVisibleCopyReadback = inspectProductVisibleCopy(html);
const htmlDigest = createHash("sha256").update(html).digest("hex");
const requiredState = model.requiredState;
const requiredStateOk = requiredState.productDesignStatus === "target_set_implemented_pending_review"
  && requiredState.aosWideProductDesignAccepted === false
  && requiredState.deploymentProof === "not_claimed"
  && requiredState.liveDispatch === false
  && requiredState.threadRegistryMutation === false
  && requiredState.releaseReadiness === "not_claimed"
  && requiredState.productAcceptance === "not_claimed"
  && requiredState.finalMvpAcceptance === "not_claimed"
  && requiredState.docsExport === "not_executed"
  && requiredState.docsPublication === "not_claimed"
  && requiredState.canonicalPromotion === "not_claimed"
  && requiredState.githubMutation === false
  && requiredState.scannerIngestion === false
  && requiredState.materializationExecuted === false
  && requiredState.productRepoWrite === false
  && requiredState.codexSecurityScan === "not_run"
  && requiredState.externalProofRequired === true;
const readinessRows = model.surfaces.map((surface) => ({
  id: surface.id,
  title: surface.title,
  state: surface.state,
  desktopReadyForCapture: model.evidenceReadiness[surface.id]?.desktopReadyForCapture === true,
  mobileReadyForCapture: model.evidenceReadiness[surface.id]?.mobileReadyForCapture === true,
  bodyOverflowExpected: model.evidenceReadiness[surface.id]?.bodyOverflowExpected,
  denseOverflowConfinedTo: model.evidenceReadiness[surface.id]?.denseOverflowConfinedTo,
  consolePageErrorExpectation: model.evidenceReadiness[surface.id]?.consolePageErrorExpectation
}));
const interactionReadiness = {
  primaryNavigation: html.includes("data-nav-surface="),
  searchFilter: html.includes("id=\"surface-search\""),
  stateFilters: ["all", "review_required", "blocked", "current", "pending_external_proof"].every((state) => html.includes(`data-filter-state="${state}"`)),
  rowDetailSelection: html.includes("data-surface-row") && html.includes("data-detail-title"),
  emptyState: html.includes("data-empty-state"),
  disabledGateControls: html.includes("Request approval") && html.includes("Run live action") && html.includes("Open evidence review") && html.includes("disabled"),
  focusStateCss: html.includes(":focus-visible")
};
const overflowReadiness = {
  bodyPageOverflowExpected: false,
  shellClipsHorizontalOverflow: html.includes("overflow-x: clip"),
  denseTableOverflowConfined: html.includes(".surface-index { border-radius: 6px 0 0 6px; overflow-x: auto; }"),
  mobileDenseTableWidth: html.includes(".surface-table { width: max-content; min-width: 820px; }")
};
const restrictedPayloadCheck = {
  rawSourceStored: model.restrictedPayloadPosture.rawSourceStored,
  secretsStored: model.restrictedPayloadPosture.secretsStored,
  authStateStored: model.restrictedPayloadPosture.authStateStored,
  shellHistoryStored: model.restrictedPayloadPosture.shellHistoryStored,
  browserKeychainStored: model.restrictedPayloadPosture.browserKeychainStored,
  rawScannerOutputStored: model.restrictedPayloadPosture.rawScannerOutputStored,
  localAbsolutePathStored: model.restrictedPayloadPosture.localAbsolutePathStored
};
const d024Boundary = model.d024Boundary;
const browserReadback = await runBrowserProof();
const ok = slice10WorkflowPacketBasis === "bcff619a406f2028e6c70ea76a3ade1674e3ca21"
  && slice10PreImplementationBasis === "06cded11e97be6d4a738a21ae942128d5b4688cd"
  && slice10LocalCheckpoint === "slice-10-aos-wide-product-design-surface-set"
  && model.surfaces.length === 10
  && selectorProof.every((item) => item.present)
  && Object.values(targetPathReadback).every((item) => item.exists)
  && forbiddenHits.length === 0
  && productVisibleCopyReadback.ok
  && requiredStateOk
  && readinessRows.every((row) => row.desktopReadyForCapture && row.mobileReadyForCapture && row.bodyOverflowExpected === false)
  && Object.values(interactionReadiness).every(Boolean)
  && overflowReadiness.bodyPageOverflowExpected === false
  && overflowReadiness.shellClipsHorizontalOverflow
  && overflowReadiness.denseTableOverflowConfined
  && overflowReadiness.mobileDenseTableWidth
  && Object.values(restrictedPayloadCheck).every((value) => value === false)
  && d024Boundary.localFirstOperationalData === true
  && browserReadback.ok
  && d024Boundary.runtimeOperationalDumpCommitted === false;

const summary = {
  ok,
  route: "route_tcrn_aos_design_system_frontend_rebuild_59ax_aos_wide_product_design_target_set_package_runtime_adoption_implementation",
  sourceHead,
  checkpoint: {
    workflowPacketBasis: slice10WorkflowPacketBasis,
    preImplementationBasis: slice10PreImplementationBasis,
    localCheckpoint: slice10LocalCheckpoint
  },
  staticRender: {
    path: "apps/web/static/aos-wide-product-design.html",
    bytes: Buffer.byteLength(html),
    sha256: htmlDigest,
    productDesignStatus: model.context.productDesignStatus,
    selectorProof
  },
  targetPathReadback,
  sourceFreshnessReadback,
  surfaceReadiness: {
    count: readinessRows.length,
    rows: readinessRows
  },
  interactionReadiness,
  overflowReadiness,
  copyScan: {
    forbiddenHits,
    productVisibleInternalHits: productVisibleCopyReadback.hits,
    productionSurfaceOnly: true
  },
  requiredState,
  noOverclaim: {
    aosWideProductDesignAccepted: requiredState.aosWideProductDesignAccepted,
    deploymentProof: requiredState.deploymentProof,
    liveDispatch: requiredState.liveDispatch,
    threadRegistryMutation: requiredState.threadRegistryMutation,
    releaseReadiness: requiredState.releaseReadiness,
    productAcceptance: requiredState.productAcceptance,
    finalMvpAcceptance: requiredState.finalMvpAcceptance,
    docsExport: requiredState.docsExport,
    docsPublication: requiredState.docsPublication,
    canonicalPromotion: requiredState.canonicalPromotion,
    githubMutation: requiredState.githubMutation,
    scannerIngestion: requiredState.scannerIngestion,
    materializationExecuted: requiredState.materializationExecuted,
    productRepoWrite: requiredState.productRepoWrite,
    codexSecurityScan: requiredState.codexSecurityScan
  },
  d024Boundary,
  restrictedPayloadCheck,
  browserReadback,
  evidenceReadiness: {
    markdownReceipt: relative(repoRoot, markdownPath),
    browserSummaryPath: relative(repoRoot, browserSummaryPath),
    stableBrowserSummaryPath: relative(repoRoot, stableBrowserSummaryPath),
    consolePageErrorReadiness: browserReadback.pageErrors.length === 0 ? "none_observed" : "page_errors_observed"
  }
};

writeFileSync(browserSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(stableBrowserSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(markdownPath, markdownReceipt(summary));
console.log(JSON.stringify(summary, null, 2));

if (!ok) {
  process.exit(1);
}

async function runBrowserProof() {
  const designSystemRequire = createRequire(join(repoRoot, "..", "TCRN-Design-System", "package.json"));
  let playwrightPath;
  try {
    playwrightPath = designSystemRequire.resolve("@playwright/test");
  } catch {
    throw new Error("design_system_playwright_tooling_unavailable");
  }

  const playwright = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = playwright.default ?? playwright;
  const browser = await chromium.launch();
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const screenshots = [];
  const viewportReadbacks = [];
  const staticUrl = pathToFileURL(staticPath).href;
  const viewports = [
    { label: "desktop-1440x900", width: 1440, height: 900 },
    { label: "mobile-390x844", width: 390, height: 844 }
  ];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => pageErrors.push(`${viewport.label}: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(`${viewport.label}: ${message.text()}`);
      });
      page.on("requestfailed", (request) => {
        requestFailures.push(`${viewport.label}: ${request.url()} ${request.failure()?.errorText ?? "request_failed"}`);
      });

      await page.goto(staticUrl, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-surface='aos-wide-product-design']");
      const initialReadback = await collectPageReadback(page, `${viewport.label}-initial`);
      screenshots.push(await captureScreenshot(page, `${viewport.label}-initial.png`));

      await page.locator("[data-filter-state='blocked']").click();
      await page.waitForFunction(() => {
        const rows = Array.from(document.querySelectorAll("[data-surface-row]"));
        return rows.filter((row) => !row.hidden && getComputedStyle(row).display !== "none").length === 4;
      });
      const blockedReadback = await collectPageReadback(page, `${viewport.label}-blocked-filter`);
      screenshots.push(await captureScreenshot(page, `${viewport.label}-blocked-filter.png`));

      await page.fill("#surface-search", "zzz-no-match");
      await page.waitForFunction(() => {
        const emptyState = document.querySelector("[data-empty-state]");
        return emptyState && getComputedStyle(emptyState).display !== "none";
      });
      const emptyReadback = await collectPageReadback(page, `${viewport.label}-no-match`);
      screenshots.push(await captureScreenshot(page, `${viewport.label}-no-match.png`));

      await page.fill("#surface-search", "");
      await page.locator("[data-row-id='resource-library']").click();
      await page.waitForFunction(() => document.querySelector("[data-detail-title]")?.textContent?.trim() === "Resource Library");
      const detailReadback = await collectPageReadback(page, `${viewport.label}-resource-detail`);
      screenshots.push(await captureScreenshot(page, `${viewport.label}-resource-detail.png`));

      viewportReadbacks.push(initialReadback, blockedReadback, emptyReadback, detailReadback);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const ok = pageErrors.length === 0
    && consoleErrors.length === 0
    && requestFailures.length === 0
    && viewportReadbacks.every((readback) => readback.ok);

  return {
    ok,
    captureMode: "no_server_playwright_file_url_aos_wide_product_design_package_runtime",
    staticTarget: "apps/web/static/aos-wide-product-design.html",
    browserEngine: "chromium",
    pageErrors,
    consoleErrors,
    requestFailures,
    screenshots,
    viewportReadbacks
  };
}

async function collectPageReadback(page, label) {
  const requiredRuntimeComponents = [
    "Badge",
    "Button",
    "DetailDrawer",
    "EvidenceStrip",
    "Field",
    "FilterBar",
    "GateReadinessPanel",
    "Heading",
    "KeyValueList",
    "LinkButton",
    "NavGroup",
    "NavItem",
    "ReadbackPanel",
    "SearchInput",
    "Select",
    "SideNav",
    "StateView",
    "StatusBadge",
    "Surface",
    "TableShell",
    "Text",
    "TopBar",
    "WorkIndex"
  ];
  const requiredRegions = requiredAosWideSelectors
    .map((selector) => selector.match(/data-region='([^']+)'/)?.[1])
    .filter(Boolean);

  return page.evaluate(({ label, requiredRegions, requiredRuntimeComponents, forbiddenAosWidePositiveCopy, productVisibleInternalTerms }) => {
    const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
    const surface = document.querySelector("[data-surface='aos-wide-product-design']");
    const lowerText = document.body.innerText.toLowerCase();
    const packageRuntimeComponents = Array.from(new Set(
      Array.from(document.querySelectorAll("[data-package-runtime-component]"))
        .map((element) => element.getAttribute("data-package-runtime-component"))
        .filter(Boolean)
    )).sort();
    const missingRuntimeComponents = requiredRuntimeComponents.filter((component) => !packageRuntimeComponents.includes(component));
    const markerOnlyComponents = Array.from(document.querySelectorAll("[data-tcrn-component]"))
      .filter((element) => !element.hasAttribute("data-package-runtime-component") && !element.hasAttribute("data-package-runtime-subcomponent"))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        component: element.getAttribute("data-tcrn-component")
      }));
    const idCounts = new Map();
    for (const element of Array.from(document.querySelectorAll("[id]"))) {
      idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1);
    }
    const duplicateIds = Array.from(idCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    const ariaReferenceFailures = [];
    for (const element of Array.from(document.querySelectorAll("[aria-describedby], [aria-labelledby]"))) {
      for (const attribute of ["aria-describedby", "aria-labelledby"]) {
        const ids = (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean);
        for (const id of ids) {
          const targetCount = idCounts.get(id) ?? 0;
          if (targetCount !== 1) {
            ariaReferenceFailures.push({ tag: element.tagName.toLowerCase(), attribute, id, targetCount });
          }
        }
      }
    }
    const disabledControlDescriptionFailures = [];
    const disabledControls = Array.from(new Set(Array.from(document.querySelectorAll("button:disabled, select:disabled, input:disabled, textarea:disabled, a[aria-disabled='true'], [aria-disabled='true']"))));
    for (const element of disabledControls) {
      const dataDisabledReason = element.getAttribute("data-disabled-reason")?.trim() ?? "";
      const title = element.getAttribute("title")?.trim() ?? "";
      const describedbyIds = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
      const targetCounts = describedbyIds.map((id) => ({ id, targetCount: idCounts.get(id) ?? 0 }));
      const resolvedText = normalizeText(describedbyIds
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" "));
      const failures = [];
      if (!dataDisabledReason) failures.push("disabled_control_missing_data_disabled_reason");
      if (!title) failures.push("disabled_control_missing_title_reason");
      if (describedbyIds.length === 0) failures.push("disabled_control_missing_aria_describedby");
      if (targetCounts.some(({ targetCount }) => targetCount !== 1)) failures.push("disabled_control_aria_target_count_not_one");
      if (!resolvedText) failures.push("disabled_control_description_unresolved");
      if (resolvedText && dataDisabledReason && normalizeText(resolvedText) !== normalizeText(dataDisabledReason)) {
        failures.push("disabled_control_description_mismatch");
      }
      if (failures.length > 0) {
        disabledControlDescriptionFailures.push({
          tag: element.tagName.toLowerCase(),
          label: normalizeText(element.textContent ?? ""),
          dataDisabledReason,
          titleReason: title,
          ariaDescribedBy: describedbyIds,
          targetCounts,
          resolvedText,
          failures
        });
      }
    }
    const regionProof = requiredRegions.map((region) => {
      const element = document.querySelector(`[data-region="${region}"]`);
      const rect = element?.getBoundingClientRect();
      return {
        region,
        present: Boolean(element),
        display: element ? getComputedStyle(element).display : "missing",
        rect: rect ? {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        } : null,
        scrollWidth: element?.scrollWidth ?? 0,
        clientWidth: element?.clientWidth ?? 0
      };
    });
    const bodyHorizontalOverflow = Math.ceil(document.body.scrollWidth) > window.innerWidth + 1
      || Math.ceil(document.documentElement.scrollWidth) > window.innerWidth + 1;
    const wideRegions = regionProof
      .filter((region) => region.present && region.rect && Math.ceil(region.rect.right) > window.innerWidth + 1)
      .map((region) => ({ region: region.region, right: region.rect.right, width: region.rect.width }));
    const surfaceIndex = document.querySelector("[data-region='surface-index']");
    const visibleRows = Array.from(document.querySelectorAll("[data-surface-row]"))
      .filter((row) => !row.hidden && getComputedStyle(row).display !== "none");
    const selectedDetail = document.querySelector("[data-detail-title]")?.textContent?.trim() ?? "";
    const emptyState = document.querySelector("[data-empty-state]");
    const targetPathLinks = Array.from(document.querySelectorAll("[data-region='target-path-readback'] a"))
      .map((link) => link.getAttribute("href") ?? "");
    const forbiddenHits = forbiddenAosWidePositiveCopy.filter((phrase) => lowerText.includes(phrase.toLowerCase()));
    const accessibilityText = Array.from(document.querySelectorAll("[aria-label], [title], [data-disabled-reason], [placeholder], [alt]"))
      .map((element) => [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-disabled-reason"),
        element.getAttribute("placeholder"),
        element.getAttribute("alt")
      ].filter(Boolean).join(" "))
      .join(" ");
    const productVisibleText = normalizeText(`${document.body.innerText} ${accessibilityText}`).toLowerCase();
    const productVisibleInternalHits = productVisibleInternalTerms.filter((term) => productVisibleText.includes(term));
    const sideNavReadability = (() => {
      const itemReadbacks = Array.from(document.querySelectorAll('[data-navigation-primitive="nav-item"]')).map((item) => {
        const iconCount = item.querySelectorAll("[data-icon-name]").length;
        const content = item.querySelector(".tcrn-nav-item__content");
        const labelElement = item.querySelector(".tcrn-nav-item__label");
        const contentRect = content?.getBoundingClientRect();
        const labelRect = labelElement?.getBoundingClientRect();
        const labelText = normalizeText(labelElement?.textContent ?? item.textContent ?? "");
        const failures = [];
        if (iconCount !== 1) failures.push("navitem_icon_count_not_one");
        if (!contentRect || contentRect.width < 72) failures.push("navitem_content_width_collapsed");
        if (labelText.length > 3 && (!labelRect || labelRect.width < 48)) failures.push("navitem_label_width_collapsed");
        return {
          label: labelText,
          iconCount,
          contentWidth: contentRect?.width ?? 0,
          labelWidth: labelRect?.width ?? 0,
          failures
        };
      });
      const failures = itemReadbacks.filter((item) => item.failures.length > 0);
      return {
        ok: itemReadbacks.length > 0 && failures.length === 0,
        itemCount: itemReadbacks.length,
        iconCount: itemReadbacks.reduce((count, item) => count + item.iconCount, 0),
        failures,
        minContentWidth: itemReadbacks.reduce((min, item) => Math.min(min, item.contentWidth), Number.POSITIVE_INFINITY)
      };
    })();
    const expectedVisibleRows = label.includes("blocked-filter") || label.includes("resource-detail")
      ? 4
      : label.includes("no-match")
        ? 0
        : 10;
    const expectedSelectedDetail = label.includes("resource-detail")
      ? "Resource Library"
      : label.includes("blocked-filter")
        ? "Gate Queue"
        : "Project Dashboard";
    const denseTableOverflowContained = Boolean(surfaceIndex)
      && getComputedStyle(surfaceIndex).overflowX === "auto"
      && surfaceIndex.scrollWidth >= surfaceIndex.clientWidth;
    const targetPathOk = [
      "apps/web/static/operations-cockpit.html",
      "apps/web/static/docs-search-release-readiness.html",
      "apps/web/static/aos-wide-product-design.html"
    ].every((path) => targetPathLinks.some((href) => href.includes(path.split("/").pop() ?? path)));
    const ok = Boolean(surface)
      && surface?.getAttribute("data-package-backed-react-runtime-rendering") === "true"
      && surface?.getAttribute("data-aos-wide-product-design-accepted") === "false"
      && missingRuntimeComponents.length === 0
      && markerOnlyComponents.length === 0
      && duplicateIds.length === 0
      && ariaReferenceFailures.length === 0
      && disabledControlDescriptionFailures.length === 0
      && regionProof.every((region) => region.present)
      && wideRegions.length === 0
      && sideNavReadability.ok
      && !bodyHorizontalOverflow
      && denseTableOverflowContained
      && targetPathOk
      && visibleRows.length === expectedVisibleRows
      && selectedDetail === expectedSelectedDetail
      && (label.includes("no-match") ? emptyState && getComputedStyle(emptyState).display !== "none" : true)
      && forbiddenHits.length === 0
      && productVisibleInternalHits.length === 0;
    return {
      ok,
      label,
      packageRuntimeComponents,
      missingRuntimeComponents,
      markerOnlyComponents,
      duplicateIds,
      ariaReferenceFailures,
      disabledControlDescriptionFailures,
      disabledControlsCount: disabledControls.length,
      disabledControlsWithReasonCount: disabledControls.filter((element) => element.getAttribute("data-disabled-reason")?.trim()).length,
      bodyHorizontalOverflow,
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      sideNavReadability,
      wideRegions,
      denseTableOverflowContained,
      surfaceIndexScrollWidth: surfaceIndex?.scrollWidth ?? 0,
      surfaceIndexClientWidth: surfaceIndex?.clientWidth ?? 0,
      targetPathLinks,
      targetPathOk,
      regionProof,
      visibleRows: visibleRows.length,
      expectedVisibleRows,
      selectedDetail,
      expectedSelectedDetail,
      emptyStateVisible: emptyState ? getComputedStyle(emptyState).display !== "none" : false,
      forbiddenHits,
      productVisibleInternalHits
    };
  }, { label, requiredRegions, requiredRuntimeComponents, forbiddenAosWidePositiveCopy, productVisibleInternalTerms });
}

function inspectProductVisibleCopy(html) {
  const text = productVisibleAndA11yText(html).toLowerCase();
  const hits = productVisibleInternalTerms.filter((term) => text.includes(term));
  return {
    ok: hits.length === 0,
    hits,
    scannedTextLength: text.length
  };
}

function productVisibleAndA11yText(html) {
  const attributeText = Array.from(html.matchAll(/\s(?:aria-label|title|data-disabled-reason|placeholder|alt)="([^"]*)"/g))
    .map((match) => match[1])
    .join(" ");
  return `${visibleText(html)} ${attributeText}`
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function captureScreenshot(page, fileName) {
  const path = join(browserEvidenceDir, fileName);
  await page.screenshot({ path, fullPage: true });
  const body = readFileSync(path);
  return {
    file: relative(repoRoot, path),
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: body.length
  };
}

function inspectSourceContentDigest() {
  const sourcePaths = [
    "apps/web/src/aos-wide-product-design-data.ts",
    "apps/web/src/aos-wide-product-design-ui-react-runtime.ts",
    "apps/web/src/aos-wide-product-design-view.ts",
    "apps/web/test/aos-wide-product-design-view.test.mjs",
    "scripts/aos-design-system-package-runtime-proof.mjs",
    "scripts/aos-design-system-component-registry-proof.mjs",
    "scripts/slice-10-aos-wide-product-design-proof.mjs"
  ];
  const digestInput = sourcePaths
    .map((sourcePath) => `${sourcePath}\0${readFileSync(join(repoRoot, sourcePath), "utf8")}`)
    .join("\0");
  return {
    ok: true,
    strategy: "source_content_digest_for_mutating_aos_wide_browser_receipts",
    sourceHeadAtProofRun: sourceHead,
    exactFinalCommitHeadRequired: false,
    sourceContentDigest: createHash("sha256").update(digestInput).digest("hex"),
    sourcePaths
  };
}

function markdownReceipt(summary) {
  const artifacts = summary.browserReadback.screenshots
    .map((screenshot) => `- \`${screenshot.file}\` sha256 \`${screenshot.sha256}\``)
    .join("\n");
  return `# Slice 10 AOS-Wide Product Design Surface Set Proof\n\n`
    + `Status: ${summary.ok ? "observed local proof receipt" : "failed local proof receipt"}\n\n`
    + `## Checkpoint Identity\n\n`
    + `- Route: \`${summary.route}\`\n`
    + `- Source head at proof run: \`${summary.sourceHead}\`\n`
    + `- Workflow packet basis: \`${summary.checkpoint.workflowPacketBasis}\`\n`
    + `- Pre-implementation basis: \`${summary.checkpoint.preImplementationBasis}\`\n`
    + `- Static target: \`${summary.staticRender.path}\`\n`
    + `- Static target SHA-256: \`${summary.staticRender.sha256}\`\n`
    + `- Source freshness strategy: \`${summary.sourceFreshnessReadback.strategy}\`\n`
    + `- Source content digest: \`${summary.sourceFreshnessReadback.sourceContentDigest}\`\n`
    + `- Product Design status field: \`${summary.staticRender.productDesignStatus}\`\n\n`
    + `## Package Runtime Readback\n\n`
    + `- AOS-wide package runtime: true\n`
    + `- Target-set rows: ${summary.surfaceReadiness.count}\n`
    + `- Required regions present: ${summary.staticRender.selectorProof.filter((item) => item.present).length}/${summary.staticRender.selectorProof.length}\n`
    + `- Forbidden positive-copy hits: ${summary.copyScan.forbiddenHits.length}\n`
    + `- Product Design accepted: ${summary.requiredState.aosWideProductDesignAccepted}\n`
    + `- Product acceptance: ${summary.requiredState.productAcceptance}\n`
    + `- Final MVP acceptance: ${summary.requiredState.finalMvpAcceptance}\n\n`
    + `## No-Server Browser Evidence\n\n`
    + `- Browser proof ok: ${summary.browserReadback.ok}\n`
    + `- Capture mode: ${summary.browserReadback.captureMode}\n`
    + `- Page errors: ${summary.browserReadback.pageErrors.length}\n`
    + `- Console errors: ${summary.browserReadback.consoleErrors.length}\n`
    + `- Request failures: ${summary.browserReadback.requestFailures.length}\n`
    + `- Viewport readbacks: ${summary.browserReadback.viewportReadbacks.length}\n`
    + `- Duplicate id failures: ${summary.browserReadback.viewportReadbacks.reduce((count, readback) => count + readback.duplicateIds.length, 0)}\n`
    + `- ARIA reference failures: ${summary.browserReadback.viewportReadbacks.reduce((count, readback) => count + readback.ariaReferenceFailures.length, 0)}\n`
    + `- Disabled-description failures: ${summary.browserReadback.viewportReadbacks.reduce((count, readback) => count + readback.disabledControlDescriptionFailures.length, 0)}\n\n`
    + `Retained artifacts:\n\n${artifacts}\n\n`
    + `## No-Overclaim Boundaries\n\n`
    + `AOS-wide Product Design acceptance, product UI acceptance, product acceptance, final MVP acceptance, docs export/publication, canonical promotion, GitHub/CI mutation, release creation, deployment, live dispatch, Owner Intent execution, public/legal/dependency-clean readiness, and Codex Security completion remain unclaimed.\n`;
}
