# Source Export Prerequisite

This checkpoint adds a product-local source/export prerequisite proof for AOS 59AD. It does not delete ignored checkout artifacts, transfer source, contact a target host, or write `/srv/tcrn`.

## Command

```sh
pnpm source-export:proof
```

The command proves the raw checkout remains blocked for direct archive/source transfer when ignored or nontracked forbidden candidates are present. It then creates a route-owned temporary export candidate from an explicit tracked-file allowlist and verifies that candidate before creating a local, non-retained archive digest.

## Export Policy

The clean export candidate may include:

- root package/workspace/config files required for local build/proof shape;
- `apps/**`;
- `packages/**`;
- `scripts/**`;
- `docs/**`.

The export candidate excludes `evidence/**` by default. Ignored and untracked files are not copied into the candidate by construction.

## Fail-Closed Predicates

- raw checkout direct archive is blocked while forbidden ignored/nontracked candidates remain;
- `dist/**`, `node_modules/**`, `.git/**`, coverage/cache directories, `.env*`, `.npmrc`, logs, private key/cert-like files, and similar forbidden transfer classes are rejected;
- tracked symlinks are rejected before staging;
- relative path escapes are rejected before staging;
- clean candidate readback must show zero forbidden candidates, zero evidence candidates, zero symlinks, and zero path escapes;
- any local archive is created only from the verified clean candidate and is removed with the route-owned temporary root.

## Boundaries

- No target-host command execution.
- No SSH, source transfer, target extraction, install/build on target, service lifecycle proof, or writes under `/srv`.
- No destructive cleanup of ignored checkout artifacts.
- No raw private evidence, `.env*`, credentials, tokens, shell history, browser/keychain material, raw source dumps, or target-host local absolute-path dumps in retained evidence.
- No product acceptance, final MVP acceptance, deployment/runtime readiness, release/publication/Selene/push, Batch Push Gate, live dispatch, thread registry mutation, generated bridge mutation, Owner Intent execution, broad Codex Security completion, or broad DPC completion.

## Review Posture

This source/export prerequisite is ready for Arturo to route Sable/Codex Security, DPC, Rowan, and Atlas sequencing after product-local verification. It does not clear Atlas target-host execution by itself.
