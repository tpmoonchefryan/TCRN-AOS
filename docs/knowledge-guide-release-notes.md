# Slice 6 Knowledge, Guide, And Release Notes Foundations

Slice 6 adds local-first model and index foundations for project knowledge, user-guide drafts, and release-note draft items. These records are operational AOS metadata: they help agents and reviewers inspect documentation posture, source-truth references, and pending follow-up without publishing documentation or promoting canonical knowledge.

## Local Model Contract

- `KnowledgeEntry` records project knowledge metadata with category, source kind, source ids, linked tickets, linked conferences, linked evidence, freshness state, and export/canonical-promotion boundaries.
- `UserGuidePageDraft` records local guide draft metadata with audience, version label, linked stories, linked release-note items, linked evidence, and a clear split between draft state and any future published guide.
- `ReleaseNoteRecord` records local release-note item metadata with linked stories, evidence, user-facing summary, internal/risk summaries, review state, and release/export blockers.
- `ProjectDocumentationIndexReadback` aggregates knowledge, guide, release-note, stale, blocked-publish, work-item, conference, and evidence ids for a project.
- `DocumentationActionBlock` records blocked export, publish, canonical promotion, or release-closeout actions when no separately routed Owner Intent/export packet exists.

## Proof Scenarios

`pnpm slice6:proof` exercises these local scenarios:

- knowledge proposed from conference metadata
- user-guide draft linked from story/evidence metadata
- release-note draft linked from story/evidence metadata
- stale knowledge follow-up surfaced in the documentation index
- export blocked without Owner Intent/export packet
- restricted local/private payload rejected before storage
- MCP Gateway documentation methods for local propose/draft/readback paths

## D-024 Storage Boundary

Runtime documentation records are local-first operational data. Git tracks source code, schemas, tests, scripts, templates, docs, and explicit evidence receipts only. Runtime operational content dumps, private evidence bodies, raw source dumps, local absolute path dumps, secrets, credentials, auth state, shell history, browser/keychain material, and raw secret-scan output are not accepted AOS records.

## No-Overclaim Boundaries

This checkpoint does not claim docs readiness, search readiness, Git export, user-guide publication, release-note publication, canonical knowledge promotion, live Codex dispatch, deployment, release readiness, product acceptance, final MVP acceptance, or Selene publication.

Related evidence receipt: `../evidence/slice-6-knowledge-guide-release-notes-proof.md`.
