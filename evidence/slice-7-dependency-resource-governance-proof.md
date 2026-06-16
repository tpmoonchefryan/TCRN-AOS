# Slice 7 Dependency License And Resource Library Governance Proof

Status: observed local proof receipt

## Checkpoint Identity

- Pre-implementation basis: `ef1ce8aee183a8d7c41c2f677a94c1b72a84ca97` (`docs: repair AOS Slice 6 evidence lineage`)
- Implementation checkpoint under review: `d20ee15b3a7db5dcf8718f76747fc3bccf7036bd` (`feat: add AOS Slice 7 governance foundations`)
- Workflow packet basis: `f9e747228ea586ee42b9065bf39df704978f9c1d` (`docs: define AOS Slice 7 governance packet`)
- Wrong-sibling quarantine: `<wrong-sibling-quarantine>` remains quarantine/evidence only at `4d917fdb6fcbefe888054906b17b755690530112`; it is not accepted output, proof source, rollback source, or publish target.
- TCRN-TMS boundary: product repository remains separately owned and untouched; expected clean/synced head is `6356d3b6b730311fe09a0d3eb2f57a07b10bb3c5`.

## Implemented Local Contract

Slice 7 adds local-first dependency/license governance and Resource Library governance foundations:

- Dependency lifecycle records include owner, lifecycle state, artifact reference, declared/discovered license evidence, confidence, policy class, reviewer, residual risk, next action, story/evidence links, release-blocker posture, and no package-mutation execution flag.
- Dependency detection findings cover deterministic fixture states: deprecated, denied, expired, unapproved, current, historical, removed, and unused.
- Dependency governance index readback reports dependency ids, finding ids, blocked ids, release-blocker ids, SBOM/NOTICE obligation ids, linked gates/evidence, state counts, and fixed no-overclaim false claims.
- Resource registry records include project, permission state, attribution, derivative posture, expiration, reviewer, residual risk, story/release/evidence links, materialization flags, product-repo-write flags, and release-blocker posture.
- Resource materialization requests are Owner-Intent-gated metadata records only.
- Project resource manifests record approved lineage metadata only and do not create live copies.
- Resource audit findings cover approved use, deprecated, revoked, stale version, unused materialized, unregistered local asset, and blocked states.
- Resource governance index readback reports resource ids, materialization request ids, manifest ids, audit finding ids, blocked ids, release blockers, traceability rows, finding counts, and fixed no-overclaim false claims.
- MCP Gateway local methods expose dependency/resource governance record creation and index readback without live dispatch, scanner ingestion, package mutation, or materialization.

## Observed Command Receipt

Observed command: `pnpm verify`

Result: passed.

Component receipt:

- Typecheck: passed.
- Migration validation: `ok=true`, `requiredTables=21`, append-only trigger present.
- License audit: `ok=true`, runtime dependencies `[]`; dev dependencies `@types/node` MIT and `typescript` Apache-2.0; blockers `[]`; external queue/Redis runtime absent.
- Tests: `41 pass / 0 fail`.
- Runtime DB proof: `ok=true`, `storageMode=os_temp_ephemeral`, `runtimeDataCommitted=false`.
- Runtime representative counts include `dependencies=1`, `dependencyFindings=1`, `resources=1`, `materializationRequests=1`, `resourceManifests=1`, `resourceFindings=1`, `knowledgeEntries=1`, `userGuideDrafts=1`, `releaseNotes=1`, `stageMapItems=4`, `auditEvents=22`.
- Runtime audit proof: mutation blocked, update rejected, delete rejected.
- Runtime redaction proof: synthetic machine-local absolute path rejected and audited.
- Runtime reset proof: `runtimeDataExistsAfterReset=false`.
- Service smoke: `ok=true`, loopback-only, ephemeral port, stopped cleanly, local fixture runtime DB, external queue `none`, live Codex dispatch `false`, copied helper execution `false`.
- Slice 3 proof: passed.
- Slice 4 proof: passed.
- Slice 4B style proof: passed.
- Slice 5 operating-loop proof: passed.
- Slice 6 proof: passed.
- Slice 7 proof: passed.

Observed command: `pnpm slice7:proof`

Result: `ok=true`.

Slice 7 proof scenarios:

- Dependency/license governance matrix: `ok=true`; states `deprecated`, `denied`, `expired`, `unapproved`, `current`, `historical`, `removed`, and `unused`; dependencies `8`; detection findings `8`; blocked dependencies `3`; release-blocker dependencies `3`; SBOM/NOTICE required dependencies `7`; linked gates `1`; linked evidence `1`.
- Dependency state counts: deprecated `2`, denied `2`, expired `2`, unapproved `2`, current `2`, historical `2`, removed `2`, unused `2`.
- Dependency no-execution claims: package mutation authorized `false`, remediation executed `false`, dependency-clean claimed `false`, legal completion claimed `false`, release readiness claimed `false`.
- Resource Library governance matrix: `ok=true`; resources `2`; materialization requests `1`; manifest records `1`; audit findings `7`; blocked resources `1`; release-blocker resources `1`; traceability rows `2`.
- Resource finding counts: approved use `1`, deprecated `1`, revoked `1`, stale version `1`, unused materialized `1`, unregistered local asset `1`, blocked `1`.
- Resource request posture: owner intent required `true`, materialization executed `false`, product repo write executed `false`.
- Resource no-execution claims: scanner ingestion executed `false`, materialization executed `false`, product repo write executed `false`, legal completion claimed `false`, public readiness claimed `false`, release readiness claimed `false`.
- MCP Gateway governance proof: `ok=true`; dependency record, dependency finding, resource record, materialization request, manifest, and audit finding accepted; dependency and resource index methods returned read status.
- Restricted payload proof: `ok=true`; synthetic machine-local absolute path rejected before storage.

## Story Scope Covered

Primary Slice 7 scope:

- `AOS-S069..AOS-S074`: dependency lifecycle, license evidence posture, dependency/license gate work orders, release-view blockers, detection fixture states, SBOM/NOTICE posture, and approval owner readbacks.
- `AOS-S075..AOS-S082`: Resource Library registry, classification/copyright metadata, materialization request records, project resource manifest records, resource audit findings, traceability rows, and residual finding readbacks.
- `AOS-S084`: dependency/resource blockers can inform release-view metadata while release readiness, dependency-clean posture, legal completion, and public readiness remain unclaimed.

Supporting local proof only:

- `AOS-S020..AOS-S024`, `AOS-S029`, `AOS-S031`, `AOS-S045..AOS-S047`, `AOS-S052`, `AOS-S053`, and `AOS-S064..AOS-S068`.

Deferred or not claimed:

- `AOS-S083` materialization history/update/rollback/replacement automation.
- Package-file dependency install/remove/update, dependency remediation, scanner ingestion, raw scanner output ingestion, resource binary transfer, resource materialization execution, product-repo resource writes, deployment, live Codex dispatch, remote publication, release readiness, product acceptance, or final MVP acceptance.

## D-024 Boundary

Runtime dependency/license/resource/copyright/materialization/audit records are local-first AOS operational data. Git stores source code, schemas/migrations, deterministic fixtures, tests, scripts, docs, and this explicit evidence receipt only.

Not stored in AOS records or prompts:

- runtime operational content dumps
- raw private evidence bodies
- raw source dumps
- local absolute path dumps
- secrets, credentials, auth state, shell history, browser/keychain material
- raw secret-scan output

## Claim Boundaries

This checkpoint does not claim:

- dependency-clean posture
- legal completion
- public readiness
- release readiness
- scanner ingestion
- resource binary materialization
- product-repo resource writes
- package-file dependency mutation or remediation
- live Codex dispatch
- thread registry mutation
- deployment
- Product Design final UX/layout/visual acceptance
- browser acceptance closeout
- product acceptance
- final MVP acceptance
- Selene publication or push

## Dependency And Product Boundary

Dependency graph unchanged for Slice 7. Runtime dependencies remain `[]`; dev dependencies remain `@types/node` and `typescript`; license audit blockers remain `[]`.

TCRN-TMS remains outside the AOS write scope. Wrong-sibling AOS remains quarantine/evidence only and is not an accepted output.
