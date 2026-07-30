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

## The mirror segment, retired 2026-07-30 (`TCRN-AOS-STORY-134`)

Three more scripts, retired for a different reason than the three above: not a vanished
input, a vanished **subject**. `TCRN-AOS-MIN-012` decision 7 retired the read-only LAN
mirror because the truth host now carries a resident cockpit — a real read face rather
than a static copy of one — so the thing these three built, judged and kept fresh does
not exist. The removal and its before/after evidence are in
`evidence/aos-mirror-retirement.json`; `deploy/aos-mirror.yaml` is deliberately kept,
annotated as retired, because it is the artefact a future reader finds by searching for
`aos.tcrn.lan`.

Recoverable from git history at `0e0ca0876a04`, all three — the commit this retirement was
performed from. The removals are uncommitted working-tree changes, so that is the recovery
point and no later one.

### `build-mirror.mjs` (and `pnpm mirror:build`)

Server-rendered every cockpit route into `apps/web/mirror/` for nginx to serve from a
hostPath. Retired with its target.

Residual applicability, since deleting a builder forecloses cheap revival: the mirror's
one use the resident cockpit does not cover is a browser on the LAN with no ssh — and
that is precisely the case CONF-007 D7 prohibits, since the cockpit binds `127.0.0.1`
and every path onto it is a tunnel. The residual is foreclosed by the ruling, not waived
for convenience. A revival needs D7 re-ruled first, at which point it needs a builder
written against whatever topology that ruling describes, not this one.

The `surface: "mirror"` render path it drove is NOT retired: `cockpit-mirror-banner.tsx`
still resolves that state at runtime by probing for the service and failing to
"mirror" when nothing answers, which is what a saved copy of a page should say about
itself. Only the build-time producer went.

### `mirror-freshness-proof.mjs` (and `pnpm mirror:freshness-proof`)

Asked whether the committed bundle still equalled a rebuild from source. Its subject is
gone, so it goes — but its **slot in `pnpm verify` did not empty out**, and that
distinction is the point. This repository has the receipt for what happens otherwise:
`apps/web/mirror` fell three source commits behind while both its builder and its
acceptance gate sat in the tree unreachable from any npm script, and nothing signalled it
(`TCRN-AOS-INC-030`). Removing a thing and removing the only mechanism that would notice
it coming back are two different acts.

`pnpm mirror:retirement-proof` (`deploy/aos-mirror-retirement/retirement-guard.mjs`) took
the slot and asks the retirement's own questions: the bundle is absent, the three
producers are absent, no npm script reaches for any of them, and the kept manifest still
declares itself retired. Offline, so it belongs in `verify`; whether the *cluster* still
holds the route is a different question with a different authority, and
`deploy/aos-mirror-retirement/retire.mjs` asks the cluster. Driven red three ways before
being trusted — a file recreated under the bundle path, a `mirror:build` script restored,
the retirement marker stripped — and it caught its own entry point on the first run,
which is the cheapest way to learn a predicate has teeth.

### `mirror-acceptance-proof.mjs`

Decided the five D9 acceptance criteria (`TCRN-CROSS-MIN-052`) against a live mirror and a
live local service. It was never reachable from an npm script either — the same INC-030
finding — and by retirement it could not run at all: criteria 1, 2 and 5 address
`http://aos.tcrn.lan`, criteria 3 and 4 address a cockpit service on this machine's
loopback that moved to the VM under STORY-131, and its default chain workspace is the
vacated local path. By this file's own opening sentence, that makes it a false proof
rather than a weak one. It was also a live hazard: CONF-007 recorded that criterion 4's
candidate selection would advance `TCRN-AOS-INIT-002` out of `planned` — the one
non-terminal record on the chain — the next time anybody ran it.

**Where each criterion is asked now.** Not "somewhere else in general":

| D9 criterion | Successor |
| --- | --- |
| 1 — URL reachable, server-rendered | `deploy/aos-resident-cockpit/walkthrough.mjs`, step `root-ssr` |
| 2 — every module renders chain data | same, step `eleven-modules` — and stricter: each route must render ITS OWN view at THIS chain version, with the committed projection as the red control |
| 3 — domain field write round-trips | same, step `domain-store-round-trip` |
| 4 — a chain write succeeds AND an illegal one is refused | same, steps `four-write-routes`, `record-reads-back`, `refusal-and-ceremony-404` (`409 INVALID_TRANSITION` held, plus the ceremonial-verb 404 boundary) |
| 5 — freshness stated, no write control offered | half survives, half retires with its subject. "Freshness stated rather than implied live" is carried by the per-partition as-of chips and by the walkthrough's chain-version discriminator. "Offers no write control" had a read-only surface as its subject; the resident cockpit IS the write face, so there is nothing left for that half to be true of. |

The walkthrough writes to the real chain on the real host through the real tunnel, so
criterion 4 is asked more strongly than the retired proof asked it, not more weakly. What
it is **not** is a `pnpm verify` step: it is a deliberate ceremony, run by hand, exactly
as the acceptance proof was. The guard status of that property did not improve and did not
degrade, and claiming otherwise would be the "delivered once, then never verified again"
shape this repository keeps rediscovering.

`deploy/switch-rehearsal/act3-product-walkthrough.mjs` (STORY-125) re-decided the same
criteria earlier against the rehearsal topology; the resident walkthrough is the
production successor of that work.

`evidence/aos-mirror-acceptance.json` is left byte-untouched. It is a historical receipt
cited by chain annotations, and editing bytes the chain points at to add a retirement
note would corrupt a citation in order to be tidy. This file is the pointer instead.

Two libraries extracted from it survive:

- `scripts/lib/annotate-pair.mjs` — still has a caller, `scripts/inc-034-annotate-pair-proof.mjs`
  (`pnpm inc034:annotate-pair-proof`), plus its own unit tests. That red-proof matters more
  now, not less: it is the last thing exercising the policy.
- `scripts/lib/migration-candidates.mjs` — **orphaned**, and named as such rather than left
  to be discovered. The acceptance proof was its only caller, so it is now a tested library
  nothing invokes. Kept because the question it answers (which chain records are legally
  movable forward, without mirroring the engine's state machine) is what any future
  write-surface acceptance will ask, and its lesson was expensive. Delete it the day
  somebody rules that future is not coming.

## Prerequisite order, now stated

`d3` and `d4` require an activated D2 runtime profile root and fail closed without one
(`d3_default_d2_runtime_profile_root_missing`). Run
`pnpm d2:runtime-profile-activation-proof` first. It is idempotent.
