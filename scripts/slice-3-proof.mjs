import { AosStore, createDefaultSeed } from "../dist/packages/domain/src/index.js";
import { McpGateway } from "../dist/packages/mcp-gateway/src/index.js";
import { CodexIntegrationAdapter } from "../dist/packages/adapter-codex/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice-3-proof"
};

const store = new AosStore(createDefaultSeed());
const gateway = new McpGateway(store);
const adapter = new CodexIntegrationAdapter(store, { maxAttempts: 1, backoffSeconds: [1] });
const estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

const initiative = gateway.handle({
  method: "aos.ticket.propose",
  actor,
  params: {
    ticketType: "initiative",
    projectId: "TCRN-AOS",
    title: "Slice 3 Gateway Adapter Proof",
    problem: "AOS needs runtime-backed gateway and dry-run adapter proof.",
    expectedOutcome: "Local records and audit prove dry-run contract."
  },
  idempotencyKey: "slice-3-initiative"
});
const duplicate = gateway.handle({
  method: "aos.ticket.propose",
  actor,
  params: {
    ticketType: "initiative",
    projectId: "TCRN-AOS",
    title: "Slice 3 Gateway Adapter Proof",
    problem: "AOS needs runtime-backed gateway and dry-run adapter proof.",
    expectedOutcome: "Local records and audit prove dry-run contract."
  },
  idempotencyKey: "slice-3-initiative"
});
const epic = gateway.handle({
  method: "aos.ticket.propose",
  actor,
  params: {
    ticketType: "epic",
    initiativeId: initiative.result.id,
    title: "Dry-run adapter",
    goal: "Collect returns without live dispatch."
  }
});
const story = gateway.handle({
  method: "aos.ticket.propose",
  actor,
  params: {
    ticketType: "story",
    epicId: epic.result.id,
    title: "Return collection",
    problem: "Adapter returns need local record effects.",
    user: "proof owner",
    expectedBehavior: "Dry-run return updates local assignment and audit.",
    acceptanceCriteria: ["dry-run outbox", "readback", "return collection"],
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
    body: "Slice 3 proof uses local dry-run state only."
  }
});
const evidence = gateway.handle({
  method: "aos.evidence.link",
  actor,
  params: {
    type: "artifact_id",
    target: "slice-3-proof",
    digest: "sha256:slice-3",
    redactionState: "metadata_only"
  }
});
const gate = gateway.handle({
  method: "aos.gate.request",
  actor,
  params: {
    type: "release_closeout",
    requestedAction: "remote_publication",
    linkedTicketId: story.result.id,
    inputEvidenceIds: [evidence.result.id]
  }
});
const conference = gateway.handle({
  method: "aos.conference.request",
  actor,
  params: {
    type: "verification",
    title: "Slice 3 dry-run proof",
    participantEmployeeIds: ["employee-arturo"],
    agenda: ["Verify no live dispatch"],
    linkedTicketIds: [story.result.id],
    desiredOutcome: "Local proof receipt"
  }
});
const assignment = store.createAssignment({
  employeeId: "employee-ilya",
  targetId: story.result.id,
  targetType: "story",
  role: "implementation",
  status: "in_progress",
  dueState: "none",
  proofExpectation: "slice-3-proof script"
}, actor);
const dispatch = adapter.createDryRunDispatch({
  kind: "assignment",
  targetEmployeeId: "employee-ilya",
  linkedTicketIds: [story.result.id],
  linkedAssignmentId: assignment.id,
  subject: "Slice 3 local dry run",
  body: "No live send.",
  expectedReturnFormat: "status summary blockers next_owner"
}, actor);
const readback = adapter.readback(dispatch.id, actor);
const parsed = adapter.collectReturn(dispatch.id, "<status>success</status><summary>Local proof complete</summary>", actor);
adapter.markStale(dispatch.id, actor);
adapter.markRetry(dispatch.id, actor);
adapter.markRetry(dispatch.id, actor);
const restrictedBody = "private " + "evidence payload";
let restrictedBlocked = false;
try {
  adapter.createDryRunDispatch({
    kind: "assignment",
    targetEmployeeId: "employee-ilya",
    linkedTicketIds: [story.result.id],
    subject: "Unsafe",
    body: restrictedBody,
    expectedReturnFormat: "status"
  }, actor);
} catch {
  restrictedBlocked = true;
}

const audit = store.queryAudit();
const ok = [
  initiative.ok,
  duplicate.status === "deduped",
  story.ok,
  comment.ok,
  evidence.ok,
  gate.result.type === "owner_intent",
  gate.result.status === "owner_intent_required",
  conference.ok,
  dispatch.status === "expired",
  readback.acceptanceInferred === false,
  parsed.status === "success",
  restrictedBlocked,
  audit.some((event) => event.action === "codex.dispatch.blocked"),
  audit.some((event) => event.action === "agent_run.record"),
  audit.some((event) => event.action === "codex.dispatch.expire")
].every(Boolean);

console.log(JSON.stringify({
  ok,
  gateway: {
    initiativeStatus: initiative.status,
    duplicateStatus: duplicate.status,
    ownerIntentGateStatus: gate.result.status,
    conferenceStatus: conference.status
  },
  adapter: {
    dispatchStatus: dispatch.status,
    outboxCount: adapter.listOutbox().length,
    readbackObservedStatus: readback.observedStatus,
    liveDispatchAuthorized: false,
    copiedHelperExecution: false,
    threadRegistryMutation: false
  },
  audit: {
    eventCount: audit.length,
    blockedDispatchEvents: audit.filter((event) => event.action === "codex.dispatch.blocked").length,
    returnCollectionEvents: audit.filter((event) => event.action === "codex.return.collect").length,
    expireEvents: audit.filter((event) => event.action === "codex.dispatch.expire").length
  },
  redaction: {
    restrictedPayloadBlocked: restrictedBlocked
  },
  noOverclaim: {
    liveDispatch: false,
    deployment: false,
    productAcceptance: false,
    productDesignAcceptance: false
  }
}, null, 2));

if (!ok) {
  process.exit(1);
}
