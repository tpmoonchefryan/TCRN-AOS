import {
  createDependencyConsoleModel,
  dependencyConsoleDsStandardIds,
  dependencyConsoleStorybookIds,
  forbiddenDependencyConsoleVisibleCopy,
  requiredDependencyConsoleSelectors,
  type DependencyConsoleModel
} from "./dependency-console-data.js";
import {
  aosDesignSystemNavigationCss,
  aosDesignSystemTokenCss
} from "./design-system-bridge.js";
import { renderDependencyConsoleRuntimeSurface } from "./dependency-console-ui-react-runtime.js";

export {
  createDependencyConsoleModel,
  dependencyConsoleDsStandardIds,
  dependencyConsoleStorybookIds,
  forbiddenDependencyConsoleVisibleCopy,
  requiredDependencyConsoleSelectors
} from "./dependency-console-data.js";

export function renderDependencyConsoleHtml(model: DependencyConsoleModel = createDependencyConsoleModel()): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TCRN AOS Dependency Console</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='6'%20fill='%2308243b'/%3E%3Ctext%20x='16'%20y='21'%20font-size='12'%20text-anchor='middle'%20fill='%2314b8ad'%20font-family='Arial'%3EA%3C/text%3E%3C/svg%3E" />
    <style>${dependencyConsoleCss}</style>
  </head>
  <body data-dependency-count="${model.dependencies.length}">
    ${renderDependencyConsoleRuntimeSurface(model)}
  </body>
</html>`;
}

const dependencyConsoleCss = `
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
button, select { font: inherit; }
button:disabled { cursor: not-allowed; opacity: 0.72; }
a { color: inherit; }
button:focus-visible, a:focus-visible, select:focus-visible { outline: 2px solid var(--teal-500); outline-offset: 2px; }
.tcrn-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; white-space: nowrap !important; border: 0 !important; }
.dependency-console { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; max-width: 100%; overflow-x: clip; }
.dependency-console > .tcrn-side-nav { position: sticky; top: 0; align-self: start; align-content: start; grid-auto-rows: max-content; height: 100vh; overflow: auto; }
${aosDesignSystemNavigationCss}
.dependency-console__brand { display: flex; align-items: center; justify-content: flex-start; gap: 10px; min-height: 44px; color: var(--tcrn-color-text-primary); text-decoration: none; }
.dependency-console__brand-mark { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 6px; background: color-mix(in srgb, var(--tcrn-color-brand-primary-bg) 72%, transparent); color: var(--tcrn-color-text-primary); font-weight: 700; }
.dependency-console__brand-text { display: grid; gap: 1px; min-width: 0; }
.dependency-console__brand-kicker, .dependency-console__nav-note { margin: 0; color: var(--tcrn-color-text-muted); font-size: 11px; line-height: 1.2; }
.dependency-console__brand-name { margin: 0; color: var(--tcrn-color-text-primary); font-size: 14px; font-weight: 600; line-height: 1.2; }
.dependency-console__nav-note { padding: 0 8px; }
.dependency-console__content { display: grid; grid-template-rows: auto 1fr; min-width: 0; max-width: 100%; }
.dependency-console__topbar { display: grid; gap: 12px; padding: 16px 22px; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, 0.96); }
.dependency-console__topbar .tcrn-top-bar { display: grid; grid-template-columns: 180px minmax(180px, 1fr) minmax(260px, max-content); align-items: center; gap: 14px; min-width: 0; }
.dependency-console__topbar .tcrn-top-bar__brand, .dependency-console__topbar .tcrn-top-bar__module { color: #25364a; font-size: 13px; font-weight: 600; }
.dependency-console__topbar .tcrn-top-bar__actions { display: flex; align-items: end; justify-content: end; gap: 10px; min-width: 0; }
.dependency-console__topbar-copy { display: grid; gap: 4px; min-width: 0; }
.dependency-console__topbar-copy .tcrn-heading { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 600; letter-spacing: 0; }
.dependency-console__topbar-copy .tcrn-text, .tcrn-text--muted { margin: 0; color: var(--muted); }
.dependency-console__select-field { display: grid; gap: 4px; min-width: min(260px, 100%); }
.dependency-console__field-label { font-size: 11px; line-height: 1.2; }
.dependency-console__select-field select, .dependency-console__topbar .tcrn-button { min-height: 36px; }
.dependency-console__summary, .dependency-console__detail { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.95fr); gap: 14px; min-width: 0; }
.dependency-console__content > .dependency-console__summary { margin-top: 22px; }
.dependency-console__summary, .dependency-console__list, .dependency-console__detail, .dependency-console__actions { padding-inline: 22px; }
.dependency-console__summary, .dependency-console__list, .dependency-console__detail { margin-bottom: 14px; }
.dependency-console__actions { margin-bottom: 28px; }
.tcrn-surface { display: grid; align-content: start; gap: 12px; min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 16px; background: var(--surface); box-shadow: 0 10px 26px rgba(8, 36, 59, 0.05); }
.dependency-console__hero { background: linear-gradient(180deg, #ffffff, #f7fbfc); }
.tcrn-heading { margin: 0; letter-spacing: 0; }
.tcrn-heading--2, .tcrn-readback-panel .tcrn-heading--3 { font-size: 15px; line-height: 1.25; font-weight: 600; }
.tcrn-text { margin: 0; line-height: 1.45; overflow-wrap: anywhere; }
.tcrn-badge { display: inline-flex; width: fit-content; max-width: 100%; align-items: center; border-radius: 4px; padding: 4px 7px; font-size: 11px; font-weight: 600; line-height: 1.2; }
.tcrn-badge--neutral { background: #edf2f7; color: #46576b; }
.tcrn-badge--positive { background: #e5f8ee; color: #1d8d51; }
.tcrn-badge--warning { background: #fff1d6; color: #a66f0d; }
.tcrn-badge--danger { background: #ffe7e3; color: #d0312a; }
.dependency-console__evidence-strip .tcrn-evidence-strip, .dependency-console__action-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tcrn-key-value-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; margin: 0; }
.tcrn-key-value-list div { display: grid; gap: 2px; min-width: 0; }
.tcrn-key-value-list dt { color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; }
.tcrn-key-value-list dd { margin: 0; min-width: 0; color: #162437; font-size: 13px; overflow-wrap: anywhere; }
.dependency-console__table-shell { min-width: 0; overflow-x: auto; }
.tcrn-table-shell { min-width: 980px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: #fff; }
.tcrn-table-shell__head, .tcrn-table-shell__row { display: grid; grid-template-columns: minmax(180px, 1.2fr) 140px 150px 140px 150px 120px; align-items: stretch; }
.tcrn-table-shell__head { background: #f2f6f9; color: #4d5d70; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.tcrn-table-shell__head span, .tcrn-table-shell__cell { display: flex; align-items: center; min-width: 0; padding: 11px 12px; border-bottom: 1px solid var(--line); overflow-wrap: break-word; word-break: normal; }
.tcrn-table-shell__cell[data-label="Lifecycle"], .tcrn-table-shell__cell[data-label="Posture"], .tcrn-table-shell__cell[data-label="License"], .tcrn-table-shell__cell[data-label="Status"] { overflow-wrap: normal; word-break: keep-all; }
.tcrn-table-shell__cell + .tcrn-table-shell__cell, .tcrn-table-shell__head span + span { border-left: 1px solid var(--line); }
.dependency-console__detail-drawer .tcrn-detail-drawer, .dependency-console__service .tcrn-readback-panel { display: grid; gap: 12px; min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 16px; background: var(--surface); }
.dependency-console__actions { display: grid; gap: 12px; }
.tcrn-button, .tcrn-link-button { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 12px; background: #fff; color: var(--text); font-weight: 600; text-decoration: none; }
.tcrn-button--secondary { background: #fff; }
.tcrn-select { width: 100%; min-width: 0; border: 1px solid var(--line-strong); border-radius: 5px; padding: 0 10px; background: #fff; color: var(--text); }
@media (max-width: 980px) {
  .dependency-console { grid-template-columns: 1fr; }
  .dependency-console > .tcrn-side-nav { position: static; height: auto; }
  .dependency-console__topbar .tcrn-top-bar { grid-template-columns: 1fr; }
  .dependency-console__topbar .tcrn-top-bar__actions { justify-content: start; flex-wrap: wrap; }
  .dependency-console__summary, .dependency-console__detail { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .dependency-console__summary, .dependency-console__list, .dependency-console__detail, .dependency-console__actions { padding-inline: 14px; }
  .dependency-console__topbar { padding-inline: 14px; }
  .tcrn-key-value-list { grid-template-columns: 1fr; }
  .tcrn-table-shell { min-width: 0; border: 0; background: transparent; }
  .tcrn-table-shell__head { display: none; }
  .tcrn-table-shell__row { display: grid; grid-template-columns: 1fr; gap: 0; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  .tcrn-table-shell__cell { display: grid; grid-template-columns: 78px minmax(0, 1fr); justify-content: stretch; gap: 12px; border-left: 0 !important; }
  .tcrn-table-shell__cell::before { content: attr(data-label); color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; overflow-wrap: normal; }
}
`;
