import test from "node:test";
import assert from "node:assert/strict";
import {
  actor,
  candidateInput,
  docsReadinessInput,
  docsSearchScenario,
  githubInput,
  prciInput,
  searchInput
} from "./slice9-fixture.mjs";

test("Slice 9 docs readiness search and release-candidate linkage stay local and not-ready", () => {
  const scenario = docsSearchScenario("slice9-domain-test");
  const readiness = scenario.store.createDocsReadinessRecord(docsReadinessInput(scenario), actor);
  const searchRecord = scenario.store.createProjectSearchIndexRecord(searchInput(scenario), actor);
  const github = scenario.store.createGitHubMetadataReadback(githubInput(), actor);
  const prci = scenario.store.createPrCiStoryReadiness(prciInput(scenario, github.id), actor);
  const candidate = scenario.store.createReleaseCandidateLinkage(candidateInput(scenario, readiness.id, github.id, prci.id), actor);
  const index = scenario.store.createDocsSearchReleaseLinkageIndex("TCRN-AOS");

  assert.equal(readiness.docsPublished, false);
  assert.equal(searchRecord.rawSourceIndexed, false);
  assert.equal(github.githubWriteExecuted, false);
  assert.equal(prci.releaseReadyClaimed, false);
  assert.equal(candidate.releaseCreated, false);
  assert.equal(candidate.productAccepted, false);
  assert.deepEqual(index.docsReadinessRecordIds, [readiness.id]);
  assert.deepEqual(index.searchIndexRecordIds, [searchRecord.id]);
  assert.deepEqual(index.githubMetadataIds, [github.id]);
  assert.deepEqual(index.prCiReadinessIds, [prci.id]);
  assert.deepEqual(index.releaseCandidateIds, [candidate.id]);
  assert.ok(index.blockedReadinessIds.includes(readiness.id));
  assert.ok(index.blockedReleaseCandidateIds.includes(candidate.id));
  assert.ok(index.linkedStoryIds.includes(scenario.story.id));
  assert.ok(index.linkedEvidenceIds.includes(scenario.evidence.id));
  assert.ok(index.linkedGateIds.includes(scenario.gate.id));
  assert.equal(index.releaseReadyClaimed, false);
  assert.equal(index.publicReadinessClaimed, false);
  assert.equal(index.finalMvpAccepted, false);
  assert.equal(index.legalCompletionClaimed, false);
  assert.equal(index.dependencyCleanClaimed, false);
});

test("Slice 9 write paths fail closed on publication execution and acceptance claims", () => {
  const scenario = docsSearchScenario("slice9-fail-closed-test");
  assert.throws(() => scenario.store.createDocsReadinessRecord({ ...docsReadinessInput(scenario), docsPublished: true }, actor), /docsPublished/);
  assert.throws(() => scenario.store.createProjectSearchIndexRecord({ ...searchInput(scenario), rawSourceIndexed: true }, actor), /rawSourceIndexed/);
  assert.throws(() => scenario.store.createGitHubMetadataReadback({ ...githubInput(), githubWriteExecuted: true }, actor), /githubWriteExecuted/);
  assert.throws(() => scenario.store.createReleaseCandidateLinkage({
    ...candidateInput(scenario, "missing-readiness", "missing-github", "missing-prci"),
    releaseCreated: true
  }, actor), /releaseCreated/);
  const syntheticPath = "/" + "Users/example/private-docs.md";
  assert.throws(() => scenario.store.createProjectSearchIndexRecord({ ...searchInput(scenario), summary: syntheticPath }, actor), /restricted machine_local_absolute_path/);
});
