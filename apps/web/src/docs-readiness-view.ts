import {
  AosStore,
  createDefaultSeed,
  createId,
  type ActorIdentity,
  type DocsReadinessRecord,
  type DocsSearchReleaseLinkageIndexReadback,
  type Estimate,
  type GitHubMetadataReadback,
  type PrCiStoryReadinessLinkage,
  type ProjectSearchIndexRecord,
  type ReleaseCandidateLinkage
} from "../../../packages/domain/src/index.js";
import { renderDocsReadinessRuntimeSurface } from "./docs-readiness-ui-react-runtime.js";

export const slice9bWorkflowPacketBasis = "624127182da417f65c790de155e3297e77828181";
export const slice9bPreImplementationBasis = "9d7980f46245bb783b520c9f90945da8609c01ce";

export const requiredDocsReadinessSelectors = [
  "[data-region='docs-surface-shell']",
  "[data-region='brand-lockup']",
  "[data-region='header-claim-strip']",
  "[data-region='docs-readiness-board']",
  "[data-region='search-inspection']",
  "[data-region='github-prci-linkage']",
  "[data-region='release-candidate-linkage']",
  "[data-region='evidence-readback-panel']",
  "[data-region='detail-panel']"
] as const;

export const forbiddenDocsReadinessCopy = [
  "Product Design accepted",
  "browser acceptance complete",
  "deployment ready",
  "release ready",
  "dependency clean",
  "legal completion",
  "public readiness",
  "scanner ingestion complete",
  "resource materialization complete",
  "product accepted",
  "final MVP accepted",
  "GitHub write enabled",
  "release created",
  "docs published"
] as const;

interface InspectionRow {
  id: string;
  storyId: string;
  kind: string;
  title: string;
  status: string;
  owner: string;
  blocker: string;
  linkedEvidenceCount: number;
  detail: string;
  terms: string[];
}

export interface DocsSearchReleaseInspectionModel {
  context: {
    projectId: string;
    localCheckpoint: string;
    workflowPacketBasis: string;
    preImplementationBasis: string;
    docsSearchReleaseSurfacesVisible: true;
    productDesignStatus: "local_static_surface_only";
  };
  rows: InspectionRow[];
  docsReadiness: DocsReadinessRecord;
  searchIndex: ProjectSearchIndexRecord;
  githubMetadata: GitHubMetadataReadback;
  prCiReadiness: PrCiStoryReadinessLinkage;
  releaseCandidate: ReleaseCandidateLinkage;
  aggregateIndex: DocsSearchReleaseLinkageIndexReadback;
  evidencePanel: {
    evidenceTarget: string;
    command: string;
    tcrnTmsBoundary: string;
    wrongSiblingQuarantine: "absent_acceptable";
  };
  noClaims: {
    docsPublication: false;
    docsExport: false;
    canonicalPromotion: false;
    githubMutation: false;
    releaseCreation: false;
    ciMutation: false;
    deployment: false;
    liveCodexDispatch: false;
    productDesignFinalAcceptance: false;
    browserAcceptanceCloseout: false;
    productAcceptance: false;
    finalMvpAcceptance: false;
  };
}

const actor: ActorIdentity = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice9b-visible-readiness"
};

const estimate: Estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

export function createSlice9bDocsSearchReleaseReadModel(): DocsSearchReleaseInspectionModel {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 9B Docs Search Release Visible Readiness Inspection",
    status: "in_progress",
    problem: "Reviewers need a visible local surface for docs/search/release-candidate linkage without publication or release claims.",
    expectedOutcome: "Static inspection surface exposes sanitized docs readiness, search, GitHub/PR/CI metadata, and blocker linkage."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Visible docs readiness inspection",
    goal: "Render Slice 9 metadata as a no-server browser-inspectable local surface.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Inspect docs search and release-candidate linkage",
    problem: "Talia and Rowan need retained browser evidence that the local metadata can be inspected without broadening readiness claims.",
    user: "reviewer",
    expectedBehavior: "Surface exposes docs readiness, sanitized search, GitHub metadata, PR/CI posture, release-candidate blockers, and evidence readbacks.",
    acceptanceCriteria: [
      "visible docs readiness board",
      "search and empty-state inspection",
      "GitHub metadata readback without mutation",
      "release-candidate blocker linkage",
      "no Product Design final acceptance claim"
    ],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-9b-visible-readiness-browser-evidence",
    validity: "valid",
    producer: actor.employeeId,
    digest: "sha256:slice9b-visible-readiness",
    redactionState: "metadata_only"
  }, actor);
  const gate = store.requestGate({
    type: "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const releaseNote = store.createReleaseNote({
    id: createId("release_note", { storyId: story.id, releaseLabel: "slice-9b-local" }),
    projectId: "TCRN-AOS",
    releaseLabel: "slice-9b-local",
    linkedStoryIds: [story.id],
    userFacingSummary: "Local release-candidate linkage is visible for review.",
    internalNotesSummary: "No release creation or GitHub write is claimed.",
    riskNotesSummary: "Release review remains pending until closeout is complete.",
    linkedEvidenceIds: [evidence.id],
    reviewState: "review_required",
    gitExportAuthorized: false,
    releaseCloseoutClaimed: false
  }, actor);
  store.createKnowledgeEntry({
    id: createId("knowledge", { storyId: story.id, category: "release" }),
    projectId: "TCRN-AOS",
    category: "release",
    status: "proposed",
    sourceKind: "story",
    sourceIds: [story.id],
    linkedTicketIds: [story.id],
    linkedConferenceIds: [],
    linkedEvidenceIds: [evidence.id],
    freshnessState: "review_due",
    rawPrivatePayloadStored: false,
    canonicalPromotionClaimed: false,
    localFirstStorage: true,
    defaultGitStorage: false,
    explicitExportRequired: true
  }, actor);
  store.createUserGuideDraft({
    id: createId("guide", { storyId: story.id, audience: "reviewer" }),
    projectId: "TCRN-AOS",
    audience: "release_reviewer",
    versionLabel: "slice-9b-local",
    status: "review_required",
    linkedStoryIds: [story.id],
    linkedReleaseNoteItemIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id],
    publishedStateDistinctFromDraft: true,
    releaseCloseoutClaimed: false,
    defaultGitStorage: false
  }, actor);
  const dependency = store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: "example-review-only",
    versionRange: "0.0.0-fixture",
    sourceSystem: "deterministic_fixture",
    projectUsage: "development",
    ownerRole: "security",
    lifecycleState: "unapproved",
    licenseExpression: "UNKNOWN",
    evidenceStatus: "evidence_missing",
    policyClass: "review_required",
    residualRisk: "blocked",
    nextAction: "request_review",
    sbomNoticeObligation: "review_required",
    posture: "evidence_missing",
    approvalOwnerRole: "security",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id],
    releaseBlocker: true
  }, actor);
  const resource = store.createResourceRecord({
    type: "external_reference",
    projectId: "TCRN-AOS",
    title: "Example release asset metadata",
    owner: "resource-library",
    source: "fixture",
    version: "0.0.0",
    digest: "sha256:slice9b-resource",
    storageReference: "metadata-only",
    classification: ["release-candidate", "metadata-only"],
    permissionState: "permission_required",
    residualRisk: "blocked",
    copyrightStatus: "review_required",
    lifecycleState: "proposed",
    approvalState: "blocked",
    linkedStoryIds: [story.id],
    linkedReleaseNoteIds: [releaseNote.id],
    linkedEvidenceIds: [evidence.id],
    materializationAllowed: false,
    releaseBlocker: true
  }, actor);
  const docsReadiness = store.createDocsReadinessRecord({
    projectId: "TCRN-AOS",
    targetType: "release_note",
    targetId: releaseNote.id,
    readinessState: "needs_review",
    freshnessState: "review_due",
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id],
    linkedGateIds: [gate.id],
    stageMapContext: {
      initiativeId: initiative.id,
      stageIds: ["verification", "release"]
    },
    blockers: ["release review pending"]
  }, actor);
  const searchIndex = store.createProjectSearchIndexRecord({
    projectId: "TCRN-AOS",
    sourceType: "release_note",
    sourceId: releaseNote.id,
    title: "Docs readiness metadata",
    summary: "Sanitized local release-note summary for inspection.",
    sanitizedTerms: ["docs", "search", "release-candidate", "local-review"],
    linkedStoryIds: [story.id],
    linkedEvidenceIds: [evidence.id],
    linkedGateIds: [gate.id]
  }, actor);
  const githubMetadata = store.createGitHubMetadataReadback({
    projectId: "TCRN-AOS",
    repoRegistryId: "TCRN-AOS",
    repositoryName: "TCRN-AOS-local",
    defaultBranch: "main",
    branchName: "main",
    commitSha: slice9bPreImplementationBasis,
    pullRequestRefs: ["local-pr-9b"],
    ciRunRefs: ["local-ci-9b"],
    releaseReferenceIds: [],
    readbackState: "fixture_readback",
    warnings: ["local metadata only"],
    blockers: []
  }, actor);
  const prCiReadiness = store.createPrCiStoryReadiness({
    projectId: "TCRN-AOS",
    storyId: story.id,
    githubMetadataId: githubMetadata.id,
    pullRequestState: "verified_local_metadata",
    ciState: "warning",
    readinessState: "not_ready_for_release",
    warnings: ["CI metadata is local review only"],
    blockers: [],
    linkedEvidenceIds: [evidence.id]
  }, actor);
  const releaseCandidate = store.createReleaseCandidateLinkage({
    projectId: "TCRN-AOS",
    releaseCandidateLabel: "local-release-candidate",
    status: "not_ready_for_release",
    storyIds: [story.id],
    docsReadinessRecordIds: [docsReadiness.id],
    releaseNoteItemIds: [releaseNote.id],
    evidenceIds: [evidence.id],
    dependencyBlockerIds: [dependency.id],
    resourceBlockerIds: [resource.id],
    gateIds: [gate.id],
    githubMetadataIds: [githubMetadata.id],
    prCiReadinessIds: [prCiReadiness.id],
    residualRisks: ["release candidate is local linkage only"]
  }, actor);
  const aggregateIndex = store.createDocsSearchReleaseLinkageIndex("TCRN-AOS");

  return {
    context: {
      projectId: "TCRN-AOS",
      localCheckpoint: "docs-readiness-local-inspection",
      workflowPacketBasis: slice9bWorkflowPacketBasis,
      preImplementationBasis: slice9bPreImplementationBasis,
      docsSearchReleaseSurfacesVisible: true,
      productDesignStatus: "local_static_surface_only"
    },
    rows: [
      inspectionRow("AOS-S057", "Docs readiness", "Release note draft", docsReadiness.readinessState, "review", docsReadiness.blockers[0] ?? "release review pending", docsReadiness.linkedEvidenceIds.length, "Readiness record links release-note draft, stage context, evidence, and gate metadata.", ["docs", "readiness", "release-note"]),
      inspectionRow("AOS-S058", "Search index", searchIndex.title, "metadata_only", "review", "raw payload rejected", searchIndex.linkedEvidenceIds.length, searchIndex.summary, searchIndex.sanitizedTerms),
      inspectionRow("AOS-S062", "GitHub and PR/CI", githubMetadata.repositoryName, prCiReadiness.ciState, "verification", "external review pending", prCiReadiness.linkedEvidenceIds.length, "Repository, branch, PR, and CI references are local metadata.", ["github", "pr", "ci", "metadata"]),
      inspectionRow("AOS-S063", "Release candidate linkage", releaseCandidate.releaseCandidateLabel, "release_proof_required", "release-review", "dependency and resource blockers", releaseCandidate.evidenceIds.length, "Candidate links docs readiness, evidence, dependency/resource blockers, gates, and PR/CI metadata without release creation.", ["release-candidate", "blockers", "evidence"])
    ],
    docsReadiness,
    searchIndex,
    githubMetadata,
    prCiReadiness,
    releaseCandidate,
    aggregateIndex,
    evidencePanel: {
      evidenceTarget: "evidence/slice-9b-visible-readiness-inspection-proof.md",
      command: "pnpm slice9b:proof",
      tcrnTmsBoundary: "6356d3b6b730311fe09a0d3eb2f57a07b10bb3c5",
      wrongSiblingQuarantine: "absent_acceptable"
    },
    noClaims: {
      docsPublication: false,
      docsExport: false,
      canonicalPromotion: false,
      githubMutation: false,
      releaseCreation: false,
      ciMutation: false,
      deployment: false,
      liveCodexDispatch: false,
      productDesignFinalAcceptance: false,
      browserAcceptanceCloseout: false,
      productAcceptance: false,
      finalMvpAcceptance: false
    }
  };
}

export function renderDocsSearchReleaseReadinessHtml(model: DocsSearchReleaseInspectionModel = createSlice9bDocsSearchReleaseReadModel()): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Docs Readiness Inspection</title>
    <link rel="icon" href="../../../docs/brand/aos-favicon.png" />
    <style>${docsReadinessCss}</style>
  </head>
  <body>
    ${renderDocsReadinessRuntimeSurface(model)}
    <script>${docsReadinessClientScript}</script>
  </body>
</html>`;
}

function inspectionRow(storyId: string, kind: string, title: string, status: string, owner: string, blocker: string, linkedEvidenceCount: number, detail: string, terms: string[]): InspectionRow {
  return {
    id: createId("slice9b_row", { storyId, kind, title }),
    storyId,
    kind,
    title,
    status,
    owner,
    blocker,
    linkedEvidenceCount,
    detail,
    terms
  };
}

function copyPosture(value: string): string {
  if (value === "needs_review") return "needs review";
  if (value === "review_due") return "review due";
  if (value === "fixture_readback") return "local evidence review";
  if (value === "metadata_only") return "metadata only";
  if (value === "not_ready_for_release") return "release review pending";
  if (value === "release_proof_required") return "review needed";
  if (value === "absent_acceptable") return "absent acceptable";
  return value.replaceAll("_", " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const docsReadinessCss = `
:root {
  color-scheme: light;
  --navy-950: #061a2c;
  --navy-900: #08243b;
  --teal-500: #14b8ad;
  --teal-600: #069c99;
  --blue-500: #1b75d0;
  --red-500: #df2b2b;
  --amber-500: #f4a321;
  --green-500: #18a865;
  --surface: #ffffff;
  --surface-weak: #f7f9fb;
  --line: #dbe4ea;
  --line-strong: #c9d5de;
  --text: #0f1b2d;
  --muted: #647282;
  font-family: Inter, "Avenir Next", "Helvetica Neue", Arial, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: #f4f7fa; color: var(--text); }
button, input, select { font: inherit; }
button { cursor: pointer; }
strong, b { font-weight: 500; }
.aos-shell { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
.aos-sidebar { position: sticky; top: 0; align-self: start; display: grid; grid-template-rows: auto 1fr auto; gap: 22px; height: 100vh; padding: 24px 14px 20px; overflow: auto; background: linear-gradient(180deg, var(--navy-900), var(--navy-950)); color: #d9e8f0; }
.brand-lockup { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; min-height: 42px; padding: 0 10px 8px; }
.brand-tcrn { font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 29px; line-height: 1; font-weight: 500; letter-spacing: 0.17em; color: #f7fbff; }
.brand-aos { display: inline-block; font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 32px; line-height: 1; font-weight: 800; letter-spacing: 0; color: #14b8ad; transform: skewX(-5deg); }
.nav-stack { display: grid; align-content: start; gap: 6px; }
.nav-row { display: grid; grid-template-columns: 8px 1fr; align-items: center; gap: 10px; width: 100%; min-height: 38px; border: 1px solid transparent; border-radius: 6px; padding: 0 10px; background: transparent; color: #e5eef3; text-align: left; font-size: 14px; font-weight: 400; }
.nav-row::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: #7891a2; }
.nav-row.active, .nav-row:hover { background: rgba(255, 255, 255, 0.12); }
.nav-row.active { box-shadow: inset 4px 0 0 var(--teal-500); }
.nav-row.active::before { background: var(--teal-500); }
.tcrn-nav-group__label { padding: 0 10px 4px; color: #9fb5c4; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
.tcrn-nav-group__items { display: grid; gap: 6px; }
.tcrn-nav-item__content { min-width: 0; }
.tcrn-nav-item__label { min-width: 0; }
.tcrn-nav-item__disabled-reason { display: block; margin-top: 2px; color: #b8cad5; font-size: 11px; font-weight: 400; line-height: 1.25; }
.nav-label { min-width: 0; }
.nav-unavailable-reason { display: block; margin-top: 2px; color: #b8cad5; font-size: 11px; font-weight: 400; line-height: 1.25; }
.sidebar-note { display: flex; align-items: center; gap: 8px; color: #deedf4; font-size: 12px; }
.aos-main { min-width: 0; }
.aos-main, .workspace, .hero-row, .summary-grid, .content-grid, .panel, .work-index, .detail-drawer, .topbar { max-width: 100%; min-width: 0; }
.topbar { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 14px; min-height: 64px; padding: 0 22px; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, 0.96); }
.tcrn-top-bar__brand, .tcrn-top-bar__module { white-space: nowrap; font-size: 13px; font-weight: 500; color: #29374a; }
.tcrn-top-bar__module { color: var(--muted); }
.tcrn-top-bar__actions { display: grid; grid-template-columns: 220px minmax(0, 1fr) max-content; align-items: center; gap: 14px; min-width: 0; }
.project-selector { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; min-height: 38px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--surface); font-size: 14px; }
.project-selector select { min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font-weight: 500; }
.checkpoint-strip { display: flex; align-items: center; gap: 12px; min-width: 0; color: #26364a; font-size: 13px; }
.checkpoint-strip strong, .checkpoint-strip em { white-space: nowrap; }
.checkpoint-strip em { color: var(--teal-600); font-style: normal; }
.top-action, .panel-head button, .filter-row button { min-height: 34px; border: 1px solid var(--line-strong); border-radius: 5px; background: #fff; color: var(--text); font-weight: 500; }
.workspace { display: grid; gap: 18px; padding: 24px 18px 34px; overflow-x: clip; }
.hero-row { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
h1 { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 500; letter-spacing: 0; }
.claim-strip { display: flex; flex-wrap: wrap; gap: 8px; }
.claim-strip span { border: 1px solid var(--line); border-radius: 5px; padding: 6px 9px; background: #fff; color: #516174; font-size: 12px; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.panel, .work-index, .detail-drawer { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.panel { min-height: 184px; padding: 16px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
h2 { margin: 0; font-size: 13px; font-weight: 500; letter-spacing: 0.055em; text-transform: uppercase; }
.count { display: grid; place-items: center; min-width: 22px; height: 22px; border-radius: 999px; background: #fff1d6; color: #a66f0d; font-size: 12px; }
.tag, .state-chip { width: max-content; border-radius: 4px; padding: 4px 7px; font-size: 11px; font-weight: 500; }
.tag { background: #e5f8ee; color: #1d8d51; }
.state-chip { background: #e8f2ff; color: #176ac2; }
.state-chip.release_proof_required { background: #fff1d6; color: #a66f0d; }
.posture-list, .detail-list { display: grid; gap: 10px; margin: 0; }
.posture-list div, .detail-list div { display: grid; grid-template-columns: 118px 1fr; gap: 8px; }
dt { color: #253449; font-size: 12px; font-weight: 500; }
dd { margin: 0; color: #162437; font-size: 12px; }
.compact-copy { margin: 0 0 12px; color: #36475b; font-size: 12px; line-height: 1.5; }
.term-list { display: flex; flex-wrap: wrap; gap: 7px; }
.term-list span { border: 1px solid var(--line); border-radius: 4px; padding: 4px 7px; color: #3c5065; font-size: 11px; }
.state-dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 999px; }
.state-current { background: var(--green-500); }
.state-review { background: var(--amber-500); }
.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 336px; gap: 0; }
.work-index { border-radius: 6px 0 0 6px; overflow: auto; }
.work-index-head { display: grid; grid-template-columns: auto minmax(220px, 1fr) 88px; align-items: center; gap: 14px; padding: 18px; border-bottom: 1px solid var(--line); }
.search-box { display: grid; grid-template-columns: 1fr; min-height: 36px; }
.search-box > .tcrn-field__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.search-box .tcrn-search-input { width: 100%; }
.search-box input { width: 100%; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 12px; color: var(--text); }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--line); }
.readiness-table { min-width: 860px; }
.readiness-row { display: grid; grid-template-columns: 92px minmax(190px, 1fr) 132px 116px 178px 96px; align-items: center; min-height: 48px; padding: 0 16px; border-bottom: 1px solid var(--line); color: #29374a; font-size: 12px; }
.readiness-row[hidden], .empty-state[hidden] { display: none !important; }
.readiness-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.table-head { min-height: 42px; background: #fbfcfd; color: #384659; font-size: 11px; font-weight: 500; }
.inspection-row { width: 100%; border-width: 0 0 1px; background: #fff; text-align: left; }
.inspection-row:hover, .inspection-row.active { background: #effafe; }
.inspection-row.active { box-shadow: inset 4px 0 0 var(--teal-600); }
.empty-state { display: grid; gap: 4px; padding: 18px; border-top: 1px solid var(--line); color: #4b5d70; font-size: 12px; }
.detail-drawer { border-radius: 0 6px 6px 0; border-left: 0; padding: 20px; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.drawer-head button { border: 0; background: transparent; color: #1a293d; }
.detail-drawer h2, .detail-drawer h3:first-child { margin: 14px 0; padding-bottom: 14px; border-bottom: 1px solid var(--line); color: #162437; font-size: 18px; line-height: 1.25; letter-spacing: 0; text-transform: none; }
.detail-list { margin-bottom: 18px; }
.evidence-panel { border: 1px solid var(--line); border-radius: 5px; padding: 12px; background: var(--surface-weak); }
.evidence-panel h3 { margin: 0 0 10px; font-size: 12px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
@media (max-width: 1260px) {
  .aos-shell { grid-template-columns: 220px minmax(0, 1fr); }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content-grid { grid-template-columns: 1fr; }
  .detail-drawer { border-left: 1px solid var(--line); border-radius: 6px; }
}
@media (max-width: 760px) {
  .aos-shell { grid-template-columns: 1fr; }
  .aos-sidebar { position: static; height: auto; gap: 14px; padding: 18px 14px; }
  .nav-stack { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .topbar, .tcrn-top-bar__actions, .work-index-head, .summary-grid { grid-template-columns: minmax(0, 1fr); }
  .topbar { padding: 14px; }
  .checkpoint-strip { align-items: start; flex-direction: column; gap: 4px; }
  .checkpoint-strip strong { white-space: normal; overflow-wrap: anywhere; }
  .checkpoint-strip em { white-space: normal; }
  .hero-row { align-items: start; flex-direction: column; }
  .workspace { padding: 16px 12px 28px; }
  .claim-strip span, .filter-row button, .term-list span { max-width: 100%; overflow-wrap: anywhere; }
  .work-index { overflow-x: auto; }
  .readiness-table { width: max-content; min-width: 760px; }
  .detail-list div, .posture-list div { grid-template-columns: minmax(90px, 0.42fr) minmax(0, 1fr); }
  dd { min-width: 0; overflow-wrap: anywhere; }
}
`;

const docsReadinessClientScript = `
const rows = Array.from(document.querySelectorAll("[data-readiness-row]"));
const emptyState = document.querySelector("[data-empty-state]");
const search = document.querySelector("#readiness-search");
const detailKind = document.querySelector("[data-detail-kind]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailStory = document.querySelector("[data-detail-story]");
const detailStatus = document.querySelector("[data-detail-status]");
const detailBlocker = document.querySelector("[data-detail-blocker]");
const detailCopy = document.querySelector("[data-detail-copy]");
function visibleRows() {
  return rows.filter((row) => !row.hidden).length;
}
function syncEmptyState() {
  const count = visibleRows();
  document.body.dataset.visibleRows = String(count);
  if (emptyState) emptyState.hidden = count !== 0;
}
function activate(row) {
  rows.forEach((candidate) => candidate.classList.toggle("active", candidate === row));
  if (detailKind) detailKind.textContent = row.getAttribute("data-kind") || "";
  if (detailTitle) detailTitle.textContent = row.getAttribute("data-title") || "";
  if (detailStory) detailStory.textContent = row.getAttribute("data-story") || "";
  if (detailStatus) detailStatus.textContent = row.getAttribute("data-status") || "";
  if (detailBlocker) detailBlocker.textContent = row.getAttribute("data-blocker") || "";
  if (detailCopy) detailCopy.textContent = row.getAttribute("data-detail") || "";
}
rows.forEach((row) => row.addEventListener("click", () => activate(row)));
rows.forEach((row) => row.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate(row);
  }
}));
search?.addEventListener("input", () => {
  const query = search.value.toLowerCase();
  rows.forEach((row) => {
    const haystack = row.getAttribute("data-search") || row.textContent || "";
    row.hidden = query.length > 0 && !haystack.toLowerCase().includes(query);
  });
  syncEmptyState();
});
syncEmptyState();
`;
