# Slice 3 Gateway And Adapter Proof

Slice 3 proves the local control-plane path from MCP Gateway requests to Codex Adapter dry-run outbox/readback/return collection.

Observed proof receipt: `../evidence/slice-3-gateway-adapter-proof.md`.

## Commands

```sh
pnpm slice3:proof
pnpm verify
```

`pnpm verify` includes Slice 3 tests and `pnpm slice3:proof`.

## MCP Gateway

The gateway remains limited to the accepted method families:

- `aos.ticket.propose`
- `aos.ticket.comment`
- `aos.run.summary.create`
- `aos.gate.request`
- `aos.evidence.link`
- `aos.policy.read`
- `aos.conference.request`
- `aos.conference.position.record`
- `aos.stage_map.read`
- `aos.audit.query`

Write-like methods check caller identity, active thread binding, role authority, project scope, idempotency/dedupe, and restricted-content safety before runtime storage.

## Codex Adapter

The adapter creates dry-run outbox records only. It can read back stored dispatch status, collect structured returns, update linked local assignment/gate/conference records, and audit retry/stale/expiry state.

It does not send to live Codex threads, use Codex app/thread tools, mutate thread registry state, execute copied helpers, deploy, or touch product repos.

## No-Overclaim

This is backend/control-plane proof. It is not Product Design acceptance, release readiness, public readiness, product acceptance, final MVP acceptance, or legal/dependency-clean completion.
