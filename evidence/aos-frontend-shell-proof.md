# AOS Frontend Shell Proof

Status: current owner-quality frontend shell implementation/proof slice. PM/browser QA is still required before any owner-facing return.

Current disposition:

- `apps/web/src/**` renders a static React AOS shell during `pnpm build`.
- The local service serves `/`, `/cockpit`, `/work`, the static Work Management mockup route set, and legacy compatibility aliases as shell HTML.
- `/api/health`, `/api/readback`, and `/api/policy` remain backend JSON readbacks.
- `/api/cockpit` remains deferred with `410 aos_cockpit_api_deferred`; the shell Cockpit is dummy-only and not final aggregation.
- The shell consumes public TCRN Design System packages: `@tcrn/ui-react`, `@tcrn/ui-tokens`, and `@tcrn/ui-copy-state`.
- The shell consumes the registered DS `ProductShell`, `ProductLogo`, `tcrnProductLogoRegistry`, and `useProductShellController` semantic boundary; AOS no longer owns wrapper event delegation for shell controls.
- AOS intentionally omits topbar/global `ProductShellSearch` because no real AOS global search capability exists. The proof fails if an inert search box, Ctrl+K shortcut, search-results surface, or search-result activation claim appears in the AOS owner-quality shell.
- Locale persistence is URL-canonical: `locale` in the current route query is the authority, language selection updates the current URL while preserving supported params such as `theme` and `collapsed`, and refresh preserves the selected language through the URL. Cookies and hidden localStorage locale fallback are not the primary locale source.
- Work Management mockups are static fixture pages only. The proof fails if the Work mockup route set drops its static fixture/no API/no live dispatch/hierarchy markers or if rendered Work mockups request `/api/work`, `/api/gates`, `/api/evidence`, `/api/codex-activity`, or `/api/routes`.
- Static Work Management mockup routes currently covered by service and browser proof are `/work`, `/work/board`, `/work/backlog`, `/work/items/AOS-128`, `/work/gates`, `/work/evidence`, `/work/codex-activity`, `/work/views/owner-feedback`, and `/work/initiatives/work-management-mvp`.
- The Work Management mockup hierarchy follows the PRD: Initiative > Epic > Story > Task / Work Item > Subtask / Evidence Task. Rendered mockup copy explicitly states that Story is the smallest acceptable human/business/workflow result, Task / Work Item is the smallest executable ticket/task unit, and Codex Activity is execution/evidence context attached to Work Items, not a replacement for Story or Task / Work Item.
- The static Work Management proof fails unless the rendered route set includes the PRD relationship vocabulary: `blocks`, `blocked_by`, `depends_on`, `relates_to`, `duplicates`, `supersedes`, `split_from`, `caused_by`, `implements`, `verifies`, `reviews`, and `refreshes`.
- The shell maps its rendered route/state proof to the accepted DS Storybook owner-quality visual-instance oracle `aos-owner-quality-product-shell` at `components.html#aos-owner-quality-product-shell` from the current local DS package basis.
- `pnpm aos:frontend-shell-proof` compares AOS route states against the accepted owner-quality variants that AOS still claims after removing global search: `desktop-light-operations-cockpit`, `desktop-light-operations-cockpit-collapsed`, `desktop-dark-operations-cockpit`, `desktop-dark-operations-cockpit-collapsed`, `desktop-light-work-queue`, `desktop-light-work-queue-collapsed`, `mobile-dark-zh-cn-work-queue`, and `reduced-motion`.
- The mobile zh-CN Work proof fails closed unless the owner-quality first viewport includes `仅本地证明` with the other required zh-CN work/state labels and without the forbidden English state labels.
- The mobile Work proof records html/body, `tcrn-product-shell-content-stack`, `tcrn-product-shell-section-grid`, and table-shell overflow metrics; page-level horizontal overflow fails, while table-local scrolling remains allowed only inside table scrollers.
- Owner-review Cockpit and Work routes (`/`, `/cockpit`, `/cockpit?locale=en&theme=light`, `/cockpit?locale=en&theme=light&collapsed=true`, `/cockpit?locale=en&theme=dark`, `/cockpit?locale=en&theme=dark&collapsed=true`, `/work?locale=en&theme=light`, `/work?locale=en&theme=light&collapsed=true`, `/work?locale=zh-CN&theme=dark`, unsupported-search-param canonicalization from `/cockpit?locale=en&theme=light&collapsed=false&search=gate`, and side-nav toggle from Cockpit) map to accepted owner-quality variants; the proof fails if reviewed states emit `aos-route-state-outside-owner-quality-oracle`.
- Theme control is compact, circular, icon-only, and explicit; locale control uses a globe trigger and native names, closes on selection/outside pointer/Escape, returns focus on keyboard or selection dismissal, and updates the URL `locale` query as the persistence source.
- Side navigation uses the DS ProductShell package boundary with an actionable desktop collapse/expand control, local collapsed-state storage callback, admitted expanded/collapsed desktop variants, Enter/Space keyboard activation proof in both directions, 280px/92px rail proof, icon center proof, and a DS mobile stacked posture with the mobile collapse affordance hidden until mobile collapsed variants are admitted.
- The proof banner and no-overclaim alert are rendered as spaced shell rows, not concatenated debug text. Dark mode uses a single coherent shell theme and a readable warning surface.
- Visible primary navigation is limited to the admitted Cockpit and Work entries. Legacy aliases remain compatibility routes only and are not registered product IA.
- The visible product brand uses the registered Design System AOS product logo asset `tcrn-aos-two-line` through `ProductShell`/`ShellBrandLockup`/`ProductLogo`: line one `TCRN AOS`, line two `AI Operation System`. Deprecated local AOS wordmark/favicon assets and text-composed `Rebuild workspace` brand captions are absent from shell HTML, dist assets, and current docs.
- Backend readback uses DS readback/key-value/evidence surfaces first; raw JSON is secondary disclosure, not the primary Cockpit UX.
- `pnpm aos:frontend-shell-proof` writes non-committed QA screenshots under `/tmp/tcrn-aos-shell-qa/` for owner-quality desktop Cockpit/default, desktop side-nav collapse, desktop Work, mobile dark Work, every desktop static Work Management mockup route, and one mobile zh-CN static Work graph route.

No-overclaim:

- No final Cockpit implementation.
- No Product UI acceptance, Product Design final acceptance, release readiness, hosted deployment readiness, live dispatch, external queue, publication, package publication, or product acceptance is claimed.
- Planned modules remain deferred until later routed implementation and are not visible primary navigation or registered module cards in this slice.

Verification entrypoint:

```sh
pnpm aos:frontend-shell-proof
```
