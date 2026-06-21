import test from "node:test";
import assert from "node:assert/strict";
import {
  aosDesignSystemConsumerBridge,
  aosDesignSystemTokenReadback,
  copyAosState
} from "../../../dist/apps/web/src/design-system-bridge.js";
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
  assert.equal(aosDesignSystemConsumerBridge.uiReactPackage, "not_adopted_in_slice_1");
  assert.equal(aosDesignSystemConsumerBridge.designSystemSourceHead, "a74742a9cfaa03205d867f7e33dea92c1e8ac6ca");
  assert.equal(copyAosState("external_proof_required"), "External proof required");
  assert.equal(copyAosState("not_claimed"), "Not claimed");
  assert.equal(copyAosState("record_participant_position"), "Record participant position");
  assert.ok(aosDesignSystemTokenReadback.brandPrimary);
  assert.match(html, /data-design-system-consumer="tokens_copy_state_static_renderer_bridge"/);
  assert.match(html, /data-design-system-tokens="@tcrn\/ui-tokens"/);
  assert.match(html, /data-design-system-copy-state="@tcrn\/ui-copy-state"/);
  assert.match(html, /--tcrn-color-brand-primary/);
});

test("disabled cockpit navigation exposes held reasons visibly and accessibly", () => {
  const html = renderOperationsCockpitHtml();
  const disabledButtons = Array.from(html.matchAll(/<button\b([^>]*)\bdisabled\b([^>]*)>/g))
    .map((match) => `${match[1]} ${match[2]}`);

  assert.ok(disabledButtons.length > 0);
  for (const attributes of disabledButtons) {
    const hasReason = /title="[^"]+"/.test(attributes)
      || /aria-describedby="[^"]+"/.test(attributes)
      || /data-disabled-reason="[^"]+"/.test(attributes);
    assert.ok(hasReason, `disabled button exposes a held reason: ${attributes}`);
  }
  assert.match(html, /Dashboard view is held for a later routed AOS slice/);
  assert.match(html, /this service read-model checkpoint keeps Cockpit available only/);
  assert.doesNotMatch(html, /Slice 1 checkpoint/);
  assert.match(html, /aria-describedby="nav-reason-dashboard"/);
  assert.match(html, /Held for later route/);
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
