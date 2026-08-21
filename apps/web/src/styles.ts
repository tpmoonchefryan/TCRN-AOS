/**
 * The stylesheet, served as one file.
 *
 * This file contains only AOS-owned page composition and the few controls the Design
 * System does not provide. Component ink, form controls, navigation, cards, badges,
 * breadcrumbs and the product shell come from `/assets/tcrn.css`.
 *
 * Two rules from the design record are load-bearing here and are the reason the retained
 * page CSS is not generic CSS:
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
  /* The ink is DERIVED from the text colour, never stated per theme.
   *
   * Stating it per theme is what broke it: the design system's tokens are light-only, so a
   * media query that flipped this to the dark value put a near-white ink at 6% on a
   * near-white surface, and the selected item became invisible on every browser whose user
   * prefers dark. Deriving it means the ink follows whatever the tokens say, in any theme
   * the design system grows later, with nothing here to keep in step. */
  --aos-selection-fill: color-mix(in srgb, var(--tcrn-color-text-primary, #1c1d21) 6%, transparent);
  --aos-selection-fill-hover: color-mix(in srgb, var(--tcrn-color-text-primary, #1c1d21) 3.2%, transparent);
  --aos-radius: 6px;
}

/* AOS page composition still needs a predictable box model and document canvas; the DS
   component sheet deliberately does not own the product's body margins. */
* { box-sizing: border-box; }

/* The DS does not provide a body reset or the product's Markdown canvas. */
body {
  margin: 0;
  font-family: var(--tcrn-font-family-sans, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif);
  font-size: 14px;
  line-height: 1.6;
  color: var(--tcrn-color-text-primary, #1c1d21);
  background: var(--tcrn-color-surface-canvas, #fafaf9);
}

/* ---------- AOS scope selector retained: ProductShell has no project-scope control. */
.aos-shell-actions { display: inline-flex; align-items: center; gap: 8px; }
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
/* The project scope menu has no DS count primitive; these are its compact numeric hints. */
.scope-menu .count { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); }
.spacer { flex: 1 1 auto; }

/* The shell owns the workspace surface; these are page-level headings and copy. */
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

/* ---------- AOS page composition; DS owns the controls and surfaces above. ---------- */
.grid2 { display: grid; grid-template-columns: 1fr 340px; gap: 14px; align-items: start; }
@media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }

/* DS Field/Input/Select/Textarea/Button own their labels, dimensions, focus and ink. */
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
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
/* DS EmptyState owns empty-state layout and tone. */
.truncation { font-size: 12px; color: var(--tcrn-color-text-muted, #8a8c93); margin-top: 10px; }
.unread { font-style: normal; color: var(--tcrn-color-text-muted, #8a8c93); }

.login { max-width: 360px; margin: 12vh auto; }
`;
