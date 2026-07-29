# AOS engine host (EPIC-034 / STORY-118)

> **Direction D (`TCRN-AOS-MIN-011`): this recipe outlived the switch it was built for.**
> Truth stays local-first on the Owner's machine permanently; AOS carries the
> operating and read faces, not the store; the mirror is the standing form rather
> than a transitional stage. The engine copy this manifest places on the VM was
> originally the far side of a two-stage truth topology — the host that would have
> received the chain. **That stage is retired; nothing will be switched to it.**
>
> The copy is kept, and it is kept for a live purpose: it is what makes the
> off-site paired backup **self-attesting at the far end**. A backup that can only
> be checked by the machine that wrote it proves the machine agrees with itself.
> With a governed engine already standing on the VM, a pushed pair can be answered
> there — `snapshot-verify`, `validate`, `event-list` — by something that never
> saw the chain being written. That is remote recoverability demonstrated rather
> than assumed, and it is the reason not one script here was removed.
>
> The manifest's original boundary is unchanged and now permanent rather than
> pending: **no authority material travels with this deployment.** `pinsTransferred`
> is `false`, the VM holds no operator bundle, and under direction D there is no
> longer a later step that would supply one — the governance ceremony stays on the
> Owner's machine for good. The minimum VM bundle that was forged for the switch
> remains on the Mac, undeployed, as a contingency asset.

## What is here

| File | What it is |
| --- | --- |
| `manifest.mjs` | The single declarative statement of what `/srv/tcrn/engine/tcrn-workflow` on `tcrn-platform-dev` must contain: the local governed engine copy at the `v0.8.0` tag anchor, minus `node_modules` and `.git`, plus the built `dist`. Also the verification contract — catalog reason code, cli verb count, verbs required by name, digest ledger form — and the honest ceiling of what the deployment claims. |
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
- **No supply material, permanently.** Under direction D this stops being a
  deferral and becomes the settled shape.
