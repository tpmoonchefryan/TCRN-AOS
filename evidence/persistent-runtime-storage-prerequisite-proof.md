# Persistent Runtime Storage Prerequisite Proof Receipt

Status: product-local 59Z persistent DB/storage prerequisite implementation ready for review.

Post-review repair status: root guard repair applied for Sable `TCRN-AOS-59Z-001` and route-local DPC findings. Explicit runtime roots now fail closed unless absent/newly-created, empty, or already route-owned with the current profile/route/run identity and matching runtime-root digest. Follow-up alias canonicalization repair applies nearest-existing-ancestor realpath identity before source-tree/wrong-sibling containment, marker digest validation, mkdir/use, and reset.

## Lineage

- Parent route: `AOS-59f-live-dispatch-dry-run-no-send-authority-packet`
- 59Z Workflow packet basis: `cbb5f8d9ab57ecf585ebd3ec9ca455b4cf4aefa8` (`docs: define AOS runtime prerequisites`)
- AOS pre-implementation basis: `1d30a10b2b47bb00cdcfd6407a4183155504b4ed` (`fix: harden AOS Stage B ingestion references`)
- Implementation checkpoint: route-carried by this successor; this receipt intentionally does not self-reference a future hash.

## Implemented Scope

- Added `aos-59z-persistent-runtime-storage-profile-v1` in `packages/db`.
- Added `pnpm runtime:persistent-proof` as a focused route-bound command.
- The local proof uses a safe OS temp route-owned runtime root and resets it after proof.
- The future target-host runtime root is metadata only: `/srv/tcrn/runtime/TCRN-AOS`.
- The proof writes only synthetic non-private operational data, then proves write/readback, simulated restart/readback, backup/restore, ownership/permissions readback, and reset.

## Observed Command Receipt

`node --test packages/db/test/persistent-runtime-profile.test.mjs`

- Passed.
- Focused persistent runtime profile tests: `4 pass / 0 fail`.
- Covered temp route-owned persistent write/readback/restart/backup/restore/reset, conflicting temp/explicit root rejection, missing root rejection, source-tree root rejection, explicit wrong-sibling rejection, symlink root rejection, symlink ancestor rejection, non-empty unowned root rejection, stale data ambiguity rejection, stale marker/root digest mismatch rejection, unowned cleanup rejection, and dangerous marked source-tree reset rejection.
- Added alias rows for case-insensitive source-tree and wrong-sibling aliases; on this Mac both rows ran and failed closed with `runtime_root_inside_git_tree` and `runtime_root_aliases_wrong_sibling`.

`pnpm runtime:persistent-proof`

- Passed.
- `ok=true`.
- `profileId=aos-59z-persistent-runtime-storage-profile-v1`.
- `futureTargetRuntimeRoot=/srv/tcrn/runtime/TCRN-AOS` as profile metadata only.
- `runtimeRootKind=safe_temp_route_owned`.
- Write/readback proof `ok=true`.
- Simulated restart/readback proof `ok=true`.
- Backup/restore proof `ok=true`, `deferralAccepted=false`.
- Ownership/permissions readback `ok=true`.
- Reset proof `runtimeDataExistsAfterReset=false`.
- Negative proof booleans all `true`: missing runtime root, conflicting temp/explicit runtime-root flags, source tree root, wrong sibling root, symlink root, symlink ancestor, non-empty unowned root, stale data ambiguity, stale marker/root mismatch, unowned cleanup, dangerous marked reset, and restricted payload.
- Alias canonicalization proof: `caseInsensitiveAliasSupported=true`, `sourceTreeAliasRejected=true`, and `wrongSiblingAliasRejected=true`.
- No-overclaim booleans remained false for target-host execution, source transfer, service start/stop, `/srv` write, runtime operational data committed to Git, raw private payload retention, product acceptance, and final MVP acceptance.

`pnpm verify`

- Passed.
- Component sequence: typecheck, migration validation, license audit, tests, runtime DB proof, service smoke, Slice 3 proof, Slice 4 proof, Slice 4B proof, Slice 5 proof, Slice 6 proof, Slice 7 proof, Slice 8 proof, Slice 9 proof, Slice 9B proof, Slice 10 proof, live-dispatch dry-run proof, live-dispatch execution-readiness proof, and live-dispatch terminal-ingestion proof.
- Tests: `75 pass / 0 fail`.
- License posture unchanged: runtime dependencies `[]`; dev dependencies `@types/node` MIT and `typescript` Apache-2.0; blockers `[]`.
- Existing runtime DB proof remained local ephemeral fixture proof; it was not relabeled as persistent readiness.

`git diff --check` and `git diff --cached --check`

- Run before commit; final terminal return records the observed status.

## No-Overclaim Boundaries

This checkpoint does not claim target-host execution, source transfer, install/build on target, service start/stop, writes under `/srv`, transfer-filter clearance, deployment/runtime readiness, release readiness, publication, Selene closeout, Batch Push Gate, live dispatch, real thread send, retry, terminal-return ingestion execution, registry/generated bridge mutation, TCRN-TMS mutation, product acceptance, final MVP acceptance, broad Codex Security completion, broad DPC completion, or Owner Intent execution.

## Remaining Blockers

- Transfer evidence filtering/allowlist strategy remains a separate prerequisite before any target-host route.
- Atlas target-host persistent runtime proof remains held until review convergence and a fresh execution packet.
