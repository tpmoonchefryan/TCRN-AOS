# Slice 9 Docs Search And Release-Candidate Linkage Readiness

Slice 9 adds local-first model, index, and readback foundations for docs search readiness and release-candidate linkage. These records help reviewers inspect whether project knowledge, user-guide drafts, release-note draft items, local evidence, GitHub metadata readbacks, PR/CI metadata, dependency/resource blockers, and release-candidate posture are connected.

This checkpoint is readiness metadata only. It does not publish docs, export docs to Git, promote canonical knowledge, create GitHub releases, mutate GitHub, deploy services, or claim release readiness.

## Local Model Contract

- `DocsReadinessRecord` links a knowledge entry, user-guide draft, release-note item, or documentation index to stories, evidence, gates, stage-map context, freshness state, blockers, and fixed false publication/export/promotion/readiness claims.
- `ProjectSearchIndexRecord` stores sanitized metadata terms and source links for local docs/search readback. It explicitly stores metadata only and rejects raw private payloads, raw source, raw scanner output, and machine-local absolute path payloads.
- `GitHubMetadataReadback` stores local fixture/readback metadata for repository, branch, commit, PR refs, CI refs, warnings, and blockers. It never writes GitHub state, creates releases, mutates CI status, or claims release readiness.
- `PrCiStoryReadinessLinkage` connects a story to GitHub/PR/CI metadata and evidence while keeping readiness states warning/blocked/not-ready until external proof exists.
- `ReleaseCandidateLinkage` links stories, docs readiness, release-note items, evidence, dependency blockers, resource blockers, gates, GitHub metadata, PR/CI readiness, and residual risks without release creation, deployment, product acceptance, final MVP acceptance, legal completion, dependency-clean, public-readiness, or release-ready claims.
- `DocsSearchReleaseLinkageIndexReadback` aggregates these records for review lanes and cockpit/API consumers.

## Gateway Contract

Slice 9 adds local MCP Gateway method families:

- `aos.docs.readiness.record`
- `aos.docs.search.index`
- `aos.github.metadata.record`
- `aos.pr_ci.story_readiness.record`
- `aos.release_candidate.linkage.record`
- `aos.release_candidate.linkage.read`

The write methods require the existing authenticated AI employee identity, role/thread binding, project scope, write permission, idempotency/dedupe behavior, and restricted-payload rejection. The read method returns only local AOS readback metadata.

## Proof Scenarios

`pnpm slice9:proof` exercises these local scenarios:

- docs readiness, sanitized search, GitHub metadata, PR/CI story readiness, and release-candidate linkage records are created locally and indexed together;
- gateway methods accept local metadata writes, dedupe a repeated readiness request, and read back the aggregate index;
- restricted synthetic machine-local absolute path payloads are rejected before storage;
- caller-supplied true publication, release-creation, and product-acceptance claims fail closed;
- aggregate readbacks preserve D-024 local-first storage and no-overclaim booleans.

## D-024 Storage Boundary

Runtime docs/search/release-candidate linkage records are local-first AOS operational data. Git tracks source code, schemas/migrations, deterministic fixtures, tests, scripts, docs, and explicit evidence receipts only.

Not stored in AOS records or prompts:

- runtime operational content dumps
- raw private evidence bodies
- raw source dumps
- local absolute path dumps
- secrets, credentials, auth state, shell history, browser/keychain material
- raw secret-scan output
- raw scanner output

## No-Overclaim Boundaries

This checkpoint does not claim docs publication, docs export, search/public readiness, GitHub mutation, release creation, deployment, release readiness, canonical knowledge promotion, dependency-clean posture, legal completion, product acceptance, final MVP acceptance, live Codex dispatch, Selene publication, Product Design final UX/layout/visual acceptance, scanner ingestion, or resource materialization.

Related evidence receipt: `../evidence/slice-9-docs-search-release-linkage-proof.md`.
