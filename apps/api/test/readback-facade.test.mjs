import test from "node:test";
import assert from "node:assert/strict";
import { createWorkReadbackApiResponse } from "../../../dist/apps/api/src/work-readback.js";
import { startAosLocalServiceProof } from "../../../dist/apps/api/src/server.js";
import { AosStore, createDefaultSeed } from "../../../dist/packages/domain/src/index.js";
import { McpGateway } from "../../../dist/packages/mcp-gateway/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "phase3-readback-api-test"
};

const estimate = {
  effortPoints: 1,
  complexity: "low",
  risk: "L1",
  verificationCost: "low",
  confidence: "high"
};
const localUsersPathMarker = ["", "Users", ""].join("/");
const recordJsonMarker = ["record", "json"].join("_");

test("work readback facade exposes ticket, audit, and policy reads with safe envelopes", async () => {
  const service = await startAosLocalServiceProof();
  try {
    const firstPage = await getJson(service.url, "/api/work/readback/tickets?limit=1");
    assert.equal(firstPage.status, 200);
    assert.equal(firstPage.body.surface, "work.readback");
    assert.equal(firstPage.body.serviceProofOnly, true);
    assert.equal(firstPage.body.runtimeDataCommitted, false);
    assert.equal(firstPage.body.liveDispatchAuthorized, false);
    assert.equal(firstPage.body.method, "aos.ticket.list");
    assert.equal(firstPage.body.schemaVersion, "aos.ticket.list.v1");
    assert.equal(firstPage.body.rowGrain, "story");
    assert.equal(firstPage.body.rows.length, 1);
    assert.equal(firstPage.body.page.limit, 1);
    assert.equal(typeof firstPage.body.page.nextCursor, "string");
    assert.equal(JSON.stringify(firstPage.body).includes("acceptanceCriteria"), false);
    assert.equal(JSON.stringify(firstPage.body).includes(recordJsonMarker), false);

    const cursorMismatch = await getJson(
      service.url,
      `/api/work/readback/tickets?limit=1&status=blocked&cursor=${encodeURIComponent(firstPage.body.page.nextCursor)}`
    );
    assert.equal(cursorMismatch.status, 400);
    assert.equal(cursorMismatch.body.reason, "ticket_list_cursor_filter_mismatch");

    const invalidCursor = await getJson(service.url, "/api/work/readback/tickets?cursor=not-a-ticket-list-cursor");
    assert.equal(invalidCursor.status, 400);
    assert.equal(invalidCursor.body.reason, "invalid_ticket_list_cursor");

    const unsupportedFilter = await getJson(service.url, "/api/work/readback/tickets?updatedSince=2026-07-05T00%3A00%3A00Z");
    assert.equal(unsupportedFilter.status, 400);
    assert.equal(unsupportedFilter.body.reason, "unsupported_filter");

    const clientAuthority = await getJson(service.url, "/api/work/readback/tickets?employeeId=employee-sable");
    assert.equal(clientAuthority.status, 400);
    assert.equal(clientAuthority.body.reason, "client_authority_denied");

    const storyId = firstPage.body.rows[0].storyId;
    const audit = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(storyId)}&limit=5`);
    assert.equal(audit.status, 200);
    assert.equal(audit.body.surface, "work.readback");
    assert.equal(audit.body.method, "aos.audit.query");
    assert.equal(audit.body.limit, 5);
    assert.ok(audit.body.returnedCount >= 1);
    assert.equal(JSON.stringify(audit.body).includes("problem"), false);
    assert.equal(JSON.stringify(audit.body).includes(localUsersPathMarker), false);

    const broadAudit = await getJson(service.url, "/api/work/readback/audit");
    assert.equal(broadAudit.status, 400);
    assert.equal(broadAudit.body.reason, "audit_scope_required");

    const invalidAuditCursor = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(storyId)}&cursor=bad-cursor`);
    assert.equal(invalidAuditCursor.status, 400);
    assert.equal(invalidAuditCursor.body.reason, "invalid_audit_cursor");

    const auditOverLimit = await getJson(service.url, `/api/work/readback/audit?targetId=${encodeURIComponent(storyId)}&limit=6`);
    assert.equal(auditOverLimit.status, 400);
    assert.equal(auditOverLimit.body.reason, "audit_limit_exceeded");

    const policy = await getJson(service.url, "/api/work/readback/policy");
    assert.equal(policy.status, 200);
    assert.equal(policy.body.method, "aos.policy.read");
    assert.deepEqual(policy.body.readbackMethods, ["aos.ticket.list", "aos.audit.query", "aos.backup.list"]);
    assert.equal(policy.body.fullGatewayMethodListExposed, false);
    assert.equal(JSON.stringify(policy.body).includes("aos.work_index"), false);

    const post = await fetch(`${service.url}/api/work/readback/tickets`, { method: "POST" });
    assert.equal(post.status, 405);

    const mcp = await getJson(service.url, "/api/mcp");
    assert.equal(mcp.status, 404);
    const gateway = await getJson(service.url, "/api/gateway");
    assert.equal(gateway.status, 404);
    const legacyReadback = await getJson(service.url, "/api/readback?method=aos.work_index.drill_through.read");
    assert.equal(legacyReadback.status, 200);
    assert.equal(JSON.stringify(legacyReadback.body).includes("aos.work_index"), false);
  } finally {
    await service.close();
  }
});

test("work readback facade fails closed on response budget without partial data", () => {
  const store = seedLargeTicketStore();
  const response = createWorkReadbackApiResponse(
    store,
    "/api/work/readback/tickets",
    new URLSearchParams({ limit: "1" }),
    { responseBudgetBytes: 512 }
  );
  assert.equal(response.statusCode, 413);
  assert.equal(response.body.reason, "readback_response_budget_exceeded");
  assert.equal(JSON.stringify(response.body).includes("phase3-readback-budget-title"), false);
});

function seedLargeTicketStore() {
  const store = new AosStore(createDefaultSeed());
  const gateway = new McpGateway(store);
  const initiative = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "initiative",
      projectId: "TCRN-AOS",
      title: "Phase 3 readback facade budget",
      problem: "phase3-readback-forbidden-problem-value",
      expectedOutcome: "Budget failures do not return partial rows."
    }
  });
  const epic = gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "epic",
      initiativeId: initiative.result.id,
      title: "Readback API facade",
      goal: "Expose only browser-safe story readbacks."
    }
  });
  gateway.handle({
    method: "aos.ticket.propose",
    actor,
    params: {
      ticketType: "story",
      epicId: epic.result.id,
      title: `phase3-readback-budget-title-${"x".repeat(1600)}`,
      problem: "phase3-readback-forbidden-problem-value",
      user: "phase3-readback-forbidden-user-value",
      expectedBehavior: "phase3-readback-forbidden-expected-value",
      acceptanceCriteria: ["phase3-readback-forbidden-acceptance-value"],
      estimate,
      subTasks: []
    }
  });
  return store;
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}
