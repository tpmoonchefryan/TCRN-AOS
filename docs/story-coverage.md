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
