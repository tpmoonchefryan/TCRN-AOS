import {
  AosStore,
  createDefaultSeed,
  type ActorIdentity,
  type Estimate
} from "../../../packages/domain/src/index.js";
import {
  aosClientCopyStateLabels,
  aosDesignSystemConsumerBridge,
  aosDesignSystemTokenCss,
  copyAosAction,
  copyAosFreshness,
  copyAosPosture,
  copyAosState
} from "./design-system-bridge.js";
import {
  createCockpitServiceReadback,
  createOperationsCockpitReadModel,
  type CockpitServiceReadModelReadback,
  type GateQueueItem,
  type OperationsCockpitReadModel,
  type RiskWarningItem,
  type WorkstreamStoryRow
} from "./cockpit.js";
import {
  aosCockpitUiReactRuntime,
  renderCockpitRuntimeClaimRiskStrips,
  renderCockpitRuntimeDetailDrawer,
  renderCockpitRuntimeGateReadbackCards,
  renderCockpitRuntimeHeroTitle,
  renderCockpitRuntimeShellSidebar,
  renderCockpitRuntimeStagePhaseCards,
  renderCockpitRuntimeTopbarCheckpoint,
  renderCockpitRuntimeWorkIndexCluster,
  type CockpitRuntimeClaimRiskStripsOptions,
  type CockpitRuntimeDetailDrawerOptions,
  type CockpitRuntimeGateReadbackCardsOptions,
  type CockpitRuntimeHeroTitleOptions,
  type CockpitRuntimeNavItem,
  type CockpitRuntimeShellSidebarOptions,
  type CockpitRuntimeStagePhaseOptions,
  type CockpitRuntimeTopbarCheckpointOptions,
  type CockpitRuntimeWorkIndexRow
} from "./cockpit-ui-react-runtime.js";
import { tcrnComponentAttr } from "./static-component-registry.js";

export const slice4bBaselineDigest = "2bccfa9ab9ed95b785135965c4494f38258a27de3c6f4e9cc1fdad51ed75fb90";

export const requiredProductionSelectors = [
  "[data-region='sidebar-nav']",
  "[data-region='brand-lockup']",
  "[data-region='project-selector']",
  "[data-region='checkpoint-strip']",
  "[data-region='stage-map']",
  "[data-region='ai-employee-phase']",
  "[data-region='blocker-gate-card']",
  "[data-region='readback-posture-card']",
  "[data-region='work-index']",
  "[data-region='detail-drawer']"
] as const;

export const forbiddenProductionCopy = [
  "All Systems Operational",
  "Healthy",
  "On Track",
  "Local DB (SQLite) Healthy",
  "Release Readiness",
  "Route to Next Approval",
  "Product Design accepted",
  "browser acceptance complete",
  "deployment ready",
  "live Codex dispatch enabled",
  "release ready",
  "dependency clean",
  "legal completion",
  "public readiness",
  "scanner ingestion complete",
  "resource materialization complete",
  "product accepted",
  "final MVP accepted"
] as const;

export interface OperationsCockpitRenderOptions {
  serviceBacked?: boolean;
  cockpitApiPath?: string;
}

const actor: ActorIdentity = {
  employeeId: "employee-ilya",
  role: "implementation",
  threadId: "019eb6d7-f130-70a0-8805-169cc337229b",
  sessionId: "slice-4b-style-proof"
};

const estimate: Estimate = {
  effortPoints: 3,
  complexity: "medium",
  risk: "L3",
  verificationCost: "medium",
  confidence: "medium"
};

const cockpitNavLabels = [
  "Dashboard",
  "Cockpit",
  "Work Index",
  "Stage Map",
  "Gate Queue",
  "Conferences",
  "Evidence",
  "Dependency",
  "Resources",
  "Audit"
] as const;

export function createSlice4bCockpitReadModel(): OperationsCockpitReadModel {
  const store = new AosStore(createDefaultSeed());
  const initiative = store.createInitiative({
    projectId: "TCRN-AOS",
    title: "Slice 4B Operations Cockpit Frontend Style Baseline",
    status: "in_progress",
    problem: "AOS needs a product-local cockpit surface that implements the accepted static style baseline without broad acceptance claims.",
    expectedOutcome: "Production surface preserves local-first readbacks, gate posture, stage map, evidence, and inspection contracts."
  }, actor);
  const epic = store.createEpic({
    initiativeId: initiative.id,
    title: "Operations Cockpit Surface",
    goal: "Render the local operations cockpit style baseline from deterministic read-model data.",
    status: "in_progress"
  }, actor);
  const story = store.createStory({
    epicId: epic.id,
    title: "Render local-first cockpit style baseline",
    problem: "The owner needs to scan AI-operated work without mistaking local proof for release readiness.",
    user: "owner observer",
    expectedBehavior: "Cockpit separates project switching, stage movement, gate posture, evidence freshness, dependency posture, and owner-intent work orders.",
    acceptanceCriteria: [
      "brand lockup uses selected geometric baseline",
      "project selector is separate from work index filters",
      "stage map and AI employee responsibility are visible",
      "dependency and resource inspection avoid clean/legal claims",
      "detail drawer uses non-executing gate language"
    ],
    status: "in_progress",
    estimate,
    subTasks: []
  }, actor);
  const evidence = store.linkEvidence({
    type: "artifact_id",
    target: "slice-4b-style-baseline-proof",
    validity: "valid",
    producer: actor.employeeId,
    digest: `sha256:${slice4bBaselineDigest}`,
    redactionState: "metadata_only"
  }, actor);
  store.requestGate({
    type: "evidence_proof",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  store.requestGate({
    type: "owner_intent",
    linkedTicketId: story.id,
    inputEvidenceIds: [evidence.id]
  }, actor);
  const conference = store.createConference({
    type: "verification",
    title: "Slice 4B style baseline review",
    initiator: actor,
    participantEmployeeIds: ["employee-arturo", "employee-sable"],
    agenda: ["Check visual baseline implementation", "Preserve no-overclaim copy"],
    linkedTicketIds: [story.id],
    desiredOutcome: "Local browser/static proof package"
  }, actor);
  store.recordConferencePosition({
    conferenceId: conference.id,
    actor: {
      employeeId: "employee-arturo",
      role: "coordinator",
      threadId: "019eb66e-00d1-7190-81d9-693895b32033",
      sessionId: "slice-4b-style-proof"
    },
    position: "Proceed with local style baseline proof.",
    risks: ["Browser acceptance remains unclaimed until proof is reviewed."],
    recommendations: ["Keep Product Design final visual acceptance out of scope."],
    evidenceIds: [evidence.id]
  }, actor);
  store.createAssignment({
    employeeId: "employee-ilya",
    targetId: story.id,
    targetType: "story",
    role: "implementation",
    status: "in_progress",
    dueState: "none",
    proofExpectation: "slice-4b-style-proof"
  }, actor);
  store.createDependencyRecord({
    projectId: "TCRN-AOS",
    ecosystem: "npm",
    packageName: "typescript",
    versionRange: "5.8.3",
    sourceSystem: "package.json",
    projectUsage: "development",
    licenseExpression: "Apache-2.0",
    evidenceStatus: "present",
    sbomNoticeObligation: "none",
    posture: "review_required",
    approvalOwnerRole: "security"
  }, actor);
  store.createResourceRecord({
    type: "image",
    title: "TCRN-AOS geometric wordmark",
    owner: "TCRN",
    source: "owner-accepted product-local baseline",
    version: "slice-4b",
    digest: `sha256:${slice4bBaselineDigest}`,
    storageReference: "docs/brand/tcrn-aos-wordmark-geometric-dark.png",
    classification: ["brand", "style-baseline"],
    copyrightStatus: "review_required",
    lifecycleState: "approved",
    approvalState: "review_required"
  }, actor);
  return createOperationsCockpitReadModel({
    store,
    projectId: "TCRN-AOS",
    initiativeId: initiative.id,
    localCheckpoint: "slice-4b-style-baseline",
    selectedDetail: { id: story.id, type: "story" }
  });
}

export function renderOperationsCockpitHtml(
  model: OperationsCockpitReadModel = createSlice4bCockpitReadModel(),
  options: OperationsCockpitRenderOptions = {}
): string {
  const serviceBacked = options.serviceBacked === true;
  const cockpitApiPath = options.cockpitApiPath ?? "/api/cockpit";
  const workRows = model.workstreams.flatMap((group) => group.rows);
  const selectedRow = workRows[0];
  const selectedDetail = model.detailPanel;
  const blockingGate = model.ownerIntentQueue[0] ?? model.roleGateQueue[0];
  const dependency = model.dependencyInspection[0];
  const resource = model.resourceInspection[0];
  const selectedConference = model.conferences[0];
  const serviceReadback = createCockpitServiceReadback(model, { serviceBacked });
  const stageDetailDisabledReason = "Stage details open after the stage workspace is available.";
  const roleDetailDisabledReason = "Role details open after the staffing workspace is available.";
  const claimRiskStripSeparator = "\n          ";
  const claimRiskStripsHtml = renderCockpitRuntimeClaimRiskStrips(createCockpitRuntimeClaimRiskStripsOptions(model));
  const claimRiskStripParts = claimRiskStripsHtml.split(claimRiskStripSeparator);
  const claimStripHtml = claimRiskStripParts[0] ?? "";
  const riskLaneHtml = claimRiskStripParts.slice(1).join(claimRiskStripSeparator);
  const shellSidebarHtml = renderCockpitRuntimeShellSidebar(createCockpitRuntimeShellSidebarOptions({
    cockpitApiPath,
    model,
    serviceBacked,
    serviceReadback
  }));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Operations Cockpit</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='6'%20fill='%2308243b'/%3E%3Ctext%20x='16'%20y='21'%20font-size='12'%20text-anchor='middle'%20fill='%2314b8ad'%20font-family='Arial'%3EA%3C/text%3E%3C/svg%3E" />
    <style>${operationsCockpitCss}</style>
  </head>
  <body>
    ${shellSidebarHtml}
      <section class="aos-main" id="cockpit">
        ${renderCockpitRuntimeTopbarCheckpoint(createCockpitRuntimeTopbarCheckpointOptions({
          model,
          serviceBacked,
          serviceReadback
        }))}
        <div class="workspace">
          <section class="hero-row">
            ${renderCockpitRuntimeHeroTitle(createCockpitRuntimeHeroTitleOptions(model))}
            ${claimStripHtml}
          </section>
          <section class="summary-grid">
            ${renderCockpitRuntimeStagePhaseCards(createCockpitRuntimeStagePhaseOptions(model, stageDetailDisabledReason, roleDetailDisabledReason))}
            ${renderCockpitRuntimeGateReadbackCards(createCockpitRuntimeGateReadbackCardsOptions({
              blockingGate,
              dependency,
              model,
              resource
            }))}
          </section>
          <section class="content-grid">
            ${renderCockpitRuntimeWorkIndexCluster({
              columnsDisabledReason: "Column settings are not available in this workspace.",
              filters: [
                { label: `Project: ${model.contextHeader.selectedProjectId}`, tone: "neutral" },
                { label: `Freshness: ${copyFreshness(model.contextHeader.dataFreshness)}`, tone: "positive" },
                { label: `Risk: ${copyState("proof_required")}`, tone: "warning" }
              ],
              rows: createCockpitRuntimeWorkIndexRows(workRows)
            })}
            ${renderCockpitRuntimeDetailDrawer(createCockpitRuntimeDetailDrawerOptions({
              blockingGate,
              dependency,
              model,
              resource,
              selectedConference,
              selectedDetail,
              selectedRow
            }))}
          </section>
          ${riskLaneHtml}
        </div>
      </section>
    </main>
    <script>${operationsCockpitClientScript}</script>
  </body>
</html>`;
}

const operationsCockpitCss = `
${aosDesignSystemTokenCss}
:root {
  color-scheme: light;
  --navy-950: #061a2c;
  --navy-900: #08243b;
  --navy-800: #0d304b;
  --teal-500: var(--tcrn-color-brand-secondary);
  --teal-600: var(--tcrn-color-brand-secondary);
  --blue-500: var(--tcrn-color-brand-primary);
  --red-500: var(--tcrn-color-state-blocked);
  --amber-500: var(--tcrn-color-state-warning);
  --green-500: var(--tcrn-color-state-ready);
  --surface: var(--tcrn-color-surface-panel);
  --surface-weak: var(--tcrn-color-surface-muted);
  --surface-tint: var(--tcrn-color-brand-secondary-bg);
  --line: var(--tcrn-color-border-subtle);
  --line-strong: var(--tcrn-color-border-strong);
  --text: var(--tcrn-color-text-primary);
  --muted: var(--tcrn-color-text-secondary);
  --soft: var(--tcrn-color-text-muted);
  --type-ui: 13px;
  --type-label: 12px;
  --type-micro: 11px;
  --line-ui: 1.35;
  --line-compact: 1.22;
  font-family: Inter, "Avenir Next", "Helvetica Neue", Arial, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: #f4f7fa; color: var(--text); font-size: var(--type-ui); line-height: var(--line-ui); }
button, input, select { font: inherit; line-height: var(--line-compact); }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.58; }
strong, b { font-weight: 500; }
.tcrn-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.aos-shell { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
.aos-sidebar { position: sticky; top: 0; align-self: start; display: grid; grid-template-rows: auto 1fr auto; gap: 22px; height: 100vh; padding: 24px 14px 20px; overflow: auto; background: linear-gradient(180deg, var(--navy-900), var(--navy-950)); color: #d9e8f0; }
.brand-lockup { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; min-height: 42px; padding: 0 10px 8px; }
.brand-tcrn { font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 29px; line-height: 1; font-weight: 500; letter-spacing: 0.17em; color: #f7fbff; }
.brand-aos { display: inline-block; font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 32px; line-height: 1; font-weight: 800; letter-spacing: 0; color: transparent; background: linear-gradient(135deg, #18d7c8 6%, #08a99d 56%, #15c4b5 100%); -webkit-background-clip: text; background-clip: text; transform: skewX(-5deg); }
.nav-stack { display: grid; align-content: start; gap: 8px; }
.nav-stack .tcrn-nav-group__label { color: #a9bfcc; font-size: var(--type-micro); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
.nav-stack .tcrn-nav-group__items { display: grid; gap: 6px; }
.nav-row { display: grid; grid-template-columns: 8px 1fr; align-items: center; gap: 10px; width: 100%; min-height: 38px; border: 1px solid transparent; border-radius: 6px; padding: 7px 10px; background: transparent; color: #e5eef3; text-align: left; font-size: var(--type-ui); font-weight: 400; }
.nav-row::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: #7891a2; }
.nav-row.active, .nav-row:hover { background: rgba(255, 255, 255, 0.12); }
.nav-row.active { box-shadow: inset 4px 0 0 var(--teal-500); }
.nav-row.active::before { background: var(--teal-500); }
.tcrn-nav-item__content { display: grid; min-width: 0; gap: 2px; }
.tcrn-nav-item__label { min-width: 0; }
.tcrn-nav-item__disabled-reason { color: #b8cad5; font-size: var(--type-micro); font-weight: 400; line-height: var(--line-compact); overflow-wrap: anywhere; }
.nav-label { min-width: 0; }
.nav-unavailable-reason { display: block; margin-top: 2px; color: #b8cad5; font-size: var(--type-micro); font-weight: 400; line-height: var(--line-compact); }
.sidebar-note { display: flex; align-items: center; gap: 8px; color: #deedf4; font-size: var(--type-label); }
.sidebar-note .tcrn-text { margin: 0; color: inherit; font-size: inherit; line-height: inherit; }
.aos-main { min-width: 0; }
.topbar { display: grid; grid-template-columns: max-content minmax(0, 1fr); grid-template-areas: "brand actions" "module actions"; align-items: center; column-gap: 14px; row-gap: 4px; min-height: 64px; min-width: 0; padding: 8px 22px; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, 0.96); }
.tcrn-top-bar__brand { grid-area: brand; color: #0f2437; font-size: var(--type-label); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
.tcrn-top-bar__module { grid-area: module; color: var(--muted); font-size: var(--type-label); white-space: nowrap; }
.tcrn-top-bar__actions { grid-area: actions; display: grid; grid-template-columns: minmax(170px, 220px) minmax(0, 1fr) max-content 38px; align-items: center; gap: 14px; min-width: 0; }
.project-selector { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; min-height: 38px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--surface); font-size: var(--type-ui); }
.project-selector span { color: #25364a; }
.project-selector select { min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font-weight: 500; }
.checkpoint-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; min-width: 0; color: #26364a; font-size: var(--type-ui); }
.checkpoint-strip .tcrn-heading { flex: 0 0 auto; margin: 0; color: var(--muted); font-size: var(--type-label); font-weight: 500; letter-spacing: 0; text-transform: none; }
.checkpoint-strip strong, .checkpoint-strip em, .checkpoint-strip .tcrn-badge { white-space: nowrap; }
.checkpoint-strip em { color: var(--teal-600); font-style: normal; }
.service-readback { border: 1px solid #b8dde0; border-radius: 4px; padding: 4px 7px; color: #14646a; background: #f1fcfc; white-space: normal; font-size: var(--type-label); line-height: var(--line-compact); }
.service-readback.blocked { border-color: #f2c0bd; color: #b42318; background: #fff4f2; }
.service-readback.loading { border-color: #bed4f7; color: #1f5fa7; background: #f3f8ff; }
.top-action, .profile, .panel-head button, .work-index-head button, .filter-row button, .primary-action, .secondary-action { min-height: 34px; border-radius: 5px; font-size: var(--type-ui); font-weight: 500; }
.top-action, .panel-head button, .work-index-head button, .filter-row button, .secondary-action { border: 1px solid var(--line-strong); background: #fff; color: var(--text); }
.profile { border: 0; border-radius: 999px; background: #091833; color: #fff; }
.workspace { display: grid; gap: 18px; padding: 24px 18px 34px; }
.hero-row { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.eyebrow { margin: 0 0 4px; color: var(--muted); font-size: var(--type-label); text-transform: uppercase; letter-spacing: 0.06em; }
h1 { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 500; letter-spacing: 0; }
.claim-strip, .risk-lane { display: flex; flex-wrap: wrap; gap: 8px; }
.claim-strip span, .risk-pill { border: 1px solid var(--line); border-radius: 5px; padding: 6px 9px; background: #fff; color: #516174; font-size: var(--type-label); line-height: var(--line-compact); }
.summary-grid { display: grid; grid-template-columns: 1.28fr 0.92fr 1fr 1.04fr; gap: 13px; }
.panel, .work-index, .detail-drawer { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.panel { min-height: 188px; padding: 16px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
h2 { margin: 0; font-size: var(--type-ui); font-weight: 500; letter-spacing: 0.055em; text-transform: uppercase; }
.count { display: grid; place-items: center; min-width: 22px; height: 22px; border-radius: 999px; background: #f3e6e6; color: var(--red-500); font-size: var(--type-label); }
.stage-line { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 8px; margin: 0; padding: 28px 0 0; list-style: none; }
.stage-line::before { content: ""; position: absolute; left: 11%; right: 11%; top: 54px; height: 4px; background: linear-gradient(90deg, var(--teal-600) 0 72%, #c9d4dd 72% 100%); }
.stage-line li { position: relative; z-index: 1; display: grid; justify-items: center; gap: 8px; text-align: center; }
.stage-line .stage-label { width: 100%; min-height: 24px; margin: 0; padding: 0 2px; color: #113447; font-size: 10px; font-weight: 500; line-height: var(--line-compact); white-space: nowrap; }
.stage-line .stage-number { display: grid; place-items: center; width: 30px; height: 30px; border: 3px solid #c9d4dd; border-radius: 999px; background: var(--surface); color: var(--soft); font-weight: 500; }
.stage-line .complete .stage-number, .stage-line .active .stage-number { border-color: var(--teal-600); }
.stage-line .complete .stage-number { background: var(--teal-600); color: #fff; }
.stage-line .active .stage-number { background: #f4fffd; color: var(--teal-600); }
.stage-line .release_proof_required .stage-number { border-color: var(--amber-500); color: #a86500; }
.stage-line .state-chip { width: 100%; max-width: 82px; min-width: 0; padding: 4px; text-align: center; white-space: normal; overflow-wrap: anywhere; }
.phase-list, .posture-list, .detail-list { display: grid; gap: 10px; }
.phase-row, .gate-block { display: grid; gap: 8px; }
.phase-row { grid-template-columns: minmax(86px, 1fr) minmax(46px, auto) auto; align-items: center; font-size: var(--type-ui); }
.phase-label { min-width: 0; margin: 0; font-size: 11px; white-space: nowrap; }
.phase-owners { display: flex; gap: 5px; }
.avatar { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid #9edbd9; border-radius: 999px; background: #edfafa; color: #30636a; font-size: 10px; font-weight: 500; line-height: 1; }
.state-chip, .tag { width: max-content; border-radius: 4px; padding: 4px 7px; font-size: var(--type-label); font-weight: 500; line-height: var(--line-compact); }
.state-chip { background: #e8f2ff; color: #176ac2; }
.state-chip.blocked { background: #ffe7e3; color: #d0312a; }
.state-chip.release_proof_required { background: #fff1d6; color: #a66f0d; }
.gate-block { padding-top: 2px; font-size: var(--type-ui); }
.gate-block strong { color: #18253a; }
.posture-list, .detail-list { margin: 0; }
.posture-list div, .detail-list div { display: grid; grid-template-columns: 108px 1fr; gap: 8px; }
dt { color: #253449; font-size: var(--type-ui); font-weight: 500; }
dd { margin: 0; color: #162437; font-size: var(--type-ui); }
.state-dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 999px; }
.state-current { background: var(--green-500); }
.state-blocked { background: var(--red-500); }
.state-review { background: var(--amber-500); }
.secondary-action, .primary-action { width: 100%; padding: 0 12px; }
.primary-action { border: 0; background: linear-gradient(135deg, #14b8ad, #049b9a); color: #fff; }
.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 316px; gap: 0; }
.work-index { border-radius: 6px 0 0 6px; overflow: auto; }
.work-index-head { display: grid; grid-template-columns: auto minmax(220px, 1fr) 88px; align-items: center; gap: 14px; padding: 18px; border-bottom: 1px solid var(--line); }
.search-box { display: grid; grid-template-columns: 1fr; min-height: 36px; }
.search-box span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.search-box input { width: 100%; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 12px; color: var(--text); }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--line); }
.work-table { min-width: 620px; }
.empty-state { padding: 18px; border-bottom: 1px solid var(--line); color: #526174; font-size: var(--type-ui); }
.table-row { display: grid; grid-template-columns: minmax(260px, 1fr) 136px 132px; align-items: center; min-height: 48px; padding: 0 16px; border-bottom: 1px solid var(--line); color: #29374a; font-size: var(--type-ui); }
.table-row[hidden] { display: none !important; }
.table-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.table-head { min-height: 42px; background: #fbfcfd; color: #384659; font-size: var(--type-label); font-weight: 500; }
.work-row { border: 0; background: #fff; text-align: left; }
.work-row:hover, .work-row.active { background: #effafe; }
.work-row.active { box-shadow: inset 4px 0 0 var(--teal-600); }
.detail-drawer { border-radius: 0 6px 6px 0; border-left: 0; padding: 20px; }
.detail-drawer.closed { display: none; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.drawer-head button { border: 0; background: transparent; color: #1a293d; }
.tag { background: #e5f8ee; color: #1d8d51; }
.detail-drawer h2, .detail-drawer h3 { margin: 14px 0; padding-bottom: 14px; border-bottom: 1px solid var(--line); color: #162437; font-size: 16px; line-height: 1.28; letter-spacing: 0; text-transform: none; }
.detail-list { margin-bottom: 18px; }
.loop-card { margin: 0 0 16px; border: 1px solid var(--line); border-radius: 5px; padding: 12px; background: var(--surface-weak); }
.loop-card h3 { margin: 0 0 8px; font-size: var(--type-label); font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
.loop-card p { margin: 0 0 8px; color: #17263a; font-size: var(--type-ui); }
.loop-card ul { display: grid; gap: 5px; margin: 0; padding-left: 16px; color: #405065; font-size: var(--type-ui); }
.risk-lane { padding-bottom: 4px; }
@media (max-width: 1260px) {
  .aos-shell { grid-template-columns: 220px minmax(0, 1fr); }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content-grid { grid-template-columns: 1fr; }
  .detail-drawer { border-left: 1px solid var(--line); border-radius: 6px; }
}
@media (max-width: 760px) {
  .aos-shell { grid-template-columns: 1fr; }
  .aos-sidebar { position: static; height: auto; gap: 14px; padding: 18px 14px; }
  .nav-stack .tcrn-nav-group__items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nav-row { min-height: 34px; }
  .topbar, .tcrn-top-bar__actions, .work-index-head, .summary-grid { grid-template-columns: 1fr; }
  .topbar { grid-template-areas: "brand" "module" "actions"; padding: 14px; }
  .hero-row { align-items: start; flex-direction: column; }
  .workspace { padding: 16px 12px 28px; }
  .stage-line { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 18px; }
  .stage-line::before { display: none; }
}
@media (max-width: 460px) {
  .stage-line { grid-template-columns: 1fr; }
  .checkpoint-strip, .claim-strip { align-items: start; flex-direction: column; }
  .table-row { grid-template-columns: minmax(190px, 1fr) 104px 96px; }
}
@media (max-width: 520px) {
  .work-table.tcrn-table-shell { min-width: 0; overflow-x: visible; }
  .work-table .tcrn-table-shell__head { display: none; }
  .work-table .tcrn-table-shell__row { display: grid; grid-template-columns: 1fr; gap: 8px; min-width: 0; min-height: 0; padding: 12px; }
  .work-table .tcrn-table-shell__cell { display: grid; grid-template-columns: minmax(84px, 0.4fr) minmax(0, 1fr); gap: 8px; min-width: 0; overflow: visible; text-overflow: clip; white-space: normal; }
  .work-table .tcrn-table-shell__cell::before { content: attr(data-label); color: var(--muted); font-weight: 500; }
}`;

const operationsCockpitClientScript = `
const shell = document.querySelector("[data-surface='operations-cockpit']");
const aosCopyStateLabels = ${JSON.stringify(aosClientCopyStateLabels)};
const serviceBacked = shell?.getAttribute("data-service-backed") === "true";
const cockpitApiPath = shell?.getAttribute("data-cockpit-api") || "/api/cockpit";
const workTable = document.querySelector("[data-work-table]");
const drawer = document.querySelector("[data-region='detail-drawer']");
const drawerTitle = document.querySelector("[data-drawer-title]");
const detailList = document.querySelector("[data-detail-list]");
const search = document.querySelector("[data-work-search]");
const refreshButton = document.querySelector("[data-refresh-readback]");
const freshness = document.querySelector("[data-readback-freshness]");
const checkpoint = document.querySelector("[data-local-checkpoint]");
const serviceStatus = document.querySelector("[data-service-status]");
const serviceModelReadback = document.querySelector("[data-service-model-readback]");
const emptyState = document.querySelector("[data-empty-state]");
let currentRows = Array.from(document.querySelectorAll("[data-work-row]"));
let activeStoryId = currentRows[0]?.getAttribute("data-row-id") || "";
let serviceRefreshCount = 0;

function setServiceStatus(text, state) {
  if (!serviceStatus) return;
  serviceStatus.textContent = text;
  serviceStatus.classList.toggle("loading", state === "loading");
  serviceStatus.classList.toggle("blocked", state === "blocked");
  shell?.setAttribute("data-service-refresh-state", state);
  if (state === "loading") {
    shell?.setAttribute("data-service-bootstrap-state", "loading");
  }
}

function cockpitUrl(selectedId) {
  const url = new URL(cockpitApiPath, window.location.origin);
  if (selectedId) {
    url.searchParams.set("selectedType", "story");
    url.searchParams.set("selectedId", selectedId);
  }
  return url;
}

async function loadCockpit(selectedId) {
  if (!serviceBacked) return;
  refreshButton?.setAttribute("disabled", "true");
  refreshButton?.setAttribute("aria-busy", "true");
  setServiceStatus("reading service API", "loading");
  try {
    const response = await fetch(cockpitUrl(selectedId), { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("cockpit_api_" + response.status);
    const payload = await response.json();
    if (!payload.ok || !payload.model) throw new Error("cockpit_payload_not_ok");
    if (!payload.serviceReadModel) throw new Error("cockpit_service_read_model_missing");
    renderPayload(payload);
    serviceRefreshCount += 1;
    shell?.setAttribute("data-service-bootstrap-state", "ready");
    shell?.setAttribute("data-service-last-read-at", payload.generatedAt || "");
    shell?.setAttribute("data-service-refresh-count", String(serviceRefreshCount));
    shell?.setAttribute("data-owner-trial-readiness-lane", payload.ownerTrial?.readinessLane?.serviceBackedState ? "service-backed" : "unavailable");
    setServiceStatus("service API read " + new Date(payload.generatedAt).toLocaleTimeString(), "ok");
  } catch (error) {
    shell?.setAttribute("data-service-bootstrap-state", activeStoryId ? "ready_with_unavailable_refresh" : "unavailable");
    shell?.setAttribute("data-service-last-error", error instanceof Error ? error.message : String(error));
    setServiceStatus("service API read failed", "blocked");
  } finally {
    refreshButton?.removeAttribute("disabled");
    refreshButton?.removeAttribute("aria-busy");
  }
}

function renderPayload(payload) {
  const model = payload.model;
  activeStoryId = model.detailPanel?.selectedId || activeStoryId;
  if (checkpoint) checkpoint.textContent = "Operations cockpit ready";
  if (freshness) freshness.textContent = copyFreshness(model.contextHeader.dataFreshness);
  applyServiceReadModel(payload.serviceReadModel);
  renderRows(model.workstreams.flatMap((group) => group.rows));
  renderDetail(model);
  filterRows();
}

function applyServiceReadModel(readback) {
  if (!shell || !readback?.surfaces) return;
  const workIndex = readback.surfaces.workIndex || {};
  const detail = readback.surfaces.detail || {};
  const gate = readback.surfaces.gate || {};
  const readbackSurface = readback.surfaces.readback || {};
  shell.setAttribute("data-service-model-schema", readback.schemaVersion || "");
  shell.setAttribute("data-service-read-model-source", readback.source || "");
  shell.setAttribute("data-service-work-row-count", String(workIndex.rowCount ?? 0));
  shell.setAttribute("data-service-selected-story-id", workIndex.selectedStoryId || "");
  shell.setAttribute("data-service-detail-id", detail.selectedId || "");
  shell.setAttribute("data-service-detail-type", detail.selectedType || "");
  shell.setAttribute("data-service-gate-count", String((gate.roleGateCount ?? 0) + (gate.ownerIntentGateCount ?? 0)));
  shell.setAttribute("data-service-evidence-readback-count", String(readbackSurface.evidenceReadbackCount ?? 0));
  shell.setAttribute("data-service-runtime-data-committed", String(readbackSurface.runtimeDataCommittedToGit === true));
  shell.setAttribute("data-service-selected-detail-round-trip", workIndex.selectedStoryId === detail.selectedId ? "true" : "false");
  if (serviceModelReadback) {
    serviceModelReadback.textContent = serviceReadModelSummary(readback);
  }
}

function serviceReadModelSummary(readback) {
  const workIndex = readback?.surfaces?.workIndex || {};
  const detail = readback?.surfaces?.detail || {};
  const gate = readback?.surfaces?.gate || {};
  const gateCount = (gate.roleGateCount ?? 0) + (gate.ownerIntentGateCount ?? 0);
  return String(workIndex.rowCount ?? 0) + " work / " + String(gateCount) + " gates / detail " + (detail.selectedType || "story");
}

function renderRows(rows) {
  if (!workTable) return;
  workTable.querySelectorAll("[data-work-row]").forEach((row) => row.remove());
  const anchor = emptyState?.parentElement === workTable ? emptyState : null;
  rows.forEach((row, index) => {
    const button = document.createElement("button");
    button.className = "table-row work-row tcrn-table-shell__row" + (row.storyId === activeStoryId || (!activeStoryId && index === 0) ? " active" : "");
    button.type = "button";
    button.setAttribute("role", "row");
    button.setAttribute("data-tcrn-component", "TableShell");
    button.setAttribute("data-package-runtime-component", "TableShell");
    button.setAttribute("data-package-runtime-source", "@tcrn/ui-react");
    button.setAttribute("data-package-runtime-surface", "operations-cockpit-work-index");
    button.setAttribute("data-service-row-source", "api");
    button.setAttribute("data-work-row", "");
    button.setAttribute("data-row-id", row.storyId);
    button.setAttribute("data-title", row.title);
    [
      row.title,
      copyState(row.status),
      row.nextOwnerRole
    ].forEach((value, index) => {
      const cell = document.createElement("span");
      cell.className = "tcrn-table-shell__cell";
      cell.setAttribute("role", "cell");
      cell.setAttribute("data-label", ["Work item", "State", "Owner"][index] || "Value");
      cell.textContent = value;
      button.append(cell);
    });
    button.addEventListener("click", () => {
      activeStoryId = row.storyId;
      drawer?.classList.remove("closed");
      loadCockpit(row.storyId);
    });
    if (anchor) {
      workTable.insertBefore(button, anchor);
    } else {
      workTable.append(button);
    }
  });
  currentRows = Array.from(document.querySelectorAll("[data-work-row]"));
}

function renderDetail(model) {
  const detail = model.detailPanel;
  const row = model.workstreams.flatMap((group) => group.rows).find((candidate) => candidate.storyId === detail?.selectedId)
    || model.workstreams.flatMap((group) => group.rows)[0];
  if (drawer && detail) {
    drawer.setAttribute("data-service-detail-id", detail.selectedId);
    drawer.setAttribute("data-service-detail-type", detail.selectedType);
    drawer.setAttribute("data-selected-story-id", detail.selectedId);
  }
  if (drawerTitle) drawerTitle.textContent = row?.title || detail?.selectedId || "Selected work item";
  if (!detailList || !detail) return;
  replaceDetailList([
    ["Hierarchy", model.contextHeader.selectedProjectId + " / " + model.contextHeader.selectedInitiativeId],
    ["Selected", copyState(detail.selectedType) + " / " + detail.selectedId],
    ["Gate links", String(detail.linkedGateIds.length)],
    ["Conference links", String(detail.linkedConferenceIds.length)],
    ["Evidence links", String(detail.linkedEvidenceIds.length)],
    ["Local actions", detail.nextAllowedLocalActions.map(copyAction).join(", ") || copyAction("open_evidence_metadata")],
    ["Blocked actions", detail.blockedActions.map((item) => copyAction(item.action)).join(", ") || "No local readback blockers"],
    ["Operating loop", detail.operatingLoopSummary],
    ["Action posture", detail.noOverclaimSummary]
  ]);
}

function replaceDetailList(rows) {
  detailList.replaceChildren();
  rows.forEach(([term, description]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    wrapper.append(dt, dd);
    detailList.append(wrapper);
  });
}

function filterRows() {
  const query = (search?.value || "").toLowerCase();
  let visible = 0;
  currentRows.forEach((row) => {
    const match = (row.textContent || "").toLowerCase().includes(query);
    row.hidden = !match;
    if (match) visible += 1;
  });
  if (emptyState) emptyState.hidden = visible !== 0;
}

function copyState(value) {
  const key = String(value || "unknown").trim().toLowerCase();
  return aosCopyStateLabels[key] || "Unknown";
}

function copyAction(value) {
  return copyState(value);
}

function copyFreshness(value) {
  return copyState(value);
}

currentRows.forEach((row) => row.addEventListener("click", () => {
  activeStoryId = row.getAttribute("data-row-id") || activeStoryId;
  drawer?.classList.remove("closed");
  loadCockpit(activeStoryId);
}));
search?.addEventListener("input", filterRows);
refreshButton?.addEventListener("click", () => loadCockpit(activeStoryId));
document.querySelector("[data-close-detail]")?.addEventListener("click", () => drawer?.classList.add("closed"));
if (serviceBacked) {
  loadCockpit(activeStoryId);
} else {
  filterRows();
}
`;

function createCockpitRuntimeNavItems(): CockpitRuntimeNavItem[] {
  return cockpitNavLabels.map((label) => ({
    active: label === "Cockpit",
    disabledReason: `${label} opens when that AOS workspace is available.`,
    href: "#cockpit",
    label
  }));
}

function createCockpitRuntimeShellSidebarOptions(input: {
  cockpitApiPath: string;
  model: OperationsCockpitReadModel;
  serviceBacked: boolean;
  serviceReadback: CockpitServiceReadModelReadback;
}): CockpitRuntimeShellSidebarOptions {
  const serviceReadback = input.serviceReadback;
  const shellAttributes = [
    ["data-surface", "operations-cockpit"],
    ["data-service-backed", input.serviceBacked ? "true" : "false"],
    ["data-cockpit-api", input.cockpitApiPath],
    ["data-product-design-acceptance", input.model.nonClaims.productDesignAcceptance],
    ["data-design-system-consumer", aosDesignSystemConsumerBridge.adoptionPosture],
    ["data-design-system-tokens", aosDesignSystemConsumerBridge.tokenPackage],
    ["data-design-system-copy-state", aosDesignSystemConsumerBridge.copyStatePackage],
    ["data-design-system-ui-react", aosDesignSystemConsumerBridge.uiReactPackage],
    ["data-design-system-source-head", aosDesignSystemConsumerBridge.designSystemSourceHead],
    ["data-design-system-certified-standard-id", aosDesignSystemConsumerBridge.servedSurfaceStandardIds.operationsCockpit],
    ["data-design-system-exception-records", aosDesignSystemConsumerBridge.acceptedExceptionRecords.join(",")],
    ["data-package-backed-react-runtime-rendering", String(aosCockpitUiReactRuntime.packageBackedReactRuntimeRendering)],
    ["data-package-runtime-surface", aosCockpitUiReactRuntime.implementationKind],
    ["data-package-runtime-component-scope", aosCockpitUiReactRuntime.componentScope.join(",")],
    ["data-service-model-schema", serviceReadback.schemaVersion],
    ["data-service-read-model-source", serviceReadback.source],
    ["data-service-work-row-count", String(serviceReadback.surfaces.workIndex.rowCount)],
    ["data-service-selected-story-id", serviceReadback.surfaces.workIndex.selectedStoryId],
    ["data-service-detail-id", serviceReadback.surfaces.detail.selectedId],
    ["data-service-detail-type", serviceReadback.surfaces.detail.selectedType],
    ["data-service-gate-count", String(serviceReadback.surfaces.gate.roleGateCount + serviceReadback.surfaces.gate.ownerIntentGateCount)],
    ["data-service-evidence-readback-count", String(serviceReadback.surfaces.readback.evidenceReadbackCount)],
    ["data-service-runtime-data-committed", String(serviceReadback.surfaces.readback.runtimeDataCommittedToGit)],
    ["data-service-bootstrap-state", input.serviceBacked ? "pending" : "static"],
    ["data-service-refresh-state", "idle"],
    ["data-service-refresh-count", "0"],
    ["data-owner-trial-service-frontend", input.serviceBacked ? "enabled" : "static-preview"]
  ] as const;

  return {
    brandAriaLabel: "TCRN AOS",
    brandHref: "#cockpit",
    brandPrimaryLabel: "TCRN",
    brandSecondaryLabel: "AOS",
    footerLabel: "Local operations posture recorded",
    navItems: createCockpitRuntimeNavItems(),
    navLabel: "Primary cockpit views",
    shellAttributesHtml: shellAttributes
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
      .join(" ")
  };
}

function createCockpitRuntimeTopbarCheckpointOptions(input: {
  model: OperationsCockpitReadModel;
  serviceBacked: boolean;
  serviceReadback: CockpitServiceReadModelReadback;
}): CockpitRuntimeTopbarCheckpointOptions {
  return {
    checkpointLabel: "Workspace status",
    checkpointValue: "Operations cockpit ready",
    freshnessLabel: copyFreshness(input.model.contextHeader.dataFreshness),
    operatorLabel: "RL",
    projectId: input.model.contextHeader.selectedProjectId,
    projectOptions: [
      input.model.contextHeader.selectedProjectId,
      "TCRN-TMS",
      "TCRN Workflow"
    ],
    refreshLabel: "Refresh status",
    serviceReadbackLabel: serviceReadModelSummary(input.serviceReadback),
    serviceStatusLabel: input.serviceBacked ? "service API pending" : "local service snapshot"
  };
}

function createCockpitRuntimeHeroTitleOptions(model: OperationsCockpitReadModel): CockpitRuntimeHeroTitleOptions {
  return {
    eyebrow: "Operations Cockpit",
    title: model.contextHeader.selectedProjectId
  };
}

function createCockpitRuntimeClaimRiskStripsOptions(model: OperationsCockpitReadModel): CockpitRuntimeClaimRiskStripsOptions {
  return {
    claims: [
      {
        key: "release-readiness",
        label: copyState(model.nonClaims.releaseReadinessClaim),
        state: "external_proof_needed",
        variant: "status"
      },
      {
        key: "product-design-visual",
        label: copyState(model.productDesignStatus.browserVisualAcceptance),
        state: "not_claimed",
        variant: "status"
      },
      {
        key: "live-dispatch",
        label: "Live operations disabled",
        state: "unavailable",
        variant: "badge"
      }
    ],
    riskWarnings: model.riskWarnings.slice(0, 4).map((warning) => ({
      id: warning.id,
      ownerRole: warning.ownerRole,
      state: riskWarningStatusState(warning),
      stateLabel: copyPosture(warning.state),
      summary: warning.summary,
      typeLabel: copyState(warning.type)
    }))
  };
}

function createCockpitRuntimeWorkIndexRows(rows: WorkstreamStoryRow[]): CockpitRuntimeWorkIndexRow[] {
  return rows.map((row, index) => {
    const evidenceLabel = `${row.linkedConferenceIds.length} conference link`;
    const gateLabel = `${row.nextAllowedLocalActions.length} local actions`;
    const stateLabel = copyState(row.status);
    return {
      active: index === 0,
      evidenceLabel,
      gateLabel,
      owner: row.nextOwnerRole,
      searchText: [
        row.storyId,
        row.title,
        stateLabel,
        row.nextOwnerRole,
        evidenceLabel,
        gateLabel
      ].join(" ").toLowerCase(),
      stateLabel,
      storyId: row.storyId,
      title: row.title
    };
  });
}

function createCockpitRuntimeStagePhaseOptions(
  model: OperationsCockpitReadModel,
  stageDetailDisabledReason: string,
  roleDetailDisabledReason: string
): CockpitRuntimeStagePhaseOptions {
  return {
    roleDetailDisabledReason,
    stageDetailDisabledReason,
    stages: model.stageMap.map((stage, index) => ({
      evidenceCount: model.evidenceReadbacks.length,
      freshnessLabel: copyFreshness(model.contextHeader.dataFreshness),
      index,
      label: stage.label,
      ownerRoles: stage.ownerRoles,
      releaseReadinessLabel: copyState(model.nonClaims.releaseReadinessClaim),
      sourceGateCount: model.ownerIntentQueue.length + model.roleGateQueue.length,
      stageId: stage.stageId,
      state: stage.state,
      stateLabel: copyState(stage.state)
    }))
  };
}

interface DetailDrawerOptionInput {
  blockingGate: GateQueueItem | undefined;
  dependency: OperationsCockpitReadModel["dependencyInspection"][number] | undefined;
  model: OperationsCockpitReadModel;
  resource: OperationsCockpitReadModel["resourceInspection"][number] | undefined;
  selectedConference: OperationsCockpitReadModel["conferences"][number] | undefined;
  selectedDetail: OperationsCockpitReadModel["detailPanel"];
  selectedRow: WorkstreamStoryRow | undefined;
}

interface GateReadbackCardsOptionInput {
  blockingGate: GateQueueItem | undefined;
  dependency: OperationsCockpitReadModel["dependencyInspection"][number] | undefined;
  model: OperationsCockpitReadModel;
  resource: OperationsCockpitReadModel["resourceInspection"][number] | undefined;
}

function createCockpitRuntimeGateReadbackCardsOptions(input: GateReadbackCardsOptionInput): CockpitRuntimeGateReadbackCardsOptions {
  const gate = input.blockingGate;
  const gateTypeLabel = gate ? copyState(gate.type) : copyState("none");
  const gateOwnerRole = gate?.ownerRole ?? "No local gate rows";
  const gateStatusLabel = gate ? copyState(gate.status) : "No local gate rows";
  const gateModeLabel = gate ? (gate.ownerIntent ? "Owner Intent separated" : "Role gate pending") : "No local gate rows";
  return {
    gateWorkOrder: {
      count: input.model.ownerIntentQueue.length + input.model.roleGateQueue.length,
      disabledReason: "Gate requests require an approved action path.",
      gateModeLabel,
      gateOwnerRole,
      gateStatusLabel,
      gateSummary: `${gateTypeLabel}: ${gateStatusLabel}; ${gateModeLabel}.`,
      gateTypeLabel
    },
    readbackPosture: {
      dependencyLabel: input.dependency ? copyPosture(input.dependency.posture) : copyState("none"),
      disabledReason: "Evidence details open from the evidence workspace.",
      evidenceLabel: copyFreshness(input.model.evidenceReadbacks[0]?.freshness ?? "unknown"),
      resourceLabel: input.resource ? copyPosture(input.resource.approvalState) : copyState("none"),
      runtimeFixtureLabel: copyState("static_fixture")
    }
  };
}

function createCockpitRuntimeDetailDrawerOptions(input: DetailDrawerOptionInput): CockpitRuntimeDetailDrawerOptions {
  const detail = input.selectedDetail;
  const selectedType = detail?.selectedType ?? "story";
  const selectedId = detail?.selectedId ?? input.selectedRow?.storyId ?? "";
  const detailRows = [
    {
      key: "hierarchy",
      label: "Hierarchy",
      value: `${input.model.contextHeader.selectedProjectId} / ${input.model.contextHeader.selectedInitiativeId}`
    },
    {
      key: "selected",
      label: "Selected",
      value: `${copyState(selectedType)} / ${selectedId || "unavailable"}`
    },
    {
      key: "gate-flow",
      label: "Gate flow",
      value: input.blockingGate ? `${input.blockingGate.ownerRole} - ${copyState(input.blockingGate.status)}` : copyState("none")
    },
    {
      key: "conference",
      label: "Conference",
      value: input.selectedConference ? `${copyState(input.selectedConference.status)} / ${copyState(input.selectedConference.minutesStatus)}` : copyState("none")
    },
    {
      key: "dry-run-invite",
      label: "Dry-run invite",
      value: input.selectedConference ? `${input.selectedConference.inviteDispatchIds.length} outbox record metadata` : copyState("none")
    },
    {
      key: "local-actions",
      label: "Local actions",
      value: detail?.nextAllowedLocalActions.map(copyAction).join(", ")
        || input.selectedRow?.nextAllowedLocalActions.map(copyAction).join(", ")
        || copyAction("open_evidence_metadata")
    },
    {
      key: "blocked-actions",
      label: "Blocked actions",
      value: formatBlockedActions(detail?.blockedActions ?? input.selectedRow?.blockedActions ?? [])
    },
    {
      key: "evidence",
      label: "Evidence",
      value: copyState(input.model.evidenceReadbacks[0]?.redactionState ?? "metadata_only")
    },
    {
      key: "dependency",
      label: "Dependency",
      value: input.dependency ? copyPosture(input.dependency.posture) : copyState("none")
    },
    {
      key: "resource",
      label: "Resource",
      value: input.resource ? copyPosture(input.resource.approvalState) : copyState("none")
    }
  ];
  return {
    blockedActionLabel: formatBlockedActions(detail?.blockedActions ?? input.selectedRow?.blockedActions ?? []),
    closeLabel: "Close detail",
    detailRows,
    noOverclaimSummary: detail?.noOverclaimSummary ?? "Release and live operations remain disabled in this workspace.",
    operatingLoopSummary: detail?.operatingLoopSummary ?? input.selectedConference?.title ?? "Selected detail uses the service-backed work model.",
    primaryActionDisabledReason: "Gate work order execution requires approved action authority.",
    primaryActionLabel: "Gate work order",
    secondaryActionDisabledReason: "Rework requests require approved action authority.",
    secondaryActionLabel: "Request rework",
    selectedId,
    selectedType,
    selectedTypeLabel: copyState(selectedType),
    statusLabel: input.selectedRow ? copyState(input.selectedRow.status) : copyState("local_only"),
    title: (input.selectedRow?.title ?? selectedId) || "Selected work item"
  };
}

function formatBlockedActions(actions: Array<{ action: string }>): string {
  if (actions.length === 0) {
    return "No local blockers";
  }
  return actions.map((action) => copyAction(action.action)).join(", ");
}

function serviceReadModelSummary(readback: CockpitServiceReadModelReadback): string {
  const gateCount = readback.surfaces.gate.roleGateCount + readback.surfaces.gate.ownerIntentGateCount;
  return `${readback.surfaces.workIndex.rowCount} work / ${gateCount} gates / detail ${readback.surfaces.detail.selectedType}`;
}

function gateBlock(gate: GateQueueItem | undefined): string {
  if (!gate) {
    return `<div class="gate-block tcrn-state-view" ${tcrnComponentAttr("StateView")}><strong>${copyState("none")}</strong><span>No local gate rows.</span></div>`;
  }
  return `<div class="gate-block tcrn-state-view" ${tcrnComponentAttr("StateView")}><span>${copyState(gate.type)}</span><strong>${escapeHtml(gate.ownerRole)}</strong><span>${copyState(gate.status)}</span><span>${gate.ownerIntent ? "Owner Intent separated" : "Role gate pending"}</span></div>`;
}

function workRow(row: WorkstreamStoryRow, index: number): string {
  return `<button class="table-row work-row tcrn-table-shell__row${index === 0 ? " active" : ""}" ${tcrnComponentAttr("TableShell")} data-work-row data-row-id="${escapeHtml(row.storyId)}" data-title="${escapeHtml(row.title)}" type="button" role="row"><span class="tcrn-table-shell__cell">${escapeHtml(row.storyId)}</span><span class="tcrn-table-shell__cell">${escapeHtml(row.title)}</span><span class="tcrn-table-shell__cell">${copyState(row.status)}</span><span class="tcrn-table-shell__cell">${escapeHtml(row.nextOwnerRole)}</span><span class="tcrn-table-shell__cell">${row.linkedConferenceIds.length} conference link</span><span class="tcrn-table-shell__cell">${row.nextAllowedLocalActions.length} local actions</span></button>`;
}

function copyState(state: string): string {
  return copyAosState(state);
}

function copyFreshness(freshness: string): string {
  return copyAosFreshness(freshness);
}

function copyPosture(posture: string): string {
  return copyAosPosture(posture);
}

function copyAction(action: string): string {
  return copyAosAction(action);
}

function riskWarningStatusState(warning: RiskWarningItem): "blocked" | "external_proof_needed" | "local_only" | "proof_required" {
  if (warning.state === "blocked") return "blocked";
  if (warning.type === "release") return "external_proof_needed";
  if (warning.state === "not_applicable") return "local_only";
  return "proof_required";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
