# AOS engine host (EPIC-034 / STORY-118, engine upgraded under STORY-129)

> **Superseded direction, kept because the reasoning is still load-bearing.**
> Under `TCRN-AOS-MIN-011` (direction D) truth stayed local-first on the Owner's
> machine permanently and this host was **not** going to receive the chain; the
> engine copy earned its keep by making the off-site paired backup self-attesting
> at the far end — a pushed pair answered by `snapshot-verify` / `validate` /
> `event-list` on a machine that never saw the chain being written, which is
> remote recoverability demonstrated rather than assumed. That is why not one
> script here was removed, and it is still true of the copy today.
>
> **`TCRN-AOS-MIN-012` reopens the address.** The engine and the chains relocate
> to this VM; the Mac becomes a pure client. The manifest is therefore pinned at
> **v0.9.0** rather than v0.8.0 — that release carries the governed relocation
> verb family (`relocation-plan` / `-vacate` / `-adopt` / `-abort` / `-inspect`),
> and `relocation-adopt` is the receiving verb a move would run *here*.
> Siting for the chains themselves is a separate recipe:
> [`deploy/aos-truth-root-siting`](../aos-truth-root-siting/README.md).
>
> One boundary survives both directions unchanged: **no authority material
> travels with this deployment.** `pinsTransferred` is `false` and the VM holds
> no operator bundle. Under MIN-012 that is a *preparation* boundary rather than
> a permanent one — a host that is to write the chain will eventually need to be
> supplied — but supplying it is a separately-ruled step, and nothing in this
> directory does it.

## What is here

| File | What it is |
| --- | --- |
| `manifest.mjs` | The single declarative statement of what `/srv/tcrn/engine/tcrn-workflow` on `tcrn-platform-dev` must contain: the local governed engine copy at the `v0.9.0` tag anchor, minus `node_modules` and `.git`, plus the built `dist`. Also the verification contract — catalog reason code, cli verb count (101 at v0.9.0, up from 96 at v0.8.0), verbs required by name (`event-list`, `relocation-adopt`, `relocation-inspect`), digest ledger form — and the honest ceiling of what the deployment claims. |
| `apply.mjs` | The controlled application of that manifest in seven steps: preflight the local anchor, converge with `rsync --archive --delete`, verify with a full per-file sha256 ledger compared both directions, optionally prove the comparison can go red, confirm the far copy answers `commands`, classify the VM's mounts against the engine's pinned filesystem set, and reclaim. |

## Running it

```sh
node deploy/aos-engine-host/apply.mjs               # converge + verify
node deploy/aos-engine-host/apply.mjs --red-drill   # + flip one remote byte and watch the ledger catch it
```

Receipt: `evidence/aos-engine-host-deploy.json`. It carries no local absolute
path — the governed copy is named `<local-governed-copy>`, and the writer refuses
to emit a receipt in which a home-directory path survived.

## The rules this directory runs under

- **Hand-editing the VM tree is not supported.** `apply.mjs` converges with
  `--delete`, so an edit is overwritten rather than accommodated; the red drill
  exists to show such an edit is caught rather than tolerated.
- **The claim never rises above the comparison.** What is proven is byte-identity
  with the local governed copy. Not provenance beyond that copy, not authority,
  not independence of the two copies.
- **No supply material.** Not under direction D (where it was permanent), and
  not under MIN-012 (where it is a preparation boundary). Either way, not from
  this directory.
