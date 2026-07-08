import test from "node:test";
import assert from "node:assert/strict";
import {
  computeKnowledgeRetrievalKpi,
  digest
} from "../../../dist/packages/domain/src/index.js";

const actor = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "kr06-kpi-test"
};

test("KR-06 computes audit-derived hit-rate and token totals without quality claims", () => {
  const entryOne = "knowledge-kr06-entry-one";
  const entryTwo = "knowledge-kr06-entry-two";
  const report = computeKnowledgeRetrievalKpi({
    auditEvents: [
      auditEvent({
        id: "audit_kr06_search",
        action: "mcp.transport.aos.knowledge.search",
        targetType: "knowledge_search",
        targetId: "filter-digest",
        details: {
          returnedCount: 2,
          entryIdDigests: [digest(entryOne), digest(entryTwo)]
        }
      }),
      auditEvent({
        id: "audit_kr06_read",
        action: "mcp.transport.aos.knowledge.entry.read",
        targetType: "knowledge",
        targetId: entryOne,
        details: {
          bodyWordCount: 42
        }
      })
    ],
    referencedEntryIds: [entryOne],
    snippetTokenEstimatePerSearchResult: 8,
    dataSourceDisposition: "internal_runtime"
  });

  assert.equal(report.ok, true);
  assert.equal(report.retrievalEventCounts.total, 2);
  assert.equal(report.retrievalHitRate.denominatorRetrievedEntryDigestCount, 2);
  assert.equal(report.retrievalHitRate.numeratorReferencedRetrievedEntryDigestCount, 1);
  assert.equal(report.retrievalHitRate.value, 0.5);
  assert.equal(report.retrievalTokenTotals.searchSnippetEstimate, 16);
  assert.equal(report.retrievalTokenTotals.readBodyWordCount, 42);
  assert.equal(report.retrievalTokenTotals.estimatedTotal, 58);
  assert.equal(report.noOverclaimFlags.retrievalQualityAdequacyClaimed, false);
  assert.deepEqual(report.digestOnlyReadback.retrievedEntryDigests, [digest(entryOne), digest(entryTwo)].sort());
});

test("KR-06 reports bounded no-data baseline instead of inventing quality conclusions", () => {
  const report = computeKnowledgeRetrievalKpi({
    auditEvents: [],
    dataSourceDisposition: "no_data"
  });

  assert.equal(report.dataCompleteness, "no_retrieval_data");
  assert.equal(report.retrievalHitRate.value, null);
  assert.equal(report.retrievalHitRate.denominatorRetrievedEntryDigestCount, 0);
  assert.equal(report.retrievalTokenTotals.estimatedTotal, 0);
  assert.equal(report.noOverclaimFlags.productReadinessClaimed, false);
});

test("KR-06 keeps reference-missing sessions partial and digest-only", () => {
  const entryId = "knowledge-kr06-partial-entry";
  const report = computeKnowledgeRetrievalKpi({
    auditEvents: [
      auditEvent({
        id: "audit_kr06_partial_read",
        action: "mcp.transport.aos.knowledge.entry.read",
        targetType: "knowledge",
        targetId: entryId,
        details: {}
      })
    ],
    dataSourceDisposition: "fixture"
  });

  assert.equal(report.dataCompleteness, "partial_reference_data");
  assert.equal(report.retrievalHitRate.value, 0);
  assert.equal(report.digestOnlyReadback.retrievedEntryDigests.includes(digest(entryId)), true);
  assert.equal(JSON.stringify(report).includes(entryId), false);
});

function auditEvent(overrides) {
  return {
    actor,
    timestamp: "2026-07-08T00:00:00.000Z",
    outcome: "read",
    policyVersion: "test",
    ...overrides
  };
}
