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
  assert.ok(html.includes("apps/web/static/operations-cockpit.html"));
  assert.ok(html.includes("apps/web/static/docs-search-release-readiness.html"));
  assert.ok(html.includes("apps/web/static/aos-wide-product-design.html"));
  assert.match(html, /id="surface-search"/);
  assert.match(html, /data-filter-state="blocked"/);
  assert.match(html, /data-empty-state/);
  assert.match(html, /Owner action locked/);
  assert.match(html, /Live dispatch unavailable/);
  assert.ok(html.includes("Admin / Access"));
});

test("Slice 10 production HTML removes forbidden positive overclaim copy", () => {
  const html = renderAOSWideProductDesignHtml().toLowerCase();
  const hits = forbiddenAosWidePositiveCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});
