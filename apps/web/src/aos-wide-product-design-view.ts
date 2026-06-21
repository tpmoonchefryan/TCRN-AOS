import {
  createAOSWideProductDesignModel,
  forbiddenAosWidePositiveCopy,
  requiredAosWideSelectors,
  type AOSWideProductDesignModel,
  type SurfaceRow
} from "./aos-wide-product-design-data.js";
import { tcrnComponentAttr, tcrnStaticNavItem } from "./static-component-registry.js";

export {
  createAOSWideProductDesignModel,
  forbiddenAosWidePositiveCopy,
  requiredAosWideSelectors,
  slice10LocalCheckpoint,
  slice10PreImplementationBasis,
  slice10WorkflowPacketBasis
} from "./aos-wide-product-design-data.js";

export function renderAOSWideProductDesignHtml(model: AOSWideProductDesignModel = createAOSWideProductDesignModel()): string {
  const selected = requiredSurface(model, 0);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Product Design Surface Set</title>
    <link rel="icon" href="../../../docs/brand/aos-favicon.png" />
    <style>${aosWideProductDesignCss}</style>
  </head>
  <body data-visible-rows="${model.surfaces.length}">
    <main class="aos-shell tcrn-surface" ${tcrnComponentAttr("Surface")} data-region="aos-wide-shell" data-surface="aos-wide-product-design" data-product-design-status="${model.context.productDesignStatus}" data-aos-wide-product-design-accepted="${model.requiredState.aosWideProductDesignAccepted}">
      <aside class="aos-sidebar tcrn-side-nav" ${tcrnComponentAttr("SideNav")} aria-label="AOS navigation">
        <a class="brand-lockup tcrn-link-button" ${tcrnComponentAttr("LinkButton")} data-region="brand-lockup" href="#target-set" aria-label="TCRN AOS">
          <span class="brand-tcrn">TCRN</span>
          <span class="brand-aos">AOS</span>
        </a>
        <nav class="nav-stack tcrn-nav-group" ${tcrnComponentAttr("NavGroup")} aria-label="AOS-wide modules">
          ${model.surfaces.map((surface, index) => navButton(surface.title, surface.id, index === 0)).join("")}
        </nav>
        <footer class="sidebar-note tcrn-status-badge" ${tcrnComponentAttr("StatusBadge")}>
          <span class="state-dot state-current" aria-hidden="true"></span>
          <span class="tcrn-text" ${tcrnComponentAttr("Text")}>Target set pending review</span>
        </footer>
      </aside>
      <section class="aos-main" id="target-set">
        <header class="topbar tcrn-top-bar" ${tcrnComponentAttr("TopBar")}>
          <label class="project-selector tcrn-field" ${tcrnComponentAttr("Field")} for="project-select">
            <span class="tcrn-text" ${tcrnComponentAttr("Text")}>Project</span>
            <select class="tcrn-select" ${tcrnComponentAttr("Select")} id="project-select" aria-label="Project selector">
              <option>${escapeHtml(model.context.projectId)}</option>
            </select>
          </label>
          <div class="checkpoint-strip tcrn-readback-panel" ${tcrnComponentAttr("ReadbackPanel")} aria-label="Local checkpoint">
            <span class="tcrn-text" ${tcrnComponentAttr("Text")}>Product design status</span>
            <strong>${escapeHtml(model.context.productDesignStatus)}</strong>
            <em class="tcrn-status-badge" ${tcrnComponentAttr("StatusBadge")}>review pending</em>
          </div>
          <a class="top-action tcrn-link-button" ${tcrnComponentAttr("LinkButton")} href="operations-cockpit.html">Cockpit anchor</a>
          <a class="top-action tcrn-link-button" ${tcrnComponentAttr("LinkButton")} href="docs-search-release-readiness.html">Docs anchor</a>
        </header>
        <div class="workspace">
          <section class="title-row tcrn-surface" ${tcrnComponentAttr("Surface")}>
            <div>
              <p class="eyebrow tcrn-text" ${tcrnComponentAttr("Text")}>AOS-Wide / Target Set</p>
              <h1 class="tcrn-heading tcrn-heading--1" ${tcrnComponentAttr("Heading")}>AOS Product Design Surface Set</h1>
            </div>
            <div class="claim-strip tcrn-evidence-strip" ${tcrnComponentAttr("EvidenceStrip")} aria-label="Claim boundaries">
              <span class="tcrn-status-badge" ${tcrnComponentAttr("StatusBadge")}>target set implemented</span>
              <span class="tcrn-status-badge" ${tcrnComponentAttr("StatusBadge")}>review pending</span>
              <span class="tcrn-status-badge" ${tcrnComponentAttr("StatusBadge")}>external proof required</span>
            </div>
          </section>

          <section class="path-grid tcrn-evidence-strip" ${tcrnComponentAttr("EvidenceStrip")} data-region="target-path-readback" aria-label="Target path readback">
            <a class="tcrn-link-button" ${tcrnComponentAttr("LinkButton")} href="operations-cockpit.html"><span>Anchor</span><strong>Operations cockpit</strong><em>${escapeHtml(model.targetPathReadback.operationsCockpit)}</em></a>
            <a class="tcrn-link-button" ${tcrnComponentAttr("LinkButton")} href="docs-search-release-readiness.html"><span>Anchor</span><strong>Docs readiness</strong><em>${escapeHtml(model.targetPathReadback.docsSearchRelease)}</em></a>
            <a class="tcrn-link-button" ${tcrnComponentAttr("LinkButton")} href="aos-wide-product-design.html" aria-current="page"><span>Current</span><strong>AOS-wide target set</strong><em>${escapeHtml(model.targetPathReadback.aosWideTarget)}</em></a>
          </section>

          <section class="module-grid tcrn-evidence-strip" ${tcrnComponentAttr("EvidenceStrip")} aria-label="Required product design modules">
            ${moduleCard(requiredSurface(model, 0), "project-dashboard-hierarchy", "Initiative summary", ["Stage owner: Ilya", "Blockers surfaced", "Evidence freshness visible"])}
            ${moduleCard(requiredSurface(model, 1), "initiative-ticket-drillthrough", "Ticket detail", ["Gates linked", "Decision history present", "Comments and subtasks posture"])}
            ${moduleCard(requiredSurface(model, 2), "ai-employee-profile", "Role profile", ["Role/thread identity", "Assignment scope", "Authority posture"])}
            ${moduleCard(requiredSurface(model, 3), "gate-owner-intent", "Owner Intent separation", ["Role gates separate", "Required evidence", "True-owner action disabled"])}
            ${moduleCard(requiredSurface(model, 4), "conference-minutes", "Conference readback", ["Participants", "Positions", "Minutes and outcome"])}
            ${moduleCard(requiredSurface(model, 5), "gateway-adapter-health", "Gateway readback", ["Dry-run outbox", "Idempotency/dedupe", "Audit/redaction posture"])}
            ${moduleCard(requiredSurface(model, 6), "knowledge-release-modules", "Docs modules", ["Knowledge index", "Guide draft", "Release note draft"])}
            ${moduleCard(requiredSurface(model, 7), "dependency-governance-console", "Dependency console", ["License evidence", "SBOM/NOTICE", "Residual risk"])}
            ${moduleCard(requiredSurface(model, 8), "resource-library-traceability", "Resource traceability", ["Materialization request", "History and rollback posture", "Manifest audit"])}
            ${moduleCard(requiredSurface(model, 9), "admin-access-audit-shell", "Access and audit", ["Read-only access", "Authz summary", "Break-glass blocked"])}
          </section>

          <section class="content-grid tcrn-surface" ${tcrnComponentAttr("Surface")}>
            <section class="surface-index tcrn-work-index" ${tcrnComponentAttr("WorkIndex")} data-region="surface-index" aria-label="AOS-wide surface index">
              <header class="surface-index-head tcrn-filter-bar" ${tcrnComponentAttr("FilterBar")}>
                <h2 class="tcrn-heading tcrn-heading--2" ${tcrnComponentAttr("Heading")}>Surface Index</h2>
                <label class="search-box tcrn-search-input" ${tcrnComponentAttr("SearchInput")} for="surface-search">
                  <span>Search target surfaces</span>
                  <input class="tcrn-input" ${tcrnComponentAttr("Input")} id="surface-search" type="search" placeholder="Filter module, owner, blocker, story posture" />
                </label>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" data-filter-state="all">All</button>
              </header>
              <div class="filter-row tcrn-filter-bar" ${tcrnComponentAttr("FilterBar")} aria-label="State filters">
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" data-filter-state="review_required">Review required</button>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" data-filter-state="blocked">Blocked posture</button>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" data-filter-state="current">Current local readback</button>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" data-filter-state="pending_external_proof">External proof</button>
              </div>
              <div class="surface-table tcrn-table-shell" ${tcrnComponentAttr("TableShell")} role="table" aria-label="AOS-wide target-set rows">
                <div class="surface-row table-head tcrn-table-shell__row" role="row">
                  <span class="tcrn-table-shell__cell">Surface</span><span class="tcrn-table-shell__cell">Module</span><span class="tcrn-table-shell__cell">State</span><span class="tcrn-table-shell__cell">Owner</span><span class="tcrn-table-shell__cell">Blocker</span><span class="tcrn-table-shell__cell">Evidence</span>
                </div>
                ${model.surfaces.map((surface, index) => surfaceRow(surface, index)).join("")}
              </div>
              <div class="empty-state tcrn-state-view" ${tcrnComponentAttr("StateView")} data-empty-state hidden>
                <strong>No target-set rows match this local filter.</strong>
                <span>Open the evidence panel for proof readiness metadata.</span>
              </div>
            </section>
            <aside class="detail-drawer tcrn-detail-drawer" ${tcrnComponentAttr("DetailDrawer")} data-region="detail-panel" aria-label="Selected AOS-wide surface detail">
              <div class="drawer-head">
                <span class="tag tcrn-badge" ${tcrnComponentAttr("Badge")} data-detail-state>${copyState(selected.state)}</span>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" aria-label="Close detail" disabled>Close</button>
              </div>
              <h2 class="tcrn-heading tcrn-heading--2" ${tcrnComponentAttr("Heading")} data-detail-title>${escapeHtml(selected.title)}</h2>
              <dl class="detail-list tcrn-key-value-list" ${tcrnComponentAttr("KeyValueList")}>
                <div><dt>Surface</dt><dd data-detail-surface>${escapeHtml(selected.surface)}</dd></div>
                <div><dt>Owner</dt><dd data-detail-owner>${escapeHtml(selected.owner)}</dd></div>
                <div><dt>Stage</dt><dd data-detail-stage>${escapeHtml(selected.stage)}</dd></div>
                <div><dt>Blocker</dt><dd data-detail-blocker>${escapeHtml(selected.blocker)}</dd></div>
                <div><dt>Evidence</dt><dd data-detail-evidence>${escapeHtml(selected.evidence)}</dd></div>
                <div><dt>Action</dt><dd data-detail-action>${escapeHtml(selected.disabledAction)}</dd></div>
                <div><dt>Detail</dt><dd data-detail-copy>${escapeHtml(selected.detail)}</dd></div>
              </dl>
              <section class="disabled-action-panel tcrn-gate-readiness-panel" ${tcrnComponentAttr("GateReadinessPanel")} aria-label="Disabled action posture">
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" disabled>Owner action locked</button>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" disabled>Live dispatch unavailable</button>
                <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" disabled>External proof required</button>
              </section>
              <section class="evidence-panel tcrn-readback-panel" ${tcrnComponentAttr("ReadbackPanel")} data-region="evidence-readiness-panel" aria-label="Evidence readiness panel">
                <h3 class="tcrn-heading tcrn-heading--3" ${tcrnComponentAttr("Heading")}>Evidence Readiness</h3>
                <dl class="detail-list tcrn-key-value-list" ${tcrnComponentAttr("KeyValueList")}>
                  <div><dt>Command</dt><dd>pnpm slice10:proof</dd></div>
                  <div><dt>Static targets</dt><dd>3 paths read back</dd></div>
                  <div><dt>Desktop</dt><dd>capture metadata prepared</dd></div>
                  <div><dt>Mobile</dt><dd>overflow expected false</dd></div>
                  <div><dt>Console</dt><dd>page-error expectation none</dd></div>
                </dl>
              </section>
            </aside>
          </section>

          <section class="state-grid" aria-label="Required state readback">
            ${statePill("productDesignStatus", model.requiredState.productDesignStatus)}
            ${statePill("aosWideProductDesignAccepted", String(model.requiredState.aosWideProductDesignAccepted))}
            ${statePill("deploymentProof", model.requiredState.deploymentProof)}
            ${statePill("liveDispatch", String(model.requiredState.liveDispatch))}
            ${statePill("threadRegistryMutation", String(model.requiredState.threadRegistryMutation))}
            ${statePill("releaseReadiness", model.requiredState.releaseReadiness)}
            ${statePill("productAcceptance", model.requiredState.productAcceptance)}
            ${statePill("finalMvpAcceptance", model.requiredState.finalMvpAcceptance)}
            ${statePill("docsExport", model.requiredState.docsExport)}
            ${statePill("docsPublication", model.requiredState.docsPublication)}
            ${statePill("canonicalPromotion", model.requiredState.canonicalPromotion)}
            ${statePill("githubMutation", String(model.requiredState.githubMutation))}
            ${statePill("scannerIngestion", String(model.requiredState.scannerIngestion))}
            ${statePill("materializationExecuted", String(model.requiredState.materializationExecuted))}
            ${statePill("productRepoWrite", String(model.requiredState.productRepoWrite))}
            ${statePill("codexSecurityScan", model.requiredState.codexSecurityScan)}
            ${statePill("externalProofRequired", String(model.requiredState.externalProofRequired))}
          </section>
        </div>
      </section>
    </main>
    <script>${aosWideClientScript}</script>
  </body>
</html>`;
}

function requiredSurface(model: AOSWideProductDesignModel, index: number): SurfaceRow {
  const surface = model.surfaces[index];
  if (!surface) {
    throw new Error(`missing required Slice 10 surface at index ${index}`);
  }
  return surface;
}

function moduleCard(surface: SurfaceRow, region: string, label: string, items: string[]): string {
  return `<article class="module-card tcrn-surface" ${tcrnComponentAttr("Surface")} data-region="${escapeHtml(region)}" data-module-id="${escapeHtml(surface.id)}">
    <div class="panel-head tcrn-evidence-strip" ${tcrnComponentAttr("EvidenceStrip")}>
      <h2 class="tcrn-heading tcrn-heading--2" ${tcrnComponentAttr("Heading")}>${escapeHtml(surface.title)}</h2>
      <span class="state-chip tcrn-status-badge ${escapeHtml(surface.state)}" ${tcrnComponentAttr("StatusBadge")}>${copyState(surface.state)}</span>
    </div>
    <strong class="tcrn-text" ${tcrnComponentAttr("Text")}>${escapeHtml(label)}</strong>
    <p class="tcrn-text" ${tcrnComponentAttr("Text")}>${escapeHtml(surface.detail)}</p>
    <ul class="tcrn-key-value-list" ${tcrnComponentAttr("KeyValueList")}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <button class="tcrn-button" ${tcrnComponentAttr("Button")} type="button" data-select-surface="${escapeHtml(surface.id)}">Inspect</button>
  </article>`;
}

function surfaceRow(surface: SurfaceRow, index: number): string {
  const terms = [surface.title, surface.surface, surface.owner, surface.state, surface.stage, surface.blocker, surface.detail, surface.disabledAction, ...surface.terms].join(" ").toLowerCase();
  return `<button class="surface-row target-row tcrn-table-shell__row${index === 0 ? " active" : ""}" ${tcrnComponentAttr("TableShell")} data-surface-row data-state="${escapeHtml(surface.state)}" data-row-id="${escapeHtml(surface.id)}" data-title="${escapeHtml(surface.title)}" data-surface="${escapeHtml(surface.surface)}" data-owner="${escapeHtml(surface.owner)}" data-stage="${escapeHtml(surface.stage)}" data-blocker="${escapeHtml(surface.blocker)}" data-evidence="${escapeHtml(surface.evidence)}" data-action="${escapeHtml(surface.disabledAction)}" data-detail="${escapeHtml(surface.detail)}" data-search="${escapeHtml(terms)}" type="button" role="row"><span class="tcrn-table-shell__cell">${escapeHtml(surface.title)}</span><span class="tcrn-table-shell__cell">${escapeHtml(surface.surface)}</span><span class="tcrn-table-shell__cell">${copyState(surface.state)}</span><span class="tcrn-table-shell__cell">${escapeHtml(surface.owner)}</span><span class="tcrn-table-shell__cell">${escapeHtml(surface.blocker)}</span><span class="tcrn-table-shell__cell">${escapeHtml(surface.evidence)}</span></button>`;
}

function navButton(label: string, id: string, active: boolean): string {
  return tcrnStaticNavItem({
    active,
    activeHref: "#target-set",
    disabledReason: `${label} view is held for a later routed AOS slice; this AOS-wide target-set checkpoint keeps the target set available only.`,
    extraAttributes: `data-nav-surface="${escapeHtml(id)}"`,
    label
  });
}

function statePill(key: string, value: string): string {
  return `<div class="state-pill tcrn-badge" ${tcrnComponentAttr("Badge")}><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function copyState(state: string): string {
  if (state === "review_required") return "review required";
  if (state === "pending_external_proof") return "external proof required";
  return state.replaceAll("_", " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const aosWideProductDesignCss = `
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
  --surface-tint: #eef9fb;
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
button:disabled { cursor: not-allowed; opacity: 0.72; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--teal-500); outline-offset: 2px; }
strong, b { font-weight: 500; }
.aos-shell { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; max-width: 100%; overflow-x: clip; }
.aos-sidebar { position: sticky; top: 0; align-self: start; display: grid; grid-template-rows: auto 1fr auto; gap: 22px; height: 100vh; padding: 24px 14px 20px; overflow: auto; background: linear-gradient(180deg, var(--navy-900), var(--navy-950)); color: #d9e8f0; }
.brand-lockup { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; min-height: 42px; padding: 0 10px 8px; }
.brand-tcrn { font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 29px; line-height: 1; font-weight: 500; letter-spacing: 0.17em; color: #f7fbff; }
.brand-aos { display: inline-block; font-family: Futura, "Avenir Next", "Helvetica Neue", Arial, sans-serif; font-size: 32px; line-height: 1; font-weight: 800; letter-spacing: 0; color: transparent; background: linear-gradient(135deg, #18d7c8 6%, #08a99d 56%, #15c4b5 100%); -webkit-background-clip: text; background-clip: text; transform: skewX(-5deg); }
.nav-stack { display: grid; align-content: start; gap: 6px; }
.nav-row { display: grid; grid-template-columns: 8px 1fr; align-items: center; gap: 10px; width: 100%; min-height: 38px; border: 1px solid transparent; border-radius: 6px; padding: 0 10px; background: transparent; color: #e5eef3; text-align: left; font-size: 13px; font-weight: 400; }
.nav-row::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: #7891a2; }
.nav-row.active, .nav-row:hover { background: rgba(255, 255, 255, 0.12); }
.nav-row.active { box-shadow: inset 4px 0 0 var(--teal-500); }
.nav-row.active::before { background: var(--teal-500); }
.nav-label { min-width: 0; }
.nav-unavailable-reason { display: block; margin-top: 2px; color: #b8cad5; font-size: 11px; font-weight: 400; line-height: 1.25; }
.sidebar-note { display: flex; align-items: center; gap: 8px; color: #deedf4; font-size: 12px; }
.aos-main, .workspace, .title-row, .module-grid, .content-grid, .surface-index, .detail-drawer, .topbar, .path-grid { max-width: 100%; min-width: 0; }
.topbar { display: grid; grid-template-columns: 220px minmax(0, 1fr) max-content max-content; align-items: center; gap: 14px; min-height: 64px; padding: 0 22px; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, 0.96); }
.project-selector { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; min-height: 38px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 5px; background: var(--surface); font-size: 14px; }
.project-selector span { color: #25364a; }
.project-selector select { min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font-weight: 500; }
.checkpoint-strip { display: flex; align-items: center; gap: 12px; min-width: 0; color: #26364a; font-size: 13px; }
.checkpoint-strip strong, .checkpoint-strip em { white-space: nowrap; }
.checkpoint-strip em { color: var(--teal-600); font-style: normal; }
.top-action, .module-card button, .surface-index-head button, .filter-row button, .disabled-action-panel button { display: inline-grid; place-items: center; min-height: 34px; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 12px; background: #fff; color: var(--text); text-decoration: none; font-weight: 500; }
.workspace { display: grid; gap: 18px; padding: 24px 18px 34px; }
.title-row { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
h1 { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 500; letter-spacing: 0; }
h2 { margin: 0; font-size: 13px; font-weight: 500; letter-spacing: 0.055em; text-transform: uppercase; }
.claim-strip, .filter-row, .state-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.claim-strip span, .state-pill { border: 1px solid var(--line); border-radius: 5px; padding: 6px 9px; background: #fff; color: #516174; font-size: 12px; }
.path-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.path-grid a { display: grid; gap: 5px; border: 1px solid var(--line); border-radius: 6px; padding: 13px; background: var(--surface); color: inherit; text-decoration: none; }
.path-grid span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.path-grid strong { color: #162437; font-size: 14px; }
.path-grid em { min-width: 0; color: #516174; font-size: 11px; font-style: normal; overflow-wrap: anywhere; }
.module-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.module-card, .surface-index, .detail-drawer { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.module-card { display: grid; align-content: start; gap: 10px; min-height: 218px; padding: 15px; }
.module-card strong { color: #17263a; font-size: 13px; }
.module-card p, .module-card li { margin: 0; color: #46576b; font-size: 12px; line-height: 1.45; }
.module-card ul { display: grid; gap: 4px; margin: 0; padding-left: 16px; }
.panel-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.panel-head h2 { min-width: 0; }
.state-chip, .tag { display: inline-block; width: fit-content; max-width: 100%; border-radius: 4px; padding: 4px 7px; font-size: 11px; font-weight: 500; line-height: 1.2; }
.state-chip.current, .tag.current { background: #e5f8ee; color: #1d8d51; }
.state-chip.review_required, .tag.review_required { background: #fff1d6; color: #a66f0d; }
.state-chip.blocked, .tag.blocked { background: #ffe7e3; color: #d0312a; }
.state-chip.pending_external_proof, .tag.pending_external_proof { background: #e8f2ff; color: #176ac2; }
.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 336px; gap: 0; }
.surface-index { border-radius: 6px 0 0 6px; overflow-x: auto; }
.surface-index-head { display: grid; grid-template-columns: auto minmax(220px, 1fr) 88px; align-items: center; gap: 14px; padding: 18px; border-bottom: 1px solid var(--line); }
.search-box { display: grid; min-height: 36px; }
.search-box span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.search-box input { width: 100%; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 12px; color: var(--text); }
.filter-row { padding: 12px 18px; border-bottom: 1px solid var(--line); }
.surface-table { min-width: 920px; }
.surface-row { display: grid; grid-template-columns: 148px minmax(240px, 1fr) 132px 150px 150px 150px; align-items: center; width: 100%; min-height: 50px; padding: 0 16px; border: 0; border-bottom: 1px solid var(--line); background: #fff; color: #29374a; text-align: left; font-size: 12px; }
.surface-row[hidden], .empty-state[hidden] { display: none !important; }
.surface-row > span { min-width: 0; line-height: 1.35; overflow-wrap: anywhere; }
.table-head { min-height: 42px; background: #fbfcfd; color: #384659; font-size: 11px; font-weight: 500; }
.target-row:hover, .target-row.active { background: #effafe; }
.target-row.active { box-shadow: inset 4px 0 0 var(--teal-600); }
.empty-state { display: grid; gap: 4px; padding: 18px; border-top: 1px solid var(--line); color: #4b5d70; font-size: 12px; }
.detail-drawer { border-radius: 0 6px 6px 0; border-left: 0; padding: 20px; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.drawer-head button { border: 0; background: transparent; color: #1a293d; }
.detail-drawer h2 { margin: 14px 0; padding-bottom: 14px; border-bottom: 1px solid var(--line); color: #162437; font-size: 18px; line-height: 1.25; letter-spacing: 0; text-transform: none; }
.detail-list { display: grid; gap: 10px; margin: 0 0 18px; }
.detail-list div { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 8px; }
dt { color: #253449; font-size: 12px; font-weight: 500; }
dd { margin: 0; color: #162437; font-size: 12px; overflow-wrap: anywhere; }
.disabled-action-panel { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 16px; }
.evidence-panel { border: 1px solid var(--line); border-radius: 5px; padding: 12px; background: var(--surface-weak); }
.evidence-panel h3 { margin: 0 0 10px; font-size: 12px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
.state-grid { padding-bottom: 4px; }
.state-pill { display: grid; grid-template-columns: auto auto; gap: 7px; }
.state-pill dt { font-size: 11px; }
.state-pill dd { font-size: 11px; color: var(--teal-600); }
.state-dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; }
.state-current { background: var(--green-500); }
@media (max-width: 1320px) {
  .module-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .content-grid { grid-template-columns: 1fr; }
  .detail-drawer { border-left: 1px solid var(--line); border-radius: 6px; }
}
@media (max-width: 900px) {
  .aos-shell { grid-template-columns: 1fr; }
  .aos-sidebar { position: static; height: auto; gap: 14px; padding: 18px 14px; }
  .nav-stack { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .topbar, .surface-index-head, .path-grid, .module-grid { grid-template-columns: minmax(0, 1fr); }
  .topbar { padding: 14px; }
  .title-row { align-items: start; flex-direction: column; }
  .workspace { padding: 16px 12px 28px; }
  .checkpoint-strip, .claim-strip { align-items: start; flex-direction: column; }
  .surface-index { overflow-x: auto; }
  .surface-table { width: max-content; min-width: 820px; }
}
@media (max-width: 460px) {
  .nav-stack { grid-template-columns: 1fr; }
  .module-card { min-height: 0; }
  .detail-list div { grid-template-columns: minmax(92px, 0.42fr) minmax(0, 1fr); }
}`;

const aosWideClientScript = `
const rows = Array.from(document.querySelectorAll("[data-surface-row]"));
const navRows = Array.from(document.querySelectorAll("[data-nav-surface]"));
const moduleButtons = Array.from(document.querySelectorAll("[data-select-surface]"));
const search = document.querySelector("#surface-search");
const emptyState = document.querySelector("[data-empty-state]");
const detailState = document.querySelector("[data-detail-state]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailSurface = document.querySelector("[data-detail-surface]");
const detailOwner = document.querySelector("[data-detail-owner]");
const detailStage = document.querySelector("[data-detail-stage]");
const detailBlocker = document.querySelector("[data-detail-blocker]");
const detailEvidence = document.querySelector("[data-detail-evidence]");
const detailAction = document.querySelector("[data-detail-action]");
const detailCopy = document.querySelector("[data-detail-copy]");
let activeFilter = "all";

function copyState(value) {
  if (value === "review_required") return "review required";
  if (value === "pending_external_proof") return "external proof required";
  return value.replaceAll("_", " ");
}

function rowIsVisible(row) {
  return !row.hidden;
}

function syncEmptyState() {
  const visibleCount = rows.filter(rowIsVisible).length;
  document.body.dataset.visibleRows = String(visibleCount);
  if (emptyState) emptyState.hidden = visibleCount !== 0;
}

function activateById(id) {
  const row = rows.find((candidate) => candidate.getAttribute("data-row-id") === id) || rows.find(rowIsVisible) || rows[0];
  if (!row) return;
  rows.forEach((candidate) => candidate.classList.toggle("active", candidate === row));
  navRows.forEach((candidate) => candidate.classList.toggle("active", candidate.getAttribute("data-nav-surface") === row.getAttribute("data-row-id")));
  const state = row.getAttribute("data-state") || "review_required";
  if (detailState) {
    detailState.className = "tag " + state;
    detailState.textContent = copyState(state);
  }
  if (detailTitle) detailTitle.textContent = row.getAttribute("data-title") || "";
  if (detailSurface) detailSurface.textContent = row.getAttribute("data-surface") || "";
  if (detailOwner) detailOwner.textContent = row.getAttribute("data-owner") || "";
  if (detailStage) detailStage.textContent = row.getAttribute("data-stage") || "";
  if (detailBlocker) detailBlocker.textContent = row.getAttribute("data-blocker") || "";
  if (detailEvidence) detailEvidence.textContent = row.getAttribute("data-evidence") || "";
  if (detailAction) detailAction.textContent = row.getAttribute("data-action") || "";
  if (detailCopy) detailCopy.textContent = row.getAttribute("data-detail") || "";
}

function applyFilters() {
  const query = (search?.value || "").toLowerCase();
  rows.forEach((row) => {
    const stateMatch = activeFilter === "all" || row.getAttribute("data-state") === activeFilter;
    const haystack = row.getAttribute("data-search") || row.textContent || "";
    const queryMatch = query.length === 0 || haystack.toLowerCase().includes(query);
    row.hidden = !(stateMatch && queryMatch);
  });
  syncEmptyState();
  const active = rows.find((row) => row.classList.contains("active") && rowIsVisible(row));
  if (!active) activateById(rows.find(rowIsVisible)?.getAttribute("data-row-id") || "");
}

rows.forEach((row) => row.addEventListener("click", () => activateById(row.getAttribute("data-row-id") || "")));
rows.forEach((row) => row.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activateById(row.getAttribute("data-row-id") || "");
  }
}));
navRows.forEach((button) => button.addEventListener("click", () => activateById(button.getAttribute("data-nav-surface") || "")));
moduleButtons.forEach((button) => button.addEventListener("click", () => activateById(button.getAttribute("data-select-surface") || "")));
document.querySelectorAll("[data-filter-state]").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.getAttribute("data-filter-state") || "all";
  applyFilters();
}));
search?.addEventListener("input", applyFilters);
syncEmptyState();
`;
