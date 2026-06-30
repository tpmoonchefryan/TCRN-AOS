# AOS Frontend Shell Proof

Status: current owner-quality frontend shell implementation/proof slice. PM/browser QA is still required before any owner-facing return.

Current disposition:

- `apps/web/src/**` renders a static React AOS shell during `pnpm build`.
- The local service serves `/`, `/cockpit`, `/work`, and legacy compatibility aliases as shell HTML.
- `/api/health`, `/api/readback`, and `/api/policy` remain backend JSON readbacks.
- `/api/cockpit` remains deferred with `410 aos_cockpit_api_deferred`; the shell Cockpit is dummy-only and not final aggregation.
- The shell consumes public TCRN Design System packages: `@tcrn/ui-react`, `@tcrn/ui-tokens`, and `@tcrn/ui-copy-state`.
- The shell consumes the registered DS `ProductShell`, `ProductShellSearch`, `ProductLogo`, `tcrnProductLogoRegistry`, and `useProductShellController` semantic boundary; AOS no longer owns wrapper event delegation for shell controls.
- The shell maps its rendered route/state proof to the accepted DS Storybook owner-quality visual-instance oracle `aos-owner-quality-product-shell` at `components.html#aos-owner-quality-product-shell` from the current local DS package basis.
- `pnpm aos:frontend-shell-proof` compares AOS route states against the accepted owner-quality variants: `desktop-light-operations-cockpit`, `desktop-light-operations-cockpit-collapsed`, `desktop-dark-operations-cockpit`, `desktop-dark-operations-cockpit-collapsed`, `desktop-light-work-queue`, `desktop-light-work-queue-collapsed`, `mobile-dark-zh-cn-work-queue`, `desktop-light-operations-search-results`, and `reduced-motion`.
- The mobile zh-CN Work proof fails closed unless the owner-quality first viewport includes `仅本地证明` with the other required zh-CN work/state labels and without the forbidden English state labels.
- The mobile Work proof records html/body, `tcrn-product-shell-content-stack`, `tcrn-product-shell-section-grid`, and table-shell overflow metrics; page-level horizontal overflow fails, while table-local scrolling remains allowed only inside table scrollers.
- Owner-review Cockpit and Work routes (`/`, `/cockpit`, `/cockpit?locale=en&theme=light`, `/cockpit?locale=en&theme=light&collapsed=true`, `/cockpit?locale=en&theme=dark`, `/cockpit?locale=en&theme=dark&collapsed=true`, `/work?locale=en&theme=light`, `/work?locale=en&theme=light&collapsed=true`, `/work?locale=zh-CN&theme=dark`, post-search-dismissal from `/cockpit?locale=en&theme=light&collapsed=false&search=gate`, and side-nav toggle from Cockpit) map to accepted owner-quality variants; the proof fails if reviewed states emit `aos-route-state-outside-owner-quality-oracle`.
- Theme control is compact, circular, icon-only, and explicit; locale control uses a globe trigger and native names, closes on selection/outside pointer/Escape, and returns focus on keyboard or selection dismissal; shell search expands on focus, collapses on blur/outside pointer/Tab, and has real local result activation through the DS search callback.
- Side navigation uses the DS ProductShell package boundary with an actionable desktop collapse/expand control, local collapsed-state storage callback, admitted expanded/collapsed desktop variants, Enter/Space keyboard activation proof in both directions, 280px/92px rail proof, icon center proof, and a DS mobile stacked posture with the mobile collapse affordance hidden until mobile collapsed variants are admitted.
- The proof banner and no-overclaim alert are rendered as spaced shell rows, not concatenated debug text. Dark mode uses a single coherent shell theme and a readable warning surface.
- Visible primary navigation is limited to the admitted Cockpit and Work entries. Legacy aliases remain compatibility routes only and are not registered product IA.
- The visible product brand uses the registered Design System AOS product logo asset `tcrn-aos-two-line` through `ProductShell`/`ShellBrandLockup`/`ProductLogo`: line one `TCRN AOS`, line two `AI Operation System`. Deprecated local AOS wordmark/favicon assets and text-composed `Rebuild workspace` brand captions are absent from shell HTML, dist assets, and current docs.
- Backend readback uses DS readback/key-value/evidence surfaces first; raw JSON is secondary disclosure, not the primary Cockpit UX.
- `pnpm aos:frontend-shell-proof` writes non-committed QA screenshots under `/tmp/tcrn-aos-shell-qa/` for owner-quality desktop Cockpit/default, desktop side-nav collapse, desktop Work, and mobile dark Work states.

No-overclaim:

- No final Cockpit implementation.
- No Product UI acceptance, Product Design final acceptance, release readiness, hosted deployment readiness, live dispatch, external queue, publication, package publication, or product acceptance is claimed.
- Planned modules remain deferred until later routed implementation and are not visible primary navigation or registered module cards in this slice.

Verification entrypoint:

```sh
pnpm aos:frontend-shell-proof
```
