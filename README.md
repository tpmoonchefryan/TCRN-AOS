# TCRN-AOS

Local implementation checkpoint for the TCRN Agent Operations System MVP Slice 1 Operational Spine.

This repository is a local product shell only. It does not publish, deploy, mutate other product repositories, execute copied helpers, or claim AOS product acceptance.

## Slice 1 Posture

- AOS owns operational tickets, gate work orders, assignments, conferences, audit events, evidence references, dependency/resource posture records, and derived stage-map state.
- TCRN Workflow remains the source of truth for governance, initiative gates, role contracts, workflow knowledge, and project registry readback.
- GitHub remains the source of truth for repository, PR, CI, and release state.
- Product repositories remain the source of truth for product code and docs.
- Codex dispatch is dry-run only in this checkpoint.
- No Redis or external queue is used.

## Local Commands

```sh
pnpm install
pnpm verify
```
