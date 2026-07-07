import {
  AosStore,
  createDefaultSeed,
  createId
} from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice6-proof"
};

const arturo = {
  employeeId: "employee-arturo",
  role: "coordinator",
  threadId: "019eb66e-00d1-7190-81d9-693895b32033",
  sessionId: "slice6-proof"
};

const scenarios = [
  proveKnowledgeFromConference(),
  proveGuideDraftFromStory(),
  proveReleaseNoteDraft(),
  proveStaleKnowledgeFollowup(),
  proveExportBlockedWithoutOwnerGate(),
  proveRestrictedPayloadRejected()
];

const gatewayProof = proveGatewayDocumentationMethods();

const ok = scenarios.every((scenario) => scenario.ok) && gatewayProof.ok;

console.log(JSON.stringify({
  ok,
  scenarios,
  gatewayProof,
  d024Boundary: {
    localFirstStorage: true,
    defaultGitStorage: false,
    runtimeOperationalDataCommittedToGit: false,
    explicitExportRequired: true,
    auditedExportsOnly: true
  },
  noOverclaim: {
    docsReadiness: false,
    searchReadiness: false,
    gitExportExecuted: false,
    userGuidePublished: false,
    releaseNotesPublished: false,
    canonicalKnowledgePromotion: false,
    deployment: false,
    liveCodexDispatch: false,
    productAcceptance: false,
    finalMvpAcceptance: false,
    selenePublication: false
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

function proveKnowledgeFromConference() {
  const { store, story, conference, evidence } = createScenario("knowledge_from_conference");
  const entry = store.createKnowledgeEntry({
    id: createId("knowledge", { scenario: "conference", conferenceId: conference.id }),
    projectId: "TCRN-AOS",
    category: "operations",
    status: "proposed",
    sourceKind: "conference",
    sourceIds: [conference.id],
    linkedTicketIds: [story.id],
    linkedConferenceIds: [conference.id],
    linkedEvidenceIds: [evidence.id],
    freshnessState: "fresh",
    rawPrivatePayloadStored: false,
    canonicalPromotionClaimed: false,
    localFirstStorage: true,
    defaultGitStorage: false,
    explicitExportRequired: true
  }, actor);
  const index = store.createDocumentationIndex("TCRN-AOS");
  return {
    scenario: "knowledge_proposed_from_conference",
    ok: index.knowledgeEntryIds.includes(entry.id)
      && index.linkedConferenceIds.includes(conference.id)
      && index.linkedEvidenceIds.includes(evidence.id)
      && entry.rawPrivatePayloadStored === false
      && entry.canonicalPromotionClaimed === false
      && entry.defaultGitStorage === false,
    knowledgeEntries: index.knowledgeEntryIds.length,
    linkedConferences: index.linkedConferenceIds.length,
    linkedEvidence: index.linkedEvidenceIds.length
  };
}

function proveGuideDraftFromStory() {
  const { store, story, evidence } = createScenario("guide_draft_from_story");
  const guide = store.createUserGuideDraft({
    id: createId("guide", { storyId: story.id, versionLabel: "slice-6-local" }),
    projectId: "TCRN-AOS",
    audience: "owner",
    versionLabel: "slice-6-local",
    status: "draft",
    linkedStoryIds: [story.id],
    linkedReleaseNoteItemIds: [],
    linkedEvidenceIds: [evidence.id],
    publishedStateDistinctFromDraft: true,
    releaseCloseoutClaimed: false,
    defaultGitStorage: false
  }, actor);
  const index = store.createDocumentationIndex("TCRN-AOS");
  return {
    scenario: "user_guide_draft_from_story",
    ok: index.guidePageIds.includes(guide.id)
      && index.linkedWorkItemIds.includes(story.id)
      && guide.publishedStateDistinctFromDraft
      && guide.releaseCloseoutClaimed === false
      && guide.defaultGitStorage === false,
    guidePages: index.guidePageIds.length,
    linkedWorkItems: index.linkedWorkItemIds.length
  };
}

function proveReleaseNoteDraft() {
  const { store, story, evidence } = createScenario("release_note_draft");
  const note = store.createReleaseNote({
    id: createId("release_note", { storyId: story.id, label: "slice-6-local" }),
    projectId: "TCRN-AOS",
    releaseLabel: "slice-6-local",
    linkedStoryIds: [story.id],
    userFacingSummary: "Knowledge and guide index foundations are locally visible.",
    internalNotesSummary: "Local proof only; publication and release closeout are blocked.",
    riskNotesSummary: "Requires later export/publication packet before external use.",
    linkedEvidenceIds: [evidence.id],
    reviewState: "draft",
    gitExportAuthorized: false,
    releaseCloseoutClaimed: false
  }, actor);
  const index = store.createDocumentationIndex("TCRN-AOS");
  return {
    scenario: "release_note_draft_from_story_and_evidence",
    ok: index.releaseNoteItemIds.includes(note.id)
      && index.linkedWorkItemIds.includes(story.id)
      && index.linkedEvidenceIds.includes(evidence.id)
      && index.blockedPublishItemIds.includes(note.id)
      && note.gitExportAuthorized === false
      && note.releaseCloseoutClaimed === false,
    releaseNotes: index.releaseNoteItemIds.length,
    blockedPublishItems: index.blockedPublishItemIds.length
  };
}

function proveStaleKnowledgeFollowup() {
  const { store, story, evidence } = createScenario("stale_knowledge_followup");
  const stale = store.createKnowledgeEntry({
    id: createId("knowledge", { scenario: "stale", storyId: story.id }),
    projectId: "TCRN-AOS",
    category: "risk",
    status: "review_required",
    sourceKind: "story",
    sourceIds: [story.id],
    linkedTicketIds: [story.id],
    linkedConferenceIds: [],
    linkedEvidenceIds: [evidence.id],
    freshnessState: "stale",
    rawPrivatePayloadStored: false,
    canonicalPromotionClaimed: false,
    localFirstStorage: true,
    defaultGitStorage: false,
    explicitExportRequired: true
  }, actor);
  const index = store.createDocumentationIndex("TCRN-AOS");
  return {
    scenario: "stale_knowledge_followup",
    ok: index.staleItemIds.includes(stale.id)
      && index.blockedPublishItemIds.includes(stale.id)
      && stale.canonicalPromotionClaimed === false,
    staleItems: index.staleItemIds.length,
    blockedPublishItems: index.blockedPublishItemIds.length
  };
}

function proveExportBlockedWithoutOwnerGate() {
  const { store } = createScenario("export_blocked_without_owner_gate");
  const index = store.createDocumentationIndex("TCRN-AOS");
  const block = store.blockDocumentationAction({
    projectId: "TCRN-AOS",
    targetType: "documentation_index",
    targetId: index.projectId,
    action: "export"
  }, actor);
  return {
    scenario: "export_blocked_without_owner_gate",
    ok: block.status === "blocked"
      && block.ownerIntentRequired === true
      && store.queryAudit({ action: "documentation.export.blocked" }).length === 1,
    blockedAction: block.action,
    ownerIntentRequired: block.ownerIntentRequired
  };
}

function proveRestrictedPayloadRejected() {
  const { store, story } = createScenario("restricted_payload_rejected");
  let rejected = false;
  try {
    store.createKnowledgeEntry({
      id: createId("knowledge", { scenario: "restricted" }),
      projectId: "TCRN-AOS",
      category: "operations",
      status: "proposed",
      sourceKind: "story",
      sourceIds: [story.id],
      linkedTicketIds: [story.id],
      linkedConferenceIds: [],
      linkedEvidenceIds: [],
      freshnessState: "fresh",
      rawPrivatePayloadStored: false,
      canonicalPromotionClaimed: false,
      localFirstStorage: true,
      defaultGitStorage: false,
      explicitExportRequired: true,
      syntheticRejectedPayload: "/" + "Users/example/private-guide.md"
    }, actor);
  } catch {
    rejected = true;
  }
  return {
    scenario: "restricted_payload_rejected",
    ok: rejected,
    rejected
  };
}

function proveGatewayDocumentationMethods() {
  const { store, story, evidence } = createScenario("gateway_documentation_methods");
  const gateway = new McpGateway(store);
  const knowledge = gateway.handle({
    method: "aos.knowledge.entry.propose",
    actor,
    params: {
      projectId: "TCRN-AOS",
      category: "workflow",
      status: "proposed",
      sourceKind: "story",
      sourceIds: [story.id],
      linkedTicketIds: [story.id],
      linkedEvidenceIds: [evidence.id],
      freshnessState: "fresh"
    }
  });
  const release = gateway.handle({
    method: "aos.release_note.item.draft",
    actor,
    params: {
      projectId: "TCRN-AOS",
      releaseLabel: "slice-6-gateway",
      linkedStoryIds: [story.id],
      userFacingSummary: "Gateway can draft release-note metadata locally.",
      internalNotesSummary: "No publication or export executed.",
      riskNotesSummary: "External closeout remains separately gated.",
      linkedEvidenceIds: [evidence.id],
      reviewState: "draft"
    }
  });
  const guide = gateway.handle({
    method: "aos.guide.page.draft",
    actor,
    params: {
      projectId: "TCRN-AOS",
      audience: "operator",
      versionLabel: "slice-6-gateway",
      status: "draft",
      linkedStoryIds: [story.id],
      linkedReleaseNoteItemIds: release.ok ? [release.result.id] : [],
      linkedEvidenceIds: [evidence.id]
    }
  });
  const index = gateway.handle({
    method: "aos.documentation.index.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });
  const dedupe = gateway.handle({
    method: "aos.documentation.index.read",
    actor,
    params: { projectId: "TCRN-AOS" },
    idempotencyKey: index.idempotencyKey
  });
  return {
    ok: knowledge.ok === true
      && release.ok === true
      && guide.ok === true
      && index.status === "read"
      && dedupe.status === "deduped"
      && index.result.knowledgeEntryIds.length === 1
      && index.result.guidePageIds.length === 1
      && index.result.releaseNoteItemIds.length === 1
      && index.result.localFirstStorage === true
      && index.result.explicitExportRequired === true,
    knowledgeStatus: knowledge.status,
    guideStatus: guide.status,
    releaseStatus: release.status,
    indexStatus: index.status,
    dedupeStatus: dedupe.status,
    counts: index.ok ? {
      knowledgeEntries: index.result.knowledgeEntryIds.length,
      guidePages: index.result.guidePageIds.length,
      releaseNotes: index.result.releaseNoteItemIds.length,
      blockedPublishItems: index.result.blockedPublishItemIds.length
    } : {}
  };
}

function createScenario(label) {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: `Slice 6 ${label}`,
    status: "in_progress",
    problem: "Documentation metadata needs local-first model and index readback.",
    expectedOutcome: "Knowledge, guide, and release-note metadata are locally inspectable without export or publication."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Knowledge, guide, and release-note foundations",
    goal: "Create local model/index records with D-024 boundaries.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: `Document ${label}`,
    problem: "Owner and agents need documentation metadata without canonical publication claims.",
    user: "owner observer",
    expectedBehavior: "Documentation records link to work, evidence, and conferences while export remains blocked.",
    acceptanceCriteria: ["local-first index", "blocked export", "redaction", "audit"],
    status: "in_progress",
    estimate: {
      effortPoints: 3,
      complexity: "medium",
      risk: "L3",
      verificationCost: "medium",
      confidence: "medium"
    },
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: `slice-6-${label}-evidence`,
    validity: "valid",
    producer: actor.employeeId,
    digest: `sha256:slice-6-${label}`,
    redactionState: "metadata_only"
  }, actor);
  const conference = store.createConference({
    type: "verification",
    title: `Slice 6 ${label} conference`,
    initiator: actor,
    participantEmployeeIds: ["employee-arturo"],
    agenda: ["Review local documentation metadata"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local documentation index proof"
  }, actor);
  store.recordConferencePosition({
    conferenceId: conference.id,
    actor: arturo,
    position: "Proceed with local documentation model proof only.",
    risks: ["Export and publication remain separately gated."],
    recommendations: ["Keep canonical knowledge promotion unclaimed."],
    evidenceIds: [evidence.id]
  }, actor);
  return { store, initiative, epic, story, evidence, conference };
}
