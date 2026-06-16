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
  assert.match(html, /id="readiness-search"/);
  assert.match(html, /data-empty-state/);
  assert.match(html, /publication not executed/);
  assert.match(html, /release creation not executed/);
});

test("Slice 9B static HTML removes forbidden overclaim copy", () => {
  const html = renderDocsSearchReleaseReadinessHtml().toLowerCase();
  const hits = forbiddenDocsReadinessCopy.filter((phrase) => html.includes(phrase.toLowerCase()));

  assert.deepEqual(hits, []);
});
