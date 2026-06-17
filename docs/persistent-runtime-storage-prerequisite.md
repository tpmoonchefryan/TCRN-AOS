# Persistent Runtime Storage Prerequisite

This checkpoint adds a product-local command/profile for the 59Z persistent runtime prerequisite. It is not a target-host proof and does not write `/srv/tcrn/runtime/TCRN-AOS`.

## Command

```sh
pnpm runtime:persistent-proof
```

The command builds AOS, creates a route-owned temporary runtime root, writes a synthetic non-private persistent record, reads it back, simulates a process restart by reopening storage from disk, proves backup/restore, reads ownership and permission predicates, then resets the route-owned root.

The future target-host runtime root is profile metadata only: `/srv/tcrn/runtime/TCRN-AOS`. A later Atlas route must still run the reviewed command/profile on the target host after transfer filtering and review convergence.

## Fail-Closed Predicates

- missing runtime root is rejected unless the command is explicitly running in safe temp-root proof mode;
- conflicting explicit `--runtime-root` and `--use-temp-runtime-root` flags are rejected;
- runtime roots inside the Git/source tree are rejected;
- roots aliasing the wrong sibling are rejected;
- symlinked roots and symlink ancestors are rejected before mkdir/use/reset;
- non-empty unowned roots are rejected before marker creation;
- stale runtime data without the route-owned marker is rejected;
- stale markers with mismatched profile, route, run context, or runtime-root digest are rejected;
- reset refuses to delete any root without the current route-owned marker and matching runtime-root digest;
- backup/restore is implemented for the synthetic profile record, so unsupported backup/restore is not silently accepted.

## Boundaries

- No target-host command execution.
- No SSH, source transfer, install/build on target, service lifecycle proof, or writes under `/srv`.
- No raw private evidence, `.env*`, credentials, tokens, shell history, browser/keychain material, raw source dumps, or target-host local absolute-path dumps in runtime storage or evidence.
- No product acceptance, final MVP acceptance, release/publication/Selene/push, live dispatch, thread registry mutation, generated bridge mutation, Owner Intent execution, broad Codex Security completion, or broad DPC completion.

## Review Posture

This product-local prerequisite is ready for Arturo to route Sable/Codex Security, DPC, Verity, Rowan, and Mara sequencing. It does not clear the separate transfer evidence filtering/allowlist prerequisite.
