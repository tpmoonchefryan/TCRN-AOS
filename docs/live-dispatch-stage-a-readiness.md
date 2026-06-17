# Live Dispatch Stage A Readiness

Status: local implementation/evidence hardening ready for review.

## Scope

This Stage A checkpoint models real live-dispatch envelope eligibility and terminal-return readiness as local validation data only. It does not execute a live send, ingest a terminal return as product behavior, mutate thread registry records, mutate generated bridge files, or perform any thread-management primitive.

Stage B remains held for a later exact execution packet, fresh registry readback, Sable/Codex Security/DPC/Ariadne/Verity/Rowan convergence, and Owner Intent.

## Lineage

- Parent route: `AOS-59f-live-dispatch-dry-run-no-send-authority-packet`
- Workflow packet basis: `e3a0c96ed322c7f9110f7494934c63fe0c85de4e`
- Pre-implementation AOS basis: `e2e856ad6d57f06f4c8ff32dc33d83a92b5ca989`
- Implementation checkpoint: `20ad014d44705d57b5ee45eaa282e5c8fbea6ae1` (`feat: add AOS live dispatch Stage A readiness`)
- Initial evidence/docs checkpoint: `6b840e0de053bd6f1019f7a4d800ded00bc17b51` (`docs: record AOS live dispatch Stage A proof`)
- Post-review repair checkpoint: route-carried by the current local successor; this document intentionally avoids self-referencing a future commit hash.

## Implemented Contract

- Versioned Stage A envelope: `aos-real-live-dispatch-stage-a-v1`.
- Dispatch modes accepted for Stage A: `blocked_without_owner_intent`, `implementation_readiness`.
- `live_send` remains blocked without Owner Intent execution authority.
- Target readback accepts only active, successor-confirmed active successor, and route-authorized temporary lane fixtures.
- Target readback fails closed for stale, archived, predecessor, replacement-named, successor-unresolved, missing, unknown, systemError, no-return, commentary-only, conflicting-status, owner-human, and malformed target states.
- Target readback also requires an exact role match, a nonblank canonical thread name, and a fresh parseable readback timestamp before active, successor, or temporary-lane targets can be accepted.
- Payload digests, original terminal packet checksums, and coordinator-consumed receipt checksums require canonical `sha256:<64 hex>` format.
- Terminal return readiness requires terminal turn id, original terminal packet reference/checksum, coordinator-consumed receipt reference/checksum, valid source/target/coordinator identity, accepted status, and contract-valid handoff return state.
- Duplicate-send prevention and replay linking happen before any future send primitive eligibility check.

## Proof Commands

```sh
pnpm build
node --test packages/adapter-codex/test/live-dispatch-stage-a-readiness.test.mjs
pnpm live-dispatch:execution-readiness-proof
pnpm verify
```

The Stage A proof is included in `pnpm verify`.

## Non-Claims

This checkpoint does not claim real live dispatch, external thread message creation, terminal-return ingestion execution, thread registry mutation, generated bridge mutation, thread-management primitive execution, deployment/runtime execution, product acceptance, final MVP acceptance, release readiness, Owner Intent execution, Codex Security scan completion, Defensive Programming Calibration completion, Selene closeout, push, or Stage B readiness.
