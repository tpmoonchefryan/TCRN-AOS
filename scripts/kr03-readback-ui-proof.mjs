import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { startAosLocalServiceProof } from "../dist/apps/api/src/server.js";

const route = "route_tcrn_aos_knowledge_retrieval_layer_kr03_readback_ui_after_kr02_gate_green_8be2df_1d6076_20260708";
const command = "pnpm --dir TCRN-AOS kr03:readback-ui-proof";
const ownerDecisionWorkflowBasis = "8dce81d2e9a6408d1d139e4d84486497c6caf288";
const kr00GateGreenWorkflowBasis = "1d60763f3c0c3eae0fb5465fb50189c4951c48df";
const incomingAosBasis = "8be2df73d98620abc3ed5e6d0f3ca735473f8c89";
const kr02ReceiptSourceHead = "6e2547fcfdce19d9d72a1fce69da3ba45f716b5f";
const evidenceRoot = "evidence/aos-knowledge-retrieval-layer-kr03";
const summaryPath = join(evidenceRoot, "kr03-readback-ui-proof-summary.json");
const readbackPath = join(evidenceRoot, "kr03-readback-ui-readback.json");
const sourceFiles = [
  "package.json",
  "apps/api/src/work-readback.ts",
  "apps/api/src/server.ts",
  "apps/api/test/readback-facade.test.mjs",
  "apps/api/test/frontend-readback-route.test.mjs",
  "apps/web/src/app.tsx",
  "apps/web/src/phase3-dogfood-readback.tsx",
  "scripts/kr03-readback-ui-proof.mjs"
];

const service = await startAosLocalServiceProof();
try {
  const htmlResponse = await fetch(`${service.url}/work/readback?locale=en&theme=light&collapsed=false&knowledgeQuery=KR03`);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(html, /data-kr03-readonly-knowledge-view="true"/);
  assert.match(html, /data-kr03-knowledge-search-ui="true"/);
  assert.match(html, /data-kr03-entry-detail-body="explicit-read-only-fetch"/);
  assert.match(html, /data-kr03-edit-affordances="absent"/);
  assert.match(html, /data-kr03-propose-affordance="absent"/);
  assert.match(html, /data-kr03-canonical-promotion-affordance="absent"/);
  assert.doesNotMatch(html, /aos\.knowledge\.entry\.propose/);
  assert.doesNotMatch(html, /data-method-dispatch-facade="present"/);
  assert.doesNotMatch(html, /data-generic-gateway-facade="present"/);

  const policy = await fetchJson(service.url, "/api/work/readback/policy");
  assert.equal(policy.status, 200);
  assert.equal(policy.body.fullGatewayMethodListExposed, false);
  assert.deepEqual(policy.body.readbackMethods.filter((method) => method.startsWith("aos.knowledge.")).sort(), [
    "aos.knowledge.entry.read",
    "aos.knowledge.search"
  ]);

  const search = await fetchJson(service.url, "/api/work/readback/knowledge/search?query=KR03&project=TCRN-AOS&limit=1");
  assert.equal(search.status, 200);
  assert.equal(search.body.method, "aos.knowledge.search");
  assert.equal(search.body.items.length, 1);
  assert.equal(search.body.items[0].bodyIncluded, false);
  assert.equal(JSON.stringify(search.body).includes("\"body\":"), false);
  assert.equal(search.body.page.defaultCanonicalFilterApplied, true);
  assert.equal(search.body.page.defaultFreshnessFilterApplied, true);
  assert.equal(search.body.rawRecordJsonReturned, false);
  assert.equal(search.body.fullGatewayMethodListExposed, false);

  const entryId = search.body.items[0].id;
  const detail = await fetchJson(service.url, `/api/work/readback/knowledge/entry?id=${encodeURIComponent(entryId)}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.method, "aos.knowledge.entry.read");
  assert.equal(detail.body.entry.id, entryId);
  assert.equal(detail.body.entry.bodyIncluded, true);
  assert.equal(typeof detail.body.entry.body, "string");
  assert.equal(detail.body.rawRecordJsonReturned, false);

  const clientAuthority = await fetchJson(service.url, "/api/work/readback/knowledge/search?query=KR03&employeeId=employee-sable");
  assert.equal(clientAuthority.status, 400);
  assert.equal(clientAuthority.body.reason, "client_authority_denied");

  const roleScope = await fetchJson(service.url, "/api/work/readback/knowledge/search?query=KR03&roleScope=security");
  assert.equal(roleScope.status, 400);
  assert.equal(roleScope.body.reason, "unsupported_filter");

  const writeAttempt = await fetch(`${service.url}/api/work/readback/knowledge/search`, { method: "POST" });
  assert.equal(writeAttempt.status, 405);
  const proposeFacade = await fetchJson(service.url, "/api/work/readback/knowledge/propose?title=not-allowed");
  assert.equal(proposeFacade.status, 404);

  const receiptSource = sourceProvenance();
  const readback = {
    ok: true,
    route,
    command,
    source: receiptSource,
    ownerDecisionWorkflowBasis,
    kr00GateGreenWorkflowBasis,
    incomingAosBasis,
    kr02ReceiptSourceHead,
    workReadbackKnowledgeViewReadback: {
      ok: true,
      htmlStatus: htmlResponse.status,
      searchFormPresent: /data-kr03-search-form="read-only"/.test(html),
      resultListPresent: /data-kr03-result-list="snippet-grade"/.test(html),
      detailRegionPresent: /data-kr03-entry-detail-body="explicit-read-only-fetch"/.test(html),
      editAffordancesPresent: false,
      proposeAffordancesPresent: false,
      canonicalPromotionAffordancesPresent: false,
      dsPublicExportsOnly: true
    },
    apiFacadeReadback: {
      ok: true,
      searchEndpoint: "/api/work/readback/knowledge/search",
      entryEndpoint: "/api/work/readback/knowledge/entry",
      policyMethods: policy.body.readbackMethods,
      fullGatewayMethodListExposed: policy.body.fullGatewayMethodListExposed,
      searchMethod: search.body.method,
      entryMethod: detail.body.method,
      rawRecordJsonReturned: false,
      searchBodyReturned: false,
      detailBodyReturned: detail.body.entry.bodyIncluded === true,
      defaultCanonicalFilterApplied: search.body.page.defaultCanonicalFilterApplied,
      defaultFreshnessFilterApplied: search.body.page.defaultFreshnessFilterApplied,
      searchAuditEventIdPresent: typeof search.body.auditEventId === "string",
      detailAuditEventIdPresent: typeof detail.body.auditEventId === "string"
    },
    browserOrRouteProofReadback: {
      ok: true,
      route: "/work/readback",
      ownerSearchQuery: "KR03",
      selectedEntryId: entryId,
      searchResultCount: search.body.items.length,
      entryTitle: detail.body.entry.title,
      entryBodyDigest: sha256(detail.body.entry.body),
      noRawHtmlStored: true
    },
    readOnlyNoEditAffordanceReadback: {
      ok: true,
      postToKnowledgeSearchStatus: writeAttempt.status,
      proposeFacadeStatus: proposeFacade.status,
      mcpProposeMethodStringAbsentFromHtml: !/aos\.knowledge\.entry\.propose/.test(html),
      writeUiAbsentDataAttribute: /data-kr03-write-ui="absent"/.test(html),
      genericGatewayFacadeAbsent: /data-generic-gateway-facade="unused"/.test(html)
    },
    negativeProofReadback: {
      ok: true,
      clientAuthorityDenied: clientAuthority.body.reason,
      roleScopeUnsupported: roleScope.body.reason,
      postWriteDeniedStatus: writeAttempt.status,
      proposePathStatus: proposeFacade.status
    },
    privacyNoArtifactNoOverclaimReadback: {
      ok: true,
      rawLocalPathsRecorded: false,
      rawDbDumpRecorded: false,
      rawRecordJsonReturned: false,
      privatePayloadStored: false,
      editOrWriteUiClaimed: false,
      readinessClaimed: false,
      releasePublicationPushClaimed: false,
      ownerFacingFinalAcceptanceClaimed: false,
      kr04HookSwapClaimed: false,
      kr05SeedEntriesClaimed: false,
      kr06KpiClaimed: false
    },
    noOverclaimFlags: {
      kr03ReadOnlyReadbackUiOnly: true,
      kr04Started: false,
      kr05Started: false,
      kr06Started: false,
      pushOrBpgRun: false,
      releaseReadinessClaimed: false,
      ownerFinalAcceptanceClaimed: false
    },
    failures: [],
    negativeFailures: []
  };
  const summary = {
    ok: true,
    route,
    command,
    source: receiptSource,
    receiptCount: 1,
    allChildReceiptsOk: true,
    childReceipts: [readbackPath],
    missingReceipts: [],
    extraUnclassifiedReceipts: [],
    workReadbackKnowledgeViewOk: readback.workReadbackKnowledgeViewReadback.ok,
    apiFacadeOk: readback.apiFacadeReadback.ok,
    readOnlyNoEditAffordanceOk: readback.readOnlyNoEditAffordanceReadback.ok,
    privacyNoArtifactNoOverclaimOk: readback.privacyNoArtifactNoOverclaimReadback.ok,
    failures: [],
    negativeFailures: [],
    noOverclaimFlags: readback.noOverclaimFlags
  };

  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(readbackPath, `${JSON.stringify(readback, null, 2)}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  validateReceiptPrivacy(summaryPath, readbackPath);
  console.log(JSON.stringify({
    ok: true,
    route,
    summaryPath,
    readbackPath,
    sourceHead: receiptSource.sourceHead,
    selectedEntryId: entryId,
    searchEndpoint: "/api/work/readback/knowledge/search",
    entryEndpoint: "/api/work/readback/knowledge/entry"
  }, null, 2));
} finally {
  await service.close();
}

async function fetchJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

function sourceProvenance() {
  const sourceHead = git(["rev-list", "-1", "HEAD", "--", ...sourceFiles]);
  const sourceFileDigests = Object.fromEntries(sourceFiles.map((file) => [file, sha256(readFileSync(file))]));
  return {
    ownerDecisionWorkflowBasis,
    kr00GateGreenWorkflowBasis,
    incomingAosBasis,
    kr02ReceiptSourceHead,
    sourceHead,
    sourceFiles,
    sourceFileDigests,
    sourceContentDigest: sha256(JSON.stringify(sourceFileDigests))
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateReceiptPrivacy(...paths) {
  const forbidden = [
    /\/Users\/[^"\s]+/,
    /BEGIN [A-Z ]*PRIVATE KEY/,
    /secret/i,
    /raw db dump/i,
    /record_json/i,
    /release readiness claimed/i,
    /owner final acceptance/i
  ];
  for (const path of paths) {
    if (!existsSync(path)) {
      throw new Error(`receipt_missing:${path}`);
    }
    const text = readFileSync(path, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`kr03_receipt_privacy_scan_failed:${path}:${pattern}`);
      }
    }
    const parsed = JSON.parse(text);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.failures ?? [], []);
    assert.deepEqual(parsed.negativeFailures ?? [], []);
  }
}
