# AOS-Wide Product Design Surface Set

Slice 10 implements the local AOS-wide Product Design target set as an evidence-stage static surface. It composes the accepted Operations Cockpit and Docs/Search/Release readiness anchors into one inspection shell without replacing those anchors or claiming AOS-wide acceptance.

## Static Targets

- `apps/web/static/operations-cockpit.html`: accepted cockpit anchor preserved.
- `apps/web/static/docs-search-release-readiness.html`: accepted Slice 9B docs/search/release-candidate anchor preserved.
- `apps/web/static/aos-wide-product-design.html`: new Slice 10 AOS-wide target-set surface.

## Surface Coverage

The new target-set surface includes these local inspection modules:

- Project dashboard and hierarchy with project header, initiative summary, Epic/Story hierarchy, stage ownership, blockers, and evidence freshness.
- Initiative/ticket drill-through with assignments, gates, evidence links, decision history, comments, and subtasks posture.
- AI employee list/profile with role/thread identity, assignment scope, lifecycle, authority posture, active/idle/blocked state, and last readback.
- Approvals/gates and Owner Intent separation with role-owned gate work orders, evidence requirements, residual blockers, and disabled true-owner actions.
- Conference list/detail/minutes with participants, positions, linked tickets/evidence, outcome, minutes, and dry-run/no-live-dispatch posture.
- MCP Gateway and Codex Adapter health/readback with dry-run outbox, idempotency/dedupe, role/thread binding, audit, and redaction posture.
- Knowledge Base/User Guide/Release Notes modules with local-first indexes, proposal states, readiness states, and blocked export/publish/canonical-promotion posture.
- Dependency/license governance console with lifecycle, evidence, SBOM/NOTICE obligations, review gates, and residual-risk posture.
- Resource Library/materialization/audit/traceability with records, requests/history, manifests, update/rollback posture, and fail-closed no-execution flags.
- Minimal admin/access/audit shell with read-only access posture, role permissions, audit trail status, authz boundary, and blocked break-glass posture.

## Proof And Boundaries

The target exposes `productDesignStatus=target_set_implemented_pending_review`, `aosWideProductDesignAccepted=false`, and fixed false/not-claimed state fields for deployment, live dispatch, thread registry mutation, release readiness, product acceptance, final MVP acceptance, docs export/publication, canonical promotion, GitHub mutation, scanner ingestion, materialization execution, product repo write, and Codex Security scan completion.

`pnpm slice10:proof` renders `apps/web/static/aos-wide-product-design.html`, checks all required regions, confirms all three target paths exist, verifies the ten surface rows, checks disabled/blocked/empty/detail/focus readiness, asserts no body-level overflow expectation, and reports zero forbidden positive-copy hits.

This is an implementation/evidence-stage checkpoint only. It does not claim AOS-wide Product Design acceptance, Product Design final UX/layout/visual acceptance, product acceptance, final MVP acceptance, deployment, release readiness, publication, Selene closeout, push, or Codex Security scan completion.
