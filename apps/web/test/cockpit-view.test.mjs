import test from "node:test";
import assert from "node:assert/strict";
import {
  aosDesignSystemConsumerBridge,
  aosDesignSystemTokenReadback,
  copyAosState
} from "../../../dist/apps/web/src/design-system-bridge.js";
import {
  aosDesignSystemRegisteredComponentNames,
  aosRequiredStaticSurfaceComponents
} from "../../../dist/apps/web/src/static-component-registry.js";
import {
  createSlice4bCockpitReadModel,
  forbiddenProductionCopy,
  renderOperationsCockpitHtml,
  requiredProductionSelectors,
  slice4bBaselineDigest
} from "../../../dist/apps/web/src/cockpit-view.js";

test("Slice 4B view model preserves accepted style baseline boundaries", () => {
  const model = createSlice4bCockpitReadModel();

  assert.equal(slice4bBaselineDigest, "2bccfa9ab9ed95b785135965c4494f38258a27de3c6f4e9cc1fdad51ed75fb90");
  assert.equal(model.contextHeader.selectedProjectId, "TCRN-AOS");
  assert.equal(model.nonClaims.productDesignAcceptance, "not_claimed");
  assert.equal(model.nonClaims.releaseReadinessClaim, "external_proof_required");
  assert.equal(model.nonClaims.liveCodexDispatch, false);
  assert.equal(model.nonClaims.deployment, false);
  assert.equal(model.nonClaims.productAcceptance, false);
  assert.equal(model.dependencyInspection[0].cleanClaim, false);
  assert.equal(model.dependencyInspection[0].legalCompletionClaim, false);
  assert.equal(model.resourceInspection[0].scannerIngestionClaim, false);
  assert.equal(model.resourceInspection[0].materializationExecuted, false);
  assert.equal(model.workstreams[0].rows[0].linkedConferenceIds.length, 1);
  assert.ok(model.workstreams[0].rows[0].nextAllowedLocalActions.includes("record_participant_position"));
  assert.equal(model.conferences[0].minutesStatus, "ready_for_draft");
  assert.equal(model.conferences[0].liveDispatchAuthorized, false);
  assert.equal(model.conferences[0].threadRegistryMutationAuthorized, false);
  assert.equal(model.detailPanel?.rawSourceDisplayed, false);
});

test("Slice 4B production HTML exposes required cockpit regions", () => {
  const html = renderOperationsCockpitHtml();

  for (const selector of requiredProductionSelectors) {
    const region = selector.match(/data-region='([^']+)'/)?.[1];
    assert.ok(region, `selector ${selector} has data-region`);
    assert.ok(html.includes(`data-region="${region}"`), `production HTML includes ${selector}`);
  }
  assert.match(html, /class="brand-tcrn">TCRN/);
  assert.match(html, /class="brand-aos">AOS/);
  assert.match(html, /Local checkpoint observed/);
  assert.match(html, /Static fixture readback/);
  assert.match(html, /data-service-backed="false"/);
  assert.match(html, /data-refresh-readback/);
  assert.match(html, /data-work-table/);
  assert.match(html, /data-row-id=/);
  assert.match(html, /data-drawer-title/);
  assert.match(html, /data-detail-list/);
  assert.match(html, /Gate work order held/);
  assert.match(html, /data-slice5="work-index-drill-through"/);
  assert.match(html, /data-region="conference-operating-loop"/);
  assert.match(html, /Unavailable: live dispatch/);
});

test("AOS Design System consumer bridge exposes token and copy-state contracts", () => {
  const html = renderOperationsCockpitHtml();

  assert.equal(aosDesignSystemConsumerBridge.tokenPackage, "@tcrn/ui-tokens");
  assert.equal(aosDesignSystemConsumerBridge.copyStatePackage, "@tcrn/ui-copy-state");
  assert.equal(aosDesignSystemConsumerBridge.uiReactPackage, "@tcrn/ui-react");
  assert.equal(aosDesignSystemConsumerBridge.uiReactRuntimeSurface, "operations_cockpit_navitem_sidebar");
  assert.equal(aosDesignSystemConsumerBridge.packageBackedReactRuntimeRendering, true);
  assert.equal(aosDesignSystemConsumerBridge.designSystemSourceHead, "b0c00828a813d3c62392eb6e53d7d6b85b6affeb");
  assert.equal(copyAosState("external_proof_required"), "External proof required");
  assert.equal(copyAosState("not_claimed"), "Not claimed");
  assert.equal(copyAosState("record_participant_position"), "Record participant position");
  assert.ok(aosDesignSystemTokenReadback.brandPrimary);
  assert.match(html, /data-design-system-consumer="tokens_copy_state_ui_react_operations_cockpit_runtime_pilot"/);
  assert.match(html, /data-design-system-tokens="@tcrn\/ui-tokens"/);
  assert.match(html, /data-design-system-copy-state="@tcrn\/ui-copy-state"/);
  assert.match(html, /data-design-system-ui-react="@tcrn\/ui-react"/);
  assert.match(html, /data-package-backed-react-runtime-rendering="true"/);
  assert.match(html, /data-package-runtime-component-scope="NavItem"/);
  assert.match(html, /--tcrn-color-brand-primary/);
});

test("disabled cockpit navigation exposes held reasons visibly and accessibly", () => {
  const html = renderOperationsCockpitHtml();
  const heldControls = Array.from(html.matchAll(/<(?:button|a)\b([^>]*(?:\bdisabled\b|aria-disabled="true")[^>]*)>/g))
    .map((match) => match[1]);
  const disabledNavItems = disabledNavItemReadbacks(html);

  assert.ok(heldControls.length > 0);
  for (const attributes of heldControls) {
    const hasReason = /title="[^"]+"/.test(attributes)
      || /aria-describedby="[^"]+"/.test(attributes)
      || /data-disabled-reason="[^"]+"/.test(attributes);
    assert.ok(hasReason, `held control exposes a held reason: ${attributes}`);
  }
  assert.match(html, /Dashboard view is held for a later routed AOS slice/);
  assert.match(html, /this package-runtime pilot keeps Cockpit available only/);
  assert.doesNotMatch(html, /Slice 1 checkpoint/);
  assert.match(html, /data-package-runtime-component="NavItem"/);
  assert.match(html, /data-package-runtime-source="@tcrn\/ui-react"/);
  assert.ok(disabledNavItems.length > 0);
  for (const item of disabledNavItems) {
    assert.doesNotMatch(item.attributes, /\bhref=/, `disabled NavItem must not be actionable: ${item.attributes}`);
    assert.match(item.attributes, /\btabindex="-1"/, `disabled NavItem must be removed from tab order: ${item.attributes}`);
    assert.match(item.attributes, /\bdata-disabled-reason="[^"]+"/, `disabled NavItem exposes DS reason metadata: ${item.attributes}`);
    assert.match(item.attributes, /\btitle="[^"]+"/, `disabled NavItem exposes title reason: ${item.attributes}`);
    assert.match(item.attributes, /\bdata-package-runtime-component="NavItem"/, `disabled NavItem is package-runtime backed: ${item.attributes}`);
    assert.match(item.attributes, /\bdata-package-runtime-source="@tcrn\/ui-react"/, `disabled NavItem records package source: ${item.attributes}`);
    const describedby = item.attributes.match(/\baria-describedby="([^"]+)"/)?.[1];
    assert.ok(describedby, `disabled NavItem exposes aria-describedby: ${item.attributes}`);
    assert.match(item.body, new RegExp(`id="${escapeRegExp(describedby)}"`), "disabled NavItem describes visible reason by id");
    assert.match(item.body, /\btcrn-nav-item__disabled-reason\b/, "disabled NavItem has visible package reason text");
    assert.match(item.body, /package-runtime pilot keeps Cockpit available only/, "disabled NavItem visible reason is specific to 59AN runtime pilot");
  }
});

test("AOS cockpit static renderer uses only registered Design System components", () => {
  const html = renderOperationsCockpitHtml();
  const registered = new Set(aosDesignSystemRegisteredComponentNames);
  const componentNames = Array.from(html.matchAll(/data-tcrn-component="([^"]+)"/g)).map((match) => match[1]);
  const unregistered = componentNames.filter((name) => !registered.has(name));
  const missingRequired = aosRequiredStaticSurfaceComponents.filter((name) => !componentNames.includes(name));

  assert.ok(componentNames.length > 0);
  assert.deepEqual(unregistered, []);
  assert.deepEqual(missingRequired, []);
  assert.match(html, /data-tcrn-component="SideNav"/);
  assert.match(html, /data-tcrn-component="TableShell"/);
  assert.match(html, /data-tcrn-component="DetailDrawer"/);
  assert.doesNotMatch(html, /data-tcrn-component="ProductLockup"/);
  assert.doesNotMatch(html, /data-tcrn-component="TcrnBrandMark"/);
});

test("Slice 4B production HTML can be marked as service-backed for owner-trial service rendering", () => {
  const html = renderOperationsCockpitHtml(createSlice4bCockpitReadModel(), {
    serviceBacked: true,
    cockpitApiPath: "/api/cockpit"
  });

  assert.match(html, /data-service-backed="true"/);
  assert.match(html, /data-cockpit-api="\/api\/cockpit"/);
  assert.match(html, /data-service-model-schema="aos\.cockpit\.service_read_model\.v1"/);
  assert.match(html, /data-service-read-model-source="service_api_read"/);
  assert.match(html, /data-service-work-row-count="1"/);
  assert.match(html, /data-service-gate-count="2"/);
  assert.match(html, /data-service-runtime-data-committed="false"/);
  assert.match(html, /data-service-model-readback>1 work \/ 2 gates \/ detail story/);
  assert.match(html, /service API pending/);
  assert.match(html, /Filter service-backed rows/);
});

test("Slice 4B production HTML removes forbidden overclaim copy", () => {
  const html = renderOperationsCockpitHtml().toLowerCase();
  const hits = forbiddenProductionCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});

test("AOS visible cockpit copy does not leak raw workflow enum labels", () => {
  const html = renderOperationsCockpitHtml();
  const visibleTextFragments = Array.from(html.matchAll(/>([^<>]+)</g)).map((match) => match[1]).join(" ");

  assert.doesNotMatch(visibleTextFragments, /\bexternal_proof_required\b/);
  assert.doesNotMatch(visibleTextFragments, /\bnot_claimed\b/);
  assert.doesNotMatch(visibleTextFragments, /\brelease_proof_required\b/);
  assert.doesNotMatch(visibleTextFragments, /\bowner_intent_required\b/);
  assert.doesNotMatch(visibleTextFragments, /\brecord_participant_position\b/);
  assert.doesNotMatch(visibleTextFragments, /\bopen_evidence_metadata\b/);
});

function disabledNavItemReadbacks(html) {
  return Array.from(html.matchAll(/<a\b(?=[^>]*data-tcrn-component="NavItem")([^>]*)>([\s\S]*?)<\/a>/g))
    .filter((match) => /\baria-disabled="true"/.test(match[1]))
    .map((match) => ({ attributes: match[1], body: match[2] }));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
