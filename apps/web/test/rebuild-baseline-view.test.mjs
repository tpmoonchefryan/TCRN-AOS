import test from "node:test";
import assert from "node:assert/strict";
import {
  createRebuildBaselineModel,
  forbiddenRebuildBaselineFreshSectionSelectors,
  forbiddenRebuildBaselineVisibleCopy,
  rebuildBaselineDsStandardIds,
  rebuildBaselineRoutes,
  rebuildBaselineStorybookIds,
  renderRebuildBaselineHtml,
  requiredRebuildBaselineSelectors
} from "../../../dist/apps/web/src/rebuild-baseline-view.js";

test("Rebuild baseline model now represents the reset shell plus cockpit, docs, target-set, project-workspace, and initiative-detail fresh slices", () => {
  const model = createRebuildBaselineModel("/operations-cockpit.html");

  assert.equal(model.currentAliasLabel, "Operations Cockpit");
  assert.equal(model.selectedRebuiltStartingSlice, "fresh-cockpit-docs-target-set-project-workspace-initiative-detail-foundation");
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
});

test("Rebuild checkpoint HTML serves the reset shell plus cockpit, docs, target-set, project-workspace, and initiative-detail fresh slices while omitting later sections", () => {
  const html = renderRebuildBaselineHtml("/operations-cockpit.html");

  for (const selector of requiredRebuildBaselineSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    const surface = selector.match(/data-surface='([^']+)'/)?.[1];
    if (region) assert.ok(html.includes(`data-region="${region}"`), `production HTML includes ${selector}`);
    if (surface) assert.ok(html.includes(`data-surface="${surface}"`), `production HTML includes ${selector}`);
  }

  assert.match(html, /data-ds-standard-ids="ds-aos-operations-cockpit-v1 ds-aos-docs-readiness-v1 ds-aos-target-set-v1"/);
  assert.match(html, /data-product-acceptance="false"/);
  assert.match(html, />AOS Frontend Reset Notice</);
  assert.match(html, />Served AOS frontend is unavailable</);
  assert.match(html, />Operations cockpit starting surface</);
  assert.match(html, />Docs readiness starting surface</);
  assert.match(html, />Product design target-set starting surface</);
  assert.match(html, />Project workspace starting surface</);
  assert.match(html, />Initiative detail starting surface</);
  assert.match(html, />Retired frontend inventory</);
  assert.match(html, />Retired served scope</);

  for (const selector of forbiddenRebuildBaselineFreshSectionSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    if (region) {
      assert.doesNotMatch(html, new RegExp(`data-region="${region}"`), `served checkpoint omits ${selector}`);
    }
  }

  assert.doesNotMatch(
    html,
    /AI employee starting surface|Gate queue starting surface|Conference starting surface|Dependency console starting surface|Resource library starting surface/
  );
  assert.doesNotMatch(
    html,
    /AI employee roster|Gate queue rows|Conference list|Dependency governance rows|Resource library rows/
  );
  assert.match(html, /Docs inspection rows/);
  assert.match(html, /AOS-wide surface index/);
  assert.match(html, /Project workspace current work/);
  assert.match(html, /Initiative detail linked records/);
  assert.doesNotMatch(productVisibleAndA11yText(html), productVisibleInternalTermsPattern);
});

test("Rebuild checkpoint keeps the checklist readable on desktop and mobile", () => {
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

test("Rebuild checkpoint still renders package-backed Design System primitives", () => {
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
    "Text",
    "Heading",
    "KeyValueList",
    "TableShell"
  ];

  for (const component of requiredPackageComponents) {
    assert.match(html, new RegExp(`data-package-runtime-component="${component}"`), `${component} is package-rendered`);
  }
});

test("Rebuild checkpoint visible copy avoids internal workflow vocabulary", () => {
  const html = renderRebuildBaselineHtml("/dependency-console.html");
  const visibleText = productVisibleAndA11yText(html).toLowerCase();
  const hits = forbiddenRebuildBaselineVisibleCopy.filter((phrase) => visibleText.includes(phrase));

  assert.deepEqual(hits, []);
});

test("Rebuild checkpoint exposes the fresh cockpit, docs, target-set, project-workspace, and initiative-detail sections while still keeping later fresh sections suppressed", () => {
  const html = renderRebuildBaselineHtml("/operations-cockpit.html");

  assert.match(html, /data-region="cockpit-start"/);
  assert.match(html, /data-region="cockpit-work-index"/);
  assert.match(html, /data-region="cockpit-detail"/);
  assert.match(html, /Operations cockpit starting work/);
  assert.match(html, /data-region="docs-start"/);
  assert.match(html, /data-region="docs-filter"/);
  assert.match(html, /data-region="docs-detail"/);
  assert.match(html, /Docs inspection rows/);
  assert.match(html, /data-region="target-set-start"/);
  assert.match(html, /data-region="target-set-modules"/);
  assert.match(html, /data-region="target-set-detail"/);
  assert.match(html, /Product design target-set starting surface/);
  assert.match(html, /AOS-wide surface index/);
  assert.match(html, /data-region="project-workspace-start"/);
  assert.match(html, /data-region="project-workspace-hierarchy"/);
  assert.match(html, /data-region="project-workspace-detail"/);
  assert.match(html, /Project workspace starting surface/);
  assert.match(html, /Project workspace current work/);
  assert.match(html, /data-region="initiative-detail-start"/);
  assert.match(html, /data-region="initiative-detail-ticket"/);
  assert.match(html, /data-region="initiative-detail-links"/);
  assert.match(html, /data-region="initiative-detail-activity"/);
  assert.match(html, /Initiative detail starting surface/);
  assert.match(html, /Initiative detail linked records/);
  assert.doesNotMatch(html, /AI employee starting surface|Gate queue starting surface|Conference starting surface|Dependency console starting surface|Resource library starting surface/);
});

test("Rebuild checkpoint nav uses DS icons and disabled reasons", () => {
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
