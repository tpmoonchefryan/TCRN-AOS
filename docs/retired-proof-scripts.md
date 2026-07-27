# Retired proof scripts

A proof script that cannot run is not a weaker proof, it is a false one: the receipt on
disk still reads `ok: true`, and nothing signals that the run behind it can no longer be
reproduced. Three scripts were retired under `TCRN-AOS-INC-002` for that reason. This file
is the record the convention requires — a deletion needs its reason stated as much as a
replacement does.

## Why these three could not simply be repointed

All three read inputs from a sibling directory named `TCRN Workflow` (space, not hyphen)
that was archived to a private Legacy repository and deleted from this machine on
2026-07-20. The deletion was deliberate: keeping a second, older governance tree beside
the current one invites the two being mixed up, in particular by lower-capability models
that might read stale governance and act on it. The current engine, `tcrn-workflow/`, is
not a rename of that tree and does not contain the files these scripts read — no
`.context/`, no `vault/`.

So repointing was not available, and re-cloning the archive to satisfy a checker would
reinstate exactly the hazard the deletion removed. Four sibling scripts *were* repaired
instead of retired, because their dependency was shallower; that split is recorded at the
bottom.

## Retired

### `phase4-pilot-vault-import-proof.mjs`

Read a 102-file documentation package at
`TCRN Workflow/vault/initiatives/cross-project/active/tcrn-aos-product-foundation` and
proved it could be imported into AOS records without duplication. Failed at
`pilot_vault_import_source_package_missing`.

Beneficiary list: empty. The package existed only in the archived tree; nothing in this
repository imports a vault, and the import path it exercised has no product caller — no
`sourceRecordId` type exists in any package. Its assertions are pinned to that specific
package (`files.length === 102`), so they are not portable to another input even in
principle.

### `phase4-crew-reduction-ai-employees-seed-proof.mjs`

Projected 19 routeable threads and 9 archived ones out of
`.context/platform/thread-registry/long-lived-threads.json` into `aos_ai_employees`.
Failed on ENOENT against that file.

Beneficiary list: empty. Its assertions hard-code that registry's exact census — 19 rows,
9 archived, 18 active, 1 current thread, 5 default crew, 14 parked — so the script is a
statement about one vanished file rather than about the projection. The projection code it
exercised, `AosSqliteRepository.projectThreadRegistryEmployees`, keeps its coverage in
`packages/db/test/phase1-sqlite-repository.test.mjs`, which asserts canonical merge,
duplicate-thread-id absence, second-seed no-op, and job-title preservation against a
fixture it owns.

### `execution-ledger-proof.mjs`

Projected `ds2-plan-projection-manifest.json` from
`.context/platform/plans/evidence/2026-07-10-workflow-aos-execution-control-repair/`,
then drove a guarded story transition through the execution-ledger CLI. Failed at
`cli_manifest_invalid_json` — the read failed and the CLI reported it as malformed input,
which is worth noting on its own: a missing file and a corrupt file were indistinguishable
from the exit code.

Beneficiary list: empty. It required one story id, `story_0166649b9d7fd061`, that only
that manifest produces. Both halves of what it proved are covered by tests with their own
fixtures: `packages/domain/test/execution-ledger-cli.test.mjs` (guarded transition,
restart persistence, event-key reuse, argument rejection — 15 assertions) and
`packages/domain/test/plan-projection.test.mjs` plus `plan-project-cli.test.mjs`. Neither
`execution-ledger-cli-core.mjs` nor `plan-project-cli-core.mjs` was touched; both are
still exercised by `scripts/plan-project-cli-proof.mjs`, which carries its own manifest
and passes.

## What was repaired instead

- `plan-projection-proof.mjs` — read the engine HEAD only to stamp a basis into its
  receipt. Repointed to `tcrn-workflow/`; green and re-runnable.
- `phase1-persistence-proof.mjs` — eleven receipts, of which one needed the registry.
  Reading it unconditionally killed the other ten. The projection is now conditional on
  `TCRN_AOS_THREAD_REGISTRY`, and its receipt distinguishes not-read from empty rather
  than reporting zero rows as a projection that ran.
- `d3-real-dogfood-workload-proof.mjs`, `d4-friction-capture-proof.mjs` — named a parity
  receipt under the retired tree in a record field that nothing ever opened. The field now
  states the absence. Both were already green once `d2-runtime-profile-activation-proof`
  had run; their apparent breakage was an undeclared prerequisite, not rot.

## Prerequisite order, now stated

`d3` and `d4` require an activated D2 runtime profile root and fail closed without one
(`d3_default_d2_runtime_profile_root_missing`). Run
`pnpm d2:runtime-profile-activation-proof` first. It is idempotent.
