# Source Export Prerequisite Proof Receipt

Status: product-local 59AD source/export prerequisite review repair ready for Sable/Codex Security and DPC re-review.

## Lineage

- Parent route: `AOS-59f-live-dispatch-dry-run-no-send-authority-packet`
- Route: `route_59ad_source_export_prerequisite_review_repair`
- Workflow basis: `356f36b6f3e859801138e714d1476de751512434` (`docs: repair AOS 59AE current status`)
- AOS repair basis: `cd9abd9def734fb290d539d8fd2d193fbb5504c8` (`feat: add AOS source export prerequisite proof`)
- Implementation checkpoint: route-carried by this successor; this receipt intentionally does not self-reference a future hash.

## Review Findings Repaired

- Sable / `TCRN-AOS-59AD-001`: source-export forbidden matcher now rejects representative sensitive path classes for secret, credential, password, token, auth/session, cookie, keychain, shell history, raw scanner output, and raw secret-scan output.
- DPC / `DPC-59AD-001`: clean export candidate content is materialized from the reported Git commit object, not from live working-tree files. Dirty tracked/index state is reported rather than silently exported.
- DPC / `DPC-59AD-002`: proof output now emits the computed `rawSourceArchiveAllowed` predicate and fails closed if this route no longer observes raw-source blockers.
- DPC / `DPC-59AD-003`: deterministic digest proof now uses tracked path, mode, and Git blob object identity from the commit tree, avoiding platform-specific tar metadata.
- DPC / `DPC-59AD-004`: cleanup readback treats only `ENOENT` as removed; other cleanup/readback errors are ambiguous and fail closed.
- DPC / `DPC-59AD-005`: retained receipt records the deterministic digest row below.

## Root Cause

Atlas stopped before source transfer because the raw AOS checkout was Git-clean but still contained ignored/nontracked forbidden candidates. Local readback reproduced the same class:

- `git status --ignored --short` compressed the ignored set to `!! dist/` and `!! node_modules/`.
- `git ls-files --others --ignored --exclude-standard -z` counted `314` ignored candidates.
- `git ls-files --others --exclude-standard -z` counted `0` untracked candidates before implementation.

The repair does not delete those ignored checkout artifacts. Instead, it proves that the raw checkout remains blocked and that only a separately constructed clean export candidate is eligible for future source-transfer review.

## Implemented Scope

- Updated `scripts/source-export-prerequisite-proof.mjs`.
- Preserved `pnpm source-export:proof` as the focused route-bound command.
- Updated product-local docs/security/evidence readbacks for the source/export prerequisite.
- The focused command creates a route-owned temporary candidate from tracked allowlist paths, excludes `evidence/**`, creates a local archive only from the verified candidate, records a deterministic manifest digest, and deletes the temporary root.

## Observed Command Receipt

`pnpm source-export:proof`

- Passed for the repaired helper during implementation validation.
- `rawSourceArchiveAllowed=false`.
- `rawSourceBlockingRequired=true`; `rawSourceBlockingSupported=true`.
- Raw source blocker counts: ignored forbidden `314`, untracked forbidden `0`, tracked forbidden `0`, tracked symlink `0`.
- Visible ignored roots: `dist/`, `node_modules/`.
- Export content source: `git_commit_object`; the command reports tracked worktree/index cleanliness separately.
- Manifest readback: tracked files `163`, included files `107`, evidence excluded files `56`.
- Forbidden matcher negative rows: `10/10` rejected for secret, credential, password, token, auth/session, cookie, keychain, shell history, raw scanner output, and raw secret-scan output.
- Reviewed allowed rows: `3/3` not rejected for `docs/security-boundaries.md`, `docs/source-export-prerequisite.md`, and `packages/adapter-codex/src/adapter.ts`.
- Clean export candidate readback: files `107`, forbidden candidates `0`, evidence candidates `0`, symlinks `0`, path escapes `0`.
- Deterministic digest row: `sha256:e5a865dd7d977ae7588521156f945444e5e1fe546cc7b835c8b2b5f60b3bed0c`; material `git_tree_path_mode_blob_oid_v1`; rows `107`.
- Archive was created from the clean candidate only, retained `false`, with digest material `deterministic_git_tree_manifest`.
- Cleanup readback: route-owned temporary root removed `true`, readback ambiguous `false`, error code `ENOENT`.
- No-overclaim booleans remained false for target-host action, source transfer, target extraction, install/build on target, service lifecycle action, `/srv` write, deployment readiness, product acceptance, and final MVP acceptance.

`pnpm verify`

- Passed after the repaired proof command and docs/evidence update.
- Component sequence: typecheck, migration validation, license audit, tests, runtime DB proof, service smoke, Slice 3 proof, Slice 4 proof, Slice 4B proof, Slice 5 proof, Slice 6 proof, Slice 7 proof, Slice 8 proof, Slice 9 proof, Slice 9B proof, Slice 10 proof, live-dispatch dry-run proof, live-dispatch execution-readiness proof, and live-dispatch terminal-ingestion proof.
- Tests: `75 pass / 0 fail`.
- License posture unchanged: runtime dependencies `[]`; dev dependencies `@types/node` MIT and `typescript` Apache-2.0; blockers `[]`.

`git diff --check` and `git diff --cached --check`

- Run before commit; both passed.

## No-Overclaim Boundaries

This checkpoint does not claim target-host execution, source transfer, target extraction, install/build on target, service start/stop, writes under `/srv`, destructive ignored-artifact cleanup, deployment/runtime readiness, release readiness, publication, Selene closeout, Batch Push Gate, live dispatch, real thread send, retry, terminal-return ingestion execution, registry/generated bridge mutation, TCRN-TMS mutation, product acceptance, final MVP acceptance, broad Codex Security completion, broad DPC completion, or Owner Intent execution.

## Remaining Blockers

- Sable/Codex Security and DPC post-repair review remain required because this route touches source-transfer/filtering/private-evidence/security-sensitive fail-closed behavior.
- Rowan evidence/discoverability review remains required after review convergence if Arturo routes it.
- Atlas target-host persistent runtime proof remains held until this prerequisite and review convergence are accepted.
