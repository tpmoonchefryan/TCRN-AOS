# Retiring the mirror segment (TCRN-AOS-STORY-134)

The read-only LAN mirror is gone. It ran on the k3s cluster on `tcrn-platform-dev`
from 2026-07-26T19:29:30Z to 2026-07-30: one unprivileged nginx pod serving a
static server-rendered copy of the cockpit from a hostPath, published on the LAN as
`aos.tcrn.lan` through traefik.

**Why** (`TCRN-AOS-MIN-012`, decision 7): the truth host now carries a RESIDENT
cockpit — a systemd unit reading and writing the governance chain that relocated to
that same host. The mirror existed because there was no service on that side to
read. There is one now, and it is the real thing rather than a copy of it.

## Why the route was removed and not repointed

This is the decision worth stating, because repointing is the obvious thought.

The resident cockpit binds `127.0.0.1` and the only path onto it from anywhere else
is an SSH tunnel (CONF-007 D7). Putting a LAN ingress in front of it would be the
overturn of that ruling wearing the costume of a configuration change — same YAML,
same one-line edit, an entirely different security posture.

And the mirror's one residual use is exactly the case D7 prohibits: a browser on
the LAN with no ssh. So the residual is **foreclosed by the ruling**, not waived
for convenience. That distinction is what the convention asks for and it happens to
point the same way here: there is no supported reader for whom the old path still
holds.

`aos.tcrn.lan` is therefore unclaimed cluster-wide. The name still resolves on the
Owner's machine from an `/etc/hosts` entry that now points at nothing in
particular; removing that line is a change to a system file and is left to the
Owner. Traefik answers `404 page not found` for the host, which is why the absence
predicate is not "the request fails".

## Files

| File | What it is |
| --- | --- |
| `manifest.mjs` | The declarative inventory — namespace, the five objects, the hostPath, the LAN name — plus the pure predicates that decide absence |
| `retire.mjs` | The ceremony: forensics → declarative delete → verify absence → confirm the resident cockpit is untouched → write the receipt |
| `retirement-guard.mjs` | The standing offline gate (`pnpm mirror:retirement-proof`, in `pnpm verify`): the retirement stays retired |

```
node deploy/aos-mirror-retirement/retire.mjs --forensics-only   # pre-state, touches nothing
node deploy/aos-mirror-retirement/retire.mjs                    # the retirement itself
node deploy/aos-mirror-retirement/retirement-guard.mjs          # the standing gate
```

`retire.mjs` is idempotent in the direction that matters: on an already-retired
cluster the inventory reads `absent` and the first step reports it rather than
inventing a removal. It is not, however, a thing to re-run casually — its forensics
step reads a bundle that no longer exists in the repository, so a second run fails
at `deployed-equals-committed`, honestly, having changed nothing.

## Design notes worth keeping

**Forensics come first and are not optional.** A deleted deployment cannot be asked
what it was. Every later question — what image, which route, which bytes, was the
deployed copy the committed one — has exactly one chance to be answered.

**Removal is declarative.** The committed `deploy/aos-mirror.yaml` is streamed to
`kubectl delete -f -`, so what was removed is exactly what had been declared. No
name list was retyped and nothing was installed on the VM.

**Verification is produced by a different act than the removal.** The objects are
asked for individually afterwards, because from the delete's exit code alone a
cascade that left one object behind reads the same as one that worked. A check whose
two sides come from the same act can only ever be green.

**The hostname question is asked of the whole cluster.** "Is this name claimed
somewhere else" is not something a namespace delete can answer.

**Both sides of the absence predicate were observed.** The mirror was probed from
the Owner's machine over the LAN and answered `200` with a server-rendered view
marker; after the removal the same probe gets `404` and no marker. The control that
the ingress controller itself is fine: `grafana.tcrn.lan` still routes.

**The bundle ledger decides whether anything was destroyed.** Per-file sha256 was
computed on the VM and in the repository by the same recipe and compared full-value:
16 files, identical, ledger digest `83e24f7c842476d05db005f2b6ee187e9582c1340cc536e73dcdba6f76e0c35a`.
So the removal took a copy, not an original.

**Two bugs this recipe paid for, recorded so the next one does not.** Async
`execFile` has no `input` option — that belongs to the `*Sync` variants — so the
first attempt at the declarative delete left `kubectl delete -f -` waiting on a
stdin nobody would close: no error, nothing deleted, a hang. And `String.length`
counts UTF-16 units, so a page full of Chinese governance text measures 380,234
against a real 412,653; two probes of the same document would appear to disagree.
Both are in the code comments at the site.

## What else went with it

Repository assets, each with its reasoning in `docs/retired-proof-scripts.md`. All are
recoverable from git history at `0e0ca0876a04`, the commit this retirement was performed
from; the removals themselves are uncommitted working-tree changes awaiting review, so
that is the recovery point and no later one.

- `apps/web/mirror/` — the committed bundle, whose only consumer was the removed
  hostPath;
- `scripts/build-mirror.mjs` / `pnpm mirror:build` — the builder;
- `scripts/mirror-freshness-proof.mjs` / `pnpm mirror:freshness-proof` — replaced in
  `pnpm verify` by `mirror:retirement-proof` rather than dropped, because
  `TCRN-AOS-INC-030` is the receipt for what a bundle does when nothing is watching;
- `scripts/mirror-acceptance-proof.mjs` — the D9 acceptance proof, whose five
  criteria are re-asked by `deploy/aos-resident-cockpit/walkthrough.mjs` against the
  real chain (the criterion-by-criterion mapping is in the retired-scripts doc).

`deploy/aos-mirror.yaml` is KEPT, annotated with the retirement and with what a
revival would actually need. `evidence/aos-mirror-acceptance.json` is kept
byte-untouched: chain annotations cite it, and editing bytes the chain points at in
order to add a note would corrupt a citation for tidiness.
