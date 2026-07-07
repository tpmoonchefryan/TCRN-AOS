import test from "node:test";
import assert from "node:assert/strict";
import {
  AosStore,
  createDefaultSeed,
  createId
} from "../../../dist/packages/domain/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice6-domain-test"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

test("Slice 6 documentation index links knowledge guide release notes and blocks export claims", () => {
  const { store, story, conference, evidence } = documentationFixture();
  const releaseNote = store.createReleaseNote({
    id: createId("release_note", { storyId: story.id, releaseLabel: "slice-6-local" }),
    projectId: "TCRN-AOS",
    releaseLabel: "slice-6-local",
    linkedStoryIds: [story.id],
    userFacingSummary: "Knowledge index foundations remain local.",
    internalNotesSummary: "No release closeout or Git export is claimed.",
    riskNotesSummary: "Documentation readiness and publication are deferred.",
    linkedEvidenceIds: [evidence.id],
    reviewState: "publish_blocked",
    gitExportAuthorized: false,
    releaseCloseoutClaimed: false
  }, actor);
  const guide = store.createUserGuideDraft({
    id: createId("guide", { storyId: story.id, audience: "operator" }),
    projectId: "TCRN-AOS",
    audience: "operator",
    versionLabel: "slice-6-local",
    status: "review_required",
    linkedStoryIds: [story.id],
    linkedReleaseNoteItemIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id],
    publishedStateDistinctFromDraft: true,
    releaseCloseoutClaimed: false,
    defaultGitStorage: false
  }, actor);
  const knowledge = store.createKnowledgeEntry({
    id: createId("knowledge", { storyId: story.id, category: "operations" }),
    projectId: "TCRN-AOS",
    category: "operations",
    status: "proposed",
    sourceKind: "conference",
    sourceIds: [conference.id],
    linkedTicketIds: [story.id],
    linkedConferenceIds: [conference.id],
    linkedEvidenceIds: [evidence.id],
    freshnessState: "review_due",
    rawPrivatePayloadStored: false,
    canonicalPromotionClaimed: false,
    localFirstStorage: true,
    defaultGitStorage: false,
    explicitExportRequired: true
  }, actor);

  const index = store.createDocumentationIndex("TCRN-AOS");
  const exportBlock = store.blockDocumentationAction({
    projectId: "TCRN-AOS",
    targetType: "documentation_index",
    targetId: index.projectId,
    action: "export"
  }, actor);

  assert.deepEqual(index.knowledgeEntryIds, [knowledge.id]);
  assert.deepEqual(index.guidePageIds, [guide.id]);
  assert.deepEqual(index.releaseNoteItemIds, [releaseNote.id]);
  assert.ok(index.staleItemIds.includes(knowledge.id));
  assert.ok(index.staleItemIds.includes(guide.id));
  assert.ok(index.staleItemIds.includes(releaseNote.id));
  assert.ok(index.blockedPublishItemIds.includes(knowledge.id));
  assert.ok(index.blockedPublishItemIds.includes(releaseNote.id));
  assert.deepEqual(index.linkedWorkItemIds, [story.id]);
  assert.deepEqual(index.linkedConferenceIds, [conference.id]);
  assert.deepEqual(index.linkedEvidenceIds, [evidence.id]);
  assert.equal(index.localFirstStorage, true);
  assert.equal(index.explicitExportRequired, true);
  assert.equal(exportBlock.status, "blocked");
  assert.equal(exportBlock.ownerIntentRequired, true);
  assert.match(exportBlock.auditEventId, /^audit_/);
});

test("Slice 6 documentation records reject restricted payloads before storage", () => {
  const store = new AosStore(createDefaultSeed());
  const syntheticPrivateEvidence = "private " + "evidence payload";
  assert.throws(() => store.createKnowledgeEntry({
    id: "knowledge-restricted",
    projectId: "TCRN-AOS",
    category: "operations",
    status: "proposed",
    sourceKind: "manual_seed",
    sourceIds: [syntheticPrivateEvidence],
    linkedTicketIds: [],
    linkedConferenceIds: [],
    linkedEvidenceIds: [],
    freshnessState: "fresh",
    rawPrivatePayloadStored: false,
    canonicalPromotionClaimed: false,
    localFirstStorage: true,
    defaultGitStorage: false,
    explicitExportRequired: true
  }, actor), /restricted private_evidence_payload/);
});

function documentationFixture() {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 6 documentation index",
    status: "in_progress",
    problem: "Knowledge, guide, and release-note records need local index readback.",
    expectedOutcome: "Local documentation records link work, conference, and evidence metadata without publication claims."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Project documentation foundations",
    goal: "Build local-first knowledge, guide, and release-note model/index foundations.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Index local documentation records",
    problem: "Reviewers need deterministic readback without Git export or canonical promotion.",
    user: "knowledge reviewer",
    expectedBehavior: "Documentation records stay local-first and expose blocked publish/export posture.",
    acceptanceCriteria: ["local index", "blocked export", "metadata links only"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-6-documentation-index-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice6",
    redactionState: "metadata_only"
  }, actor);
  const conference = store.createConference({
    type: "verification",
    title: "Slice 6 documentation index review",
    initiator: actor,
    participantEmployeeIds: ["employee-arturo", "employee-sable"],
    agenda: ["Check local documentation index", "Confirm export remains blocked"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local proof ready for review lanes."
  }, actor);
  return { store, story, conference, evidence };
}
