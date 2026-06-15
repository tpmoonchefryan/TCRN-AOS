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

## Slice 4 Operations Cockpit Functional Contract Coverage

Slice 4 adds non-visual Operations Cockpit read-model proof for owner observation and inspection surfaces:

- `AOS-S045..AOS-S047`: stage-map readback is shaped with required state names, linked stories/gates/evidence, blockers, owner roles, and `manualReadinessOverrideAllowed=false`.
- `AOS-S049`, `AOS-S050`, `AOS-S052`, `AOS-S053`: context header, workstream overview, gate queues, risk warnings, owner-intent separation, and no-overclaim states are exposed as functional contract data.
- `AOS-S038..AOS-S042`: conference visibility exposes initiator, participants, missing responses, agenda, linked tickets/evidence, status, decision class, and minutes summary when present.
- `AOS-S014..AOS-S018`, `AOS-S020..AOS-S024`: AI employee responsibility, role-owned gates, and Owner Intent gates remain separate; Owner Intent readbacks are not auto-executable.
- `AOS-S029`, `AOS-S031`, `AOS-S054..AOS-S056`, `AOS-S060`, `AOS-S061`: evidence/readback freshness and source-truth links are metadata-only and do not copy raw private payloads.
- `AOS-S064`, `AOS-S065`: access/audit guardrails remain readback-only in this slice.
- `AOS-S069..AOS-S074`: dependency/license inspection shows posture, evidence status, SBOM/NOTICE obligation, and linked gates without dependency-clean or legal-completion claims.
- `AOS-S075..AOS-S082`, `AOS-S084`: Resource Library inspection shows copyright, lifecycle, approval, manifest, and gate state without scanner ingestion or materialization execution.

Slice 4 proof receipt: `../evidence/slice-4-operations-cockpit-proof.md`.

Product Design status: brief accepted only. Visual ideation, prototype, browser visual acceptance, UX/layout/visual acceptance, Product Design acceptance, deployment, release readiness, product acceptance, and final MVP acceptance remain unclaimed.

## Slice 4B Frontend Style Baseline Coverage

Slice 4B records the owner-accepted static Operations Cockpit style baseline and implements it as a production-facing local static web surface:

- `AOS-S045..AOS-S047`: stage-map readback is visible in the local static cockpit with source-derived proof states.
- `AOS-S049`, `AOS-S050`, `AOS-S052`, `AOS-S053`: cockpit shell, project selector, local checkpoint strip, work index, gate card, readback posture card, and detail drawer are represented as production-surface regions.
- `AOS-S014..AOS-S018`, `AOS-S020..AOS-S024`: AI employee phase visibility and Owner Intent separation remain visible without automatic execution.
- `AOS-S038..AOS-S042`: conference visibility remains part of the detail/readback model.
- `AOS-S069..AOS-S074`: dependency/license inspection uses posture language only and does not claim dependency-clean or legal completion.
- `AOS-S075..AOS-S082`, `AOS-S084`: Resource Library inspection remains metadata/posture only; scanner ingestion and materialization are not claimed.

Slice 4B evidence receipt: `../evidence/slice-4b-frontend-style-baseline-proof.md`.

Product Design status: brief and owner style baseline accepted for now. Product Design UX/layout/visual acceptance, browser acceptance, deployment, release readiness, product acceptance, and final MVP acceptance remain unclaimed.
