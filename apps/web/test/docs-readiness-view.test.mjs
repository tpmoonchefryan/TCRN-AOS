import test from "node:test";
import assert from "node:assert/strict";
import {
  createSlice9bDocsSearchReleaseReadModel,
  forbiddenDocsReadinessCopy,
  renderDocsSearchReleaseReadinessHtml,
  requiredDocsReadinessSelectors,
  slice9bPreImplementationBasis,
  slice9bWorkflowPacketBasis
} from "../../../dist/apps/web/src/docs-readiness-view.js";

test("Slice 9B read model exposes docs search release surfaces without broad claims", () => {
  const model = createSlice9bDocsSearchReleaseReadModel();

  assert.equal(slice9bWorkflowPacketBasis, "624127182da417f65c790de155e3297e77828181");
  assert.equal(slice9bPreImplementationBasis, "9d7980f46245bb783b520c9f90945da8609c01ce");
  assert.equal(model.context.projectId, "TCRN-AOS");
  assert.equal(model.context.docsSearchReleaseSurfacesVisible, true);
  assert.equal(model.context.productDesignStatus, "local_static_surface_only");
  assert.equal(model.rows.length, 4);
  assert.deepEqual(model.rows.map((row) => row.storyId), ["AOS-S057", "AOS-S058", "AOS-S062", "AOS-S063"]);
  assert.equal(model.docsReadiness.docsPublished, false);
  assert.equal(model.searchIndex.rawSourceIndexed, false);
  assert.equal(model.githubMetadata.githubWriteExecuted, false);
  assert.equal(model.prCiReadiness.releaseReadyClaimed, false);
  assert.equal(model.releaseCandidate.releaseCreated, false);
  assert.equal(model.releaseCandidate.productAccepted, false);
  assert.equal(model.aggregateIndex.docsReadinessRecordIds.length, 1);
  assert.equal(model.aggregateIndex.searchIndexRecordIds.length, 1);
  assert.equal(model.aggregateIndex.githubMetadataIds.length, 1);
  assert.equal(model.aggregateIndex.prCiReadinessIds.length, 1);
  assert.equal(model.aggregateIndex.releaseCandidateIds.length, 1);
  assert.equal(model.noClaims.docsPublication, false);
  assert.equal(model.noClaims.docsExport, false);
  assert.equal(model.noClaims.canonicalPromotion, false);
  assert.equal(model.noClaims.githubMutation, false);
  assert.equal(model.noClaims.releaseCreation, false);
  assert.equal(model.noClaims.deployment, false);
  assert.equal(model.noClaims.productDesignFinalAcceptance, false);
  assert.equal(model.noClaims.productAcceptance, false);
  assert.equal(model.noClaims.finalMvpAcceptance, false);
});

test("Slice 9B static HTML exposes required visible inspection regions", () => {
  const html = renderDocsSearchReleaseReadinessHtml();

  for (const selector of requiredDocsReadinessSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    assert.ok(region, `selector ${selector} has data-region`);
    assert.ok(html.includes(`data-region="${region}"`), `production HTML includes ${selector}`);
  }
  assert.match(html, /data-surface="docs-search-release-readiness"/);
  assert.match(html, /data-docs-search-release-surfaces-visible="true"/);
  assert.match(html, /data-package-backed-react-runtime-rendering="true"/);
  assert.match(html, /data-package-runtime-surface="docs_readiness_search_release_package_runtime_adoption"/);
  assert.match(html, /id="readiness-search"/);
  assert.match(html, /data-empty-state/);
  assert.match(html, /Drafts stay local/);
  assert.match(html, /Release actions disabled/);
  assert.doesNotMatch(productVisibleAndA11yText(html), /publication not executed|release creation not executed|proof required|Slice 9B|slice-9b/i);
  assert.doesNotMatch(productVisibleAndA11yText(html), productVisibleInternalTermsPattern);
});

test("Slice 9B Docs Readiness runtime uses package-backed components instead of marker-only claims", () => {
  const html = renderDocsSearchReleaseReadinessHtml();
  const requiredPackageComponents = [
    "Surface",
    "SideNav",
    "NavGroup",
    "NavItem",
    "LinkButton",
    "TopBar",
    "Field",
    "Select",
    "Button",
    "Badge",
    "StatusBadge",
    "EvidenceStrip",
    "ReadbackPanel",
    "Text",
    "Heading",
    "KeyValueList",
    "WorkIndex",
    "TableShell",
    "SearchInput",
    "FilterBar",
    "StateView",
    "DetailDrawer"
  ];

  for (const component of requiredPackageComponents) {
    assert.match(html, new RegExp(`data-package-runtime-component="${component}"`), `${component} is package-runtime rendered`);
  }

  const markerOnlyClaims = Array.from(html.matchAll(/<[^>]+data-tcrn-component="([^"]+)"[^>]*>/g))
    .filter((match) => !match[0].includes("data-package-runtime-component=") && !match[0].includes("data-package-runtime-subcomponent="))
    .map((match) => match[1]);
  assert.deepEqual(markerOnlyClaims, []);
});

test("Slice 9B static HTML removes forbidden overclaim copy", () => {
  const html = renderDocsSearchReleaseReadinessHtml().toLowerCase();
  const hits = forbiddenDocsReadinessCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});

test("Slice 9B disabled Design System NavItems are non-actionable with reasons", () => {
  const html = renderDocsSearchReleaseReadinessHtml();
  const disabledNavItems = disabledNavItemReadbacks(html);

  assert.ok(disabledNavItems.length > 0);
  for (const item of disabledNavItems) {
    assert.doesNotMatch(item.attributes, /\bhref=/, `disabled NavItem must not be actionable: ${item.attributes}`);
    assert.match(item.attributes, /\btabindex="-1"/, `disabled NavItem must be removed from tab order: ${item.attributes}`);
    assert.match(item.attributes, /\baria-describedby="[^"]+"/, `disabled NavItem has accessible reason linkage: ${item.attributes}`);
    assert.match(item.attributes, /\bdata-disabled-reason="[^"]+"/, `disabled NavItem has reason metadata: ${item.attributes}`);
    assert.match(item.attributes, /\btitle="[^"]+"/, `disabled NavItem has title reason: ${item.attributes}`);
    assert.match(item.body, /\btcrn-nav-item__disabled-reason\b/, "disabled NavItem has package visible reason text");
  }
});

test("Slice 9B navigation aligns with consumed SideNav Storybook standard", () => {
  const html = renderDocsSearchReleaseReadinessHtml();

  assert.doesNotMatch(html, /\baos-sidebar\b|\bnav-row\b|\bnav-stack\b/);
  assert.match(html, /class="tcrn-side-nav"/);
  assert.match(html, /data-navigation-primitive="side-nav"/);
  assert.match(html, /class="tcrn-nav-group"/);
  assert.match(html, /data-navigation-primitive="nav-group"/);
  assert.match(html, /class="tcrn-nav-item"/);
  assert.match(html, /data-selected="true"/);
  assert.match(html, /class="tcrn-nav-item__disabled-reason"/);

  const navItems = navItemReadbacks(html);
  assert.equal(navItems.length, 5, "all docs readiness NavItems are rendered");
  assert.equal(navItems.filter((item) => item.iconNames.length === 0).length, 0, "all docs readiness NavItems render DS icons");
  assert.ok(navItems.every((item) => item.iconNames.every((name) => tcrnIconNames.has(name))), "docs readiness NavItems use registered DS icon names");
});

function disabledNavItemReadbacks(html) {
  return Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .filter((match) => /\baria-disabled="true"/.test(match[1]))
    .map((match) => ({ attributes: match[1], body: match[2] }));
}

function navItemReadbacks(html) {
  return Array.from(html.matchAll(/<a\b(?=[^>]*data-navigation-primitive="nav-item")([^>]*)>([\s\S]*?)<\/a>/g))
    .map((match) => ({
      attributes: match[1],
      body: match[2],
      iconNames: Array.from(match[2].matchAll(/data-icon-name="([^"]+)"/g)).map((iconMatch) => iconMatch[1]),
      label: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    }));
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const productVisibleInternalTermsPattern =
  /\breadback\b|\bcheckpoint\b|\broute\b|\bfixture\b|proof required|external proof required|package-runtime pilot|functional contract readback only|held for later|unavailable in this route|not claimed|not_claimed/i;

const tcrnIconNames = new Set([
  "alert-triangle",
  "arrow-left",
  "arrow-right",
  "book-open",
  "check",
  "chevron-down",
  "chevron-left",
  "chevron-right",
  "database",
  "external-link",
  "home",
  "info",
  "loader-circle",
  "menu",
  "package",
  "panel-left-close",
  "panel-left-open",
  "search",
  "settings",
  "x"
]);

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
