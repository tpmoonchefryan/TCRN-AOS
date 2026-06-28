# AOS Frontend Shell Proof

Status: current first frontend shell implementation slice.

Current disposition:

- `apps/web/src/**` renders a static React AOS shell during `pnpm build`.
- The local service serves `/`, `/cockpit`, `/work`, and legacy compatibility aliases as shell HTML.
- `/api/health`, `/api/readback`, and `/api/policy` remain backend JSON readbacks.
- `/api/cockpit` remains deferred with `410 aos_cockpit_api_deferred`; the shell Cockpit is dummy-only and not final aggregation.
- The shell consumes public TCRN Design System packages: `@tcrn/ui-react`, `@tcrn/ui-tokens`, and `@tcrn/ui-copy-state`.
- Theme control is compact, circular, icon-only, and explicit; locale control uses a globe trigger and native names, closes on selection/outside pointer/Escape, and returns focus on keyboard or selection dismissal; shell search expands on focus and has real local result behavior.
- Side navigation uses package-backed SideNav/NavGroup/NavItem surfaces with a keyboard-accessible collapse/expand control and persisted collapsed state.
- Visible primary navigation is limited to the admitted dummy Cockpit and Work entries. Legacy aliases remain compatibility routes only and are not registered product IA.
- The admitted AOS geometric wordmark from `docs/brand/tcrn-aos-wordmark-geometric-dark.png` is the visible product brand asset.
- Backend readback uses DS readback/key-value/evidence surfaces first; raw JSON is secondary disclosure, not the primary Cockpit UX.

No-overclaim:

- No final Cockpit implementation.
- No Product UI acceptance, Product Design final acceptance, release readiness, hosted deployment readiness, live dispatch, external queue, publication, package publication, or product acceptance is claimed.
- Planned modules remain deferred until later routed implementation and are not visible primary navigation or registered module cards in this slice.

Verification entrypoint:

```sh
pnpm aos:frontend-shell-proof
```
