import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";
import {
  actor as baseActor,
  candidateInput,
  docsReadinessInput,
  docsSearchScenario,
  githubInput,
  prciInput,
  searchInput
} from "../packages/domain/test/slice9-fixture.mjs";

const actor = {
  ...baseActor,
  sessionId: "slice9-proof"
};

const modelProof = proveDocsSearchReleaseCandidateModel();
const gatewayProof = proveGatewayDocsSearchReleaseCandidateMethods();
const restrictedPayloadProof = proveRestrictedPayloadRejected();
const executionClaimProof = proveExecutionClaimsFailClosed();

const ok = modelProof.ok
  && gatewayProof.ok
  && restrictedPayloadProof.ok
  && executionClaimProof.ok;

console.log(JSON.stringify({
  ok,
  modelProof,
  gatewayProof,
  restrictedPayloadProof,
  executionClaimProof,
  d024Boundary: {
    localFirstStorage: true,
    runtimeOperationalDataCommittedToGit: false,
    gitTracksOnlySourceSchemasFixturesTestsScriptsDocsEvidence: true,
    docsPublicationExecuted: false,
    gitExportExecuted: false,
    canonicalKnowledgePromotionExecuted: false,
    releaseCreationExecuted: false,
    githubWriteExecuted: false
  },
  noOverclaim: {
    docsPublished: false,
    docsExported: false,
    canonicalKnowledgePromoted: false,
    releaseReadyClaimed: false,
    publicReadinessClaimed: false,
    productAccepted: false,
    finalMvpAccepted: false,
    deploymentExecuted: false,
    liveCodexDispatch: false,
    selenePublication: false,
    scannerIngestionExecuted: false,
    resourceMaterializationExecuted: false
  },
  productDesignStatus: {
    visibleUiChanged: false,
    finalUxLayoutVisualAcceptance: false,
    browserAcceptanceCloseout: false
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}

function proveDocsSearchReleaseCandidateModel() {
  const scenario = docsSearchScenario("slice9-model-proof");
  const records = createRecords(scenario);
  const index = scenario.store.createDocsSearchReleaseLinkageIndex("TCRN-AOS");
  const auditActions = scenario.store.queryAudit().map((event) => event.action);
  const requiredActions = [
    "docs.readiness.record",
    "docs.search.index",
    "github.metadata.record",
    "pr_ci.story_readiness.record",
    "release_candidate.linkage.record"
  ];
  return {
    scenario: "docs_search_release_candidate_linkage_model",
    ok: index.docsReadinessRecordIds.length === 1
      && index.searchIndexRecordIds.length === 1
      && index.githubMetadataIds.length === 1
      && index.prCiReadinessIds.length === 1
      && index.releaseCandidateIds.length === 1
      && index.blockedReadinessIds.includes(records.readiness.id)
      && index.blockedReleaseCandidateIds.includes(records.candidate.id)
      && index.linkedStoryIds.includes(scenario.story.id)
      && index.linkedEvidenceIds.includes(scenario.evidence.id)
      && requiredActions.every((action) => auditActions.includes(action))
      && allNoExecution(index)
      && records.readiness.docsPublished === false
      && records.search.rawSourceIndexed === false
      && records.github.githubWriteExecuted === false
      && records.prci.releaseReadyClaimed === false
      && records.candidate.releaseCreated === false,
    counts: {
      docsReadiness: index.docsReadinessRecordIds.length,
      searchIndexRecords: index.searchIndexRecordIds.length,
      githubMetadata: index.githubMetadataIds.length,
      prCiReadiness: index.prCiReadinessIds.length,
      releaseCandidates: index.releaseCandidateIds.length,
      blockedReadiness: index.blockedReadinessIds.length,
      blockedReleaseCandidates: index.blockedReleaseCandidateIds.length,
      linkedStories: index.linkedStoryIds.length,
      linkedEvidence: index.linkedEvidenceIds.length
    },
    noExecutionClaims: noExecutionSummary(index)
  };
}

function proveGatewayDocsSearchReleaseCandidateMethods() {
  const scenario = docsSearchScenario("slice9-gateway-proof");
  const gateway = new McpGateway(scenario.store);
  const readiness = gateway.handle({
    method: "aos.docs.readiness.record",
    actor,
    params: docsReadinessInput(scenario),
    idempotencyKey: "slice9-proof-readiness"
  });
  const duplicateReadiness = gateway.handle({
    method: "aos.docs.readiness.record",
    actor,
    params: docsReadinessInput(scenario),
    idempotencyKey: "slice9-proof-readiness"
  });
  const search = gateway.handle({
    method: "aos.docs.search.index",
    actor,
    params: searchInput(scenario)
  });
  const github = gateway.handle({
    method: "aos.github.metadata.record",
    actor,
    params: githubInput()
  });
  const prci = gateway.handle({
    method: "aos.pr_ci.story_readiness.record",
    actor,
    params: prciInput(scenario, github.result.id)
  });
  const candidate = gateway.handle({
    method: "aos.release_candidate.linkage.record",
    actor,
    params: candidateInput(scenario, readiness.result.id, github.result.id, prci.result.id)
  });
  const index = gateway.handle({
    method: "aos.release_candidate.linkage.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });
  return {
    scenario: "mcp_gateway_docs_search_release_candidate_methods",
    ok: readiness.ok
      && duplicateReadiness.status === "deduped"
      && search.ok
      && github.ok
      && prci.ok
      && candidate.ok
      && index.status === "read"
      && allNoExecution(index.result),
    statuses: {
      readiness: readiness.status,
      duplicateReadiness: duplicateReadiness.status,
      search: search.status,
      github: github.status,
      prci: prci.status,
      candidate: candidate.status,
      index: index.status
    },
    indexCounts: index.ok ? {
      docsReadiness: index.result.docsReadinessRecordIds.length,
      searchIndexRecords: index.result.searchIndexRecordIds.length,
      githubMetadata: index.result.githubMetadataIds.length,
      prCiReadiness: index.result.prCiReadinessIds.length,
      releaseCandidates: index.result.releaseCandidateIds.length,
      blockedReleaseCandidates: index.result.blockedReleaseCandidateIds.length
    } : {}
  };
}

function proveRestrictedPayloadRejected() {
  const scenario = docsSearchScenario("slice9-restricted-payload-proof");
  const syntheticLocalPath = "/" + "Users/example/slice9-search-index.md";
  const result = expectRejected(
    () => scenario.store.createProjectSearchIndexRecord({
      ...searchInput(scenario),
      summary: syntheticLocalPath
    }, actor),
    /machine_local_absolute_path/
  );
  return {
    scenario: "restricted_docs_search_payload_rejected",
    ok: result.ok,
    rejected: result.ok,
    reasonKind: result.ok ? "machine_local_absolute_path" : "other"
  };
}

function proveExecutionClaimsFailClosed() {
  const scenario = docsSearchScenario("slice9-execution-claim-proof");
  const readinessClaim = expectRejected(
    () => scenario.store.createDocsReadinessRecord({
      ...docsReadinessInput(scenario),
      docsPublished: true
    }, actor),
    /docsPublished/
  );
  const githubClaim = expectRejected(
    () => scenario.store.createGitHubMetadataReadback({
      ...githubInput(),
      releaseCreated: true
    }, actor),
    /releaseCreated/
  );
  const candidateClaim = expectRejected(
    () => scenario.store.createReleaseCandidateLinkage({
      ...candidateInput(scenario, "missing-readiness", "missing-github", "missing-prci"),
      productAccepted: true
    }, actor),
    /productAccepted/
  );
  return {
    scenario: "release_publication_execution_claims_fail_closed",
    ok: readinessClaim.ok && githubClaim.ok && candidateClaim.ok,
    rejectedClaims: {
      docsPublished: readinessClaim.ok,
      releaseCreated: githubClaim.ok,
      productAccepted: candidateClaim.ok
    }
  };
}

function createRecords(scenario) {
  const readiness = scenario.store.createDocsReadinessRecord(docsReadinessInput(scenario), actor);
  const search = scenario.store.createProjectSearchIndexRecord(searchInput(scenario), actor);
  const github = scenario.store.createGitHubMetadataReadback(githubInput(), actor);
  const prci = scenario.store.createPrCiStoryReadiness(prciInput(scenario, github.id), actor);
  const candidate = scenario.store.createReleaseCandidateLinkage(candidateInput(scenario, readiness.id, github.id, prci.id), actor);
  return { readiness, search, github, prci, candidate };
}

function allNoExecution(index) {
  return index.docsPublished === false
    && index.gitExportExecuted === false
    && index.canonicalKnowledgePromoted === false
    && index.githubWriteExecuted === false
    && index.releaseCreated === false
    && index.deploymentExecuted === false
    && index.productAccepted === false
    && index.finalMvpAccepted === false
    && index.releaseReadyClaimed === false
    && index.publicReadinessClaimed === false
    && index.legalCompletionClaimed === false
    && index.dependencyCleanClaimed === false;
}

function noExecutionSummary(index) {
  return {
    docsPublished: index.docsPublished,
    gitExportExecuted: index.gitExportExecuted,
    canonicalKnowledgePromoted: index.canonicalKnowledgePromoted,
    githubWriteExecuted: index.githubWriteExecuted,
    releaseCreated: index.releaseCreated,
    deploymentExecuted: index.deploymentExecuted,
    productAccepted: index.productAccepted,
    finalMvpAccepted: index.finalMvpAccepted,
    releaseReadyClaimed: index.releaseReadyClaimed,
    publicReadinessClaimed: index.publicReadinessClaimed,
    legalCompletionClaimed: index.legalCompletionClaimed,
    dependencyCleanClaimed: index.dependencyCleanClaimed
  };
}

function expectRejected(action, pattern) {
  try {
    action();
    return { ok: false, message: "operation was accepted unexpectedly" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: pattern.test(message), message };
  }
}
