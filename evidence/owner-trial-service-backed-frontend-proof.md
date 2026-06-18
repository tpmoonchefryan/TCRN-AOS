# Owner Trial Service-Backed Frontend Proof

## Scope

- Route: `AOS-owner-trial-vm-retained-preview-preflight` / `59AH`.
- Purpose: prove the owner-trial Operations Cockpit is no longer only service-served static/fixture HTML.
- Boundary: local/VM owner-trial frontend proof only. This is not GitHub publication, release readiness, product acceptance, final MVP acceptance, live dispatch, terminal-return ingestion execution, registry/generated bridge mutation, broad Codex Security completion, broad DPC completion, or Owner Intent execution.

## Implementation Readback

- Added service-backed cockpit read model endpoint: `/api/cockpit`.
- Root cockpit route renders from the service runtime/store read model and marks the shell with `data-service-backed="true"` and `data-cockpit-api="/api/cockpit"`.
- Client bootstrap, refresh, and Work Index row selection fetch `/api/cockpit`.
- Search no-match state is visible via `data-empty-state`.
- Unavailable owner-trial actions are disabled instead of inert: gate request, stage/role/evidence detail, gate work order, rework request, inactive nav, and column customization.
- Favicon is inlined as a data URI to avoid page-level 404 console noise.

## Command Proof

- `pnpm build`: passed.
- Focused tests: `node --test apps/api/test/service-smoke.test.mjs apps/web/test/cockpit-view.test.mjs`: 5 pass / 0 fail.
- `pnpm service:smoke`: passed. The smoke output now includes the service-backed cockpit API readback:
  - `cockpit.ok=true`
  - `cockpit.serviceBacked=true`
  - `cockpit.localCheckpoint=owner-trial-service-readback`
  - `cockpit.workRows=1`
  - `cockpit.productAcceptance=false`
  - `cockpit.finalMvpAcceptance=false`

## Browser Proof

Browser proof used system Google Chrome through Playwright against temporary local service `http://127.0.0.1:4327/`; the service was stopped and runtime reset after proof.

- Desktop viewport: `1440x900`.
- Mobile viewport: `390x844`.
- Initial desktop readback:
  - `serviceBacked=true`
  - `apiPath=/api/cockpit`
  - drawer title `Prove local runtime persistence`
  - `rowCount=1`
  - `disabledButtons=16`
  - body/page overflow `false`
- Interaction readback:
  - initial load, refresh, and Work Index row click produced three `/api/cockpit?selectedType=story&selectedId=...` requests.
  - refresh updated visible service read timestamp.
  - no-match search state was visible.
  - selected row remained active and detail title stayed service-backed.
- Mobile readback:
  - `serviceBacked=true`
  - `rowCount=1`
  - body/page overflow `false`
- Console/page errors:
  - desktop: `[]`
  - mobile: `[]`

## Retained Boundaries

- Runtime data remains local fixture / ephemeral.
- `liveCodexDispatchAuthorized=false`.
- `runtimeDataCommitted=false`.
- Product acceptance and final MVP acceptance remain false/not claimed.
- GitHub push, Batch Push Gate, release/publication/Selene, Owner Intent, registry/generated bridge, terminal ingestion, and live dispatch remain out of scope.
