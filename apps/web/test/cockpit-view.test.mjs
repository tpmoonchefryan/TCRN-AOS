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
  assert.equal(aosDesignSystemConsumerBridge.uiReactRuntimeSurface, "operations_cockpit_navitem_sidebar_work_index_selected_detail_drawer_gate_readback_cards_stage_phase");
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
  assert.match(html, /data-package-runtime-component-scope="NavItem,WorkIndex,TableShell,SearchInput,Field,FilterBar,Button,Badge,StateView,DetailDrawer,KeyValueList,Surface,Heading,Text,StatusBadge,GateReadinessPanel,ReadbackPanel"/);
  assert.match(html, /data-package-runtime-component="WorkIndex"/);
  assert.match(html, /data-package-runtime-component="SearchInput"/);
  assert.match(html, /data-package-runtime-component="TableShell"/);
  assert.match(html, /data-package-runtime-component="GateReadinessPanel"/);
  assert.match(html, /data-package-runtime-component="ReadbackPanel"/);
  assert.match(html, /data-package-runtime-surface="operations-cockpit-stage-phase"/);
  assert.doesNotMatch(html, /data-package-runtime-component="Input"/);
  assert.match(html, /data-package-runtime-subcomponent="SearchInput\.control"/);
  assert.match(html, /data-package-runtime-surface="operations-cockpit-work-index"/);
  assert.match(html, /--tcrn-color-brand-primary/);
  assert.match(html, /\.tcrn-sr-only\s*\{[^}]*position: absolute;[^}]*width: 1px;[^}]*overflow: hidden;/);
  assert.match(html, /@media \(max-width: 520px\)[\s\S]*\.work-table \.tcrn-table-shell__cell::before\s*\{[^}]*content: attr\(data-label\)/);
});

test("Operations Cockpit Stage Map and AI Employee Phase render package-backed runtime controls", () => {
  const html = renderOperationsCockpitHtml();
  const stageStart = html.indexOf('data-region="stage-map"');
  const stageEnd = html.indexOf("</section>", stageStart);
  const stageHtml = html.slice(stageStart, stageEnd);
  const phaseStart = html.indexOf('data-region="ai-employee-phase"');
  const phaseEnd = html.indexOf("</section>", phaseStart);
  const phaseHtml = html.slice(phaseStart, phaseEnd);

  assert.ok(stageStart > 0, "stage map region is present");
  assert.ok(phaseStart > 0, "AI Employee Phase region is present");
  assert.match(stageHtml, /data-package-runtime-component="Surface"/);
  assert.match(stageHtml, /data-package-runtime-surface="operations-cockpit-stage-phase"/);
  assert.match(stageHtml, /data-package-runtime-component="Heading"/);
  assert.match(stageHtml, /data-package-runtime-component="Button"/);
  assert.match(stageHtml, /data-package-runtime-component="Text"/);
  assert.match(stageHtml, /data-package-runtime-component="Badge"/);
  assert.match(stageHtml, /data-package-runtime-component="StatusBadge"/);
  assert.match(stageHtml, /Stage detail held/);
  assert.match(stageHtml, /data-disabled-reason="Stage detail route is held for the owner-trial implementation proof"/);
  assert.equal((stageHtml.match(/data-stage-id=/g) ?? []).length, 4);
  assert.equal((stageHtml.match(/data-stage-state=/g) ?? []).length, 4);
  assert.match(phaseHtml, /data-package-runtime-component="Surface"/);
  assert.match(phaseHtml, /data-package-runtime-surface="operations-cockpit-stage-phase"/);
  assert.match(phaseHtml, /data-package-runtime-component="Heading"/);
  assert.match(phaseHtml, /data-package-runtime-component="Button"/);
  assert.match(phaseHtml, /data-package-runtime-component="Text"/);
  assert.match(phaseHtml, /data-package-runtime-component="Badge"/);
  assert.match(phaseHtml, /data-package-runtime-component="StatusBadge"/);
  assert.match(phaseHtml, /Role detail held/);
  assert.match(phaseHtml, /data-disabled-reason="Role detail route is held for a later owner-trial slice"/);
  assert.equal((phaseHtml.match(/data-phase-stage-id=/g) ?? []).length, 4);
  assert.ok((phaseHtml.match(/data-owner-role=/g) ?? []).length >= 4);
});

test("Operations Cockpit summary Gate and Readback cards render package-backed runtime controls", () => {
  const html = renderOperationsCockpitHtml();
  const gateStart = html.indexOf('data-region="blocker-gate-card"');
  const gateEnd = html.indexOf("</article>", gateStart);
  const gateHtml = html.slice(gateStart, gateEnd);
  const readbackStart = html.indexOf('data-region="readback-posture-card"');
  const readbackEnd = html.indexOf("</article>", readbackStart);
  const readbackHtml = html.slice(readbackStart, readbackEnd);

  assert.ok(gateStart > 0, "gate work order region is present");
  assert.ok(readbackStart > 0, "readback posture region is present");
  assert.match(gateHtml, /data-tcrn-component="GateReadinessPanel"/);
  assert.match(gateHtml, /data-package-runtime-component="GateReadinessPanel"/);
  assert.match(gateHtml, /data-package-runtime-surface="operations-cockpit-gate-readback-cards"/);
  assert.match(gateHtml, /data-package-runtime-component="Heading"/);
  assert.match(gateHtml, /data-package-runtime-component="Badge"/);
  assert.match(gateHtml, /data-package-runtime-component="StatusBadge"/);
  assert.match(gateHtml, /data-package-runtime-component="StateView"/);
  assert.match(gateHtml, /data-package-runtime-component="Button"/);
  assert.match(gateHtml, /Gate request held/);
  assert.match(gateHtml, /data-disabled-reason="Gate request requires a routed owner-intent or role-gate path"/);
  assert.match(readbackHtml, /data-tcrn-component="ReadbackPanel"/);
  assert.match(readbackHtml, /data-package-runtime-component="ReadbackPanel"/);
  assert.match(readbackHtml, /data-package-runtime-surface="operations-cockpit-gate-readback-cards"/);
  assert.match(readbackHtml, /data-package-runtime-component="KeyValueList"/);
  assert.match(readbackHtml, /Runtime fixture/);
  assert.match(readbackHtml, /Evidence/);
  assert.match(readbackHtml, /Dependency/);
  assert.match(readbackHtml, /Resource/);
  assert.match(readbackHtml, /Evidence detail held/);
  assert.match(readbackHtml, /data-disabled-reason="Evidence detail route is held for a later owner-trial slice"/);
});

test("Operations Cockpit composed package runtime markup has unique id and resolved aria references", () => {
  const html = renderOperationsCockpitHtml();
  const idCounts = collectRealIdCounts(html);
  const duplicateIds = Array.from(idCounts.entries()).filter(([, count]) => count > 1);

  assert.deepEqual(duplicateIds, []);
  for (const reference of collectAriaReferences(html)) {
    for (const id of reference.ids) {
      assert.equal(idCounts.get(id), 1, `${reference.attribute} ${id} resolves exactly once`);
    }
  }
  for (const control of disabledControls(html)) {
    assert.ok(control.parsed["data-disabled-reason"]?.trim(), `disabled control has data-disabled-reason: ${control.attributes}`);
    assert.ok(control.parsed.title?.trim(), `disabled control has title reason: ${control.attributes}`);
    const describedby = control.parsed["aria-describedby"];
    assert.ok(describedby, `disabled control has aria-describedby: ${control.attributes}`);
    const resolvedText = describedby
      .split(/\s+/)
      .map((id) => textForRealId(html, id))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    assert.ok(resolvedText, `disabled control aria-describedby resolves to text: ${control.attributes}`);
    assert.equal(resolvedText, control.parsed["data-disabled-reason"], `disabled reason resolves to own description for ${control.attributes}`);
  }
});

test("Operations Cockpit Work Index renders package-backed runtime controls", () => {
  const html = renderOperationsCockpitHtml();
  const workIndexStart = html.indexOf('data-region="work-index"');
  const workIndexEnd = html.indexOf('<aside class="detail-drawer', workIndexStart);
  const workIndexHtml = html.slice(workIndexStart, workIndexEnd);

  assert.ok(workIndexStart > 0, "work index region is present");
  assert.match(workIndexHtml, /data-package-runtime-component="WorkIndex"/);
  assert.match(workIndexHtml, /data-package-runtime-component="Field"/);
  assert.match(workIndexHtml, /data-package-runtime-component="SearchInput"/);
  assert.doesNotMatch(workIndexHtml, /data-package-runtime-component="Input"/);
  assert.match(workIndexHtml, /data-package-runtime-subcomponent="SearchInput\.control"/);
  assert.match(workIndexHtml, /data-package-runtime-component="FilterBar"/);
  assert.match(workIndexHtml, /data-package-runtime-component="Button"/);
  assert.match(workIndexHtml, /data-package-runtime-component="Badge"/);
  assert.match(workIndexHtml, /data-package-runtime-component="TableShell"/);
  assert.match(workIndexHtml, /data-package-runtime-component="StateView"/);
  assert.match(workIndexHtml, /data-work-table/);
  assert.match(workIndexHtml, /data-work-row/);
  assert.match(workIndexHtml, /aria-label="Service-backed Work Index"/);
  assert.match(workIndexHtml, /Filter service-backed rows/);
});

test("Operations Cockpit selected detail drawer renders package-backed runtime controls", () => {
  const html = renderOperationsCockpitHtml();
  const detailStart = html.indexOf('<aside class="detail-drawer');
  const detailEnd = html.indexOf("</aside>", detailStart);
  const detailHtml = html.slice(detailStart, detailEnd);

  assert.ok(detailStart > 0, "detail drawer region is present");
  assert.match(detailHtml, /data-region="detail-drawer"/);
  assert.match(detailHtml, /data-package-runtime-component="DetailDrawer"/);
  assert.match(detailHtml, /data-package-runtime-surface="operations-cockpit-detail-drawer"/);
  assert.match(detailHtml, /data-service-detail-id="story_[^"]+"/);
  assert.match(detailHtml, /data-service-detail-type="story"/);
  assert.match(detailHtml, /data-selected-story-id="story_[^"]+"/);
  assert.match(detailHtml, /data-drawer-title/);
  assert.match(detailHtml, /data-package-runtime-component="StatusBadge"/);
  assert.match(detailHtml, /data-package-runtime-component="KeyValueList"/);
  assert.match(detailHtml, /data-package-runtime-component="Surface"/);
  assert.match(detailHtml, /data-package-runtime-component="Heading"/);
  assert.match(detailHtml, /data-package-runtime-component="Text"/);
  assert.match(detailHtml, /data-package-runtime-component="Button"/);
  assert.match(detailHtml, /data-detail-list/);
  assert.match(detailHtml, /Selected Detail Readback/);
  assert.match(detailHtml, /Functional contract readback only; no visual, release, product, dependency-clean, or live-dispatch acceptance/);
  assert.match(detailHtml, /Gate work order held/);
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

function collectRealIdCounts(html) {
  const counts = new Map();
  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) {
    const id = parseAttributes(match[2]).id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function collectAriaReferences(html) {
  const references = [];
  for (const match of html.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) {
    const parsed = parseAttributes(match[2]);
    for (const attribute of ["aria-describedby", "aria-labelledby"]) {
      const ids = (parsed[attribute] ?? "").split(/\s+/).filter(Boolean);
      if (ids.length > 0) references.push({ attribute, ids });
    }
  }
  return references;
}

function disabledControls(html) {
  return Array.from(html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g))
    .map((match) => ({
      attributes: match[2],
      body: match[3],
      parsed: parseAttributes(match[2])
    }))
    .filter((control) => control.parsed.disabled === "true" || control.parsed["aria-disabled"] === "true");
}

function textForRealId(html, id) {
  const match = html.match(new RegExp(`<([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\sid="${escapeRegExp(id)}")[^>]*>([\\s\\S]*?)<\\/\\1>`));
  return match ? match[2].replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim() : "";
}

function parseAttributes(raw) {
  const attributes = {};
  for (const match of raw.matchAll(/\s([a-zA-Z0-9:-]+)(?:="([^"]*)")?/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? "true";
  }
  return attributes;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
