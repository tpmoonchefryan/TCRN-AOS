import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice6-gateway-test"
};

const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

test("Slice 6 gateway creates documentation records and reads local index", () => {
  const { gateway, storyId, conferenceId, evidenceId } = gatewayDocumentationFixture();
  const knowledge = gateway.handle({
    method: "aos.knowledge.entry.propose",
    actor,
    params: {
      projectId: "TCRN-AOS",
      category: "operations",
      status: "proposed",
      sourceKind: "conference",
      sourceIds: [conferenceId],
      linkedTicketIds: [storyId],
      linkedConferenceIds: [conferenceId],
      linkedEvidenceIds: [evidenceId],
      freshnessState: "review_due"
    },
    idempotencyKey: "slice6-knowledge"
  });
  const knowledgeDuplicate = gateway.handle({
    method: "aos.knowledge.entry.propose",
    actor,
    params: {
      projectId: "TCRN-AOS",
      category: "operations",
      status: "proposed",
      sourceKind: "conference",
      sourceIds: [conferenceId],
      linkedTicketIds: [storyId],
      linkedConferenceIds: [conferenceId],
      linkedEvidenceIds: [evidenceId],
      freshnessState: "review_due"
    },
    idempotencyKey: "slice6-knowledge"
  });
  const release = gateway.handle({
    method: "aos.release_note.item.draft",
    actor,
    params: {
      projectId: "TCRN-AOS",
      releaseLabel: "slice-6-local",
      linkedStoryIds: [storyId],
      userFacingSummary: "Local documentation index proof.",
      internalNotesSummary: "No release closeout claim.",
      riskNotesSummary: "Publication deferred.",
      linkedEvidenceIds: [evidenceId],
      reviewState: "publish_blocked"
    }
  });
  const guide = gateway.handle({
    method: "aos.guide.page.draft",
    actor,
    params: {
      projectId: "TCRN-AOS",
      audience: "operator",
      versionLabel: "slice-6-local",
      status: "review_required",
      linkedStoryIds: [storyId],
      linkedReleaseNoteItemIds: [release.result.id],
      linkedEvidenceIds: [evidenceId]
    }
  });
  const index = gateway.handle({
    method: "aos.documentation.index.read",
    actor,
    params: { projectId: "TCRN-AOS" }
  });

  assert.equal(knowledge.ok, true);
  assert.equal(knowledge.result.localFirstStorage, true);
  assert.equal(knowledge.result.canonicalPromotionClaimed, false);
  assert.equal(knowledgeDuplicate.status, "deduped");
  assert.equal(release.result.gitExportAuthorized, false);
  assert.equal(guide.result.publishedStateDistinctFromDraft, true);
  assert.equal(index.status, "read");
  assert.deepEqual(index.result.knowledgeEntryIds, [knowledge.result.id]);
  assert.deepEqual(index.result.guidePageIds, [guide.result.id]);
  assert.deepEqual(index.result.releaseNoteItemIds, [release.result.id]);
  assert.ok(index.result.blockedPublishItemIds.includes(release.result.id));
});

test("Slice 6 gateway rejects restricted documentation payloads", () => {
  const { gateway, storyId } = gatewayDocumentationFixture();
  const syntheticLocalPath = "/" + "Users/example/private-guide.md";
  const rejected = gateway.handle({
    method: "aos.guide.page.draft",
    actor,
    params: {
      projectId: "TCRN-AOS",
      audience: "operator",
      versionLabel: "slice-6-local",
      status: "draft",
      linkedStoryIds: [storyId],
      linkedReleaseNoteItemIds: [],
      linkedEvidenceIds: [syntheticLocalPath]
    }
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /restricted machine_local_absolute_path/);
});

function gatewayDocumentationFixture() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 6 documentation gateway",
    status: "in_progress",
    problem: "Gateway methods need local documentation index proof.",
    expectedOutcome: "Safe local methods write metadata records and read index state."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Documentation MCP methods",
    goal: "Local documentation write/read contract",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Prove documentation gateway",
    problem: "Documentation records need governed creation.",
    user: "knowledge owner",
    expectedBehavior: "Gateway accepts safe metadata and blocks restricted payloads.",
    acceptanceCriteria: ["authz", "dedupe", "redaction", "index readback"],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-6-gateway-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice6-gateway",
    redactionState: "metadata_only"
  }, actor);
  const conference = store.createConference({
    type: "verification",
    title: "Slice 6 gateway review",
    initiator: actor,
    participantEmployeeIds: ["employee-arturo"],
    agenda: ["Review documentation gateway methods"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local gateway proof"
  }, actor);
  return { gateway, storyId: story.id, conferenceId: conference.id, evidenceId: evidence.id };
}
