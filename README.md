<h1 align="center">TCRN AOS</h1>

<p align="center">
  Work items and a knowledge base, for people and agents on the same team.
  Runs on one node, owns its own data, and needs nothing else at runtime.
</p>

<p align="center">
  <a href="README.md">English</a>
  · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-5865d8" />
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24.16-3c873a" />
  <img alt="PostgreSQL 18" src="https://img.shields.io/badge/PostgreSQL-18-336791" />
  <img alt="single-node k3s" src="https://img.shields.io/badge/deploys%20on-single--node%20k3s-2f6b45" />
</p>

## What it is

A Jira-and-Confluence-class system you can run yourself: projects, a work-item tree, twelve
relation types, labels, boards, comments, notifications, saved views, knowledge spaces with
page revisions, and an opt-in governance layer of gates, deliberations and decisions.

Three surfaces — a REST API, an MCP service, and a server-rendered web interface — are all
generated from one registry of operations. That is not an implementation detail: it is what
lets the build check, rather than promise, that **a person can do by hand everything an agent
can do**.

## What makes it different

**Every mutation is a real form post.** The interface changes things by submitting
`<form method="POST">` to the same operations the API exposes, so it is an API client by
construction rather than by intention, and the whole product stays usable by hand.

That is a floor, not a ceiling. An earlier draft of this file stated a ban on client-side
JavaScript and called the product "not progressively enhanced". Nobody ruled that: it was
the author's inference from "a person can manage the project by hand", it was stricter than
the requirement, and it was the opposite of the posture the tree before this one had
recorded. The design system this product renders with expects script — its tab component
takes a required `onSelect`, its overlays are Radix, and it ships a client controller for
its shell. The requirement that survives is the one the gates actually check.

**The claim is a test.** `gate:parity-registry` asserts the registry, the OpenAPI document
and the MCP tool list are the same set in both directions. `gate:forms` boots the real
server, opens every route a control declares, and replays every form it finds. `gate:human-only`
runs a whole project through those forms with zero agent principals in the database and the
MCP surface never contacted. If a screen goes missing, the build goes red.

**Three tiers of mutability, enforced by the database.** Work items and pages are editable
and reopenable, with every prior value kept in a revision row. The activity stream and the
revision tables are append-only, protected by triggers rather than by discipline.
Deliberation positions, minutes, gate decisions and decisions are immutable and corrected
only by writing a successor — a defeated position stays on the record.

**Erasure without breaking the audit trail.** The activity stream records who changed which
*field names* and points at the revision row; it never stores the values. Erasing a person's
data deletes revision rows through one named, journalled path, and the immutable stream stays
whole. The journal's own trigger has no exemption, so a purge cannot erase its own trace.

**Chinese search that works.** `to_tsvector` treats an unbroken run of Chinese as a single
token, so a two-character query — the dominant Chinese word form — matches nothing. The
analyzer emits overlapping bigrams for CJK and ordinary lexemes for Latin, and the same
function runs on write and on query so the two cannot drift. `gate:search-cjk` holds the
corpus and also asserts the naive behaviour still fails, so the reason this exists stays
true or goes red.

## Run it

```sh
pnpm install
pnpm db:up          # Postgres 18 in Docker, on port 55432
pnpm build
AOS_BIND_HOST=127.0.0.1 AOS_DATABASE_URL=postgres://postgres:devpass@127.0.0.1:55432/aos pnpm start
```

On first boot it creates one administrator and prints the password once. There are no
default credentials.

For single-node k3s, see **[deploy/BOOTSTRAP.md](deploy/BOOTSTRAP.md)** — six commands, each
of them run rather than described.

After deployment, `pnpm verify:deploy` runs the external smoke check and then the persistence
check. It requires a reachable cluster and deliberately deletes the Postgres pod, so it is
an operator-run proof rather than part of `pnpm verify`.

## Verify it

```sh
pnpm verify
```

Sixteen steps: types, the generated migration module, the build, the tests, licences, and
eleven gates — the verify-step manifest, registry parity, no side door into the store, the OpenAPI
document, the MCP handshake, form replay, the by-hand scenario, Chinese search, absence of the sibling
repositories, self-sufficiency, and generated-file encoding.

`pnpm verify:fast` skips the gates that need Docker.

## Layout

```text
packages/store    Postgres access, migrations codegen'd into the artifact, ids, text analysis
packages/kernel   the operation registry, dispatch, authorization, audit, and all domain logic
packages/mcp      the MCP server, generated from the registry
apps/server       Fastify: REST, the MCP endpoint, and server-rendered pages
apps/web          the interface — pages, the shared kit, the stylesheet
deploy/k8s        Kustomize base and a single-node overlay
scripts           the gates
```

## What it deliberately does not have

No rich-text editor — page bodies are Markdown in a textarea, rendered as text. No email or
webhooks; notifications are in-app, because SMTP would be an external service at runtime. No
drag-and-drop board; the same move is a select and a button, which is what keeps the board
usable by hand. No multi-tenancy, no custom roles, no identity provider. Attachments
are schema placeholders only; there is no upload path or blob volume in this release. The base
Kubernetes manifest is deliberately a local HTTP demo, so it sets `AOS_SECURE_COOKIES=false`;
an HTTPS production overlay must set it to `true`. The single-node manifest starts one app
replica by default, while all implemented state lives in Postgres.

It has no dependency on any other repository in this platform, and `gate:absence` renames
them aside and runs the suite to keep that true.

On each boot, expired or revoked sessions older than 30 days, idempotency records older than
7 days, and old notifications are pruned. The activity stream is intentionally append-only;
its growth is a design choice, not an unadvertised cleanup omission.

## Licence

Apache-2.0. See [LICENSE](LICENSE).
