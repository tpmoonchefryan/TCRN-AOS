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
  assert.equal(model.selectedRebuiltStartingSlice, "storyboard-first-aos-rebuild-workspace-baseline");
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
  assert.match(html, />AOS Rebuild Workspace</);
  assert.match(html, />Current AOS frontend is being replaced</);
  assert.match(html, />Module rebuild checklist</);
  assert.match(html, />Replaced frontend scope</);
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
    "Text",
    "Heading",
    "KeyValueList",
    "TableShell"
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

test("Rebuild baseline nav uses DS icons and disabled reasons for queued modules", () => {
  const html = renderRebuildBaselineHtml("/conference.html");
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-package-runtime-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g));
  const disabledCount = navItems.filter((match) => match[1].includes('aria-disabled="true"')).length;

  assert.ok(navItems.length >= 10);
  assert.ok(disabledCount >= 6);
  for (const [, attributes, body] of navItems) {
    assert.match(body, /\btcrn-icon\b/, "NavItem body includes a DS icon");
    if (attributes.includes('aria-disabled="true"')) {
      assert.match(attributes, /\bdata-disabled-reason="[^"]+"/, "disabled rebuild nav item includes a reason");
    }
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
