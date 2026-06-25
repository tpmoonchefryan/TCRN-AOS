import test from "node:test";
import assert from "node:assert/strict";
import {
  createRebuildBaselineModel,
  forbiddenRebuildBaselineVisibleCopy,
  rebuildBaselineDsStandardIds,
  rebuildBaselineRoutes,
  rebuildBaselineStorybookIds,
  renderRebuildBaselineHtml,
  requiredRebuildBaselineSelectors
} from "../../../dist/apps/web/src/rebuild-baseline-view.js";

test("Rebuild baseline model resets the current AOS frontend to Storybook-first scope", () => {
  const model = createRebuildBaselineModel("/operations-cockpit.html");

  assert.equal(model.currentAliasLabel, "Operations Cockpit");
  assert.equal(model.selectedRebuiltStartingSlice, "storybook-first-replacement-workspace-shell");
  assert.equal(model.noClaims.productAcceptance, false);
  assert.equal(model.noClaims.finalMvpAcceptance, false);
  assert.equal(model.noClaims.releasePublication, false);
  assert.equal(model.noClaims.ownerIntentExecution, false);
  assert.equal(model.noClaims.liveDispatch, false);
  assert.equal(model.noClaims.parentGoalCompletion, false);
  assert.deepEqual(rebuildBaselineDsStandardIds, [
    "ds-aos-operations-cockpit-v1",
    "ds-aos-docs-readiness-v1",
    "ds-aos-target-set-v1"
  ]);
  assert.deepEqual(rebuildBaselineStorybookIds, [
    "tcrn-design-system-patterns--aos-operations-cockpit-standard",
    "tcrn-design-system-patterns--aos-docs-readiness-standard",
    "tcrn-design-system-patterns--aos-product-design-target-set-standard"
  ]);
  assert.deepEqual(rebuildBaselineRoutes, [
    "/operations-cockpit.html",
    "/docs-search-release-readiness.html",
    "/aos-wide-product-design.html",
    "/project-workspace.html",
    "/initiative-detail.html",
    "/ai-employee.html",
    "/gate-queue.html",
    "/conference.html",
    "/dependency-console.html"
  ]);
  assert.ok(model.checklist.length >= 10);
});

test("Rebuild baseline HTML exposes the reset shell and removes old active surface assumptions", () => {
  const html = renderRebuildBaselineHtml("/operations-cockpit.html");

  for (const selector of requiredRebuildBaselineSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    const surface = selector.match(/data-surface='([^']+)'/)?.[1];
    if (region) assert.ok(html.includes(`data-region="${region}"`), `production HTML includes ${selector}`);
    if (surface) assert.ok(html.includes(`data-surface="${surface}"`), `production HTML includes ${selector}`);
  }
  assert.match(html, /data-ds-standard-ids="ds-aos-operations-cockpit-v1 ds-aos-docs-readiness-v1 ds-aos-target-set-v1"/);
  assert.match(html, /data-product-acceptance="false"/);
  assert.match(html, />AOS Frontend Replacement Workspace</);
  assert.match(html, />Current served frontend has been retired</);
  assert.match(html, />Operations cockpit starting surface</);
  assert.match(html, />Docs readiness starting surface</);
  assert.match(html, />Product design target-set starting surface</);
  assert.match(html, />Project workspace starting surface</);
  assert.match(html, />Retired frontend inventory</);
  assert.match(html, />Retired served scope</);
  assert.doesNotMatch(html, />Active now</);
  assert.doesNotMatch(productVisibleAndA11yText(html), productVisibleInternalTermsPattern);
});

test("Rebuild baseline checklist includes table layout rules for desktop and mobile readability", () => {
  const html = renderRebuildBaselineHtml("/operations-cockpit.html");

  assert.match(
    html,
    /\.rebuild-baseline__checklist \.tcrn-table-shell__head, \.rebuild-baseline__checklist \.tcrn-table-shell__row \{ display: grid; grid-template-columns: minmax\(180px, 1\.15fr\) 132px minmax\(180px, 0\.9fr\) minmax\(320px, 1\.75fr\); align-items: stretch; \}/
  );
  assert.match(
    html,
    /\.rebuild-baseline__checklist \.tcrn-table-shell__head span, \.rebuild-baseline__checklist \.tcrn-table-shell__cell \{ display: flex; align-items: center; min-width: 0; padding: 11px 12px; border-bottom: 1px solid var\(--line\);/
  );
  assert.match(
    html,
    /\.rebuild-baseline__checklist \.tcrn-table-shell__head \{ display: none; \}/
  );
  assert.match(
    html,
    /\.rebuild-baseline__checklist \.tcrn-table-shell__cell \{ display: grid; grid-template-columns: 92px minmax\(0, 1fr\);/
  );
});

test("Rebuild baseline renders package-backed public Design System components", () => {
  const html = renderRebuildBaselineHtml("/project-workspace.html");
  const requiredPackageComponents = [
    "Surface",
    "SideNav",
    "NavGroup",
    "NavItem",
    "LinkButton",
    "TopBar",
    "Button",
    "Badge",
    "StatusBadge",
    "EvidenceStrip",
    "ReadbackPanel",
    "DetailDrawer",
    "FilterBar",
    "GateReadinessPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "TableShell",
    "WorkIndex"
  ];

  for (const component of requiredPackageComponents) {
    assert.match(html, new RegExp(`data-package-runtime-component="${component}"`), `${component} is package-rendered`);
  }
});

test("Rebuild baseline visible copy avoids internal workflow vocabulary", () => {
  const html = renderRebuildBaselineHtml("/dependency-console.html");
  const visibleText = productVisibleAndA11yText(html).toLowerCase();
  const hits = forbiddenRebuildBaselineVisibleCopy.filter((phrase) => visibleText.includes(phrase));

  assert.deepEqual(hits, []);
});

test("Rebuild baseline exposes the first fresh cockpit surface inside the replacement workspace", () => {
  const html = renderRebuildBaselineHtml("/operations-cockpit.html");

  assert.match(html, /data-region="cockpit-start"/);
  assert.match(html, /data-region="cockpit-work-index"/);
  assert.match(html, /data-region="cockpit-detail"/);
  assert.match(html, /Cockpit standard reference/);
  assert.match(html, /Operations cockpit starting work/);
  assert.match(html, /First fresh surface/);
  assert.match(html, /data-package-runtime-component="GateReadinessPanel"/);
  assert.match(html, /data-package-runtime-component="DetailDrawer"/);
});

test("Rebuild baseline exposes the next fresh docs readiness surface inside the replacement workspace", () => {
  const html = renderRebuildBaselineHtml("/docs-search-release-readiness.html");

  assert.match(html, /data-region="docs-start"/);
  assert.match(html, /data-region="docs-filter"/);
  assert.match(html, /data-region="docs-detail"/);
  assert.match(html, /Docs readiness starting surface/);
  assert.match(html, /Docs inspection rows/);
  assert.match(html, /Docs readiness standard reference/);
  assert.match(html, /data-package-runtime-component="FilterBar"/);
  assert.match(html, /class="tcrn-search-input"/);
  assert.match(html, /class="tcrn-select"/);
  assert.match(html, /class="tcrn-field"/);
});

test("Rebuild baseline exposes the next fresh product design target-set surface inside the replacement workspace", () => {
  const html = renderRebuildBaselineHtml("/aos-wide-product-design.html");

  assert.match(html, /data-region="target-set-start"/);
  assert.match(html, /data-region="target-set-modules"/);
  assert.match(html, /data-region="target-set-detail"/);
  assert.match(html, /Product design target-set starting surface/);
  assert.match(html, /AOS-wide surface index/);
  assert.match(html, /Target-set standard reference/);
  assert.match(html, /Target path and module cards/);
  assert.match(html, /Disabled gate panel/);
});

test("Rebuild baseline exposes the next fresh project workspace surface inside the replacement workspace", () => {
  const html = renderRebuildBaselineHtml("/project-workspace.html");

  assert.match(html, /data-region="project-workspace-start"/);
  assert.match(html, /data-region="project-workspace-hierarchy"/);
  assert.match(html, /data-region="project-workspace-detail"/);
  assert.match(html, /Project workspace starting surface/);
  assert.match(html, /Project workspace current work/);
  assert.match(html, /Project workspace standards/);
  assert.match(html, /Workspace shell and hierarchy/);
  assert.match(html, /Send owner action/);
});

test("Rebuild baseline nav uses DS icons and disabled reasons for reference and retired modules", () => {
  const html = renderRebuildBaselineHtml("/conference.html");
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-package-runtime-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g));
  const disabledCount = navItems.filter((match) => match[1].includes('aria-disabled="true"')).length;

  assert.ok(navItems.length >= 10);
  assert.equal(disabledCount, navItems.length);
  for (const [, attributes, body] of navItems) {
    assert.match(body, /\btcrn-icon\b/, "NavItem body includes a DS icon");
    assert.match(attributes, /\bdata-disabled-reason="[^"]+"/, "disabled rebuild nav item includes a reason");
  }
});

function productVisibleAndA11yText(html) {
  const attributeText = Array.from(html.matchAll(/\b(?:aria-label|title|data-disabled-reason)="([^"]*)"/g))
    .map((match) => match[1])
    .join(" ");
  const visibleText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/\b(?:class|data-[\w:-]+|id|href|src|style)="[^"]*"/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${visibleText} ${attributeText}`.replace(/\s+/g, " ").trim();
}

const productVisibleInternalTermsPattern = /\b(readback|checkpoint|route|slice|implementation|workflow|proof|package-runtime|package runtime|functional contract|held for later|unavailable in this route|not claimed|not_claimed)\b/i;
