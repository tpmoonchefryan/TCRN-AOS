import {
  AosStore,
  createDefaultSeed,
  type ActorIdentity,
  type Estimate
} from "../../../packages/domain/src/index.js";
import {
  createOperationsCockpitReadModel,
  type GateQueueItem,
  type OperationsCockpitReadModel,
  type RiskWarningItem,
  type StageMapReadModel,
  type WorkstreamStoryRow
} from "./cockpit.js";

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

export function renderOperationsCockpitHtml(model: OperationsCockpitReadModel = createSlice4bCockpitReadModel()): string {
  const workRows = model.workstreams.flatMap((group) => group.rows);
  const selectedRow = workRows[0];
  const blockingGate = model.ownerIntentQueue[0] ?? model.roleGateQueue[0];
  const dependency = model.dependencyInspection[0];
  const resource = model.resourceInspection[0];
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Operations Cockpit</title>
    <link rel="icon" href="../../../docs/brand/aos-favicon.png" />
    <style>${operationsCockpitCss}</style>
  </head>
  <body>
    <main class="aos-shell" data-surface="operations-cockpit" data-product-design-acceptance="${model.nonClaims.productDesignAcceptance}">
      <aside class="aos-sidebar" data-region="sidebar-nav" aria-label="AOS navigation">
        <a class="brand-lockup" data-region="brand-lockup" href="#cockpit" aria-label="TCRN AOS">
          <span class="brand-tcrn">TCRN</span>
          <span class="brand-aos">AOS</span>
        </a>
        <nav class="nav-stack" aria-label="Primary cockpit views">
          ${navButton("Dashboard", false)}
          ${navButton("Cockpit", true)}
          ${navButton("Work Index", false)}
          ${navButton("Stage Map", false)}
          ${navButton("Gate Queue", false)}
          ${navButton("Conferences", false)}
          ${navButton("Evidence", false)}
          ${navButton("Dependency", false)}
          ${navButton("Resources", false)}
          ${navButton("Audit", false)}
        </nav>
        <footer class="sidebar-note">
          <span class="state-dot state-current"></span>
          <span>Local posture recorded</span>
        </footer>
      </aside>
      <section class="aos-main" id="cockpit">
        <header class="topbar">
          <label class="project-selector" data-region="project-selector" for="project-select">
            <span>Project</span>
            <select id="project-select" aria-label="Project selector">
              <option>${escapeHtml(model.contextHeader.selectedProjectId)}</option>
              <option>TCRN-TMS</option>
              <option>TCRN Workflow</option>
            </select>
          </label>
          <div class="checkpoint-strip" data-region="checkpoint-strip" aria-label="Local checkpoint">
            <span>Local checkpoint observed</span>
            <strong>${escapeHtml(model.contextHeader.localCheckpoint)}</strong>
            <em>${copyFreshness(model.contextHeader.dataFreshness)}</em>
          </div>
          <button type="button" class="top-action">Refresh readback</button>
          <button type="button" class="profile" aria-label="Current operator">RL</button>
        </header>
        <div class="workspace">
          <section class="hero-row">
            <div>
              <p class="eyebrow">Operations Cockpit</p>
              <h1>${escapeHtml(model.contextHeader.selectedProjectId)}</h1>
            </div>
            <div class="claim-strip" aria-label="Claim boundaries">
              <span>${escapeHtml(model.nonClaims.releaseReadinessClaim)}</span>
              <span>${escapeHtml(model.productDesignStatus.browserVisualAcceptance)}</span>
              <span>live dispatch false</span>
            </div>
          </section>
          <section class="summary-grid">
            <article class="panel stage-panel" data-region="stage-map" aria-label="Development stage map">
              <div class="panel-head">
                <h2>Stage Map</h2>
                <button type="button">Open stage detail</button>
              </div>
              <ol class="stage-line">
                ${model.stageMap.map((stage, index) => stageStep(stage, index)).join("")}
              </ol>
            </article>
            <article class="panel" data-region="ai-employee-phase" aria-label="AI employee responsibility by phase">
              <div class="panel-head">
                <h2>AI Employee Phase</h2>
                <button type="button">Open role detail</button>
              </div>
              <div class="phase-list">
                ${model.stageMap.map((stage) => phaseRow(stage)).join("")}
              </div>
            </article>
            <article class="panel" data-region="blocker-gate-card" aria-label="Blocker and gate posture">
              <div class="panel-head">
                <h2>Gate Work Order</h2>
                <span class="count">${model.ownerIntentQueue.length + model.roleGateQueue.length}</span>
              </div>
              ${gateBlock(blockingGate)}
              <button type="button" class="secondary-action">Prepare gate request</button>
            </article>
            <article class="panel" data-region="readback-posture-card" aria-label="Readback posture">
              <div class="panel-head">
                <h2>Readback Posture</h2>
                <button type="button">Open evidence detail</button>
              </div>
              <dl class="posture-list">
                <div><dt>Runtime fixture</dt><dd><span class="state-dot state-current"></span>local fixture readback current</dd></div>
                <div><dt>Evidence</dt><dd>${copyFreshness(model.evidenceReadbacks[0]?.freshness ?? "unknown")}</dd></div>
                <div><dt>Dependency</dt><dd>${dependency ? copyPosture(dependency.posture) : "metadata present"}</dd></div>
                <div><dt>Resource</dt><dd>${resource ? copyPosture(resource.approvalState) : "metadata present"}</dd></div>
              </dl>
            </article>
          </section>
          <section class="content-grid">
            <section class="work-index" data-region="work-index" aria-label="Work index">
              <header class="work-index-head">
                <h2>Work Index</h2>
                <label class="search-box" for="work-search">
                  <span>Search</span>
                  <input id="work-search" type="search" placeholder="Filter local fixture rows" />
                </label>
                <button type="button">Columns</button>
              </header>
              <div class="filter-row" aria-label="Fixture filters">
                <button type="button">Project: ${escapeHtml(model.contextHeader.selectedProjectId)}</button>
                <button type="button">Freshness: ${copyFreshness(model.contextHeader.dataFreshness)}</button>
                <button type="button">Risk: proof required</button>
              </div>
              <div class="work-table" role="table">
                <div class="table-row table-head" role="row">
                  <span>ID</span><span>Title</span><span>State</span><span>Owner</span><span>Evidence</span><span>Gate</span>
                </div>
                ${workRows.map((row, index) => workRow(row, index)).join("")}
              </div>
            </section>
            <aside class="detail-drawer" data-region="detail-drawer" aria-label="Selected item detail">
              <div class="drawer-head">
                <span class="tag">Story</span>
                <button type="button" aria-label="Close detail">Close</button>
              </div>
              <h2>${escapeHtml(selectedRow?.title ?? "Selected work item")}</h2>
              <dl class="detail-list">
                <div><dt>Hierarchy</dt><dd>${escapeHtml(model.contextHeader.selectedProjectId)} / ${escapeHtml(model.contextHeader.selectedInitiativeId)}</dd></div>
                <div><dt>Gate flow</dt><dd>${blockingGate ? `${escapeHtml(blockingGate.ownerRole)} - ${escapeHtml(blockingGate.status)}` : "metadata present"}</dd></div>
                <div><dt>Conference</dt><dd>${escapeHtml(model.conferences[0]?.status ?? "requested")}</dd></div>
                <div><dt>Evidence</dt><dd>${escapeHtml(model.evidenceReadbacks[0]?.redactionState ?? "metadata_only")}</dd></div>
                <div><dt>Dependency</dt><dd>${dependency ? copyPosture(dependency.posture) : "metadata present"}</dd></div>
                <div><dt>Resource</dt><dd>${resource ? copyPosture(resource.approvalState) : "metadata present"}</dd></div>
              </dl>
              <button type="button" class="primary-action">Open gate work order</button>
              <button type="button" class="secondary-action">Request rework</button>
            </aside>
          </section>
          <section class="risk-lane" aria-label="Risk and warning lane">
            ${model.riskWarnings.slice(0, 4).map((warning) => riskPill(warning)).join("")}
          </section>
        </div>
      </section>
    </main>
    <script>${operationsCockpitClientScript}</script>
  </body>
</html>`;
}

const operationsCockpitCss = `
:root {
  color-scheme: light;
  --navy-950: #061a2c;
  --navy-900: #08243b;
  --navy-800: #0d304b;
  --teal-500: #14b8ad;
  --teal-600: #069c99;
  --blue-500: #1b75d0;
  --red-500: #df2b2b;
  --amber-500: #f4a321;
  --green-500: #18a865;
  --surface: #ffffff;
  --surface-weak: #f7f9fb;
  --surface-tint: #eef9fb;
  --line: #dbe4ea;
  --line-strong: #c9d5de;
  --text: #0f1b2d;
  --muted: #647282;
  --soft: #8c99a6;
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
.brand-aos { display: inline-block; font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 32px; line-height: 1; font-weight: 800; letter-spacing: 0; color: transparent; background: linear-gradient(135deg, #18d7c8 6%, #08a99d 56%, #15c4b5 100%); -webkit-background-clip: text; background-clip: text; transform: skewX(-5deg); }
.nav-stack { display: grid; align-content: start; gap: 6px; }
.nav-row { display: grid; grid-template-columns: 8px 1fr; align-items: center; gap: 10px; width: 100%; min-height: 38px; border: 1px solid transparent; border-radius: 6px; padding: 0 10px; background: transparent; color: #e5eef3; text-align: left; font-size: 14px; font-weight: 400; }
.nav-row::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: #7891a2; }
.nav-row.active, .nav-row:hover { background: rgba(255, 255, 255, 0.12); }
.nav-row.active { box-shadow: inset 4px 0 0 var(--teal-500); }
.nav-row.active::before { background: var(--teal-500); }
.sidebar-note { display: flex; align-items: center; gap: 8px; color: #deedf4; font-size: 12px; }
.aos-main { min-width: 0; }
.topbar { display: grid; grid-template-columns: 220px minmax(0, 1fr) max-content 38px; align-items: center; gap: 14px; min-height: 64px; padding: 0 22px; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, 0.96); }
.project-selector { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; min-height: 38px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--surface); font-size: 14px; }
.project-selector span { color: #25364a; }
.project-selector select { min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font-weight: 500; }
.checkpoint-strip { display: flex; align-items: center; gap: 12px; min-width: 0; color: #26364a; font-size: 13px; }
.checkpoint-strip strong, .checkpoint-strip em { white-space: nowrap; }
.checkpoint-strip em { color: var(--teal-600); font-style: normal; }
.top-action, .profile, .panel-head button, .work-index-head button, .filter-row button, .primary-action, .secondary-action { min-height: 34px; border-radius: 5px; font-weight: 500; }
.top-action, .panel-head button, .work-index-head button, .filter-row button, .secondary-action { border: 1px solid var(--line-strong); background: #fff; color: var(--text); }
.profile { border: 0; border-radius: 999px; background: #091833; color: #fff; }
.workspace { display: grid; gap: 18px; padding: 24px 18px 34px; }
.hero-row { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
h1 { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 500; letter-spacing: 0; }
.claim-strip, .risk-lane { display: flex; flex-wrap: wrap; gap: 8px; }
.claim-strip span, .risk-pill { border: 1px solid var(--line); border-radius: 5px; padding: 6px 9px; background: #fff; color: #516174; font-size: 12px; }
.summary-grid { display: grid; grid-template-columns: 1.28fr 0.92fr 1fr 1.04fr; gap: 13px; }
.panel, .work-index, .detail-drawer { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.panel { min-height: 188px; padding: 16px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
h2 { margin: 0; font-size: 13px; font-weight: 500; letter-spacing: 0.055em; text-transform: uppercase; }
.count { display: grid; place-items: center; min-width: 22px; height: 22px; border-radius: 999px; background: #f3e6e6; color: var(--red-500); font-size: 12px; }
.stage-line { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0; padding: 28px 0 0; list-style: none; }
.stage-line::before { content: ""; position: absolute; left: 11%; right: 11%; top: 54px; height: 4px; background: linear-gradient(90deg, var(--teal-600) 0 72%, #c9d4dd 72% 100%); }
.stage-line li { position: relative; z-index: 1; display: grid; justify-items: center; gap: 8px; text-align: center; }
.stage-line small { min-height: 24px; color: #113447; font-size: 10px; font-weight: 500; }
.stage-line span { display: grid; place-items: center; width: 30px; height: 30px; border: 3px solid #c9d4dd; border-radius: 999px; background: var(--surface); color: var(--soft); font-weight: 500; }
.stage-line .complete span, .stage-line .active span { border-color: var(--teal-600); }
.stage-line .complete span { background: var(--teal-600); color: #fff; }
.stage-line .active span { background: #f4fffd; color: var(--teal-600); }
.stage-line .release_proof_required span { border-color: var(--amber-500); color: #a86500; }
.phase-list, .posture-list, .detail-list { display: grid; gap: 10px; }
.phase-row, .gate-block { display: grid; gap: 8px; }
.phase-row { grid-template-columns: minmax(72px, 1fr) 1fr auto; align-items: center; font-size: 12px; }
.phase-owners { display: flex; gap: 5px; }
.avatar { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid #9edbd9; border-radius: 999px; background: #edfafa; color: #30636a; font-size: 9px; font-weight: 500; }
.state-chip, .tag { width: max-content; border-radius: 4px; padding: 4px 7px; font-size: 11px; font-weight: 500; }
.state-chip { background: #e8f2ff; color: #176ac2; }
.state-chip.blocked { background: #ffe7e3; color: #d0312a; }
.state-chip.release_proof_required { background: #fff1d6; color: #a66f0d; }
.gate-block { padding-top: 2px; font-size: 12px; }
.gate-block strong { color: #18253a; }
.posture-list, .detail-list { margin: 0; }
.posture-list div, .detail-list div { display: grid; grid-template-columns: 108px 1fr; gap: 8px; }
dt { color: #253449; font-size: 12px; font-weight: 500; }
dd { margin: 0; color: #162437; font-size: 12px; }
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
.work-table { min-width: 820px; }
.table-row { display: grid; grid-template-columns: 98px minmax(220px, 1fr) 112px 108px 124px 132px; align-items: center; min-height: 48px; padding: 0 16px; border-bottom: 1px solid var(--line); color: #29374a; font-size: 12px; }
.table-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.table-head { min-height: 42px; background: #fbfcfd; color: #384659; font-size: 11px; font-weight: 500; }
.work-row { border: 0; background: #fff; text-align: left; }
.work-row:hover, .work-row.active { background: #effafe; }
.work-row.active { box-shadow: inset 4px 0 0 var(--teal-600); }
.detail-drawer { border-radius: 0 6px 6px 0; border-left: 0; padding: 20px; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.drawer-head button { border: 0; background: transparent; color: #1a293d; }
.tag { background: #e5f8ee; color: #1d8d51; }
.detail-drawer h2 { margin: 14px 0; padding-bottom: 14px; border-bottom: 1px solid var(--line); color: #162437; font-size: 18px; line-height: 1.25; letter-spacing: 0; text-transform: none; }
.detail-list { margin-bottom: 18px; }
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
  .nav-stack { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nav-row { min-height: 34px; }
  .topbar, .work-index-head, .summary-grid { grid-template-columns: 1fr; }
  .topbar { padding: 14px; }
  .hero-row { align-items: start; flex-direction: column; }
  .workspace { padding: 16px 12px 28px; }
  .stage-line { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 18px; }
  .stage-line::before { display: none; }
}
@media (max-width: 460px) {
  .stage-line { grid-template-columns: 1fr; }
  .checkpoint-strip, .claim-strip { align-items: start; flex-direction: column; }
  .table-row { grid-template-columns: 86px minmax(190px, 1fr) 104px 96px 118px 122px; }
}`;

const operationsCockpitClientScript = `
const rows = Array.from(document.querySelectorAll("[data-work-row]"));
const drawerTitle = document.querySelector("[data-drawer-title]");
const search = document.querySelector("#work-search");
function activate(row) {
  rows.forEach((candidate) => candidate.classList.toggle("active", candidate === row));
  if (drawerTitle) drawerTitle.textContent = row.getAttribute("data-title") || drawerTitle.textContent;
}
rows.forEach((row) => row.addEventListener("click", () => activate(row)));
search?.addEventListener("input", () => {
  const query = search.value.toLowerCase();
  rows.forEach((row) => {
    row.hidden = !(row.textContent || "").toLowerCase().includes(query);
  });
});
`;

function navButton(label: string, active: boolean): string {
  return `<button class="nav-row${active ? " active" : ""}" type="button">${escapeHtml(label)}</button>`;
}

function stageStep(stage: StageMapReadModel, index: number): string {
  return `<li class="${escapeHtml(stage.state)}"><small>${escapeHtml(stage.label)}</small><span>${index + 1}</span><em class="state-chip ${escapeHtml(stage.state)}">${copyState(stage.state)}</em></li>`;
}

function phaseRow(stage: StageMapReadModel): string {
  const owners = stage.ownerRoles.map((role) => `<span class="avatar">${escapeHtml(role.slice(0, 2))}</span>`).join("");
  return `<div class="phase-row"><span>${escapeHtml(stage.label)}</span><span class="phase-owners">${owners}</span><em class="state-chip ${escapeHtml(stage.state)}">${copyState(stage.state)}</em></div>`;
}

function gateBlock(gate: GateQueueItem | undefined): string {
  if (!gate) {
    return `<div class="gate-block"><strong>metadata present</strong><span>No local gate rows in fixture.</span></div>`;
  }
  return `<div class="gate-block"><span>${escapeHtml(gate.type)}</span><strong>${escapeHtml(gate.ownerRole)}</strong><span>${escapeHtml(gate.status)}</span><span>${gate.ownerIntent ? "Owner Intent separated" : "Role gate pending"}</span></div>`;
}

function workRow(row: WorkstreamStoryRow, index: number): string {
  return `<button class="table-row work-row${index === 0 ? " active" : ""}" data-work-row data-title="${escapeHtml(row.title)}" type="button" role="row"><span>${escapeHtml(row.storyId)}</span><span>${escapeHtml(row.title)}</span><span>${escapeHtml(row.status)}</span><span>${escapeHtml(row.nextOwnerRole)}</span><span>${copyFreshness(row.freshness)}</span><span>${row.linkedGateIds.length} gate metadata</span></button>`;
}

function riskPill(warning: RiskWarningItem): string {
  return `<span class="risk-pill">${escapeHtml(warning.type)}: ${copyPosture(warning.state)}</span>`;
}

function copyState(state: string): string {
  return state === "release_proof_required" ? "proof required" : state.replaceAll("_", " ");
}

function copyFreshness(freshness: string): string {
  if (freshness === "current") return "readback current";
  if (freshness === "blocked") return "proof blocked";
  if (freshness === "stale") return "proof required";
  return "metadata present";
}

function copyPosture(posture: string): string {
  if (posture === "accepted_with_residual_risk") return "accepted with residual risk";
  if (posture === "blocked") return "blocked";
  if (posture === "evidence_missing") return "evidence missing";
  if (posture === "review_required") return "reviewed for local checkpoint";
  if (posture === "not_applicable") return "not applicable";
  if (posture === "none") return "metadata present";
  return posture.replaceAll("_", " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
