# Switch rehearsal (STORY-122 / STORY-125 / STORY-123)

A four-act walk of the switchover ceremony's verification shape, ruled by
`TCRN-AOS-MIN-007` (矩阵双跑 → owner 门 → 切换 → 降级归档, with a semantic-drift
red path as a standing rehearsal obligation).

**This directory produces evidence, never authority.** Nothing here grants a
switchover, a migration, or a release. The owner gate is elsewhere.

## The acts

| Act | Story | What it walks |
| --- | --- | --- |
| `act1-scratch-arc.mjs` | S122 | Build a governed scratch chain locally, mirror-ingest the A side, run the 5×4 consistency matrix green on both containers, take the chain-side anchor, transfer to the VM with per-file sha256 reconciliation in both directions, and have the VM's own engine re-verify. |
| `act2-real-chain-arc.mjs` | S122 | The live chain, read-only. A byte copy proven to share no inode with the authority answers `validate` + `snapshot` green; the matrix comes out in its honest pre-instantiation shape (A side declared absent); the copy replays on the VM engine and is then deleted from both sides. |
| `act3-product-walkthrough.mjs` | S125 | The cockpit service itself on the VM — `AOS_ACTOR` explicit, bound to 127.0.0.1, reached only through `ssh -L` (CONF-007 D7). Eleven module read faces, the four safe write routes end to end, an `INVALID_TRANSITION` refusal, a ceremonial-verb 404, and the S113 write log observed moving in lockstep with the chain. |
| `act4-rollback-arc.mjs` | S123 | Rollback in six steps: freeze → restore the base (snapshot-verify **and** validate) → enumerate the delta (with injected forged rows) → governed replay through the engine's own verbs → reconcile → new anchor. |

Acts 3 and 4 are a **pair**: act 3 drifts the scratch chain and leaves the
service up, act 4 freezes it and rolls it back. Act 3 resets the VM scratch
chain to the anchor on entry, so the pair can be re-run.

## Running it

```sh
node deploy/switch-rehearsal/act1-scratch-arc.mjs
node deploy/switch-rehearsal/act2-real-chain-arc.mjs
node deploy/switch-rehearsal/act3-product-walkthrough.mjs
node deploy/switch-rehearsal/act4-rollback-arc.mjs
node deploy/switch-rehearsal/emit-evidence.mjs     # writes evidence/, redacted
```

Red modes for act 4, each expected to exit non-zero at a named step:

```sh
TCRN_REHEARSAL_RED=accept-forged        node deploy/switch-rehearsal/act4-rollback-arc.mjs  # enumerate-delta must go red
TCRN_REHEARSAL_RED=drop-one-replay-row  node deploy/switch-rehearsal/act4-rollback-arc.mjs  # reconcile must go red
```

Cleanup is part of the run, not a follow-up: delete `/srv/tcrn/scratch-rehearsal-*`
on the VM and the `switch-rehearsal-*` directories in the session scratchpad, then
confirm the process residue is zero on both sides.

## Containment

- Governed **writes** only ever target a workspace under the session scratchpad
  or under `/srv/tcrn/scratch-rehearsal-*`; `assertScratchWorkspace` and the VM
  prefix check in `rehearsal-lib.mjs` refuse anything else.
- The live chains are read. Act 2 proves its copy shares no inode with the
  authority, file by file, and re-reads the authority's head afterwards.
- Every judgement routes through the engine — its CLI verbs, its `commands`
  roster, its `canonicalJson`. Nothing here re-implements an engine rule.

## Two reclaim rules this directory paid for

1. **A remote start command must not carry its own output back.** `ssh` waits
   for the session channel; a start that also prints leaves it referenced and
   the call hangs. The pid goes to a file that a second, ordinary call reads,
   and `ssh -n` closes stdin. An interrupted run here once left a cockpit and
   its engine facade alive on the VM for eight and a half hours.
2. **Reclaim is proven by the socket, not by the process table.** This host is
   `ControlMaster auto` + `ControlPersist`, so the `ssh -N -L` client exits as
   soon as the master accepts the forward — a "no client process remains" check
   is green from the first second and stays green while the port is held. The
   predicate is "nothing is listening on the port", and the reclaim asks the
   master (`ssh -O cancel -L …`). `tunnel-reclaim-red-proof.mjs` makes the old
   predicate read green and the new one read red at the same instant.
