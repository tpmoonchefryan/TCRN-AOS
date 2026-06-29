# AOS Slice 1 Architecture

## Boundaries

TCRN-AOS is an operational-state topology. It records governed operational state and references external sources of truth by stable ids, links, digests, and posture metadata.

It does not replace:

- TCRN Workflow governance, gates, role contracts, workflow knowledge, or project registry.
- GitHub repository, pull request, CI, or release state.
- Product repositories as code and documentation authorities.

## Local Checkpoint Packages

- `packages/domain`: operational models, policy predicates, redaction checks, idempotency keys, audit/event types, and an in-memory store for local proof.
- `packages/mcp-gateway`: allowed MCP method contracts, authz, role/thread binding, idempotency, dedupe, Owner Intent Gate separation, and audit appenders.
- `packages/adapter-codex`: Codex Integration Adapter contracts with dry-run dispatch/readback/return parsing only.
- `packages/db`: PostgreSQL schema, seed data, and an ephemeral local fixture runtime for apply/readback/reset proof.
- `apps/api`: API composition shell around the MCP Gateway plus a short-lived local HTTP health/readback service for proof.
- `apps/web`: first frontend shell slice rendered as static React output at build time and served by `apps/api` for `/`, `/cockpit`, `/work`, and legacy compatibility aliases. The shell consumes current TCRN Design System packages for public React primitives, tokens, and copy-state/i18n posture.

## Frontend Shell Boundary

The current shell establishes attached product navigation limited to the admitted dummy Cockpit and Work entries, compact theme/locale/search controls, route-owned side navigation collapse, a registered Design System `ShellBrandLockup` using `tcrn-brand-mark.svg`, and browser-side fail-closed reads of `/api/health`, `/api/readback`, and `/api/policy`. Legacy aliases may still serve the shell for local compatibility, but planned modules are not visible primary navigation or registered module cards in this slice. PM/browser QA remains required before any owner-facing return.

It deliberately does not implement final cockpit aggregation. `/api/cockpit` remains a deferred JSON endpoint with `410 aos_cockpit_api_deferred`; browser surfaces must not treat the dummy Cockpit as live aggregation, external queue evidence, product acceptance, release readiness, or live dispatch proof.

## Deferred

NestJS, Refine, Payload, deployed PostgreSQL proof, final cockpit aggregation, deployment, live Codex sends, scanner ingestion, resource binary materialization, and GitHub remote publication require separate routes.
