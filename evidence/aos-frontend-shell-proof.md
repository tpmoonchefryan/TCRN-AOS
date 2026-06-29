# AOS Frontend Shell Proof

Status: current first frontend shell changes-requested repair slice. PM/browser QA is still required before any owner-facing return.

Current disposition:

- `apps/web/src/**` renders a static React AOS shell during `pnpm build`.
- The local service serves `/`, `/cockpit`, `/work`, and legacy compatibility aliases as shell HTML.
- `/api/health`, `/api/readback`, and `/api/policy` remain backend JSON readbacks.
- `/api/cockpit` remains deferred with `410 aos_cockpit_api_deferred`; the shell Cockpit is dummy-only and not final aggregation.
- The shell consumes public TCRN Design System packages: `@tcrn/ui-react`, `@tcrn/ui-tokens`, and `@tcrn/ui-copy-state`.
- The shell consumes the registered DS `ProductShell`, `ProductShellSearch`, and `useProductShellController` semantic boundary; AOS no longer owns wrapper event delegation for shell controls.
- The shell now maps its rendered route/state proof to the accepted DS Storybook visual-instance oracle `aos-frontend-shell-slice` at `components.html#aos-frontend-shell-slice` on DS `1531f96c0cfb2aacf570e2b1ffb9c0d8224605b2`.
- `pnpm aos:frontend-shell-proof` compares AOS route states against the accepted variants: `desktop-light-expanded-cockpit-search-results`, `desktop-light-expanded-cockpit-search-rest`, `desktop-dark-expanded-cockpit`, `desktop-light-collapsed-work`, `mobile-dark-work-stacked`, and `reduced-motion`.
- Owner-review Cockpit rest routes (`/`, `/cockpit`, `/cockpit?locale=en&theme=light`, and post-search-dismissal from `/cockpit?locale=en&theme=light&collapsed=false&search=shell`) normalize to `desktop-light-expanded-cockpit-search-rest`; the proof fails if those reviewed states emit `aos-route-state-outside-accepted-oracle-matrix`.
- Theme control is compact, circular, icon-only, and explicit; locale control uses a globe trigger and native names, closes on selection/outside pointer/Escape, and returns focus on keyboard or selection dismissal; shell search expands on focus, collapses on blur/outside pointer/Tab, and has real local result activation through the DS search callback.
- Side navigation uses the DS ProductShell package boundary with a keyboard-accessible collapse/expand control, local collapsed-state storage callback, expanded desktop first-load posture, and DS mobile stacked posture.
- The proof banner and no-overclaim alert are rendered as spaced shell rows, not concatenated debug text. Dark mode uses a single coherent shell theme and a readable warning surface.
- Visible primary navigation is limited to the admitted dummy Cockpit and Work entries. Legacy aliases remain compatibility routes only and are not registered product IA.
- The visible product brand uses the registered Design System `ShellBrandLockup` and `tcrn-brand-mark.svg`; deprecated local AOS wordmark/favicon assets are absent from shell HTML, dist assets, and current docs.
- Backend readback uses DS readback/key-value/evidence surfaces first; raw JSON is secondary disclosure, not the primary Cockpit UX.
- `pnpm aos:frontend-shell-proof` writes non-committed QA screenshots under `/tmp/tcrn-aos-shell-qa/` for desktop Cockpit/default, desktop collapsed, desktop dark Work, and mobile dark Work states.

No-overclaim:

- No final Cockpit implementation.
- No Product UI acceptance, Product Design final acceptance, release readiness, hosted deployment readiness, live dispatch, external queue, publication, package publication, or product acceptance is claimed.
- Planned modules remain deferred until later routed implementation and are not visible primary navigation or registered module cards in this slice.

Verification entrypoint:

```sh
pnpm aos:frontend-shell-proof
```
