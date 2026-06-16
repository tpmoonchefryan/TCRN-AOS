import {
  AosStore,
  createDefaultSeed,
  createId
} from "../../../dist/packages/domain/src/index.js";

export const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice9-fixture"
};

const estimate = {
  effortPoints: 4,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

export function docsSearchScenario(sessionId = "slice9-fixture") {
  const fixtureActor = { ...actor, sessionId };
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 9 docs search release linkage",
    status: "in_progress",
    problem: "Docs search and release-candidate linkage need local readback without publication claims.",
    expectedOutcome: "Search, GitHub metadata, PR/CI linkage, and release-candidate posture stay local and not-ready."
  }, fixtureActor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Docs search and release linkage",
    goal: "Build sanitized local docs search and release-candidate linkage metadata.",
    status: "in_progress"
  }, fixtureActor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Link docs readiness to release-candidate metadata",
    problem: "Reviewers need local readiness and blocker readbacks without release claims.",
    user: "release reviewer",
    expectedBehavior: "Records expose missing, warning, blocked, and not-ready states locally.",
    acceptanceCriteria: ["sanitized search", "read-only GitHub metadata", "not-ready release candidate"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, fixtureActor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-9-docs-search-release-linkage-proof",
    validity: "valid",
    producer: fixtureActor.employeeId,
    digest: "sha256:slice9",
    redactionState: "metadata_only"
  }, fixtureActor);
  const gate = store.requestGate({
    type: "verification",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, fixtureActor);
  const releaseNote = store.createReleaseNote({
    id: createId("release_note", { storyId: story.id, releaseLabel: "slice-9-local" }),
    projectId: "TCRN-AOS",
    releaseLabel: "slice-9-local",
    linkedStoryIds: [story.id],
    userFacingSummary: "Local release-candidate linkage is visible for review.",
    internalNotesSummary: "No release creation or GitHub write is claimed.",
    riskNotesSummary: "Release readiness remains blocked until external proof.",
    linkedEvidenceIds: [evidence.id],
    reviewState: "review_required",
    gitExportAuthorized: false,
    releaseCloseoutClaimed: false
  }, fixtureActor);
  store.createKnowledgeEntry({
    id: createId("knowledge", { storyId: story.id, category: "release" }),
    projectId: "TCRN-AOS",
    category: "release",
    status: "proposed",
    sourceKind: "story",
    sourceIds: [story.id],
    linkedTicketIds: [story.id],
    linkedConferenceIds: [],
    linkedEvidenceIds: [evidence.id],
    freshnessState: "review_due",
    rawPrivatePayloadStored: false,
    canonicalPromotionClaimed: false,
    localFirstStorage: true,
    defaultGitStorage: false,
    explicitExportRequired: true
  }, fixtureActor);
  store.createUserGuideDraft({
    id: createId("guide", { storyId: story.id, audience: "release_reviewer" }),
    projectId: "TCRN-AOS",
    audience: "release_reviewer",
    versionLabel: "slice-9-local",
    status: "review_required",
    linkedStoryIds: [story.id],
    linkedReleaseNoteItemIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id],
    publishedStateDistinctFromDraft: true,
    releaseCloseoutClaimed: false,
    defaultGitStorage: false
  }, fixtureActor);
  const dependency = store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: "example-review-only",
    versionRange: "0.0.0-fixture",
    sourceSystem: "deterministic_fixture",
    projectUsage: "development",
    ownerRole: "security",
    lifecycleState: "unapproved",
    licenseExpression: "UNKNOWN",
    evidenceStatus: "evidence_missing",
    policyClass: "review_required",
    residualRisk: "blocked",
    nextAction: "request_review",
    sbomNoticeObligation: "review_required",
    posture: "evidence_missing",
    approvalOwnerRole: "security",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id],
    releaseBlocker: true
  }, fixtureActor);
  const resource = store.createResourceRecord({
    type: "external_reference",
    projectId: "TCRN-AOS",
    title: "Example release asset metadata",
    owner: "resource-library",
    source: "fixture",
    version: "0.0.0",
    digest: "sha256:slice9-resource",
    storageReference: "metadata-only",
    classification: ["release-candidate", "metadata-only"],
    permissionState: "permission_required",
    residualRisk: "blocked",
    copyrightStatus: "review_required",
    lifecycleState: "proposed",
    approvalState: "blocked",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id],
    materializationAllowed: false,
    releaseBlocker: true
  }, fixtureActor);
  return { store, actor: fixtureActor, initiative, story, evidence, gate, releaseNote, dependency, resource };
}

export function docsReadinessInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    targetType: "release_note",
    targetId: scenario.releaseNote.id,
    readinessState: "needs_review",
    freshnessState: "review_due",
    linkedStoryIds: [scenario.story.id],
    linkedEvidenceIds: [scenario.evidence.id],
    linkedGateIds: [scenario.gate.id],
    stageMapContext: {
      initiativeId: scenario.initiative.id,
      stageIds: ["verification", "release"]
    },
    blockers: ["release proof required"]
  };
}

export function searchInput(scenario) {
  return {
    projectId: "TCRN-AOS",
    sourceType: "release_note",
    sourceId: scenario.releaseNote.id,
    title: "Slice 9 release note metadata",
    summary: "Sanitized local release-note summary for review.",
    sanitizedTerms: ["slice-9", "release-note", "metadata"],
    linkedStoryIds: [scenario.story.id],
    linkedEvidenceIds: [scenario.evidence.id],
    linkedGateIds: [scenario.gate.id]
  };
}

export function githubInput() {
  return {
    projectId: "TCRN-AOS",
    repoRegistryId: "TCRN-AOS",
    repositoryName: "TCRN-AOS-local",
    defaultBranch: "main",
    branchName: "main",
    commitSha: "9530c3ad4c42eb838972139f04ff72e1c59383f6",
    pullRequestRefs: ["fixture-pr-9"],
    ciRunRefs: ["fixture-ci-9"],
    releaseReferenceIds: [],
    readbackState: "fixture_readback",
    warnings: ["local fixture metadata only"],
    blockers: []
  };
}

export function prciInput(scenario, githubMetadataId) {
  return {
    projectId: "TCRN-AOS",
    storyId: scenario.story.id,
    githubMetadataId,
    pullRequestState: "verified_local_metadata",
    ciState: "warning",
    readinessState: "not_ready_for_release",
    warnings: ["CI metadata is fixture readback only"],
    blockers: [],
    linkedEvidenceIds: [scenario.evidence.id]
  };
}

export function candidateInput(scenario, readinessId, githubMetadataId, prCiReadinessId) {
  return {
    projectId: "TCRN-AOS",
    releaseCandidateLabel: "slice-9-local-candidate",
    status: "not_ready_for_release",
    storyIds: [scenario.story.id],
    docsReadinessRecordIds: [readinessId],
    releaseNoteItemIds: [scenario.releaseNote.id],
    evidenceIds: [scenario.evidence.id],
    dependencyBlockerIds: [scenario.dependency.id],
    resourceBlockerIds: [scenario.resource.id],
    gateIds: [scenario.gate.id],
    githubMetadataIds: [githubMetadataId],
    prCiReadinessIds: [prCiReadinessId],
    residualRisks: ["release candidate is local linkage only"]
  };
}
