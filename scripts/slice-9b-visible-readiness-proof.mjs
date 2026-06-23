import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createSlice9bDocsSearchReleaseReadModel,
  forbiddenDocsReadinessCopy,
  renderDocsSearchReleaseReadinessHtml,
  requiredDocsReadinessSelectors,
  slice9bPreImplementationBasis,
  slice9bWorkflowPacketBasis
} from "../dist/apps/web/src/docs-readiness-view.js";

const repoRoot = process.cwd();
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkCurrentSource = process.argv.includes("--check-current-source");
const model = createSlice9bDocsSearchReleaseReadModel();
const html = renderDocsSearchReleaseReadinessHtml(model);
const staticPath = join(repoRoot, "apps/web/static/docs-search-release-readiness.html");
const browserEvidenceRoot = join(repoRoot, "evidence", "slice-9b-visible-readiness-browser");
const browserEvidenceDir = join(browserEvidenceRoot, sourceHead);
const browserSummaryPath = join(browserEvidenceDir, "browser-evidence-summary.json");
const stableBrowserSummaryPath = join(browserEvidenceRoot, "browser-evidence-summary.json");
const markdownPath = join(repoRoot, "evidence", "slice-9b-visible-readiness-inspection-proof.md");
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "mobile-390x844", width: 390, height: 844 }
];
const requiredRuntimeComponents = [
  "Badge",
  "Button",
  "DetailDrawer",
  "EvidenceStrip",
  "Field",
  "FilterBar",
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

const sourceFreshnessReadback = inspectSourceContentDigest();

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(stableBrowserSummaryPath, "utf8"));
  const retainedDigest = retained.sourceFreshnessReadback?.sourceContentDigest;
  const retainedStrategy = retained.sourceFreshnessReadback?.strategy;
  const ok = retainedDigest === sourceFreshnessReadback.sourceContentDigest
    && retainedStrategy === sourceFreshnessReadback.strategy
    && retained.ok === true;
  const result = {
    ok,
    command: "node scripts/slice-9b-visible-readiness-proof.mjs --check-current-source",
    retainedSummaryPath: "evidence/slice-9b-visible-readiness-browser/browser-evidence-summary.json",
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

await mkdir(dirname(staticPath), { recursive: true });
await mkdir(browserEvidenceDir, { recursive: true });
await writeFile(staticPath, html);

const selectorProof = requiredDocsReadinessSelectors.map((selector) => {
  const dataRegion = selector.match(/data-region='([^']+)'/)?.[1];
  const present = dataRegion ? html.includes(`data-region="${dataRegion}"`) : false;
  return { selector, present };
});
const forbiddenHits = forbiddenDocsReadinessCopy.filter((phrase) => html.toLowerCase().includes(phrase.toLowerCase()));
const productVisibleCopyReadback = inspectProductVisibleCopy(html);
const htmlDigest = createHash("sha256").update(html).digest("hex");
const docsReadinessRuntimeReadback = inspectDocsReadinessRuntime(html);
const noExecutionClaims = {
  docsPublished: model.docsReadiness.docsPublished,
  rawSourceIndexed: model.searchIndex.rawSourceIndexed,
  githubWriteExecuted: model.githubMetadata.githubWriteExecuted,
  releaseCreated: model.releaseCandidate.releaseCreated,
  ciStatusMutated: model.prCiReadiness.ciStatusMutated,
  deploymentExecuted: model.releaseCandidate.deploymentExecuted,
  productAccepted: model.releaseCandidate.productAccepted,
  finalMvpAccepted: model.releaseCandidate.finalMvpAccepted
};
const browserReadback = await runBrowserProof();
const ok = slice9bWorkflowPacketBasis === "624127182da417f65c790de155e3297e77828181"
  && slice9bPreImplementationBasis === "9d7980f46245bb783b520c9f90945da8609c01ce"
  && model.context.docsSearchReleaseSurfacesVisible === true
  && selectorProof.every((item) => item.present)
  && forbiddenHits.length === 0
  && productVisibleCopyReadback.ok
  && Object.values(noExecutionClaims).every((value) => value === false)
  && docsReadinessRuntimeReadback.ok
  && browserReadback.ok
  && html.includes("id=\"readiness-search\"")
  && html.includes("data-empty-state")
  && html.includes("Drafts stay local")
  && html.includes("Release actions disabled")
  && html.includes("Review state visible");

const summary = {
  ok,
  route: "route_tcrn_aos_design_system_frontend_rebuild_59aw_docs_readiness_package_runtime_adoption_implementation",
  sourceHead,
  checkpoint: {
    workflowPacketBasis: slice9bWorkflowPacketBasis,
    preImplementationBasis: slice9bPreImplementationBasis,
    localCheckpoint: model.context.localCheckpoint
  },
  staticRender: {
    path: "apps/web/static/docs-search-release-readiness.html",
    bytes: Buffer.byteLength(html),
    sha256: htmlDigest,
    docsSearchReleaseSurfacesVisible: model.context.docsSearchReleaseSurfacesVisible,
    selectorProof
  },
  sourceFreshnessReadback,
  docsReadinessRuntimeReadback,
  browserReadback,
  readModel: {
    rowCount: model.rows.length,
    storyScope: model.rows.map((row) => row.storyId),
    docsReadiness: model.aggregateIndex.docsReadinessRecordIds.length,
    searchIndexRecords: model.aggregateIndex.searchIndexRecordIds.length,
    githubMetadata: model.aggregateIndex.githubMetadataIds.length,
    prCiReadiness: model.aggregateIndex.prCiReadinessIds.length,
    releaseCandidates: model.aggregateIndex.releaseCandidateIds.length,
    blockedReadiness: model.aggregateIndex.blockedReadinessIds.length,
    blockedReleaseCandidates: model.aggregateIndex.blockedReleaseCandidateIds.length
  },
  copyScan: {
    forbiddenHits,
    productVisibleInternalHits: productVisibleCopyReadback.hits,
    productionSurfaceOnly: true
  },
  noExecutionClaims,
  noOverclaim: {
    docsPublication: model.noClaims.docsPublication,
    docsExport: model.noClaims.docsExport,
    canonicalPromotion: model.noClaims.canonicalPromotion,
    githubMutation: model.noClaims.githubMutation,
    releaseCreation: model.noClaims.releaseCreation,
    ciMutation: model.noClaims.ciMutation,
    deployment: model.noClaims.deployment,
    liveCodexDispatch: model.noClaims.liveCodexDispatch,
    productDesignFinalAcceptance: model.noClaims.productDesignFinalAcceptance,
    browserAcceptanceCloseout: model.noClaims.browserAcceptanceCloseout,
    productAcceptance: model.noClaims.productAcceptance,
    finalMvpAcceptance: model.noClaims.finalMvpAcceptance
  },
  evidenceReadback: model.evidencePanel
};

await writeFile(browserSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(stableBrowserSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(markdownPath, markdownReceipt(summary));
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
  const viewportReadbacks = [];
  const screenshots = [];
  const staticUrl = pathToFileURL(staticPath).href;

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
      await page.waitForSelector("[data-surface='docs-search-release-readiness']");
      const initialReadback = await collectPageReadback(page, `${viewport.label}-initial`);
      const initialScreenshot = await captureScreenshot(page, `${viewport.label}-initial.png`);
      screenshots.push(initialScreenshot);

      if (viewport.label.startsWith("desktop")) {
        await page.fill("#readiness-search", "github");
        await clickFirstVisibleReadinessRow(page);
        const githubReadback = await collectPageReadback(page, `${viewport.label}-search-github`);
        const githubScreenshot = await captureScreenshot(page, `${viewport.label}-search-github.png`);
        screenshots.push(githubScreenshot);
        await page.fill("#readiness-search", "zzz-no-match");
        const emptyReadback = await collectPageReadback(page, `${viewport.label}-search-empty`);
        const emptyScreenshot = await captureScreenshot(page, `${viewport.label}-search-empty.png`);
        screenshots.push(emptyScreenshot);
        viewportReadbacks.push(initialReadback, githubReadback, emptyReadback);
      } else {
        await page.fill("#readiness-search", "AOS-S063");
        await clickFirstVisibleReadinessRow(page);
        const candidateReadback = await collectPageReadback(page, `${viewport.label}-search-candidate`);
        const candidateScreenshot = await captureScreenshot(page, `${viewport.label}-search-candidate.png`);
        screenshots.push(candidateScreenshot);
        viewportReadbacks.push(initialReadback, candidateReadback);
      }
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
    captureMode: "no_server_playwright_file_url_package_runtime_docs_readiness",
    staticTarget: "apps/web/static/docs-search-release-readiness.html",
    browserEngine: "chromium",
    pageErrors,
    consoleErrors,
    requestFailures,
    screenshots,
    viewportReadbacks
  };
}

async function clickFirstVisibleReadinessRow(page) {
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll("[data-readiness-row]"))
      .some((row) => !row.hidden && getComputedStyle(row).display !== "none");
  });
  await page.locator("[data-readiness-row]:not([hidden])").first().click();
}

async function collectPageReadback(page, label) {
  return page.evaluate(({ label, requiredRuntimeComponents, forbiddenDocsReadinessCopy, productVisibleInternalTerms }) => {
    const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
    const surface = document.querySelector("[data-surface='docs-search-release-readiness']");
    const text = document.body.innerText;
    const lowerText = text.toLowerCase();
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
    const idElements = Array.from(document.querySelectorAll("[id]"));
    const idCounts = new Map();
    for (const element of idElements) {
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
    const disabledControls = Array.from(document.querySelectorAll("button:disabled, [aria-disabled='true']"));
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
    const requiredRegions = [
      "docs-surface-shell",
      "brand-lockup",
      "header-claim-strip",
      "docs-readiness-board",
      "search-inspection",
      "github-prci-linkage",
      "release-candidate-linkage",
      "evidence-readback-panel",
      "detail-panel"
    ];
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
    const wideRegions = regionProof
      .filter((region) => region.present && region.rect && Math.ceil(region.rect.right) > window.innerWidth + 1)
      .map((region) => ({ region: region.region, right: region.rect.right, width: region.rect.width }));
    const visibleRows = Array.from(document.querySelectorAll("[data-readiness-row]"))
      .filter((row) => !row.hidden && getComputedStyle(row).display !== "none");
    const selectedDetail = document.querySelector("[data-detail-title]")?.textContent?.trim() ?? "";
    const expectedSelectedDetail = label.includes("search-github")
      ? "TCRN-AOS-local"
      : label.includes("search-candidate")
        ? "local-release-candidate"
        : label.includes("initial")
          ? "Release note draft"
          : "";
    const emptyState = document.querySelector("[data-empty-state]");
    const forbiddenHits = forbiddenDocsReadinessCopy.filter((phrase) => lowerText.includes(phrase.toLowerCase()));
    const accessibilityText = Array.from(document.querySelectorAll("[aria-label], [title], [data-disabled-reason], [placeholder], [alt]"))
      .map((element) => [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-disabled-reason"),
        element.getAttribute("placeholder"),
        element.getAttribute("alt")
      ].filter(Boolean).join(" "))
      .join(" ");
    const productVisibleText = normalizeText(`${text} ${accessibilityText}`).toLowerCase();
    const productVisibleInternalHits = productVisibleInternalTerms.filter((term) => productVisibleText.includes(term));
    const bodyHorizontalOverflow = Math.ceil(document.body.scrollWidth) > window.innerWidth + 1
      || Math.ceil(document.documentElement.scrollWidth) > window.innerWidth + 1;
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
    const ok = Boolean(surface)
      && surface?.getAttribute("data-package-backed-react-runtime-rendering") === "true"
      && missingRuntimeComponents.length === 0
      && markerOnlyComponents.length === 0
      && duplicateIds.length === 0
      && ariaReferenceFailures.length === 0
      && disabledControlDescriptionFailures.length === 0
      && regionProof.every((region) => region.present)
      && wideRegions.length === 0
      && forbiddenHits.length === 0
      && productVisibleInternalHits.length === 0
      && sideNavReadability.ok
      && selectedDetail.length > 0
      && (!expectedSelectedDetail || selectedDetail === expectedSelectedDetail)
      && !bodyHorizontalOverflow;
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
      docsSearchReleaseSurfacesVisible: surface?.getAttribute("data-docs-search-release-surfaces-visible") === "true",
      bodyHorizontalOverflow,
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      sideNavReadability,
      wideRegions,
      regionProof,
      visibleRows: visibleRows.length,
      selectedDetail,
      expectedSelectedDetail,
      emptyStateVisible: emptyState ? getComputedStyle(emptyState).display !== "none" : false,
      forbiddenHits,
      productVisibleInternalHits
    };
  }, { label, requiredRuntimeComponents, forbiddenDocsReadinessCopy, productVisibleInternalTerms });
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
  const body = await readFile(path);
  return {
    file: relative(repoRoot, path),
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: body.length
  };
}

function inspectDocsReadinessRuntime(html) {
  const packageRuntimeComponents = Array.from(new Set(
    Array.from(html.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const missingRuntimeComponents = requiredRuntimeComponents.filter((component) => !packageRuntimeComponents.includes(component));
  const markerOnlyComponents = Array.from(html.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)(?![^>]*data-package-runtime-subcomponent=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));
  const disabledNavItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")(?=[^>]*aria-disabled="true")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({ attributes: match[1], body: match[2], parsed: parseAttributes(match[1]) }));
  const disabledNavItemFailures = [];
  for (const item of disabledNavItems) {
    const failures = [];
    if (/\shref=/.test(item.attributes)) failures.push("disabled_navitem_has_href");
    if (item.parsed.tabindex !== "-1") failures.push("disabled_navitem_missing_tabindex_minus_1");
    if (!item.parsed.title?.trim()) failures.push("disabled_navitem_missing_title");
    if (!item.parsed["data-disabled-reason"]?.trim()) failures.push("disabled_navitem_missing_data_disabled_reason");
    if (!item.parsed["aria-describedby"]?.trim()) failures.push("disabled_navitem_missing_aria_describedby");
    if (!item.body.includes("tcrn-nav-item__disabled-reason")) failures.push("disabled_navitem_visible_reason_missing");
    if (failures.length > 0) disabledNavItemFailures.push({ label: stripTags(item.body).replace(/\s+/g, " ").trim(), failures });
  }
  const forbiddenRuntimeHits = [
    "docs published",
    "github write enabled",
    "ci mutation complete",
    "canonical promotion complete",
    "release ready",
    "release created",
    "product accepted",
    "final mvp accepted"
  ].filter((phrase) => html.toLowerCase().includes(phrase));
  return {
    ok: missingRuntimeComponents.length === 0
      && markerOnlyComponents.length === 0
      && disabledNavItems.length === 4
      && disabledNavItemFailures.length === 0
      && forbiddenRuntimeHits.length === 0
      && html.includes('data-package-runtime-subcomponent="SearchInput.control"')
      && !html.includes('data-package-runtime-component="Input"'),
    packageRuntimeComponents,
    missingRuntimeComponents,
    markerOnlyComponents,
    disabledNavItemCount: disabledNavItems.length,
    disabledNavItemFailures,
    searchInputControlDisposition: "internal_subcomponent_not_separate_package_runtime_scope",
    forbiddenRuntimeHits
  };
}

function parseAttributes(attributes) {
  return Object.fromEntries(
    Array.from(attributes.matchAll(/\s([a-zA-Z0-9:-]+)(?:="([^"]*)")?/g)).map((match) => [match[1].toLowerCase(), match[2] ?? "true"])
  );
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function inspectSourceContentDigest() {
  const sourcePaths = [
    "apps/web/src/docs-readiness-ui-react-runtime.ts",
    "apps/web/src/docs-readiness-view.ts",
    "apps/web/test/docs-readiness-view.test.mjs",
    "scripts/aos-design-system-package-runtime-proof.mjs",
    "scripts/aos-design-system-component-registry-proof.mjs",
    "scripts/slice-9b-visible-readiness-proof.mjs"
  ];
  const digestInput = sourcePaths
    .map((sourcePath) => `${sourcePath}\0${readFileSync(join(repoRoot, sourcePath), "utf8")}`)
    .join("\0");
  return {
    ok: true,
    strategy: "source_content_digest_for_mutating_docs_readiness_browser_receipts",
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
  return `# Slice 9B Docs Search Release Visible Readiness Inspection Proof\n\n`
    + `Status: ${summary.ok ? "observed local proof receipt" : "failed local proof receipt"}\n\n`
    + `## Checkpoint Identity\n\n`
    + `- Source head at proof run: \`${summary.sourceHead}\`\n`
    + `- Workflow packet basis: \`${summary.checkpoint.workflowPacketBasis}\`\n`
    + `- Pre-implementation basis: \`${summary.checkpoint.preImplementationBasis}\`\n`
    + `- Static target: \`${summary.staticRender.path}\`\n`
    + `- Source content digest: \`${summary.sourceFreshnessReadback.sourceContentDigest}\`\n`
    + `- Product-local proof command: \`pnpm slice9b:proof\`\n\n`
    + `## Package Runtime Readback\n\n`
    + `- Docs Readiness package runtime components: ${summary.docsReadinessRuntimeReadback.packageRuntimeComponents.join(", ")}\n`
    + `- Missing runtime components: ${summary.docsReadinessRuntimeReadback.missingRuntimeComponents.length}\n`
    + `- Marker-only package component claims: ${summary.docsReadinessRuntimeReadback.markerOnlyComponents.length}\n`
    + `- Disabled package NavItems with reasons: ${summary.docsReadinessRuntimeReadback.disabledNavItemCount}\n`
    + `- SearchInput control disposition: ${summary.docsReadinessRuntimeReadback.searchInputControlDisposition}\n\n`
    + `## No-Server Browser Evidence\n\n`
    + `- Browser proof ok: ${summary.browserReadback.ok}\n`
    + `- Capture mode: ${summary.browserReadback.captureMode}\n`
    + `- Page errors: ${summary.browserReadback.pageErrors.length}\n`
    + `- Console errors: ${summary.browserReadback.consoleErrors.length}\n`
    + `- Request failures: ${summary.browserReadback.requestFailures.length}\n`
    + `- Viewport readbacks: ${summary.browserReadback.viewportReadbacks.length}\n\n`
    + `Retained artifacts:\n\n${artifacts}\n\n`
    + `## No-Overclaim Boundaries\n\n`
    + `Docs publication, docs export, canonical promotion, GitHub mutation, release creation, CI mutation, deployment, live Codex dispatch, Product Design final acceptance, browser acceptance closeout, product acceptance, and final MVP acceptance remain false. This is local Docs Readiness package-runtime evidence only.\n`;
}
