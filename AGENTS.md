# AGENTS.md — TCRN AOS

This repository is a product: work items and a knowledge base. It is not part of any
governance framework, it holds no chain, and it carries no platform-level checks. If you
came here looking for those, they are not here and should not be added — a product
repository that also judges the platform is how the last version of this code became
unusable as either.

The manual is `README.md`; the deployment is `deploy/BOOTSTRAP.md`.

## The one architectural rule

Every product act is one entry in the operation registry (`packages/kernel/src/registry.ts`),
and that entry declares its schema, its HTTP route, its MCP tool name and its UI control
together. REST, MCP and the rendered pages are all generated from it.

Adding a capability therefore means adding a registry entry AND the screen that performs
it. Not the screen later: `gate:parity-registry` and `gate:forms` fail the build when an
operation has no working control, because the promise this product makes is that a person
can do by hand everything an agent can do.

Nothing outside `packages/kernel` may import `packages/store`. Authorization is checked in
exactly one place — `dispatch` — and a transport that could reach past it would make every
other guarantee here decorative. `gate:no-side-door` enforces this; the only exemptions are
process entrypoints, which create the pool before any request exists.

## Working here

- `pnpm db:up` then `pnpm verify` — the full chain, fifteen steps. `pnpm verify:fast` skips
  the gates that need Docker.
- Migrations are `.sql` files under `packages/store/migrations/`, codegen'd into a TypeScript
  module so the running artifact carries its own schema. Run `pnpm codegen:migrations` after
  editing one; `codegen:check` fails the build if you forget. There are no down-migrations —
  a mistake is a new forward migration.
- Every mutation is a `<form method="POST">`, and that is what keeps the product usable by
  hand — `gate:human-only` runs a whole project through those forms with zero agent
  principals and the MCP surface never contacted. Client-side JavaScript is NOT forbidden.
  A previous wording here banned it outright; that was never ruled by anyone, and the design
  system this product renders with expects script. Adding script is fine as long as the
  by-hand path stays whole and that gate stays green.
- Tiers: work items, pages, comments and projects are editable and versioned; the activity
  stream and the revision tables are append-only by trigger; deliberation positions, minutes,
  gate decisions and decisions are immutable and corrected by supersession. The database
  refuses the writes the tiers forbid — do not try to route around it.

## Two traps that have already bitten

**The Postgres volume mounts at `/var/lib/postgresql`, not `/var/lib/postgresql/data`.**
`postgres:18-alpine` puts its data in `/var/lib/postgresql/18/docker` and the older path does
not exist in the image. Mounting there yields a deployment that starts, serves, and loses the
database on every restart without a single error.

**A form posts an empty string for an untouched optional input.** That is adapted once, in
`dispatch`, where an empty value for an optional field means "not given" — never per screen,
and never by making the field required to dodge it.

## Git

Approved identity for commits here is
`tpmoonchefryan <253097889+tpmoonchefryan@users.noreply.github.com>`. Do not add
`Co-Authored-By`.
