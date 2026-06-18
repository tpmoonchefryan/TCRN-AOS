import test from "node:test";
import assert from "node:assert/strict";
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
  assert.match(html, /local fixture readback current/);
  assert.match(html, /data-service-backed="false"/);
  assert.match(html, /data-refresh-readback/);
  assert.match(html, /data-work-table/);
  assert.match(html, /data-row-id=/);
  assert.match(html, /data-drawer-title/);
  assert.match(html, /data-detail-list/);
  assert.match(html, /Gate work order held/);
  assert.match(html, /data-slice5="work-index-drill-through"/);
  assert.match(html, /data-region="conference-operating-loop"/);
  assert.match(html, /live dispatch false/);
});

test("Slice 4B production HTML can be marked as service-backed for owner-trial service rendering", () => {
  const html = renderOperationsCockpitHtml(createSlice4bCockpitReadModel(), {
    serviceBacked: true,
    cockpitApiPath: "/api/cockpit"
  });

  assert.match(html, /data-service-backed="true"/);
  assert.match(html, /data-cockpit-api="\/api\/cockpit"/);
  assert.match(html, /service API pending/);
  assert.match(html, /Filter service-backed rows/);
});

test("Slice 4B production HTML removes forbidden overclaim copy", () => {
  const html = renderOperationsCockpitHtml().toLowerCase();
  const hits = forbiddenProductionCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});
