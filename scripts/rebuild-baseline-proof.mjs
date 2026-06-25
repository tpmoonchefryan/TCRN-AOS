import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  forbiddenRebuildBaselineVisibleCopy,
  rebuildBaselineRoutes,
  renderRebuildBaselineHtml,
  requiredRebuildBaselineSelectors
} from "../dist/apps/web/src/rebuild-baseline-view.js";

const repoRoot = process.cwd();
const route = "route_tcrn_aos_storybook_first_rebuild_reset_after_owner_direction_clarification";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkCurrentSource = process.argv.includes("--check-current-source");
const evidenceRoot = join(repoRoot, "evidence", "rebuild-baseline-browser");
const evidenceDir = join(evidenceRoot, sourceHead);
const summaryPath = join(evidenceDir, "browser-evidence-summary.json");
const latestSummaryPath = join(evidenceRoot, "browser-evidence-summary.json");
const markdownPath = join(repoRoot, "evidence", "rebuild-baseline-proof.md");
const sourceFreshnessReadback = inspectSourceContentDigest();
const staticTargets = rebuildBaselineRoutes.map((routePath) => ({
  routePath,
  filePath: join(repoRoot, "apps/web/static", routePath.replace(/^.*\//, ""))
}));
const fallbackRoutePath = "/";
const fallbackProofPath = join(evidenceDir, "rebuild-baseline-root.html");
const browserProofTarget = staticTargets[0] ?? {
  routePath: fallbackRoutePath,
  filePath: fallbackProofPath,
  generatedForProofOnly: true
};
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900, minNavLabelWidth: 120, checklistMode: "desktop", minChecklistRowWidth: 880 },
  { label: "mobile-390x844", width: 390, height: 844, minNavLabelWidth: 100, checklistMode: "mobile", minChecklistRowWidth: 0 }
];

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(latestSummaryPath, "utf8"));
  const ok = retained.ok === true
    && retained.sourceFreshnessReadback?.sourceContentDigest === sourceFreshnessReadback.sourceContentDigest;
  const result = {
    ok,
    route,
    command: "node scripts/rebuild-baseline-proof.mjs --check-current-source",
    sourceHead,
    retainedSummaryPath: relative(repoRoot, latestSummaryPath),
    retainedDigest: retained.sourceFreshnessReadback?.sourceContentDigest,
    currentDigest: sourceFreshnessReadback.sourceContentDigest
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
  process.exit(0);
}

mkdirSync(evidenceDir, { recursive: true });
for (const target of staticTargets) {
  mkdirSync(dirname(target.filePath), { recursive: true });
  writeFileSync(target.filePath, renderRebuildBaselineHtml(target.routePath));
}
if (staticTargets.length === 0) {
  writeFileSync(browserProofTarget.filePath, renderRebuildBaselineHtml(fallbackRoutePath));
}

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
    page.on("requestfailed", (request) => requestFailures.push(`${viewport.label}: ${request.url()} ${request.failure()?.errorText ?? "request_failed"}`));

    await page.goto(pathToFileURL(browserProofTarget.filePath).href, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-surface='aos-rebuild-workspace']");
    const screenshotPath = join(evidenceDir, `rebuild-baseline-${viewport.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBytes = readFileSync(screenshotPath);
    const domReadback = await page.evaluate((args) => {
      const selectorProof = args.requiredSelectors.map((selector) => ({ selector, present: Boolean(document.querySelector(selector)) }));
      const ids = Array.from(document.querySelectorAll("[id]")).map((node) => node.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      const ariaReferenceFailures = [];
      for (const node of Array.from(document.querySelectorAll("[aria-describedby], [aria-labelledby]"))) {
        for (const attr of ["aria-describedby", "aria-labelledby"]) {
          const raw = node.getAttribute(attr);
          if (!raw) continue;
          for (const id of raw.split(/\s+/).filter(Boolean)) {
            const count = document.querySelectorAll(`#${CSS.escape(id)}`).length;
            if (count !== 1) ariaReferenceFailures.push({ attr, id, count, html: node.outerHTML.slice(0, 220) });
          }
        }
      }
      const disabledControls = Array.from(document.querySelectorAll("button:disabled, select:disabled, input:disabled, textarea:disabled, a[aria-disabled='true'], [aria-disabled='true']"));
      const disabledFailures = [];
      for (const control of disabledControls) {
        const reason = control.getAttribute("data-disabled-reason")?.trim() ?? "";
        const title = control.getAttribute("title")?.trim() ?? "";
        const describedby = control.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ?? [];
        const resolved = describedby.map((id) => document.getElementById(id)?.textContent?.trim() ?? "").filter(Boolean).join(" ");
        if (!reason || !title || describedby.length !== 1 || resolved !== reason || title !== reason) {
          disabledFailures.push({ reason, title, describedby, resolved, html: control.outerHTML.slice(0, 260) });
        }
      }
      const packageComponents = Array.from(new Set(Array.from(document.querySelectorAll("[data-package-runtime-component]")).map((node) => node.getAttribute("data-package-runtime-component")))).sort();
      const markerOnlyComponents = Array.from(document.querySelectorAll("[data-tcrn-component]"))
        .filter((node) => !node.hasAttribute("data-package-runtime-component") && !node.hasAttribute("data-package-runtime-subcomponent"))
        .map((node) => node.getAttribute("data-tcrn-component"));
      const checklistTable = document.querySelector("[data-region='rebuild-checklist'] .tcrn-table-shell");
      const checklistHead = checklistTable?.querySelector(".tcrn-table-shell__head") ?? null;
      const checklistRows = Array.from(checklistTable?.querySelectorAll(".tcrn-table-shell__row") ?? []);
      const firstChecklistRow = checklistRows[0] ?? null;
      const checklistCells = Array.from(firstChecklistRow?.querySelectorAll(".tcrn-table-shell__cell") ?? []);
      const checklistReadback = checklistTable ? {
        tableWidth: Math.round(checklistTable.getBoundingClientRect().width),
        tableScrollWidth: checklistTable.scrollWidth,
        headDisplay: checklistHead ? getComputedStyle(checklistHead).display : null,
        rowDisplay: firstChecklistRow ? getComputedStyle(firstChecklistRow).display : null,
        headCellCount: checklistHead ? checklistHead.querySelectorAll("[role='columnheader']").length : 0,
        rowCount: checklistRows.length,
        cellCount: checklistCells.length,
        cellDisplays: checklistCells.map((cell) => getComputedStyle(cell).display),
        cellRects: checklistCells.map((cell) => {
          const rect = cell.getBoundingClientRect();
          return {
            label: cell.getAttribute("data-label") ?? "",
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
      } : null;
      const checklistDistinctXCount = checklistReadback ? new Set(checklistReadback.cellRects.map((cell) => cell.x)).size : 0;
      const checklistDistinctYCount = checklistReadback ? new Set(checklistReadback.cellRects.map((cell) => cell.y)).size : 0;
      const checklistReadabilityFailures = [];
      if (!checklistReadback) {
        checklistReadabilityFailures.push("missing_checklist_table");
      } else {
        if (checklistReadback.headCellCount !== 4) checklistReadabilityFailures.push(`unexpected_head_cell_count:${checklistReadback.headCellCount}`);
        if (checklistReadback.cellCount !== 4) checklistReadabilityFailures.push(`unexpected_row_cell_count:${checklistReadback.cellCount}`);
        if (checklistReadback.rowCount < 10) checklistReadabilityFailures.push(`unexpected_row_count:${checklistReadback.rowCount}`);
        if (args.checklistMode === "desktop") {
          if (checklistReadback.headDisplay !== "grid") checklistReadabilityFailures.push(`desktop_head_display:${checklistReadback.headDisplay ?? "missing"}`);
          if (checklistReadback.rowDisplay !== "grid") checklistReadabilityFailures.push(`desktop_row_display:${checklistReadback.rowDisplay ?? "missing"}`);
          if (checklistReadback.tableScrollWidth < args.minChecklistRowWidth) checklistReadabilityFailures.push(`desktop_table_width:${checklistReadback.tableScrollWidth}`);
          if (!checklistReadback.cellDisplays.every((display) => display === "flex")) checklistReadabilityFailures.push(`desktop_cell_displays:${checklistReadback.cellDisplays.join(",")}`);
          if (checklistDistinctXCount !== 4) checklistReadabilityFailures.push(`desktop_distinct_x_count:${checklistDistinctXCount}`);
        } else {
          if (checklistReadback.headDisplay !== "none") checklistReadabilityFailures.push(`mobile_head_display:${checklistReadback.headDisplay ?? "missing"}`);
          if (checklistReadback.rowDisplay !== "grid") checklistReadabilityFailures.push(`mobile_row_display:${checklistReadback.rowDisplay ?? "missing"}`);
          if (!checklistReadback.cellDisplays.every((display) => display === "grid")) checklistReadabilityFailures.push(`mobile_cell_displays:${checklistReadback.cellDisplays.join(",")}`);
          if (checklistDistinctYCount !== 4) checklistReadabilityFailures.push(`mobile_distinct_y_count:${checklistDistinctYCount}`);
        }
      }
      const navItems = Array.from(document.querySelectorAll("[data-package-runtime-component='NavItem']"));
      const navIconlessCount = navItems.filter((item) => !item.querySelector(".tcrn-icon")).length;
      const navReadabilityFailures = navItems.map((item) => {
        const label = item.querySelector(".tcrn-nav-item__label");
        const content = item.querySelector(".tcrn-nav-item__content");
        return {
          label: label?.textContent?.trim() ?? "",
          contentWidth: content ? Math.round(content.getBoundingClientRect().width) : 0,
          labelHeight: label ? Math.round(label.getBoundingClientRect().height) : 0
        };
      }).filter((item) => item.contentWidth < args.minNavLabelWidth || item.labelHeight > 42);
      const accessibilityText = [
        ...Array.from(document.querySelectorAll("[aria-label]")).map((node) => node.getAttribute("aria-label") ?? ""),
        ...Array.from(document.querySelectorAll("[title]")).map((node) => node.getAttribute("title") ?? ""),
        ...Array.from(document.querySelectorAll("[data-disabled-reason]")).map((node) => node.getAttribute("data-disabled-reason") ?? "")
      ].join(" ");
      const visibleText = `${document.body.innerText} ${accessibilityText}`.toLowerCase();
      const forbiddenVisibleHits = args.forbiddenTerms.filter((term) => visibleText.includes(term.toLowerCase()));
      const bodyHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      const nonblank = document.body.innerText.trim().length > 700 && document.querySelectorAll("[data-package-runtime-component]").length >= 12;

      return {
        selectorProof,
        duplicateIds: Array.from(new Set(duplicateIds)),
        ariaReferenceFailures,
        disabledControlsCount: disabledControls.length,
        disabledFailures,
        packageComponents,
        markerOnlyComponents,
        checklistReadback,
        checklistReadabilityFailures,
        navItemCount: navItems.length,
        navIconlessCount,
        navReadabilityFailures,
        forbiddenVisibleHits,
        bodyHorizontalOverflow,
        nonblank
      };
    }, {
      requiredSelectors: [...requiredRebuildBaselineSelectors],
      forbiddenTerms: [...forbiddenRebuildBaselineVisibleCopy],
      minNavLabelWidth: viewport.minNavLabelWidth,
      checklistMode: viewport.checklistMode,
      minChecklistRowWidth: viewport.minChecklistRowWidth
    });

    viewportReadbacks.push({
      viewport: viewport.label,
      screenshot: relative(repoRoot, screenshotPath),
      screenshotSha256: createHash("sha256").update(screenshotBytes).digest("hex"),
      screenshotBytes: screenshotBytes.length,
      ...domReadback
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const staticTargetsReadback = staticTargets.map((target) => {
  const html = readFileSync(target.filePath, "utf8");
  return {
    routePath: target.routePath,
    staticTarget: relative(repoRoot, target.filePath),
    sha256: createHash("sha256").update(html).digest("hex"),
    bytes: Buffer.byteLength(html),
    hasBaselineSurface: html.includes('data-surface="aos-rebuild-workspace"'),
    hasChecklist: html.includes("Module rebuild checklist")
  };
});

const failures = [
  ...pageErrors.map((error) => `page_error:${error}`),
  ...consoleErrors.map((error) => `console_error:${error}`),
  ...requestFailures.map((failure) => `request_failure:${failure}`),
  ...staticTargetsReadback.filter((item) => !item.hasBaselineSurface || !item.hasChecklist).map((item) => `static_target_not_replaced:${item.routePath}`)
];
for (const readback of viewportReadbacks) {
  failures.push(
    ...readback.selectorProof.filter((item) => !item.present).map((item) => `missing_selector:${readback.viewport}:${item.selector}`),
    ...readback.duplicateIds.map((id) => `duplicate_id:${readback.viewport}:${id}`),
    ...readback.ariaReferenceFailures.map((failure) => `aria_reference_failure:${readback.viewport}:${failure.attr}:${failure.id}:${failure.count}`),
    ...readback.disabledFailures.map((failure) => `disabled_reason_failure:${readback.viewport}:${failure.html}`),
    ...readback.markerOnlyComponents.map((component) => `marker_only_component:${readback.viewport}:${component}`),
    ...readback.checklistReadabilityFailures.map((failure) => `checklist_readability_failure:${readback.viewport}:${failure}`),
    ...readback.forbiddenVisibleHits.map((hit) => `forbidden_visible_copy:${readback.viewport}:${hit}`),
    ...readback.navReadabilityFailures.map((failure) => `nav_readability_failure:${readback.viewport}:${failure.label}:${failure.contentWidth}:${failure.labelHeight}`)
  );
  if (!readback.nonblank) failures.push(`blank_or_sparse_render:${readback.viewport}`);
  if (readback.bodyHorizontalOverflow) failures.push(`body_horizontal_overflow:${readback.viewport}`);
  if (readback.navIconlessCount > 0) failures.push(`iconless_nav_items:${readback.viewport}:${readback.navIconlessCount}`);
}

const summary = {
  ok: failures.length === 0,
  route,
  sourceHead,
  generatedAt: new Date().toISOString(),
  browserProofTarget: {
    routePath: browserProofTarget.routePath,
    staticTarget: relative(repoRoot, browserProofTarget.filePath),
    generatedForProofOnly: browserProofTarget.generatedForProofOnly === true
  },
  replacedStaticTargets: staticTargetsReadback,
  viewportReadbacks,
  pageErrors,
  consoleErrors,
  requestFailures,
  sourceFreshnessReadback,
  noOverclaimReadback: {
    productAcceptance: false,
    finalMvpAcceptance: false,
    releasePublication: false,
    ownerIntentExecution: false,
    liveDispatch: false,
    parentGoalCompletion: false
  },
  failures
};

writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(latestSummaryPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(markdownPath, markdownReceipt(summary));
console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);

function inspectSourceContentDigest() {
  const sourcePaths = [
    "apps/web/src/rebuild-baseline-data.ts",
    "apps/web/src/rebuild-baseline-ui-react-runtime.ts",
    "apps/web/src/rebuild-baseline-view.ts",
    "apps/api/src/server.ts",
    "apps/api/test/service-smoke.test.mjs",
    "apps/web/test/rebuild-baseline-view.test.mjs",
    "scripts/rebuild-baseline-proof.mjs",
    "package.json"
  ];
  const inputs = sourcePaths.map((sourcePath) => {
    const absolutePath = join(repoRoot, sourcePath);
    return {
      path: sourcePath,
      exists: existsSync(absolutePath),
      sha256: existsSync(absolutePath) ? createHash("sha256").update(readFileSync(absolutePath)).digest("hex") : null
    };
  });
  const digest = createHash("sha256");
  for (const input of inputs) {
    digest.update(`${input.path}:${input.sha256 ?? "missing"}\n`);
  }
  return {
    strategy: "rebuild_baseline_reset_source_content_digest_v1",
    sourceHeadAtProofRun: sourceHead,
    exactFinalCommitHeadRequired: false,
    sourceContentDigest: digest.digest("hex"),
    sourcePaths
  };
}

function markdownReceipt(summary) {
  return `# Rebuild Baseline Proof

Status: ${summary.ok ? "passed" : "failed"}.

Route: \`${summary.route}\`
AOS source head: \`${summary.sourceHead}\`
Source content digest: \`${summary.sourceFreshnessReadback.sourceContentDigest}\`

## Replaced static targets

${summary.replacedStaticTargets.map((item) => `- ${item.routePath} -> ${item.staticTarget} sha256=${item.sha256} bytes=${item.bytes} baseline=${item.hasBaselineSurface} checklist=${item.hasChecklist}`).join("\n")}

## Browser proof target

- ${summary.browserProofTarget.routePath} -> ${summary.browserProofTarget.staticTarget} generatedForProofOnly=${summary.browserProofTarget.generatedForProofOnly}

## Browser Evidence

${summary.viewportReadbacks.map((readback) => `- ${readback.viewport}: ${readback.screenshot} sha256=${readback.screenshotSha256} bytes=${readback.screenshotBytes} overflow=${readback.bodyHorizontalOverflow} duplicateIds=${readback.duplicateIds.length} ariaFailures=${readback.ariaReferenceFailures.length} disabledFailures=${readback.disabledFailures.length} iconlessNavItems=${readback.navIconlessCount} checklistFailures=${readback.checklistReadabilityFailures.length}`).join("\n")}

## Boundaries

This receipt proves the frontend baseline reset only. It does not claim product acceptance, final MVP acceptance, release/publication, owner-final acceptance, Owner Intent execution, live dispatch, or parent-goal completion.
`;
}
