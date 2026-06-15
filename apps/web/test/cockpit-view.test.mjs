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
  assert.match(html, /Open gate work order/);
});

test("Slice 4B production HTML removes forbidden overclaim copy", () => {
  const html = renderOperationsCockpitHtml().toLowerCase();
  const hits = forbiddenProductionCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});
