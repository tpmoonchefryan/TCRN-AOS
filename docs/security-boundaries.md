# Security And Privacy Boundaries

The current local checkpoint stores references and posture records, not raw private payloads.

Rejected or redacted input classes include:

- credentials and token-shaped values
- private key material
- raw secret scan output
- shell history markers
- browser or keychain material
- raw source diffs
- machine-local absolute path dumps
- restricted evidence bodies

Owner-intent-required actions are modeled as pending gates. They are not executed automatically by the gateway or adapter.

The Codex adapter is dry-run only. It records intended dispatch payloads and readback models, but it does not send to live threads in this checkpoint.

Slice 2 runtime proof uses ephemeral local fixture storage and a loopback-only short-lived service. The proof scripts do not retain runtime DB files, start external queues, execute copied helpers, or store local absolute path dumps in AOS records.

Slice 3 gateway/adapter proof remains dry-run and local-only. Gateway writes require authenticated AI employee identity, active role/thread binding, project scope, write permission, idempotency, and payload safety before runtime storage. Codex Adapter outbox records are never delivered to live threads; readbacks and returns are fixture/local records only.

Slice 4 operations cockpit proof is a non-visual read-model contract. It shows gate, conference, evidence, dependency, and resource posture metadata only; it does not import raw private evidence bodies, display raw source, execute live Codex dispatch, scan/materialize resources, commit runtime operational data, or claim Product Design visual acceptance.

Slice 5 conference/AI operating-loop proof remains local-only. Conference invite outbox rows are dry-run records, linked back to conference readbacks, and never sent to live Codex threads. Work-index drill-through exposes story/assignment/gate/conference/evidence/audit metadata only; it does not mutate thread registry state, execute copied helpers, automate action items, ingest private evidence bodies, or turn Owner Intent gates into automatic operations.

Slice 6 knowledge/guide/release-note proof remains local-first and metadata-only. Documentation records may link stories, conferences, and evidence, but they do not store runtime operational content dumps, raw private evidence bodies, raw source dumps, local absolute path dumps, or publication payloads. Export, publish, canonical knowledge promotion, guide publication, and release-note closeout remain blocked without a separately routed Owner Intent/export packet.

Slice 7 dependency/license and Resource Library governance proof remains local-first and metadata-only. Dependency records and detection findings do not install, remove, update, remediate, or mutate package files. Resource records, materialization requests, manifests, and audit findings do not run scanners, ingest raw scanner output, copy binaries, materialize assets, or write product repos. Legal completion, dependency clean posture, public readiness, release readiness, Product Design final acceptance, product acceptance, and final MVP acceptance remain unclaimed.

Slice 8 materialization history/update/rollback proof remains no-execution and local-first. Materialization history, update, replacement, rollback, rollback-plan, retirement, cleanup-readback, and materialization-control index records preserve lineage and blocker metadata only. Caller-supplied true execution claims for binary transfer, materialization, update, replacement, rollback, cleanup, delete, or product-repo writes are rejected before storage. No resource binary transfer, product-repo write, scanner ingestion, rollback execution, cleanup/delete execution, release readiness, public readiness, legal completion, Product Design final acceptance, product acceptance, or final MVP acceptance is claimed.
