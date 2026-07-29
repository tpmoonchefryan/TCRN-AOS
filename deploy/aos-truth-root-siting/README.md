# AOS truth-root siting (`TCRN-AOS-MIN-012` / `STORY-129`)

Where the four governance chains would live on `tcrn-platform-dev`, and the
evidence that the address is admissible — produced by the engine, not asserted
by this directory.

**Nothing here moves a chain.** The probe creates throwaway governed workspaces
at the candidate addresses, asks the engine whether it will live there, and
deletes them. It never names, reads or writes the platform's live
`.tcrn-workspace/`.

## What is here

| File | What it is |
| --- | --- |
| `manifest.mjs` | The candidate address, the per-partition layout, the verification contract (which reason codes count as green and which as red), and the ownership / paired-backup plan that is deliberately **recorded and not applied**. |
| `probe.mjs` | The five-step run: preflight, site each partition, red probes in scratch, teardown, reclaim. Receipt: `evidence/aos-vm-relocation-prep.json`. |

```sh
node deploy/aos-truth-root-siting/probe.mjs
```

## The address

```
/srv/tcrn/governance/tcrn-workspace/
├── release-trust/                     ← shared by all four partitions
├── cross-project/
│   ├── workspace/                     ← --workspace   (the governed root)
│   ├── transient/                     ← --transient
│   ├── evidence-locator/              ← --evidence-locator
│   └── attestations/                  ← --attest-dir  (SIBLING of workspace/)
├── TCRN-AOS/          … same four
├── TCRN-Design-System/… same four
└── TCRN-TMS/          … same four
```

`--framework` is `/srv/tcrn/engine/tcrn-workflow`, the engine copy `STORY-129`
places on the host.

Congruent with the Mac on purpose. The load-bearing part is `attestations/`
being a **sibling** of `workspace/` rather than living inside it:

```
packages/cli/src/index.ts
  if (insideWorkspace(workspaceRoot, directory))
    fail("CLI_ARGUMENT_MALFORMED", "--attest-dir must resolve outside the workspace root");
```

The relocation family emits its stage attestations through that same
`--attest-dir` flag, so an address whose attest directory sits under the
workspace root cannot host an attested relocation at all. The probe checks both
directions: the sibling accepted **and a file actually written** at each real
candidate address, and the inside-the-root form refused `CLI_ARGUMENT_MALFORMED`
in scratch.

Why the red half runs in scratch rather than at the candidate address: the
containment check happens *after* the mutation commits, so running it against a
probe workspace would consume that workspace's one-shot `attestation-enable`
and leave the green half unprovable.

## What a green run establishes — and what it does not

Established: at each of the four addresses the engine will `init` a governed
workspace (`WORKSPACE_COMMAND_COMPLETED`), accept a sibling `--attest-dir` and
write the attestation file, and answer `relocation-inspect`
(`WORKSPACE_RELOCATION_INSPECTED`, `state: live`). The gate is live in both red
directions. `df -T` and statfs are recorded as the *reason* — ext4, magic
`0xef53`, device `64512`, ~66 GiB free — never as the predicate; the engine's
own answer is the predicate.

Not established: that any chain has moved, that the host is authorized to write
one (no authority material is on the VM and none travels with this recipe), or
that the address is right for reasons other than admissibility.

## Ownership (planned, not applied)

| Path | Owner | Mode |
| --- | --- | --- |
| `…/tcrn-workspace` | `ryanlan:staff` | `0700` |
| `…/tcrn-workspace/<partition>` | `ryanlan:staff` | `0700` |
| `…/<partition>/workspace` (and the three siblings) | `ryanlan:staff` | `0700` |
| `…/release-trust/gate-identity-authority.json` | `ryanlan:staff` | `0600` |

Same shape as the Mac, and the same principal the engine copy already runs as
(`/srv/tcrn/engine/tcrn-workflow` is `ryanlan:staff` after the deploy's rsync).
`0700` matters more here than it does on a laptop: `/srv/tcrn` is not its own
mount — it is the root ext4 logical volume that k3s and the other VM services
also live on, so anything group- or world-readable widens the read surface
across every workload on the box.

**Residual, stated rather than papered over:** the operator reaches this host as
`root` over ssh. `0700 ryanlan:staff` narrows the surface for *other services*;
it does not narrow it for the login that would be doing the relocating. Removing
that would mean a non-root operating account and a `root`-login policy change —
a host-configuration decision `MIN-012` has not been asked.

## Paired backup after relocation (planned, not applied)

Today's pair runs Mac → `/srv/tcrn/backups`, with the VM as the far end that can
answer for bytes it never wrote. If the chain moves here, **that argument
inverts**: a backup whose only copy sits on the machine that holds the chain
proves the machine agrees with itself — precisely the failure the current
arrangement exists to avoid, pointing the other way.

So the constraint after relocation is: the far end must stop being this host.
The Mac (and/or the existing OneDrive cadence) becomes the receiving side, and
it must be able to answer `snapshot-verify` / `validate` / `event-list` over the
pushed pair itself. A local snapshot under `/srv/tcrn/backups` is still worth
keeping as the fast restore path — it just stops counting as the proof.

Direction, retention, cadence and who initiates the push are **unruled**. This
records the constraint, not the decision.
