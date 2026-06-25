import {
  createRebuildBaselineModel,
  forbiddenRebuildBaselineVisibleCopy,
  rebuildBaselineRoutes,
  rebuildBaselineStorybookIds,
  rebuildBaselineDsStandardIds,
  requiredRebuildBaselineSelectors,
  type RebuildBaselineModel
} from "./rebuild-baseline-data.js";
import {
  aosDesignSystemNavigationCss,
  aosDesignSystemTokenCss
} from "./design-system-bridge.js";
import { renderRebuildBaselineRuntimeSurface } from "./rebuild-baseline-ui-react-runtime.js";

export {
  createRebuildBaselineModel,
  forbiddenRebuildBaselineVisibleCopy,
  rebuildBaselineRoutes,
  rebuildBaselineStorybookIds,
  rebuildBaselineDsStandardIds,
  requiredRebuildBaselineSelectors
} from "./rebuild-baseline-data.js";

export function renderRebuildBaselineHtml(currentAlias: string): string {
  const model = createRebuildBaselineModel(currentAlias);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Rebuild Workspace</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='6'%20fill='%2308243b'/%3E%3Ctext%20x='16'%20y='21'%20font-size='12'%20text-anchor='middle'%20fill='%2314b8ad'%20font-family='Arial'%3EA%3C/text%3E%3C/svg%3E" />
    <style>${rebuildBaselineCss}</style>
  </head>
  <body data-rebuild-alias="${escapeAttribute(currentAlias)}">
    ${renderRebuildBaselineRuntimeSurface(model)}
  </body>
</html>`;
}

const rebuildBaselineCss = `
${aosDesignSystemTokenCss}
:root {
  color-scheme: light;
  --navy-950: #061a2c;
  --navy-900: #08243b;
  --teal-500: #14b8ad;
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
html { min-width: 320px; background: #f4f7fa; }
body { margin: 0; min-width: 320px; background: #f4f7fa; color: var(--text); }
button { font: inherit; }
a { color: inherit; }
button:disabled { cursor: not-allowed; opacity: 0.72; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--teal-500); outline-offset: 2px; }
.tcrn-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; white-space: nowrap !important; border: 0 !important; }
.rebuild-baseline { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; max-width: 100%; overflow-x: clip; }
.rebuild-baseline > .tcrn-side-nav { position: sticky; top: 0; align-self: start; align-content: start; grid-auto-rows: max-content; height: 100vh; overflow: auto; }
${aosDesignSystemNavigationCss}
.rebuild-baseline__brand { display: flex; align-items: center; justify-content: flex-start; gap: 10px; min-height: 44px; color: var(--tcrn-color-text-primary); text-decoration: none; }
.rebuild-baseline__brand-mark { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 6px; background: color-mix(in srgb, var(--tcrn-color-brand-primary-bg) 72%, transparent); color: var(--tcrn-color-text-primary); font-weight: 700; }
.rebuild-baseline__brand-text { display: grid; gap: 1px; min-width: 0; }
.rebuild-baseline__brand-kicker, .rebuild-baseline__nav-note { margin: 0; color: var(--tcrn-color-text-muted); font-size: 11px; line-height: 1.2; }
.rebuild-baseline__brand-name { margin: 0; color: var(--tcrn-color-text-primary); font-size: 14px; font-weight: 600; line-height: 1.2; }
.rebuild-baseline__nav-note { padding: 0 8px; }
.rebuild-baseline__content { display: grid; grid-template-rows: auto 1fr; min-width: 0; max-width: 100%; }
.rebuild-baseline__topbar { display: grid; gap: 12px; padding: 16px 22px; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, 0.96); }
.rebuild-baseline__topbar .tcrn-top-bar { display: grid; grid-template-columns: 180px minmax(180px, 1fr) minmax(260px, max-content); align-items: center; gap: 14px; min-width: 0; }
.rebuild-baseline__topbar .tcrn-top-bar__brand, .rebuild-baseline__topbar .tcrn-top-bar__module { color: #25364a; font-size: 13px; font-weight: 600; }
.rebuild-baseline__topbar .tcrn-top-bar__actions { display: flex; align-items: center; justify-content: end; gap: 10px; min-width: 0; }
.rebuild-baseline__topbar-copy { display: grid; gap: 4px; min-width: 0; }
.rebuild-baseline__topbar-copy .tcrn-heading { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 600; letter-spacing: 0; }
.rebuild-baseline__summary, .rebuild-baseline__boundaries { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.95fr); gap: 14px; min-width: 0; }
.rebuild-baseline__summary, .rebuild-baseline__cockpit-start, .rebuild-baseline__checklist, .rebuild-baseline__boundaries, .rebuild-baseline__action-lane { padding-inline: 22px; }
.rebuild-baseline__summary { margin-top: 22px; margin-bottom: 14px; }
.rebuild-baseline__cockpit-start, .rebuild-baseline__docs-start, .rebuild-baseline__target-set-start, .rebuild-baseline__project-workspace-start, .rebuild-baseline__initiative-detail-start { margin-bottom: 14px; }
.rebuild-baseline__checklist, .rebuild-baseline__boundaries { margin-bottom: 14px; }
.rebuild-baseline__action-lane { margin-bottom: 28px; }
.rebuild-baseline__cockpit-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.95fr); gap: 14px; min-width: 0; }
.rebuild-baseline__cockpit-side { display: grid; gap: 14px; min-width: 0; }
.rebuild-baseline__cockpit-surface { min-width: 0; }
.rebuild-baseline__module-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-width: 0; }
.rebuild-baseline__hierarchy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-width: 0; }
.rebuild-baseline__activity-list { display: grid; gap: 12px; min-width: 0; }
.rebuild-baseline__strong-text { font-weight: 600; }
.rebuild-baseline__cockpit-start .tcrn-detail-drawer { display: grid; gap: 12px; border: 1px solid var(--line); border-radius: 6px; padding: 16px; background: var(--surface); box-shadow: 0 10px 26px rgba(8, 36, 59, 0.05); }
.tcrn-surface { display: grid; align-content: start; gap: 12px; min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 16px; background: var(--surface); box-shadow: 0 10px 26px rgba(8, 36, 59, 0.05); }
.rebuild-baseline__hero { background: linear-gradient(180deg, #ffffff, #f7fbfc); }
.tcrn-heading { margin: 0; letter-spacing: 0; }
.tcrn-heading--2, .tcrn-readback-panel .tcrn-heading--3 { font-size: 15px; line-height: 1.25; font-weight: 600; }
.tcrn-text { margin: 0; line-height: 1.45; overflow-wrap: anywhere; }
.tcrn-badge { display: inline-flex; width: fit-content; max-width: 100%; align-items: center; border-radius: 4px; padding: 4px 7px; font-size: 11px; font-weight: 600; line-height: 1.2; }
.tcrn-badge--neutral { background: #edf2f7; color: #46576b; }
.tcrn-badge--positive { background: #e5f8ee; color: #1d8d51; }
.tcrn-badge--warning { background: #fff1d6; color: #a66f0d; }
.rebuild-baseline__evidence-strip .tcrn-evidence-strip, .rebuild-baseline__action-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tcrn-key-value-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; margin: 0; }
.tcrn-key-value-list div { display: grid; gap: 2px; min-width: 0; }
.tcrn-key-value-list dt { color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; }
.tcrn-key-value-list dd { margin: 0; min-width: 0; color: #162437; font-size: 13px; overflow-wrap: anywhere; }
.rebuild-baseline__checklist .tcrn-table-shell { min-width: 920px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: #fff; }
.rebuild-baseline__checklist .tcrn-table-shell__head, .rebuild-baseline__checklist .tcrn-table-shell__row { display: grid; grid-template-columns: minmax(180px, 1.15fr) 132px minmax(180px, 0.9fr) minmax(320px, 1.75fr); align-items: stretch; }
.rebuild-baseline__checklist .tcrn-table-shell__head { background: #f2f6f9; color: #4d5d70; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.rebuild-baseline__checklist .tcrn-table-shell__head span, .rebuild-baseline__checklist .tcrn-table-shell__cell { display: flex; align-items: center; min-width: 0; padding: 11px 12px; border-bottom: 1px solid var(--line); overflow-wrap: break-word; word-break: normal; }
.rebuild-baseline__checklist .tcrn-table-shell__cell[data-label="Source"] { overflow-wrap: normal; word-break: keep-all; }
.rebuild-baseline__checklist .tcrn-table-shell__cell[data-label="Note"] { overflow-wrap: anywhere; }
.rebuild-baseline__checklist .tcrn-table-shell__cell + .tcrn-table-shell__cell, .rebuild-baseline__checklist .tcrn-table-shell__head span + span { border-left: 1px solid var(--line); }
.rebuild-baseline__action-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tcrn-button, .tcrn-link-button { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 12px; background: #fff; color: var(--text); font-weight: 600; text-decoration: none; }
@media (max-width: 980px) {
  .rebuild-baseline { grid-template-columns: 1fr; }
  .rebuild-baseline > .tcrn-side-nav { position: static; height: auto; }
  .rebuild-baseline__topbar .tcrn-top-bar { grid-template-columns: 1fr; }
  .rebuild-baseline__topbar .tcrn-top-bar__actions { justify-content: start; flex-wrap: wrap; }
  .rebuild-baseline__summary, .rebuild-baseline__boundaries { grid-template-columns: 1fr; }
  .rebuild-baseline__cockpit-grid { grid-template-columns: 1fr; }
  .rebuild-baseline__module-grid { grid-template-columns: 1fr; }
  .rebuild-baseline__hierarchy-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .rebuild-baseline__summary, .rebuild-baseline__cockpit-start, .rebuild-baseline__checklist, .rebuild-baseline__boundaries, .rebuild-baseline__action-lane { padding-inline: 14px; }
  .rebuild-baseline__topbar { padding-inline: 14px; }
  .tcrn-key-value-list { grid-template-columns: 1fr; }
  .rebuild-baseline__checklist .tcrn-table-shell { min-width: 0; border: 0; background: transparent; }
  .rebuild-baseline__checklist .tcrn-table-shell__head { display: none; }
  .rebuild-baseline__checklist .tcrn-table-shell__row { display: grid; grid-template-columns: 1fr; gap: 0; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  .rebuild-baseline__checklist .tcrn-table-shell__cell { display: grid; grid-template-columns: 92px minmax(0, 1fr); justify-content: stretch; gap: 12px; border-left: 0 !important; }
  .rebuild-baseline__checklist .tcrn-table-shell__cell::before { content: attr(data-label); color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; overflow-wrap: normal; }
}
`;

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
