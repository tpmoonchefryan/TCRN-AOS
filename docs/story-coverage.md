# MVP Story Coverage

This checkpoint implements Slice 1 as a model-first operational spine and adds Slice 2 runtime DB/local service proof for the existing model families.

## Implemented At Model Or Contract Level

- `AOS-S001..AOS-S018`: project, initiative, epic, story, estimate, sub-task, comments, links, AI employee identity, thread identity, assignments, runs, and approval authority models.
- `AOS-S020..AOS-S036`: gate work orders, role routing, owner-intent separation, ticket gate state, stale-route fields, MCP method families, audit stream, and dry-run Codex adapter dispatch/readback/return/retry contracts.
- `AOS-S038..AOS-S042`: conference request, typed conference, dry-run invite payload shape, participant position recording, and minutes/outcome model.
- `AOS-S045..AOS-S047`: stage taxonomy, stage-map read model, and stage derivation from story/gate data without release-readiness overclaim.
- `AOS-S049..AOS-S050`: cockpit read model for workstream and approval/gate inspection.
- `AOS-S052..AOS-S056`: risk warning posture, owner intent submission model, knowledge entry, guide, and release-note models.
- `AOS-S060..AOS-S061`: model surfaces for TCRN Workflow initiative artifact references and product registry state.
- `AOS-S064..AOS-S082`: access roles, audit foundation, admin posture, navigation IA, seed data, dependency lifecycle/governance records, and model-first resource registry/audit/traceability surfaces.
- `AOS-S084`: resource and dependency gates can inform release-readiness views without claiming legal completion or public readiness.

## Slice 2 Runtime Proof Coverage

Commit `e84410367267b47da0d2654e174a69578f91f6af` adds local runtime proof for the already-scoped operational-spine story groups:

- `AOS-S006..AOS-S018`: representative project, initiative, epic, story, subtask, comment, AI employee, and operational state records are applied and read back through the runtime fixture.
- `AOS-S020..AOS-S031`: gate work order, Owner Intent separation, MCP/audit/evidence posture, idempotency/dedupe, and append-only audit behavior remain covered; Slice 2 adds runtime append-only proof.
- `AOS-S038..AOS-S042`: conference request and participant position records are included in runtime fixture data.
- `AOS-S045..AOS-S047`: derived stage-map readback is included with four stage-map items and no release-readiness claim.
- `AOS-S052..AOS-S056`: knowledge, user-guide, release-note, and risk/no-overclaim posture are represented as runtime records.
- `AOS-S060..AOS-S061`: product registry/project references remain metadata references and do not ingest product repo source.
- `AOS-S064..AOS-S082`: dependency lifecycle, resource governance, audit, redaction, and model-first Resource Library records are represented without scanner ingestion, materialization, or product-repo writes.
- `AOS-S084`: dependency/resource posture can inform release-readiness views, but Slice 2 does not claim dependency-clean, legal completion, public readiness, release readiness, product acceptance, or final MVP acceptance.

## Deferred By Route

- `AOS-S019`, `AOS-S037`, `AOS-S043`, `AOS-S044`, `AOS-S048`, `AOS-S051`, `AOS-S057`, `AOS-S058`, `AOS-S059`, `AOS-S062`, `AOS-S063`, and `AOS-S083` remain deferred unless a later packet promotes them.
- Live Codex thread sends, scanner ingestion, resource binary materialization, GitHub mutation, deployment, and remote publication remain separately gated.

## Proof Boundary

The checkpoint proves local TypeScript contracts, static PostgreSQL schema shape, local runtime fixture apply/readback/reset, loopback-only service health/readback, no runtime dependency graph, no Redis/external queue use, dry-run adapter behavior, redaction/restricted-payload rejection, audit append-only behavior, and no direct TCRN-TMS mutation.

Slice 2 evidence receipt: `../evidence/slice-2-runtime-proof.md`.

## Slice 3 Gateway And Adapter Proof Coverage

Slice 3 adds runtime-backed MCP Gateway and Codex Adapter dry-run/outbox/readback proof for the existing operational-spine story groups:

- `AOS-S020..AOS-S024`: Owner Intent and stale/blocked route state remain pending local records; high-risk actions do not execute.
- `AOS-S025..AOS-S031`: MCP Gateway methods are runtime-backed for ticket proposal, comments, run summary, gate request, evidence link, policy read, conference request, conference position, stage-map read, and audit query.
- `AOS-S032..AOS-S036`: Codex Adapter dry-run outbox creates assignment, gate request, and conference invitation payloads; return collection updates local assignment/gate/conference records without live dispatch.
- `AOS-S038..AOS-S042`: conference invitation and return-loop proof remains local and dry-run only.
- `AOS-S045..AOS-S047`, `AOS-S052..AOS-S056`, `AOS-S060..AOS-S061`: readback-only proof consumers are exercised where needed; no UX, publication, or product-source ingestion scope is promoted.
- `AOS-S064`, `AOS-S065`: access, role/thread binding, read/write split, restricted-content rejection, and append-only audit guardrails are tested.

Slice 3 evidence receipt: `../evidence/slice-3-gateway-adapter-proof.md`.

## Frontend Shell Slice

Current AOS source now includes the first frontend shell slice under `apps/web/src/**`. This shell restores a local visible surface after the owner-directed reset without reviving the prior implementation: it serves an attached AOS product shell, dummy Cockpit, Jira-like Work entry, Design System-backed theme/locale/search controls, side navigation collapse, registered Design System brand lockup, and backend readbacks from `/api/health`, `/api/readback`, and `/api/policy`. Planned module aliases may still serve shell HTML for compatibility, but they are not visible primary navigation or registered module cards in this slice.

The shell is a structural implementation slice only. Final cockpit aggregation, Product Design final UX/layout/visual acceptance, product acceptance, release readiness, external queue use, live dispatch, package publication, and hosted publication remain deferred.

## Slice 5 Conference And AI Operating Loop Coverage

Slice 5 remains as local domain/gateway/adapter operating-loop proof only:

- `AOS-S038..AOS-S042`: conference request, typed/default conference behavior, dry-run invite outbox linkage, participant position collection, missing participant readback, and minutes/outcome metadata are covered by domain/gateway/adapter tests and `pnpm slice5:proof`.
- `AOS-S014..AOS-S018`: AI employee identity, thread identity, assignment, run summary, and authority snapshots are used as operating-loop inputs and readbacks.
- `AOS-S020..AOS-S024`: role-owned gate work orders, Owner Intent separation, ticket gate state, and stale-route follow-up remain explicit local records; high-risk owner actions do not auto-execute.
- `AOS-S032..AOS-S036`: Codex Adapter dry-run dispatch/readback/return/retry contracts now link `conference_invite` outbox records back to conference operating-loop readbacks; live dispatch remains blocked.
- `AOS-S049`, `AOS-S050`, `AOS-S052`, `AOS-S053`: work-index and drill-through models expose story, assignment, gate, conference, evidence, audit, risk, owner-intent, and local action context without a frontend surface.
- Supporting `AOS-S029`, `AOS-S031`, `AOS-S045..AOS-S047`, `AOS-S060`, `AOS-S061`, `AOS-S064`, `AOS-S065`, and `AOS-S068`: evidence links, audit stream, source-truth metadata, stage-map readback, access/role binding, and seed/test posture remain local and inspectable.

Still deferred: `AOS-S043` action-item automation, `AOS-S044` deep conference search, all frontend development, final visual/UX acceptance, browser acceptance closeout, deployment, live Codex dispatch, thread registry mutation, release readiness, product acceptance, and final MVP acceptance.

Slice 5 evidence receipt: `../evidence/slice-5-conference-ai-operating-loop-proof.md`.

## Slice 6 Knowledge, Guide, And Release Notes Coverage

Slice 6 adds local-first documentation model/index foundations for AOS-E10:

- `AOS-S054`: project knowledge records now preserve category, source kind, source ids, linked tickets, linked conferences, linked evidence, freshness state, and explicit export/canonical-promotion blockers.
- `AOS-S055`: user-guide page draft records now separate local draft metadata from future publication state and link guide drafts to stories, release-note items, and evidence.
- `AOS-S056`: release-note draft item records now link stories and evidence while keeping Git export, release closeout, and publication unclaimed by default.

Supporting local readbacks connect these records to existing story, conference, evidence, audit, gateway, and work-index metadata without promoting deferred docs readiness/search, Git export, canonical knowledge promotion, user-guide publication, release-note publication, or release readiness.

Slice 6 evidence receipt: `../evidence/slice-6-knowledge-guide-release-notes-proof.md`.

## Slice 7 Dependency License And Resource Library Governance Coverage

Slice 7 adds local-first dependency/license governance and Resource Library governance foundations:

- `AOS-S069`: dependency lifecycle records preserve project, ecosystem, package, version/range, source system, usage, owner, lifecycle state, artifact reference, and audit posture.
- `AOS-S070`: license evidence posture records declared/discovered evidence, confidence, policy class, reviewer, residual risk, and next action without legal-completion claims.
- `AOS-S071`: dependency/license gate work orders and release-view blockers expose unresolved obligations without satisfying them automatically.
- `AOS-S072`: dependency detection fixtures cover deprecated, denied, expired, unapproved, current, historical, removed, and unused states without mutating package files.
- `AOS-S073` and `AOS-S074`: SBOM/NOTICE obligation and approval owner fields are visible in dependency governance index readbacks.
- `AOS-S075`: Resource Library registry records preserve resource id, type, title, owner, source, version, digest, storage reference, classification, and approval posture.
- `AOS-S076` and `AOS-S077`: copyright/license metadata, permission state, attribution, derivative posture, expiration, reviewer, residual risk, and next action remain local metadata.
- `AOS-S078`: materialization requests are gate/Owner Intent records only; no binary copy or product repo write is executed.
- `AOS-S079`: project resource manifests record approved lineage metadata without creating live materialized copies.
- `AOS-S080` and `AOS-S081`: resource audit findings cover approved use, deprecated, revoked, stale version, unused materialized, unregistered local asset, and blocked states.
- `AOS-S082`: resource/dependency traceability links stories, gates, release-note records, evidence, and residual findings.
- `AOS-S084`: dependency/resource blockers can inform release-view metadata while release readiness, dependency clean posture, legal completion, and public readiness remain unclaimed.

Supporting local proof touches `AOS-S020..AOS-S024`, `AOS-S029`, `AOS-S031`, `AOS-S045..AOS-S047`, `AOS-S052`, `AOS-S053`, and `AOS-S064..AOS-S068` only as readback/linkage context.

Still deferred: package dependency remediation, scanner ingestion, resource binary transfer, product-repo resource writes, materialization/update/rollback/replacement/cleanup execution, release readiness, product acceptance, and final MVP acceptance.

Slice 7 evidence receipt: `../evidence/slice-7-dependency-resource-governance-proof.md`.

## Slice 8 Resource Materialization History And Rollback Coverage

Slice 8 adds local-first no-execution control-record foundations for `AOS-S083`:

- Materialization history records preserve resource, manifest, target project, linked gates/evidence, lifecycle state, residual risk, next action, and fixed false execution flags.
- Update and replacement requests preserve requested lineage changes and Owner Intent requirements without binary transfer, product-repo writes, or replacement execution.
- Rollback requests and rollback plans preserve intended previous-manifest/readback posture, cleanup blockers, required gates, and fixed false rollback/cleanup/product-write claims.
- Retirement records and cleanup readbacks preserve blocked/approved local posture, delete blockers, residual risk, and fixed false cleanup/delete/product-repo-write claims.
- Materialization-control index readbacks expose history, update, replacement, rollback, plan, retirement, cleanup, blocked, gate, evidence, and lifecycle counts for cockpit/API/gateway consumers.
- MCP Gateway methods record and read these control records locally, with idempotency, role/project checks, restricted payload rejection, and fail-closed execution-claim booleans.

Supporting local proof touches `AOS-S078..AOS-S082`, `AOS-S084`, `AOS-S020..AOS-S024`, `AOS-S029`, `AOS-S031`, `AOS-S052`, `AOS-S053`, and `AOS-S064..AOS-S068` only as linkage/readback context.

Still deferred: actual resource materialization, resource binary transfer, update execution, replacement execution, rollback execution, cleanup/delete execution, scanner ingestion, product-repo resource writes, public/legal/release readiness, product acceptance, and final MVP acceptance.

Slice 8 evidence receipt: `../evidence/slice-8-resource-materialization-history-rollback-proof.md`.

## Slice 9 Docs Search And Release-Candidate Linkage Coverage

Slice 9 adds local-first docs/search readiness and release-candidate linkage foundations:

- `AOS-S057`: docs readiness records link knowledge, guide, release-note, and documentation-index targets to stories, evidence, gates, freshness, stage-map context, blockers, and fixed false publication/export/promotion/readiness claims.
- `AOS-S058`: project search index records store sanitized metadata terms and source links only; raw source, private payloads, raw scanner output, and machine-local absolute path payloads are rejected before storage.
- `AOS-S059`: aggregate docs/search readbacks expose readiness ids, search ids, blocked ids, linked stories, linked evidence, linked gates, and state counts without public readiness or search-readiness overclaims.
- `AOS-S062`: GitHub metadata and PR/CI story readiness records preserve local fixture/readback metadata for branch, commit, PR refs, CI refs, warnings, blockers, and story readiness without GitHub writes, CI mutation, or release creation.
- `AOS-S063`: release-candidate linkage records connect stories, docs readiness, release-note items, evidence, dependency blockers, resource blockers, gates, GitHub metadata, PR/CI readiness, and residual risks without release creation, deployment, release readiness, product acceptance, or final MVP acceptance.

Supporting local linkage touches `AOS-S054..AOS-S056`, `AOS-S060..AOS-S061`, `AOS-S020..AOS-S024`, `AOS-S029`, `AOS-S031`, `AOS-S045..AOS-S047`, `AOS-S052`, `AOS-S053`, `AOS-S064..AOS-S068`, and prior dependency/resource governance stories only as readback context.

Still deferred: docs publication/export, canonical knowledge promotion, live GitHub writes, GitHub release creation, CI status mutation, deployment, live Codex dispatch, thread registry mutation, scanner ingestion, resource materialization, release readiness, product acceptance, and final MVP acceptance.

Slice 9 evidence receipt: `../evidence/slice-9-docs-search-release-linkage-proof.md`.

Visible inspection for Slice 9 remains model/control-plane readiness only. The current frontend shell does not promote Docs/Search/Release as registered navigation or module cards; docs publication, search/public readiness, GitHub mutation, release creation, deployment, release readiness, product acceptance, final MVP acceptance, and Product Design final UX/layout/visual acceptance remain deferred.
