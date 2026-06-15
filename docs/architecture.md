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
- `apps/web`: cockpit read model shell for inspection.

## Deferred

NestJS, Refine, Payload, deployed PostgreSQL proof, deployment, live Codex sends, scanner ingestion, resource binary materialization, and GitHub remote publication require separate routes.
