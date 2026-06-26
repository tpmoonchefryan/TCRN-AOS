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

test("Rebuild baseline model now represents the reset shell plus cockpit, docs, target-set, project-workspace, initiative-detail, ai-employee, gate-queue, conference, gateway-adapter, dependency-console, resource-library, knowledge-modules, admin-access, and GitHub release-linkage fresh slices", () => {
  const model = createRebuildBaselineModel("/operations-cockpit.html");
  const resourceLibraryRow = model.checklist.find((row) => row.id === "resource-library");
  const knowledgeModulesRow = model.checklist.find((row) => row.id === "knowledge-modules");
  const adminAccessRow = model.checklist.find((row) => row.id === "admin-access");
  const githubReleaseLinkageRow = model.checklist.find((row) => row.id === "github-release-linkage");

  assert.equal(model.currentAliasLabel, "Operations Cockpit");
  assert.equal(model.selectedRebuiltStartingSlice, "fresh-cockpit-docs-target-set-project-workspace-initiative-detail-ai-employee-gate-queue-conference-gateway-adapter-dependency-console-resource-library-knowledge-modules-admin-access-github-workflow-sync-release-linkage-foundation");
  assert.equal(resourceLibraryRow?.status, "workspace_active");
  assert.equal(
    resourceLibraryRow?.note,
    "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."
  );
  assert.equal(knowledgeModulesRow?.status, "workspace_active");
  assert.equal(
    knowledgeModulesRow?.note,
    "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."
  );
  assert.equal(adminAccessRow?.status, "workspace_active");
  assert.equal(
    adminAccessRow?.note,
    "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."
  );
  assert.equal(githubReleaseLinkageRow?.status, "workspace_active");
  assert.equal(
    githubReleaseLinkageRow?.note,
    "Fresh rebuilt module is active in the shared workspace while the standalone page remains retired."
  );
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
    "/gateway-adapter.html",
    "/dependency-console.html",
    "/resource-library.html",
    "/knowledge-modules.html",
    "/admin-access.html",
    "/github-release-linkage.html"
  ]);
});

test("Rebuild baseline recognizes later rebuilt module alias routes as active workspace entries", () => {
  assert.equal(createRebuildBaselineModel("/").currentEntryFocus?.anchor, "cockpit-start");
  assert.equal(createRebuildBaselineModel("/").currentEntryFocus?.entryMode, "Workspace default");
  assert.equal(createRebuildBaselineModel("/").currentEntryFocus?.relatedEntries.length, 3);
  assert.equal(createRebuildBaselineModel("/gateway-adapter.html").currentAliasLabel, "Gateway / Adapter");
  assert.equal(createRebuildBaselineModel("/gateway-adapter.html").currentEntryFocus?.anchor, "gateway-adapter-start");
  assert.equal(createRebuildBaselineModel("/gateway-adapter.html").currentEntryFocus?.entryMode, "Direct entry");
  assert.equal(createRebuildBaselineModel("/gateway-adapter.html").currentEntryFocus?.relatedEntries[0]?.label, "Dependency Console");
  assert.equal(createRebuildBaselineModel("/resource-library.html").currentAliasLabel, "Resource Library");
  assert.equal(createRebuildBaselineModel("/knowledge-modules.html").currentAliasLabel, "Knowledge Modules");
  assert.equal(createRebuildBaselineModel("/admin-access.html").currentAliasLabel, "Admin / Access");
  assert.equal(createRebuildBaselineModel("/github-release-linkage.html").currentAliasLabel, "GitHub Release Linkage");
});

test("Rebuild checkpoint foregrounds the current alias entry inside the shared shell", () => {
  const html = renderRebuildBaselineHtml("/gateway-adapter.html");

  assert.match(html, /Current path/);
  assert.match(html, /data-region="current-entry-panel"/);
  assert.match(html, /data-current-entry="gateway-adapter"/);
  assert.match(html, /Current module entry/);
  assert.match(html, /Direct entry/);
  assert.match(html, /Current path overview/);
  assert.match(html, /Active module/);
  assert.match(html, /Current path actions/);
  assert.match(html, /Open Gateway \/ Adapter/);
  assert.match(html, /Open Dependency Console/);
  assert.match(html, /Jump to Gateway \/ Adapter/);
  assert.match(html, /Gateway \/ Adapter is foregrounded in the rebuilt workspace/);
  assert.match(html, /Related rebuilt modules/);
  assert.match(html, /Health and governance/);
  assert.match(html, /Release records/);
  assert.match(html, /Go to Dependency Console/);
  assert.match(html, /Go to GitHub Release Linkage/);
  assert.match(html, /data-current-entry-row="gateway-adapter"/);
  assert.match(html, />Related</);
  assert.ok(
    html.indexOf('data-region="gateway-adapter-start"') < html.indexOf('data-region="cockpit-start"'),
    "current alias section is foregrounded before the default cockpit section"
  );
  assert.ok(
    html.indexOf('data-region="dependency-console-start"') < html.indexOf('data-region="cockpit-start"'),
    "related dependency console section is foregrounded before the default cockpit section"
  );
  assert.ok(
    html.indexOf('data-region="github-release-linkage-start"') < html.indexOf('data-region="cockpit-start"'),
    "related GitHub release linkage section is foregrounded before the default cockpit section"
  );
  const checklistHtml = html.slice(html.indexOf("Rebuilt module directory"), html.indexOf("Legacy standalone scope"));
  assert.ok(
    checklistHtml.indexOf("Gateway / Adapter") < checklistHtml.indexOf("Operations Cockpit"),
    "current alias row is foregrounded before the default checklist ordering"
  );
  assert.ok(
    checklistHtml.indexOf("Dependency Console") < checklistHtml.indexOf("Operations Cockpit"),
    "related rows are foregrounded before the default checklist ordering"
  );
  assert.ok(
    checklistHtml.indexOf("GitHub Release Linkage") < checklistHtml.indexOf("Operations Cockpit"),
    "related GitHub release linkage row is foregrounded before the default checklist ordering"
  );
});

test("Rebuild checkpoint HTML serves the reset shell plus cockpit, docs, target-set, project-workspace, initiative-detail, ai-employee, gate-queue, conference, gateway-adapter, dependency-console, resource-library, knowledge-modules, admin-access, and GitHub release-linkage fresh slices while omitting later sections", () => {
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
  assert.match(html, />Operations Cockpit is foregrounded in the rebuilt workspace</);
  assert.match(html, />Operations cockpit starting surface</);
  assert.match(html, />Docs readiness starting surface</);
  assert.match(html, />Product design target-set starting surface</);
  assert.match(html, />Project workspace starting surface</);
  assert.match(html, />Initiative detail starting surface</);
  assert.match(html, />AI employee starting surface</);
  assert.match(html, />Gate queue starting surface</);
  assert.match(html, />Conference starting surface</);
  assert.match(html, />Gateway and adapter starting surface</);
  assert.match(html, />Dependency console starting surface</);
  assert.match(html, />Resource library starting surface</);
  assert.match(html, />Knowledge modules starting surface</);
  assert.match(html, />Admin and access starting surface</);
  assert.match(html, />GitHub release linkage starting surface</);
  assert.match(html, /Fresh rebuilt module is active in the shared workspace while the standalone page remains retired\./);
  assert.match(html, />Rebuilt module directory</);
  assert.match(html, />Legacy standalone scope</);

  for (const selector of forbiddenRebuildBaselineFreshSectionSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    if (region) {
      assert.doesNotMatch(html, new RegExp(`data-region="${region}"`), `served checkpoint omits ${selector}`);
    }
  }

  assert.match(html, /Docs inspection rows/);
  assert.match(html, /AOS-wide surface index/);
  assert.match(html, /Project workspace current work/);
  assert.match(html, /Initiative detail linked records/);
  assert.match(html, /AI employee roster/);
  assert.match(html, /Gate queue rows/);
  assert.match(html, /Conference list/);
  assert.match(html, /Gateway and adapter rows/);
  assert.match(html, /Dependency governance rows/);
  assert.match(html, /Resource library rows/);
  assert.match(html, /Knowledge module rows/);
  assert.match(html, /Admin and access rows/);
  assert.match(html, /GitHub release linkage rows/);
  assert.equal(
    countMatches(html, /Fresh rebuild surface not started yet\./g),
    0
  );
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

test("Rebuild checkpoint exposes the fresh cockpit, docs, target-set, project-workspace, initiative-detail, ai-employee, gate-queue, conference, gateway-adapter, dependency-console, resource-library, knowledge-modules, admin-access, and GitHub release-linkage sections while still keeping later fresh sections suppressed", () => {
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
  assert.match(html, /data-region="ai-employee-start"/);
  assert.match(html, /data-region="ai-employee-roster"/);
  assert.match(html, /data-region="ai-employee-detail"/);
  assert.match(html, /AI employee starting surface/);
  assert.match(html, /AI employee roster/);
  assert.match(html, /data-region="gate-queue-start"/);
  assert.match(html, /data-region="gate-queue-list"/);
  assert.match(html, /data-region="gate-queue-detail"/);
  assert.match(html, /Gate queue starting surface/);
  assert.match(html, /Gate queue rows/);
  assert.match(html, /data-region="conference-start"/);
  assert.match(html, /data-region="conference-list"/);
  assert.match(html, /data-region="conference-detail"/);
  assert.match(html, /Conference starting surface/);
  assert.match(html, /Conference list/);
  assert.match(html, /data-region="gateway-adapter-start"/);
  assert.match(html, /data-region="gateway-adapter-list"/);
  assert.match(html, /data-region="gateway-adapter-detail"/);
  assert.match(html, /Gateway and adapter starting surface/);
  assert.match(html, /Gateway and adapter rows/);
  assert.match(html, /data-region="dependency-console-start"/);
  assert.match(html, /data-region="dependency-console-list"/);
  assert.match(html, /data-region="dependency-console-detail"/);
  assert.match(html, /Dependency console starting surface/);
  assert.match(html, /Dependency governance rows/);
  assert.match(html, /data-region="resource-library-start"/);
  assert.match(html, /data-region="resource-library-list"/);
  assert.match(html, /data-region="resource-library-detail"/);
  assert.match(html, /Resource library starting surface/);
  assert.match(html, /Resource library rows/);
  assert.match(html, /data-region="knowledge-modules-start"/);
  assert.match(html, /data-region="knowledge-modules-list"/);
  assert.match(html, /data-region="knowledge-modules-detail"/);
  assert.match(html, /Knowledge modules starting surface/);
  assert.match(html, /Knowledge module rows/);
  assert.match(html, /data-region="admin-access-start"/);
  assert.match(html, /data-region="admin-access-list"/);
  assert.match(html, /data-region="admin-access-detail"/);
  assert.match(html, /Admin and access starting surface/);
  assert.match(html, /Admin and access rows/);
  assert.match(html, /data-region="github-release-linkage-start"/);
  assert.match(html, /data-region="github-release-linkage-list"/);
  assert.match(html, /data-region="github-release-linkage-detail"/);
  assert.match(html, /GitHub release linkage starting surface/);
  assert.match(html, /GitHub release linkage rows/);
});

test("Rebuild checkpoint nav uses DS icons and disabled reasons", () => {
  const html = renderRebuildBaselineHtml("/conference.html");
  const navItems = Array.from(html.matchAll(/<a\b(?=[^>]*data-package-runtime-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g));
  const disabledCount = navItems.filter((match) => match[1].includes('aria-disabled="true"')).length;
  const enabledCount = navItems.length - disabledCount;

  assert.ok(navItems.length >= 20);
  assert.ok(enabledCount >= 10);
  assert.ok(disabledCount >= 10);
  for (const [, attributes, body] of navItems) {
    assert.match(body, /\btcrn-icon\b/, "NavItem body includes a DS icon");
    if (attributes.includes('aria-disabled="true"')) {
      assert.match(attributes, /\bdata-disabled-reason="[^"]+"/, "disabled rebuild nav item includes a reason");
    } else {
      assert.match(attributes, /\bhref="#[^"]+"/, "enabled rebuilt module nav item includes an in-page anchor");
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

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

const productVisibleInternalTermsPattern = /\b(readback|checkpoint|route|slice|implementation|workflow|proof|package-runtime|package runtime|functional contract|held for later|unavailable in this route|not claimed|not_claimed)\b/i;
