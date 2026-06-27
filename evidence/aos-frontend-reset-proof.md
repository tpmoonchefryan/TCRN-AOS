# AOS Frontend Reset Proof

Status: current AOS frontend code removed.

Owner directive: all existing AOS frontend implementation is invalid for product use and must be restarted only after owner-led design review.

Current disposition:

- `apps/web` is removed.
- Static product UI routes are gone from the local service and return `410` with `aos_frontend_removed`.
- `/api/cockpit` is gone because it was a service-backed frontend read-model endpoint.
- React, React DOM, and TCRN Design System runtime frontend dependencies are removed from the AOS package manifest.
- Previous browser, Storybook-standard, Design-System-consumer, and product-design visual receipts are removed from current evidence.
- Backend/domain/API/database/MCP/adapter proofs remain in scope.

No-overclaim:

- No replacement frontend exists in this checkpoint.
- No Product UI acceptance, Product Design acceptance, release readiness, hosted deployment readiness, live dispatch, publication, or product acceptance is claimed.
- Any future AOS frontend, reusable visual pattern, Storybook entry, or Design System truth requires explicit Owner Review before registration or consumption.

Verification entrypoint:

```sh
pnpm aos:frontend-reset-proof
```
