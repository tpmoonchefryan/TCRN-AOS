# Live Dispatch Stage B Terminal Return Ingestion

Status: fixture-mode implementation/evidence hardening ready for review.

## Scope

This checkpoint implements the AOS product-local Stage B terminal-return ingestion/readback model for the already-returned Ilya terminal packet shape. It is fixture-mode only: it creates in-memory adapter records from synthetic/redacted 59S rows and proves deterministic readback, idempotency, dedupe, replay, audit, redaction, and no-overclaim behavior.

It does not ingest the real terminal turn `019ed469-4067-7090-821b-eb19465e9f2a` as product state. It does not send a second message, retry a dispatch, execute live dispatch, mutate the thread registry, mutate generated bridges, execute terminal-return ingestion against live thread data, deploy services, mutate resources, run Selene, push, or claim product/final acceptance.

## Lineage

- Parent route: `AOS-59f-live-dispatch-dry-run-no-send-authority-packet`
- Workflow packet basis: `3aea9d069bcdaedf2a22ea6fd85ff4777d75875c`
- AOS implementation basis: `1387e38dc229856df542b6370bfb89cf87a75237`
- Source terminal turn modeled: `019ed469-4067-7090-821b-eb19465e9f2a`
- Source thread modeled: `019eb6d7-f130-70a0-8805-169cc337229b`
- Source payload digest modeled: `sha256:2daadd66db0566b59671c9ac2d968ca3f190a208e03520921e10968c67df8280`
- Implementation/evidence successor: route-carried by the current local commit; this document intentionally avoids self-referencing a future hash.

## Implemented Contract

- Record class: `StageBTerminalReturnIngestionRecord`.
- Code/storage/readback surface: `CodexIntegrationAdapter`, backed by adapter-owned in-memory records plus `AosStore.appendAudit`.
- Readback methods:
  - `getStageBTerminalReturnIngestionById(ingestionId)`
  - `listStageBTerminalReturnIngestions({ sourceThreadId, sourceTerminalTurnId, sourcePayloadDigest })`
- Required source identity:
  - schema `aos.stage_b.terminal_handoff_return.v1`
  - status `success`
  - handoff return state `return_sent`
  - request disposition `complied_without_execution`
  - send count `1`
  - retry limit `0`
  - stop gate `aos-stage-b-live-dispatch-stop-before-primitive-v1`
- Required false posture: all modeled source action/execution booleans must be false.
- Idempotency/dedupe/replay:
  - same source thread, terminal turn, and payload digest returns the existing readback only when receipt references match exactly.
  - conflicting duplicate receipt material fails closed.
- Audit/redaction:
  - audit stores count/reference metadata only.
  - raw terminal packet bodies, raw coordinator receipt bodies, raw source, secrets, raw scanner/secret-scan output, shell history, browser/keychain material, unrestricted local absolute path dumps, private evidence bodies, and overclaim payloads are rejected or not retained.

## Proof Commands

```sh
pnpm build
node --test packages/adapter-codex/test/live-dispatch-terminal-return-ingestion.test.mjs
pnpm live-dispatch:terminal-ingestion-proof
pnpm verify
```

The Stage B terminal-ingestion proof is included in `pnpm verify`.

## Non-Claims

This checkpoint does not claim real ingestion of terminal turn `019ed469-4067-7090-821b-eb19465e9f2a`, live dispatch, real thread send, second send, retry, thread registry mutation, generated bridge mutation, thread-management primitive execution, deployment/runtime execution, resource mutation, Owner Intent execution, Codex Security completion, Defensive Programming Calibration completion, product acceptance, final MVP acceptance, release readiness, publication, Selene closeout, push, or Stage B execution readiness.
