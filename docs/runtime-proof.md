# Slice 2 Runtime Proof

Slice 2 adds a local-first runtime proof without deployment or persistent services.

Observed proof receipt: `../evidence/slice-2-runtime-proof.md`.

## Commands

```sh
pnpm runtime:db:proof
pnpm service:smoke
```

`pnpm verify` includes both commands after typecheck, migration validation, license audit, and tests.

The observed Slice 2 proof receipt for commit `e84410367267b47da0d2654e174a69578f91f6af` recorded `pnpm verify` passing with `16 pass / 0 fail`, runtime DB proof `ok=true`, and local service smoke proof `ok=true`.

## Runtime DB Fixture

The fixture applies the committed schema and seed into ephemeral OS-temp storage, seeds representative operational records, reads back counts and IDs, proves audit append-only behavior, rejects a restricted synthetic local-path payload, and resets the runtime data.

The fixture covers Project, Initiative, Epic, Story, subtask, comment, evidence, gate work order, Owner Intent, conference, dependency posture, resource posture, knowledge/user-guide, release-note, stage-map, and audit event records.

## Local Service Proof

The service proof starts a loopback-only HTTP server on an ephemeral port, reads `/health` and `/readback`, verifies DB connectivity and no-overclaim posture, then closes the server and resets its fixture storage.

It does not start an external queue, use Redis, dispatch Codex live, execute copied helpers, mutate another product repo, deploy, or leave a retained service.

## Traceability

- `D-024`: runtime operational data remains local-first and ephemeral; Git records source, schema, fixture seed, tests, scripts, and evidence notes only.
- `D-026`: Slice 2 runtime DB/local service proof is local-only and does not authorize deployment or acceptance claims.

## 59Z Persistent Storage Prerequisite

`pnpm runtime:persistent-proof` is a separate product-local prerequisite command for future persistent runtime proof. It uses a safe temporary route-owned root locally, keeps `/srv/tcrn/runtime/TCRN-AOS` as future target-host profile metadata only, proves synthetic write/readback, simulated restart/readback, backup/restore, ownership/permissions readback, and reset, and rejects unsafe roots before storage.

Observed receipt: `../evidence/persistent-runtime-storage-prerequisite-proof.md`.
