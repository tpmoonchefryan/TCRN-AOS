import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice5-gateway-test"
};

const arturo = {
  employeeId: "employee-arturo",
  role: "coordinator",
  threadId: "019eb66e-00d1-7190-81d9-693895b32033",
  sessionId: "slice5-gateway-test"
};

const estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

test("Slice 5 gateway records conference positions, minutes, and drill-through readbacks", () => {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const story = createStory(gateway);
  const evidence = gateway.handle({
    method: "aos.evidence.link",
    actor,
    params: {
      type: "artifact_id",
      target: "slice5-gateway-proof",
      digest: "sha256:slice5-gateway",
      redactionState: "metadata_only"
    }
  });
  const conference = gateway.handle({
    method: "aos.conference.request",
    actor,
    params: {
      type: "verification",
      title: "Slice 5 gateway conference",
      participantEmployeeIds: ["employee-arturo", "employee-sable"],
      agenda: ["Collect positions", "Record minutes"],
      linkedTicketIds: [story.id],
      desiredOutcome: "Local-only outcome metadata"
    }
  });
  const position = gateway.handle({
    method: "aos.conference.position.record",
    actor: arturo,
    params: {
      conferenceId: conference.result.id,
      position: "Proceed with metadata-only proof.",
      risks: ["Sable position pending"],
      recommendations: ["Keep live dispatch blocked"],
      evidenceIds: [evidence.result.id]
    }
  });
  const minutes = gateway.handle({
    method: "aos.conference.minutes.record",
    actor,
    params: {
      conferenceId: conference.result.id,
      summary: "Minutes recorded locally with action automation deferred.",
      outcomeClass: "recommendation",
      decisionSummary: "Proceed to review lanes; no action-item automation.",
      evidenceIds: [evidence.result.id],
      unresolvedIssues: ["Product Design final visual acceptance remains out of scope"],
      actionItemIds: []
    }
  });
  const drillThrough = gateway.handle({
    method: "aos.work_index.drill_through.read",
    actor,
    params: {
      storyId: story.id
    }
  });

  assert.equal(conference.ok, true);
  assert.equal(position.ok, true);
  assert.equal(minutes.ok, true);
  assert.equal(minutes.result.actionItemIds.length, 0);
  assert.equal(drillThrough.status, "read");
  assert.deepEqual(drillThrough.result.linkedConferenceIds, [conference.result.id]);
  assert.ok(drillThrough.result.linkedEvidenceIds.includes(evidence.result.id));
  assert.ok(drillThrough.result.nextAllowedLocalActions.includes("open_evidence_metadata"));
  assert.equal(store.deriveConferenceOperatingLoop(conference.result.id).liveDispatchAuthorized, false);
  assert.ok(store.queryAudit({ action: "mcp.aos.work_index.drill_through.read" }).length >= 1);
});

test("Slice 5 gateway rejects restricted conference payloads before storage", () => {
  const gateway = new McpGateway(new AosStore(createDefaultSeed()));
  const blocked = gateway.handle({
    method: "aos.conference.request",
    actor,
    params: {
      type: "verification",
      title: "Unsafe conference",
      participantEmployeeIds: ["employee-arturo"],
      agenda: ["private " + "evidence payload"],
      linkedTicketIds: ["story-unsafe"],
      desiredOutcome: "Should block"
    }
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /restricted private_evidence_payload/);
});

function createStory(gateway) {
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Slice 5 gateway fixture",
      problem: "Conference operating loop needs gateway proof.",
      expectedOutcome: "MCP methods record local records only."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Conference loop",
      goal: "Gateway-backed local operating loop."
    }
  });
  const story = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: "Gateway drill-through",
      problem: "Work-index needs drill-through.",
      user: "proof owner",
      expectedBehavior: "Readback links story, conference, evidence, and audit.",
      acceptanceCriteria: ["conference", "minutes", "drill-through"],
      estimate,
      subTasks: []
    }
  });
  return story.result;
}
