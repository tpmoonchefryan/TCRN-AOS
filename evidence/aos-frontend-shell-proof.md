# AOS Frontend Shell Proof

Status: current first frontend shell implementation slice.

Current disposition:

- `apps/web/src/**` renders a static React AOS shell during `pnpm build`.
- The local service serves `/`, `/cockpit`, `/work`, and planned module aliases as shell HTML.
- `/api/health`, `/api/readback`, and `/api/policy` remain backend JSON readbacks.
- `/api/cockpit` remains deferred with `410 aos_cockpit_api_deferred`; the shell Cockpit is dummy-only and not final aggregation.
- The shell consumes public TCRN Design System packages: `@tcrn/ui-react`, `@tcrn/ui-tokens`, and `@tcrn/ui-copy-state`.
- Theme control is compact, circular, icon-only, and explicit; locale control uses a globe trigger and native names; shell search expands on focus and has real local result behavior.
- The AOS brand wordmark is served from `docs/brand/tcrn-aos-wordmark-geometric-dark.png`.

No-overclaim:

- No final Cockpit implementation.
- No Product UI acceptance, Product Design final acceptance, release readiness, hosted deployment readiness, live dispatch, external queue, publication, package publication, or product acceptance is claimed.
- Placeholder modules remain local structure only until later routed implementation.

Verification entrypoint:

```sh
pnpm aos:frontend-shell-proof
```
