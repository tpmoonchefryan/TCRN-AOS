import test from "node:test";
import assert from "node:assert/strict";
import {
  createAOSWideProductDesignModel,
  forbiddenAosWidePositiveCopy,
  renderAOSWideProductDesignHtml,
  requiredAosWideSelectors,
  slice10LocalCheckpoint,
  slice10PreImplementationBasis,
  slice10WorkflowPacketBasis
} from "../../../dist/apps/web/src/aos-wide-product-design-view.js";

test("Slice 10 read model exposes all AOS-wide target-set surfaces without acceptance claims", () => {
  const model = createAOSWideProductDesignModel();

  assert.equal(slice10WorkflowPacketBasis, "bcff619a406f2028e6c70ea76a3ade1674e3ca21");
  assert.equal(slice10PreImplementationBasis, "06cded11e97be6d4a738a21ae942128d5b4688cd");
  assert.equal(slice10LocalCheckpoint, "slice-10-aos-wide-product-design-surface-set");
  assert.equal(model.context.productDesignStatus, "target_set_implemented_pending_review");
  assert.equal(model.requiredState.aosWideProductDesignAccepted, false);
  assert.equal(model.requiredState.liveDispatch, false);
  assert.equal(model.requiredState.threadRegistryMutation, false);
  assert.equal(model.requiredState.releaseReadiness, "not_claimed");
  assert.equal(model.requiredState.productAcceptance, "not_claimed");
  assert.equal(model.requiredState.finalMvpAcceptance, "not_claimed");
  assert.equal(model.requiredState.docsExport, "not_executed");
  assert.equal(model.requiredState.docsPublication, "not_claimed");
  assert.equal(model.requiredState.canonicalPromotion, "not_claimed");
  assert.equal(model.requiredState.githubMutation, false);
  assert.equal(model.requiredState.scannerIngestion, false);
  assert.equal(model.requiredState.materializationExecuted, false);
  assert.equal(model.requiredState.productRepoWrite, false);
  assert.equal(model.requiredState.codexSecurityScan, "not_run");
  assert.equal(model.requiredState.externalProofRequired, true);
  assert.equal(model.surfaces.length, 10);
  assert.deepEqual(model.surfaces.map((surface) => surface.id), [
    "project-hierarchy",
    "ticket-drillthrough",
    "ai-employee-profile",
    "gates-owner-intent",
    "conference-minutes",
    "gateway-adapter",
    "knowledge-release",
    "dependency-license",
    "resource-library",
    "admin-access-audit"
  ]);
  assert.equal(model.d024Boundary.runtimeOperationalDumpCommitted, false);
  assert.equal(model.restrictedPayloadPosture.rawSourceStored, false);
});

test("Slice 10 static HTML exposes required modules, anchors, and interactions", () => {
  const html = renderAOSWideProductDesignHtml();

  for (const selector of requiredAosWideSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    assert.ok(region, `selector ${selector} has data-region`);
    assert.ok(html.includes(`data-region="${region}"`), `production HTML includes ${selector}`);
  }
  assert.match(html, /data-surface="aos-wide-product-design"/);
  assert.match(html, /data-product-design-status="target_set_implemented_pending_review"/);
  assert.match(html, />Operations Cockpit</);
  assert.match(html, />Docs Readiness</);
  assert.match(html, />Product Design</);
  assert.match(html, /id="surface-search"/);
  assert.match(html, /data-filter-state="blocked"/);
  assert.match(html, /data-empty-state/);
  assert.match(html, /Request approval/);
  assert.match(html, /Run live action/);
  assert.ok(html.includes("Admin / Access"));
  assert.doesNotMatch(productVisibleAndA11yText(html), /Target set only|target-set checkpoint|local target-set checkpoint|Acceptance not claimed|External proof required|not_claimed|apps\/web\/static/i);
  assert.doesNotMatch(productVisibleAndA11yText(html), productVisibleInternalTermsPattern);
});

test("Slice 10 production HTML removes forbidden positive overclaim copy", () => {
  const html = renderAOSWideProductDesignHtml().toLowerCase();
  const hits = forbiddenAosWidePositiveCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});

test("Slice 10 disabled Design System NavItems are non-actionable with reasons", () => {
  const html = renderAOSWideProductDesignHtml();
  const disabledNavItems = disabledNavItemReadbacks(html);

  assert.ok(disabledNavItems.length > 0);
  for (const item of disabledNavItems) {
    assert.doesNotMatch(item.attributes, /\bhref=/, `disabled NavItem must not be actionable: ${item.attributes}`);
    assert.match(item.attributes, /\btabindex="-1"/, `disabled NavItem must be removed from tab order: ${item.attributes}`);
    assert.match(item.attributes, /\baria-describedby="[^"]+"/, `disabled NavItem has accessible reason linkage: ${item.attributes}`);
    assert.match(item.attributes, /\bdata-disabled-reason="[^"]+"/, `disabled NavItem has reason metadata: ${item.attributes}`);
    assert.match(item.attributes, /\btitle="[^"]+"/, `disabled NavItem has title reason: ${item.attributes}`);
    assert.match(item.body, /\b(?:nav-unavailable-reason|tcrn-nav-item__disabled-reason)\b/, "disabled NavItem has visible reason text");
  }
});

test("Slice 10 disabled target path Select exposes a resolved reason", () => {
  const html = renderAOSWideProductDesignHtml();
  const selectMatch = html.match(/<select\b(?=[^>]*\bid="aos-wide-target-path")([^>]*)>([\s\S]*?)<\/select>/);

  assert.ok(selectMatch, "target path Select is rendered");
  const attributes = selectMatch[1] ?? "";
  assert.match(attributes, /\bdisabled(?:="true")?/, "target path Select remains disabled");
  const reasonMatch = attributes.match(/\bdata-disabled-reason="([^"]+)"/);
  assert.ok(reasonMatch?.[1], "disabled Select has data-disabled-reason");
  assert.match(attributes, /\btitle="[^"]+"/, "disabled Select has title reason");
  const describedbyMatch = attributes.match(/\baria-describedby="([^"]+)"/);
  assert.ok(describedbyMatch?.[1], "disabled Select has aria-describedby");

  const describedbyIds = describedbyMatch[1].split(/\s+/).filter(Boolean);
  assert.equal(describedbyIds.length, 1, "disabled Select has one reason target");
  const reasonId = describedbyIds[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reasonTarget = html.match(new RegExp(`<span\\b(?=[^>]*\\bid="${reasonId}")[^>]*>([\\s\\S]*?)<\\/span>`));
  assert.ok(reasonTarget, "disabled Select reason target resolves");
  const resolvedText = reasonTarget[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  assert.equal(resolvedText, reasonMatch[1], "disabled Select reason matches resolved target text");
});

test("AOS-wide Product Design target-set renders package-backed runtime components", () => {
  const html = renderAOSWideProductDesignHtml();
  const packageComponents = Array.from(new Set(
    Array.from(html.matchAll(/data-package-runtime-component="([^"]+)"/g)).map((match) => match[1])
  )).sort();
  const requiredComponents = [
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
  const markerOnlyComponents = Array.from(html.matchAll(/<([a-zA-Z][\w:-]*)\b(?=[^>]*data-tcrn-component="([^"]+)")(?![^>]*data-package-runtime-component=)(?![^>]*data-package-runtime-subcomponent=)([^>]*)>/g))
    .map((match) => ({ tag: match[1], component: match[2] }));

  assert.match(html, /data-package-backed-react-runtime-rendering="true"/);
  assert.match(html, /data-package-runtime-surface="aos_wide_product_design_target_set_package_runtime_adoption"/);
  assert.match(html, /data-aos-wide-product-design-accepted="false"/);
  assert.deepEqual(requiredComponents.filter((component) => !packageComponents.includes(component)), []);
  assert.deepEqual(markerOnlyComponents, []);
  assert.equal((html.match(/<button\b(?=[^>]*data-surface-row=)/g) ?? []).length, 10);
  assert.match(html, /data-package-runtime-subcomponent="SearchInput\.control"/);
  assert.doesNotMatch(html, /data-package-runtime-component="Input"/);
  assert.match(html, /data-region="disabled-action-gate"/);
  assert.match(html, /data-region="evidence-readiness-panel"/);
});

function disabledNavItemReadbacks(html) {
  return Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .filter((match) => /\baria-disabled="true"/.test(match[1]))
    .map((match) => ({ attributes: match[1], body: match[2] }));
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
