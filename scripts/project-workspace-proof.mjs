import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  forbiddenProjectWorkspaceVisibleCopy,
  renderProjectWorkspaceHtml,
  requiredProjectWorkspaceSelectors
} from "../dist/apps/web/src/project-workspace-view.js";

const repoRoot = process.cwd();
const route = "route_tcrn_aos_4b9253b_ilya_project_workspace_copy_proof_table_repair_after_elara_review";
const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkCurrentSource = process.argv.includes("--check-current-source");
const html = renderProjectWorkspaceHtml();
const staticPath = join(repoRoot, "apps/web/static/project-workspace.html");
const evidenceRoot = join(repoRoot, "evidence", "project-workspace-browser");
const evidenceDir = join(evidenceRoot, sourceHead);
const summaryPath = join(evidenceDir, "browser-evidence-summary.json");
const latestSummaryPath = join(evidenceRoot, "browser-evidence-summary.json");
const markdownPath = join(repoRoot, "evidence", "project-workspace-proof.md");
const sourceFreshnessReadback = inspectSourceContentDigest();
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900, minNavLabelWidth: 120 },
  { label: "mobile-390x844", width: 390, height: 844, minNavLabelWidth: 100 }
];

if (checkCurrentSource) {
  const retained = JSON.parse(readFileSync(latestSummaryPath, "utf8"));
  const ok = retained.ok === true
    && retained.sourceFreshnessReadback?.sourceContentDigest === sourceFreshnessReadback.sourceContentDigest;
  const result = {
    ok,
    route,
    command: "node scripts/project-workspace-proof.mjs --check-current-source",
    sourceHead,
    retainedSummaryPath: relative(repoRoot, latestSummaryPath),
    retainedDigest: retained.sourceFreshnessReadback?.sourceContentDigest,
    currentDigest: sourceFreshnessReadback.sourceContentDigest
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
  process.exit(0);
}

mkdirSync(dirname(staticPath), { recursive: true });
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(staticPath, html);

const designSystemRequire = createRequire(join(repoRoot, "..", "TCRN-DESIGN-SYSTEM", "package.json"));
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

    await page.goto(pathToFileURL(staticPath).href, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-surface='project-workspace']");
    const screenshotPath = join(evidenceDir, `project-workspace-${viewport.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshotBytes = readFileSync(screenshotPath);
    const domReadback = await page.evaluate((args) => {
      const requiredSelectors = args.requiredSelectors;
      const forbiddenTerms = args.forbiddenTerms;
      const selectorProof = requiredSelectors.map((selector) => ({ selector, present: Boolean(document.querySelector(selector)) }));
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
      const ownerCells = Array.from(document.querySelectorAll(".project-workspace__table-shell [data-label='Owner']"));
      const ownerCellFailures = ownerCells.map((cell) => {
        const text = cell.textContent?.trim() ?? "";
        return {
          text,
          clientWidth: Math.round(cell.clientWidth),
          scrollWidth: Math.round(cell.scrollWidth),
          height: Math.round(cell.getBoundingClientRect().height)
        };
      }).filter((cell) =>
        cell.text.toLowerCase().includes("implementation")
          || (args.isDesktop && (cell.scrollWidth > cell.clientWidth + 1 || cell.height > 48))
      );
      const accessibilityText = [
        ...Array.from(document.querySelectorAll("[aria-label]")).map((node) => node.getAttribute("aria-label") ?? ""),
        ...Array.from(document.querySelectorAll("[title]")).map((node) => node.getAttribute("title") ?? ""),
        ...Array.from(document.querySelectorAll("[data-disabled-reason]")).map((node) => node.getAttribute("data-disabled-reason") ?? ""),
        ...Array.from(document.querySelectorAll("[aria-describedby]")).flatMap((node) =>
          (node.getAttribute("aria-describedby") ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        )
      ].join(" ");
      const visibleText = `${document.body.innerText} ${accessibilityText}`.toLowerCase();
      const forbiddenVisibleHits = forbiddenTerms.filter((term) => visibleText.includes(term.toLowerCase()));
      const bodyHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      const nonblank = document.body.innerText.trim().length > 1000 && document.querySelectorAll("[data-package-runtime-component]").length >= 16;

      return {
        selectorProof,
        duplicateIds: Array.from(new Set(duplicateIds)),
        ariaReferenceFailures,
        disabledControlsCount: disabledControls.length,
        disabledFailures,
        packageComponents,
        markerOnlyComponents,
        navItemCount: navItems.length,
        navIconlessCount,
        navReadabilityFailures,
        ownerCellCount: ownerCells.length,
        ownerCellFailures,
        forbiddenVisibleHits,
        bodyHorizontalOverflow,
        nonblank
      };
    }, {
      requiredSelectors: [...requiredProjectWorkspaceSelectors],
      forbiddenTerms: [...forbiddenProjectWorkspaceVisibleCopy],
      minNavLabelWidth: viewport.minNavLabelWidth,
      isDesktop: viewport.width >= 980
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

const staticReadback = inspectStaticHtml(html);
const failures = [
  ...staticReadback.failures,
  ...pageErrors.map((error) => `page_error:${error}`),
  ...consoleErrors.map((error) => `console_error:${error}`),
  ...requestFailures.map((failure) => `request_failure:${failure}`)
];
for (const readback of viewportReadbacks) {
  failures.push(
    ...readback.selectorProof.filter((item) => !item.present).map((item) => `missing_selector:${readback.viewport}:${item.selector}`),
    ...readback.duplicateIds.map((id) => `duplicate_id:${readback.viewport}:${id}`),
    ...readback.ariaReferenceFailures.map((failure) => `aria_reference_failure:${readback.viewport}:${failure.attr}:${failure.id}:${failure.count}`),
    ...readback.disabledFailures.map((failure) => `disabled_reason_failure:${readback.viewport}:${failure.html}`),
    ...readback.markerOnlyComponents.map((component) => `marker_only_component:${readback.viewport}:${component}`),
    ...readback.forbiddenVisibleHits.map((hit) => `forbidden_visible_copy:${readback.viewport}:${hit}`),
    ...readback.ownerCellFailures.map((failure) => `work_index_owner_cell_failure:${readback.viewport}:${failure.text}:${failure.clientWidth}:${failure.scrollWidth}:${failure.height}`),
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
  staticTarget: relative(repoRoot, staticPath),
  staticSha256: createHash("sha256").update(html).digest("hex"),
  staticBytes: Buffer.byteLength(html),
  dsStandardsConsumed: ["ds-aos-target-set-v1", "ds-aos-operations-cockpit-v1"],
  storybookOraclesConsumed: [
    "tcrn-design-system-patterns--aos-product-design-target-set-standard",
    "tcrn-design-system-patterns--aos-operations-cockpit-standard"
  ],
  taliaChecklistItemAdvanced: "Project Dashboard / Project-Initiative-Epic-Story hierarchy standalone visible shell",
  staticReadback,
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

function inspectStaticHtml(renderedHtml) {
  const requiredComponents = [
    "Surface",
    "SideNav",
    "NavGroup",
    "NavItem",
    "LinkButton",
    "TopBar",
    "Select",
    "Button",
    "Badge",
    "StatusBadge",
    "EvidenceStrip",
    "ReadbackPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "TableShell",
    "DetailDrawer"
  ];
  const packageComponents = Array.from(new Set(Array.from(renderedHtml.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1]))).sort();
  const missingComponents = requiredComponents.filter((component) => !packageComponents.includes(component));
  const markerOnlyComponents = Array.from(renderedHtml.matchAll(/<[^>]+data-tcrn-component="([^"]+)"[^>]*>/g))
    .filter((match) => !match[0].includes("data-package-runtime-component=") && !match[0].includes("data-package-runtime-subcomponent="))
    .map((match) => match[1]);
  const selectorProof = requiredProjectWorkspaceSelectors.map((selector) => {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    const surface = selector.match(/data-surface='([^']+)'/)?.[1];
    const present = region ? renderedHtml.includes(`data-region="${region}"`) : surface ? renderedHtml.includes(`data-surface="${surface}"`) : false;
    return { selector, present };
  });
  const visibleText = productVisibleAndAccessibilityText(renderedHtml).toLowerCase();
  const forbiddenVisibleHits = forbiddenProjectWorkspaceVisibleCopy.filter((phrase) => visibleText.includes(phrase.toLowerCase()));
  const failures = [
    ...missingComponents.map((component) => `missing_component:${component}`),
    ...markerOnlyComponents.map((component) => `marker_only_component:${component}`),
    ...selectorProof.filter((item) => !item.present).map((item) => `missing_selector:${item.selector}`),
    ...forbiddenVisibleHits.map((hit) => `forbidden_visible_copy:${hit}`)
  ];
  if (!renderedHtml.includes("data-product-acceptance=\"false\"")) failures.push("missing_product_acceptance_false");
  if (!renderedHtml.includes("data-live-dispatch=\"false\"")) failures.push("missing_live_dispatch_false");
  return { packageComponents, missingComponents, markerOnlyComponents, selectorProof, forbiddenVisibleHits, failures };
}

function productVisibleAndAccessibilityText(renderedHtml) {
  const attributeText = Array.from(renderedHtml.matchAll(/\b(?:aria-label|title|data-disabled-reason)="([^"]*)"/g))
    .map((match) => match[1])
    .join(" ");
  const visibleText = renderedHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/\b(?:class|data-[\w:-]+|id|href|src|style)="[^"]*"/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${visibleText} ${attributeText}`.replace(/\s+/g, " ").trim();
}

function inspectSourceContentDigest() {
  const sourcePaths = [
    "apps/web/src/cockpit.ts",
    "apps/web/src/project-workspace-data.ts",
    "apps/web/src/project-workspace-ui-react-runtime.ts",
    "apps/web/src/project-workspace-view.ts",
    "apps/web/src/design-system-bridge.ts",
    "apps/web/test/project-workspace-view.test.mjs",
    "apps/api/src/server.ts",
    "apps/api/test/service-smoke.test.mjs",
    "scripts/project-workspace-proof.mjs",
    "scripts/service-start.mjs",
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
    strategy: "project_workspace_visible_slice_source_content_digest_v1",
    sourceHead,
    sourcePaths,
    inputs,
    sourceContentDigest: digest.digest("hex")
  };
}

function markdownReceipt(summary) {
  return `# Project Workspace Proof

- ok: ${summary.ok}
- route: ${summary.route}
- sourceHead: ${summary.sourceHead}
- staticTarget: ${summary.staticTarget}
- staticSha256: ${summary.staticSha256}
- DS standards consumed: ${summary.dsStandardsConsumed.join(", ")}
- Storybook oracles consumed: ${summary.storybookOraclesConsumed.join(", ")}
- Talia checklist item advanced: ${summary.taliaChecklistItemAdvanced}
- failures: ${summary.failures.length === 0 ? "[]" : summary.failures.join("; ")}

## Browser Evidence

${summary.viewportReadbacks.map((readback) => `- ${readback.viewport}: ${readback.screenshot} sha256=${readback.screenshotSha256} bytes=${readback.screenshotBytes} overflow=${readback.bodyHorizontalOverflow} duplicateIds=${readback.duplicateIds.length} ariaFailures=${readback.ariaReferenceFailures.length} disabledFailures=${readback.disabledFailures.length} iconlessNavItems=${readback.navIconlessCount} ownerCellFailures=${readback.ownerCellFailures.length}`).join("\n")}

## Boundaries

This receipt proves a bounded AOS Project Workspace visible shell/navigation slice only. It does not claim product UI acceptance, Product Design acceptance, product acceptance, final MVP acceptance, release/publication readiness, owner-final acceptance, Owner Intent execution, live dispatch, VM/resource freshness, or parent-goal completion.
`;
}
