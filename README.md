<p align="center">
  <img src="docs/brand/tcrn-aos-impression.png" alt="TCRN AOS product impression" width="720" />
</p>

<h1 align="center">TCRN AOS</h1>

<p align="center">
  Agent Operations System: a local-first operations spine for agent-assisted work, proof, review, and bounded readback.
</p>

<p align="center">
  <a href="README.md">English</a>
  · <a href="README.zh-CN.md">简体中文</a>
  · <a href="README.ja.md">日本語</a>
  · <a href="README.ko.md">한국어</a>
  · <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://github.com/tpmoonchefryan/TCRN-AOS"><img alt="GitHub repository" src="https://img.shields.io/badge/GitHub-TCRN--AOS-24292f" /></a>
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-5865d8" />
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-3c873a" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-local%20packages-3178c6" />
  <img alt="Local first, no live dispatch" src="https://img.shields.io/badge/posture-local--first%20%2F%20no%20live%20dispatch-4f46e5" />
</p>

## What This Repo Is

TCRN AOS, the Agent Operations System, is a local-first operations spine for
agent-assisted work. It models work as projects, initiatives, epics,
story-grain tickets, assignments, evidence links, gate work orders, comments,
and audit events, then exposes bounded MCP-style methods and browser readback
surfaces for reviewable coordination.

This repository is prepared for public source review and local experimentation.
It is not a hosted service, not an autonomous dispatch system, and not a claim
that any TCRN product milestone, runtime, release, owner-facing workflow, or
final acceptance state is complete.

## Local-First Boundaries

- AOS stores operational proof data in local SQLite databases or in-memory stores.
- Runtime profile roots are explicit and marker-checked before SQLite opens.
- Browser readback is scoped to `/api/work/readback` ticket and audit views.
- MCP transport methods are allowlisted; generic gateway, raw DB export, and
  live dispatch surfaces are intentionally absent.
- Audit and receipt payloads are metadata-oriented and redact sensitive detail.
- Codex adapter proof paths are dry-run/no-send unless a separately reviewed
  live-dispatch lane is implemented and accepted.
- Workflow governance, thread registry truth, release authority, and owner
  intent gates remain outside this repository.

## Architecture

```text
apps/
  api/       Local HTTP shell and browser-safe readback facade
  web/       Static React work/readback shell
packages/
  domain/    AOS records, store, policies, idempotency, and redaction
  db/        SQLite repository, migrations, runtime profile validation
  mcp-gateway/
             Domain method dispatcher and method-level idempotency
  mcp-server/
             Local JSON-line stdio/runtime transport
  adapter-codex/
             Dry-run Codex dispatch and terminal-return ingestion helpers
scripts/     Proof, validation, smoke, and source-export helpers
docs/        Architecture, security, runtime, and proof notes
```

## Requirements

- Node.js compatible with the checked `packageManager` field.
- `pnpm`.
- A sibling checkout of `TCRN-Design-System` when installing locally, because
  this package uses local file dependencies:

```text
TCRN Platform/
  TCRN-AOS/
  TCRN-Design-System/
```

## Quick Start

```sh
pnpm install
pnpm build
pnpm verify:fast
pnpm service:start
```

The local service serves the static shell and API readbacks. It does not start a
remote runtime, external queue, live thread dispatch, publication flow, or owner
intent executor.

## Useful Commands

```sh
pnpm typecheck
pnpm test
pnpm verify:fast
pnpm verify
pnpm audit:licenses
pnpm source-export:proof
pnpm service:smoke
pnpm phase3:readback-api-proof
pnpm phase3:frontend-readback-proof
pnpm p1:durable-runtime-profile-proof
```

`pnpm verify` runs the broader local proof suite. Some proof commands create
route-owned temporary storage and clean it up; durable local profile proofs are
explicit about retention and no-overclaim boundaries.

## Security and Privacy Posture

- Do not commit SQLite runtime databases, raw DB dumps, credentials, private
  evidence payloads, local absolute path dumps, browser/keychain material, shell
  history, or raw scanner output.
- Public source export excludes local evidence receipts and generated runtime
  artifacts by construction.
- Sensitive content checks are implemented in domain redaction helpers and in
  source-export/publication proof scripts.
- Runtime profile validation denies unsafe roots, symlinks, traversal, stale
  markers, and non-direct-child database paths before SQLite opens.
- Public repository publication should use a sanitized current-tree export
  rather than legacy local history unless that history has been independently
  proven clean.

## Docs

- [Architecture](docs/architecture.md)
- [Security boundaries](docs/security-boundaries.md)
- [Persistent runtime storage prerequisite](docs/persistent-runtime-storage-prerequisite.md)
- [Source export prerequisite](docs/source-export-prerequisite.md)
- [Gateway adapter proof](docs/gateway-adapter-proof.md)
- [Runtime proof](docs/runtime-proof.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
