# Dependency And Resource Governance

Slice 7 adds local-first foundations for dependency/license governance and Resource Library governance. It is a metadata and proof checkpoint, not a scanner, remediation engine, legal completion workflow, asset materialization system, or release-readiness claim.

## Dependency Governance Contract

Dependency lifecycle records preserve:

- project, ecosystem, package, version/range, artifact, source system, and usage
- owner, lifecycle state, license expression, declared and discovered evidence, confidence, policy class, reviewer, residual risk, next action, and approval owner
- SBOM/NOTICE obligation, evidence status, release-blocker posture, linked stories, linked gates, linked evidence, and audit history

Deterministic detection findings cover the local fixture states required by Slice 7:

- deprecated
- denied
- expired
- unapproved
- current
- historical
- removed
- unused

The dependency governance index is a readback surface. It reports dependency ids, detection finding ids, blocked ids, release-blocker ids, SBOM/NOTICE obligation ids, linked gates, linked evidence, and state counts. It always keeps these fixed no-execution claims false:

- package mutation authorized
- remediation executed
- dependency-clean claimed
- legal completion claimed
- release readiness claimed

## Resource Library Contract

Resource registry records preserve:

- resource id, type, title, owner, source, version, digest, storage reference, classification, and project
- copyright/license status, permission state, attribution requirement, derivative posture, expiration, reviewer, residual risk, lifecycle state, and approval state
- linked stories, linked release notes, linked gates, linked evidence, project manifest references, and release-blocker posture

Materialization requests are metadata records only. They preserve target project, purpose, linked evidence, optional linked gate, and Owner Intent requirement. They always record:

- materialization executed: false
- product repo write executed: false

Project resource manifests record approved lineage metadata only. They do not create live copies. They preserve the Resource Library as source truth, resource digest, manifest-only reference, linked stories, linked release notes, and linked evidence.

Resource audit findings cover:

- approved use
- deprecated
- revoked
- stale version
- unused materialized
- unregistered local asset
- blocked

The Resource Library governance index reports resource ids, materialization request ids, manifest record ids, audit finding ids, blocked ids, release-blocker ids, linked gates/evidence, traceability rows, and finding counts. It always keeps these fixed no-execution claims false:

- scanner ingestion executed
- materialization executed
- product repo write executed
- legal completion claimed
- public readiness claimed
- release readiness claimed

## Traceability

Slice 7 traceability is intentionally metadata-only. Rows can link resources to stories, gates, release-note records, evidence, and residual findings without copying binaries, scanning product repositories, storing raw source, or writing any product repo.

## Boundaries

Slice 7 does not authorize dependency install/remove/update, dependency remediation, generated PRs, scanner ingestion, raw scanner output ingestion, resource binary transfer, resource materialization execution, product-repo resource writes, deployment, live Codex dispatch, Product Design final acceptance, legal completion, dependency clean/public readiness, release readiness, product acceptance, final MVP acceptance, Selene closeout, or remote publication.
