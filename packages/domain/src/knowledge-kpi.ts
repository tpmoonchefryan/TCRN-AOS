import { digest } from "./idempotency.js";
import type { AuditEvent, ISODateTime } from "./types.js";

export const knowledgeRetrievalKpiSchema = "tcrn.aos.kr06.knowledgeRetrievalKpi.v1" as const;

export const knowledgeRetrievalAuditActions = [
  "mcp.transport.aos.knowledge.search",
  "mcp.transport.aos.knowledge.entry.read"
] as const;

export type KnowledgeRetrievalAuditAction = typeof knowledgeRetrievalAuditActions[number];

export interface KnowledgeRetrievalKpiWindow {
  start?: ISODateTime;
  end?: ISODateTime;
}

export interface ComputeKnowledgeRetrievalKpiInput {
  auditEvents: AuditEvent[];
  referencedEntryIds?: string[];
  referencedEntryDigests?: string[];
  window?: KnowledgeRetrievalKpiWindow;
  snippetTokenEstimatePerSearchResult?: number;
  dataSourceDisposition: "fixture" | "internal_runtime" | "dogfood_runtime" | "no_data";
}

export interface KnowledgeRetrievalKpiReport {
  schema: typeof knowledgeRetrievalKpiSchema;
  ok: true;
  metricDefinitions: {
    retrievalHitRate: string;
    retrievalTokenTotal: string;
  };
  window: KnowledgeRetrievalKpiWindow | null;
  dataSourceDisposition: ComputeKnowledgeRetrievalKpiInput["dataSourceDisposition"];
  dataCompleteness: "no_retrieval_data" | "partial_reference_data" | "audit_and_reference_data";
  retrievalEventCounts: {
    total: number;
    search: number;
    read: number;
  };
  retrievalHitRate: {
    numeratorReferencedRetrievedEntryDigestCount: number;
    denominatorRetrievedEntryDigestCount: number;
    value: number | null;
    referencedEntryDigestCount: number;
    calculationUnit: "unique_entry_digest";
  };
  retrievalTokenTotals: {
    estimatedTotal: number;
    searchSnippetEstimate: number;
    readBodyWordCount: number;
    snippetTokenEstimatePerSearchResult: number;
    source: "audit_details_returnedCount_and_bodyWordCount";
    actualTokenizerUsed: false;
  };
  digestOnlyReadback: {
    retrievedEntryDigests: string[];
    referencedRetrievedEntryDigests: string[];
  };
  exclusions: string[];
  noOverclaimFlags: {
    retrievalQualityAdequacyClaimed: false;
    productReadinessClaimed: false;
    releaseReadinessClaimed: false;
    ownerAcceptanceClaimed: false;
  };
}

export function computeKnowledgeRetrievalKpi(input: ComputeKnowledgeRetrievalKpiInput): KnowledgeRetrievalKpiReport {
  const snippetTokenEstimatePerSearchResult = Math.max(0, Math.floor(input.snippetTokenEstimatePerSearchResult ?? 24));
  const events = filterWindow(input.auditEvents, input.window)
    .filter((event) => knowledgeRetrievalAuditActions.includes(event.action as KnowledgeRetrievalAuditAction));
  const searchEvents = events.filter((event) => event.action === "mcp.transport.aos.knowledge.search");
  const readEvents = events.filter((event) => event.action === "mcp.transport.aos.knowledge.entry.read");
  const retrievedEntryDigests = new Set<string>();
  let searchSnippetEstimate = 0;
  let readBodyWordCount = 0;

  for (const event of searchEvents) {
    const entryIdDigests = stringArrayDetail(event.details.entryIdDigests);
    entryIdDigests.forEach((entryDigest) => retrievedEntryDigests.add(entryDigest));
    const returnedCount = numberDetail(event.details.returnedCount);
    searchSnippetEstimate += (returnedCount ?? entryIdDigests.length) * snippetTokenEstimatePerSearchResult;
  }

  for (const event of readEvents) {
    if (event.targetId) {
      retrievedEntryDigests.add(digest(event.targetId));
    }
    readBodyWordCount += numberDetail(event.details.bodyWordCount) ?? 0;
  }

  const referencedEntryDigests = new Set<string>([
    ...(input.referencedEntryDigests ?? []),
    ...(input.referencedEntryIds ?? []).map((id) => digest(id))
  ]);
  const referencedRetrievedEntryDigests = [...retrievedEntryDigests]
    .filter((entryDigest) => referencedEntryDigests.has(entryDigest))
    .sort();
  const denominator = retrievedEntryDigests.size;
  const numerator = referencedRetrievedEntryDigests.length;
  const dataCompleteness = denominator === 0
    ? "no_retrieval_data"
    : referencedEntryDigests.size === 0
      ? "partial_reference_data"
      : "audit_and_reference_data";

  return {
    schema: knowledgeRetrievalKpiSchema,
    ok: true,
    metricDefinitions: {
      retrievalHitRate: "unique entry digests pulled by KR-02 search/read and later referenced by the same session's summary/evidence divided by unique entry digests pulled",
      retrievalTokenTotal: "audit-derived estimate: search returnedCount multiplied by configured snippet estimate plus by-id read bodyWordCount"
    },
    window: input.window ?? null,
    dataSourceDisposition: input.dataSourceDisposition,
    dataCompleteness,
    retrievalEventCounts: {
      total: events.length,
      search: searchEvents.length,
      read: readEvents.length
    },
    retrievalHitRate: {
      numeratorReferencedRetrievedEntryDigestCount: numerator,
      denominatorRetrievedEntryDigestCount: denominator,
      value: denominator === 0 ? null : numerator / denominator,
      referencedEntryDigestCount: referencedEntryDigests.size,
      calculationUnit: "unique_entry_digest"
    },
    retrievalTokenTotals: {
      estimatedTotal: searchSnippetEstimate + readBodyWordCount,
      searchSnippetEstimate,
      readBodyWordCount,
      snippetTokenEstimatePerSearchResult,
      source: "audit_details_returnedCount_and_bodyWordCount",
      actualTokenizerUsed: false
    },
    digestOnlyReadback: {
      retrievedEntryDigests: [...retrievedEntryDigests].sort(),
      referencedRetrievedEntryDigests
    },
    exclusions: [
      "No retrieval-quality adequacy target is evaluated in KR-06.",
      "Search snippet tokens are estimated from audit returnedCount; no raw snippets or bodies are stored in KPI receipts.",
      "Entries without KR-02 search/read audit evidence are excluded from the denominator."
    ],
    noOverclaimFlags: {
      retrievalQualityAdequacyClaimed: false,
      productReadinessClaimed: false,
      releaseReadinessClaimed: false,
      ownerAcceptanceClaimed: false
    }
  };
}

function filterWindow(events: AuditEvent[], window?: KnowledgeRetrievalKpiWindow): AuditEvent[] {
  return events.filter((event) => {
    if (window?.start && event.timestamp < window.start) return false;
    if (window?.end && event.timestamp > window.end) return false;
    return true;
  });
}

function numberDetail(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArrayDetail(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
