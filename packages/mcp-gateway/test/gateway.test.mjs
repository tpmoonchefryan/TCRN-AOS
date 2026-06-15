import test from "node:test";
import assert from "node:assert/strict";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { McpGateway, allowedMcpMethods } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "gateway-test"
};

const estimate = {
  effortPoints: 5,
  complexity: "high",
  risk: "L3",
  verificationCost: "high",
  confidence: "medium"
};

function gatewayFixture() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  return { store, gateway };
}

test("gateway exposes only the accepted Slice 1 MCP method families", () => {
  assert.deepEqual([...allowedMcpMethods].sort(), [
    "aos.audit.query",
    "aos.conference.position.record",
    "aos.conference.request",
    "aos.dependency.record.propose",
    "aos.evidence.link",
    "aos.gate.request",
    "aos.policy.read",
    "aos.resource.record.propose",
    "aos.run.summary.create",
    "aos.stage_map.read",
    "aos.ticket.comment",
    "aos.ticket.propose"
  ].sort());
});

test("ticket proposal, idempotency, dedupe, comments, evidence, and audit work together", () => {
  const { gateway } = gatewayFixture();
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Operational Spine",
      problem: "No governed AOS operational state exists.",
      expectedOutcome: "Model-first records and gateway contracts exist."
    },
    idempotencyKey: "ticket-init-1"
  });
  const duplicate = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Operational Spine",
      problem: "No governed AOS operational state exists.",
      expectedOutcome: "Model-first records and gateway contracts exist."
    },
    idempotencyKey: "ticket-init-1"
  });
  assert.equal(initiative.ok, true);
  assert.equal(duplicate.status, "deduped");

  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Governed writes",
      goal: "MCP Gateway accepts only safe writes."
    }
  });
  const story = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: "Gateway contract",
      problem: "Agent writes need validation.",
      user: "AI employee",
      expectedBehavior: "Safe writes are audited.",
      acceptanceCriteria: ["authz", "dedupe", "audit"],
      estimate,
      subTasks: []
    }
  });
  const comment = gateway.handle({
    method: "aos.ticket.comment",
    actor,
    params: {
      ticketId: story.result.id,
      type: "agent_observation",
      body: "Gateway test comment"
    }
  });
  const evidence = gateway.handle({
    method: "aos.evidence.link",
    actor,
    params: {
      type: "artifact_id",
      target: "gateway-proof",
      digest: "sha256:123",
      redactionState: "metadata_only"
    }
  });
  const audit = gateway.handle({
    method: "aos.audit.query",
    actor,
    params: {
      targetId: story.result.id
    }
  });

  assert.equal(story.ok, true);
  assert.equal(comment.ok, true);
  assert.equal(evidence.ok, true);
  assert.equal(audit.status, "read");
  assert.ok(audit.result.length >= 1);
});

test("authz, role-thread binding, owner intent separation, and restricted payload rejection fail closed", () => {
  const { gateway } = gatewayFixture();
  const wrongThread = gateway.handle({
    method: "aos.policy.read",
    actor: { ...actor, threadId: "wrong-thread" },
    params: {}
  });
  assert.equal(wrongThread.ok, false);
  assert.match(wrongThread.error, /Thread binding/);

  const localPath = "/" + "Users/example/.ssh/id_rsa";
  const restricted = gateway.handle({
    method: "aos.evidence.link",
    actor,
    params: {
      type: "local_path_reference",
      target: localPath,
      redactionState: "restricted"
    }
  });
  assert.equal(restricted.ok, false);
  assert.match(restricted.error, /restricted machine_local_absolute_path/);

  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Owner gate",
      problem: "Remote action requires owner intent.",
      expectedOutcome: "Pending gate only."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Release",
      goal: "Owner-gated release posture."
    }
  });
  const story = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: "Do not publish",
      problem: "Publication must be owner-gated.",
      user: "release agent",
      expectedBehavior: "Gateway creates owner-intent gate.",
      acceptanceCriteria: ["no automatic operation"],
      estimate,
      subTasks: []
    }
  });
  const gate = gateway.handle({
    method: "aos.gate.request",
    actor,
    params: {
      type: "release_closeout",
      requestedAction: "remote_publication",
      linkedTicketId: story.result.id,
      inputEvidenceIds: []
    }
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.result.type, "owner_intent");
  assert.equal(gate.result.status, "owner_intent_required");
});
