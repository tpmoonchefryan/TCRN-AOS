/**
 * The stylesheet, served as one file.
 *
 * Two rules from the design record are load-bearing here and are the reason this is not
 * generic CSS:
 *
 *  - The default filter face is at most two rows, about 96px. The design it replaces
 *    stacked six rows and 340px, which pushed the list itself below the fold — the
 *    screen spent its first half describing how to look rather than showing anything.
 *
 *  - Selection is "ink": it takes over the structure a component already has. A surface
 *    that has a fill gets its fill inked; a thing with a border gets its border inked.
 *    Never both, never an added rail, underline, or brand tint. Two signals for one state
 *    is what produced the double-framed row the owner rejected on sight.
 */
export const STYLESHEET = `
:root {
  --aos-selection-fill: rgba(28, 25, 23, .06);
  --aos-selection-fill-hover: rgba(28, 25, 23, .032);
  --aos-radius: 6px;
  --aos-sidebar: 216px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --aos-selection-fill: rgba(236, 234, 230, .09);
    --aos-selection-fill-hover: rgba(236, 234, 230, .05);
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--tcrn-font-family-sans, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif);
  font-size: 14px;
  line-height: 1.6;
  color: var(--tcrn-color-text-primary, #1c1d21);
  background: var(--tcrn-color-surface-canvas, #fafaf9);
}

a { color: inherit; text-underline-offset: .16em; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible {
  outline: 2px solid var(--tcrn-color-focus-ring, #17707f);
  outline-offset: 2px;
}

.layout { display: grid; grid-template-columns: var(--aos-sidebar) 1fr; min-height: 100vh; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } .sidebar { display: none; } }

/* ---------- sidebar: the ink family with a fill ---------- */
.sidebar {
  border-right: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  background: var(--tcrn-color-surface-panel, #fff);
  padding: 14px 10px;
  display: flex; flex-direction: column; gap: 18px;
}
.brand { font-weight: 650; letter-spacing: .02em; padding: 4px 10px 10px; }
.navgroup { display: flex; flex-direction: column; gap: 1px; }
.navgroup h2 {
  font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--tcrn-color-text-muted, #8a8c93); margin: 10px 10px 4px; font-weight: 600;
}
.navitem {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 10px; border-radius: var(--aos-radius);
  color: var(--tcrn-color-text-secondary, #55575e);
  text-decoration: none; background: transparent;
}
.navitem:hover { background: var(--aos-selection-fill-hover); color: var(--tcrn-color-text-primary, #1c1d21); }
.navitem[aria-current="page"] {
  background: var(--aos-selection-fill);
  color: var(--tcrn-color-text-primary, #1c1d21);
  font-weight: 600;
}
.count {
  font-variant-numeric: tabular-nums; font-size: 12px;
  background: var(--tcrn-color-surface-muted, #f2f2f0);
  color: var(--tcrn-color-text-muted, #8a8c93);
  border-radius: 999px; padding: 0 7px;
}
.navitem[aria-current="page"] .count {
  background: var(--tcrn-color-surface-panel, #fff);
  color: var(--tcrn-color-text-primary, #1c1d21);
  font-weight: 650;
  box-shadow: 0 0 0 1px var(--tcrn-color-border-subtle, #e7e7e3);
}

/* ---------- header: the one place scope is chosen ---------- */
.main { display: flex; flex-direction: column; min-width: 0; }
.topbar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 20px; border-bottom: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  background: var(--tcrn-color-surface-panel, #fff);
}
.scope { position: relative; }
.scope > summary {
  list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--tcrn-color-border-control, #8e8e88);
  border-radius: var(--aos-radius); padding: 5px 10px; background: transparent;
}
.scope > summary::-webkit-details-marker { display: none; }
.scope .label { color: var(--tcrn-color-text-muted, #8a8c93); font-size: 12px; }
.scope .value { font-weight: 600; }
.scope-menu {
  position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; min-width: 260px;
  background: var(--tcrn-color-surface-panel, #fff);
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  border-radius: var(--aos-radius); padding: 4px; box-shadow: 0 8px 28px -14px rgba(0,0,0,.4);
  max-height: 320px; overflow-y: auto;
}
.scope-menu a {
  display: flex; justify-content: space-between; gap: 10px; padding: 6px 8px;
  border-radius: 4px; text-decoration: none; color: var(--tcrn-color-text-secondary, #55575e);
}
.scope-menu a:hover { background: var(--aos-selection-fill-hover); }
.scope-menu a[aria-current="true"] { background: var(--aos-selection-fill); color: var(--tcrn-color-text-primary, #1c1d21); font-weight: 600; }
.scope-menu hr { border: 0; border-top: 1px solid var(--tcrn-color-border-subtle, #e7e7e3); margin: 4px 0; }
.spacer { flex: 1 1 auto; }

.content { padding: 18px 20px 60px; min-width: 0; }
h1 { font-size: 20px; margin: 0 0 4px; }
.page-intro { color: var(--tcrn-color-text-secondary, #55575e); margin: 0 0 16px; }

/* ---------- the filter face: two rows, ~96px ---------- */
.filterface { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.viewtabs {
  display: flex; gap: 2px; padding: 3px; overflow-x: auto;
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  border-radius: 10px; align-self: flex-start; max-width: 100%;
}
.viewtabs a {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  padding: 4px 10px; min-height: 30px; border-radius: 7px;
  text-decoration: none; color: var(--tcrn-color-text-secondary, #55575e); background: transparent;
}
.viewtabs a:hover { background: var(--aos-selection-fill-hover); }
.viewtabs a[aria-current="true"] { background: var(--aos-selection-fill); color: var(--tcrn-color-text-primary, #1c1d21); font-weight: 600; }

.conditions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.searchform { display: flex; flex: 1 1 240px; max-width: 430px; }
.searchform input {
  width: 100%; height: 34px; padding: 0 10px; font: inherit;
  border: 1px solid var(--tcrn-color-border-control, #8e8e88);
  border-radius: var(--aos-radius); background: var(--tcrn-color-surface-panel, #fff);
  color: inherit;
}
.searchform input[data-set="true"] { border-color: var(--tcrn-color-text-primary, #1c1d21); font-weight: 600; }
.dropdown { position: relative; }
.dropdown > summary {
  list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 34px;
  padding: 0 10px; border: 1px solid var(--tcrn-color-border-control, #8e8e88);
  border-radius: var(--aos-radius);
}
.dropdown > summary::-webkit-details-marker { display: none; }
.dropdown[data-set="true"] > summary { border-color: var(--tcrn-color-text-primary, #1c1d21); }
.dropdown[data-set="true"] > summary .value { font-weight: 600; color: var(--tcrn-color-text-primary, #1c1d21); }
.dropdown .label { font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); }
.dropdown-menu {
  position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; min-width: 220px;
  background: var(--tcrn-color-surface-panel, #fff);
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  border-radius: var(--aos-radius); padding: 4px; box-shadow: 0 8px 28px -14px rgba(0,0,0,.4);
  max-height: 320px; overflow-y: auto;
}
.dropdown-menu a {
  display: flex; justify-content: space-between; gap: 10px; padding: 5px 8px;
  border-radius: 4px; text-decoration: none; color: var(--tcrn-color-text-secondary, #55575e);
}
.dropdown-menu a:hover { background: var(--aos-selection-fill-hover); }
.dropdown-menu a[aria-current="true"] { background: var(--aos-selection-fill); color: var(--tcrn-color-text-primary, #1c1d21); font-weight: 600; }
.vr { width: 1px; height: 22px; background: var(--tcrn-color-border-subtle, #e7e7e3); }
.tally { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--tcrn-color-text-muted, #8a8c93); }
.tally b { color: var(--tcrn-color-text-primary, #1c1d21); font-weight: 650; }

/* Third row only when a non-default condition is applied. */
.applied { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.applied .lead { font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); }
.chip {
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  border-radius: 999px; padding: 2px 8px 2px 10px; font-size: 12px;
  color: var(--tcrn-color-text-secondary, #55575e);
  background: var(--tcrn-color-surface-panel, #fff);
}
.chip .x { color: var(--tcrn-color-text-muted, #8a8c93); }
.chip:hover { border-color: var(--tcrn-color-state-blocked, #b3271e); color: var(--tcrn-color-state-blocked, #b3271e); }
.chip:hover .x { color: inherit; }
.resetlink { font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); }

/* ---------- lists: the ink family with a border ---------- */
.rows { display: flex; flex-direction: column; gap: 6px; }
.row {
  display: grid; grid-template-columns: 132px 1fr max-content; gap: 12px; align-items: center;
  padding: 9px 12px; text-decoration: none;
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  border-radius: var(--aos-radius);
  background: var(--tcrn-color-surface-panel, #fff);
  color: inherit;
}
.row:hover { border-color: var(--tcrn-color-border-strong, #cfcfc9); }
.row[aria-current="true"] { border-color: var(--tcrn-color-text-primary, #1c1d21); }
.row[aria-current="true"] .row-title { font-weight: 600; }
.row-key { font-family: var(--tcrn-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12.5px; color: var(--tcrn-color-text-muted, #8a8c93); }
.row-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-meta { display: flex; gap: 6px; align-items: center; }
@media (max-width: 700px) { .row { grid-template-columns: 1fr; gap: 4px; } .row-meta { flex-wrap: wrap; } }

.pill {
  font-size: 11.5px; padding: 1px 7px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  color: var(--tcrn-color-text-secondary, #55575e);
  background: var(--tcrn-color-surface-muted, #f2f2f0);
}
.pill[data-tone="done"] { color: var(--tcrn-color-state-ready, #15693a); background: var(--tcrn-color-state-ready-bg, #eaf2ec); border-color: transparent; }
.pill[data-tone="active"] { color: var(--tcrn-color-state-warning, #8a5a08); background: var(--tcrn-color-state-warning-bg, #f5eee1); border-color: transparent; }
.pill[data-tone="blocked"] { color: var(--tcrn-color-state-blocked, #b3271e); background: var(--tcrn-color-state-blocked-bg, #f7eae8); border-color: transparent; }

/* ---------- panels, forms, tables ---------- */
.panel {
  border: 1px solid var(--tcrn-color-border-subtle, #e7e7e3);
  border-radius: var(--aos-radius);
  background: var(--tcrn-color-surface-panel, #fff);
  padding: 14px 16px; margin-bottom: 14px;
}
.panel h2 { font-size: 14px; margin: 0 0 10px; }
.grid2 { display: grid; grid-template-columns: 1fr 340px; gap: 14px; align-items: start; }
@media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }

label { display: block; font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); margin-bottom: 3px; }
input[type="text"], input[type="password"], input[type="search"], select, textarea {
  width: 100%; font: inherit; padding: 7px 9px; color: inherit;
  border: 1px solid var(--tcrn-color-border-control, #8e8e88);
  border-radius: var(--aos-radius);
  background: var(--tcrn-color-surface-panel, #fff);
}
textarea { min-height: 140px; resize: vertical; font-family: var(--tcrn-font-family-mono, ui-monospace, Menlo, monospace); font-size: 13px; }
.field { margin-bottom: 10px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
button {
  font: inherit; cursor: pointer; padding: 7px 13px; border-radius: var(--aos-radius);
  border: 1px solid var(--tcrn-color-border-control, #8e8e88);
  background: var(--tcrn-color-surface-panel, #fff); color: inherit;
}
button[data-variant="primary"] {
  background: var(--tcrn-color-brand-primary, #17707f); border-color: var(--tcrn-color-brand-primary, #17707f);
  color: var(--tcrn-color-text-inverse, #fafaf9); font-weight: 600;
}
button[disabled] { opacity: .55; cursor: not-allowed; }
.reason { font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); }

.kv { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; font-size: 13px; }
.kv dt { color: var(--tcrn-color-text-muted, #8a8c93); }
.kv dd { margin: 0; }
.prose { white-space: pre-wrap; }

.feed { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.feed li { list-style: none; display: flex; gap: 10px; align-items: baseline; }
.feed .when { color: var(--tcrn-color-text-muted, #8a8c93); font-variant-numeric: tabular-nums; white-space: nowrap; }
.feed ul { margin: 0; padding: 0; }

.notice {
  border: 1px solid var(--tcrn-color-state-warning, #8a5a08);
  background: var(--tcrn-color-state-warning-bg, #f5eee1);
  color: var(--tcrn-color-state-warning, #8a5a08);
  border-radius: var(--aos-radius); padding: 10px 12px; margin-bottom: 14px;
}
.error {
  border: 1px solid var(--tcrn-color-state-blocked, #b3271e);
  background: var(--tcrn-color-state-blocked-bg, #f7eae8);
  color: var(--tcrn-color-state-blocked, #b3271e);
  border-radius: var(--aos-radius); padding: 10px 12px; margin-bottom: 14px;
}
.empty { color: var(--tcrn-color-text-muted, #8a8c93); padding: 18px 2px; }
.truncation { font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); margin-top: 10px; }
.unread { font-style: normal; color: var(--tcrn-color-text-muted, #8a8c93); }

.login { max-width: 360px; margin: 12vh auto; }
.breadcrumb { font-size: 12.5px; color: var(--tcrn-color-text-muted, #8a8c93); margin-bottom: 6px; }
.breadcrumb a { text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
`;
