# TCRN-AOS

![TCRN-AOS product impression](docs/brand/tcrn-aos-impression.png)

Local implementation checkpoint for the TCRN Agent Operations System MVP Operational Spine.

This repository is a local product shell only. It does not publish, deploy, mutate other product repositories, execute copied helpers, or claim AOS product acceptance.

## Local-First Posture

- AOS owns operational tickets, gate work orders, assignments, conferences, audit events, evidence references, dependency/resource posture records, and derived stage-map state.
- TCRN Workflow remains the source of truth for governance, initiative gates, role contracts, workflow knowledge, and project registry readback.
- GitHub remains the source of truth for repository, PR, CI, and release state.
- Product repositories remain the source of truth for product code and docs.
- Codex dispatch is dry-run only in this checkpoint.
- No Redis or external queue is used.
- Runtime operational data stays in local ephemeral storage for proof runs. Git stores source, schema, fixture seed, tests, and evidence notes only.
- The web surface is now a first-slice frontend shell with a dummy Cockpit and Jira-like work entry. It is not a final cockpit aggregation and is not Product Design accepted UX.

## Local Commands

```sh
pnpm install
pnpm verify
pnpm runtime:db:proof
pnpm service:smoke
pnpm aos:frontend-shell-proof
pnpm slice3:proof
```

## Brand Assets

- Selected geometric wordmark: `docs/brand/tcrn-aos-wordmark-geometric-dark.png`
- Selected geometric wordmark preview: `docs/brand/tcrn-aos-wordmark-geometric-dark-preview.png`
- Selected geometric wordmark spec: `docs/brand/tcrn-aos-wordmark-geometric-spec.md`
- Previous pure text wordmark: `docs/brand/tcrn-aos-wordmark.svg` and `docs/brand/tcrn-aos-wordmark.png`
- Rounded-square favicon: `docs/brand/aos-favicon.png` and `docs/brand/favicon.ico`
- README impression image: `docs/brand/tcrn-aos-impression.png`

## Frontend Shell

- Static React shell source: `apps/web/src/**`
- Generated shell artifact: `apps/web/dist/index.html` from `pnpm build`
- Served local routes: `/`, `/cockpit`, `/work`, and placeholder module aliases through `pnpm service:start`
- Scope boundary: dummy Cockpit only, no final aggregation API, no live dispatch, no external queue, no product acceptance, and no release-readiness claim.
