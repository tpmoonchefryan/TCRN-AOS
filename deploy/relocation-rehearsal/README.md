# Relocation rehearsal (STORY-130)

A full walk of the governed workspace-relocation ceremony — `relocation-plan →
relocation-vacate → operator moves the bytes → relocation-adopt → two-sided
`relocation-inspect`` — plus the `vacate → abort` recovery arc, on **throwaway
chains only**.

**This directory produces evidence, never authority.** Nothing here relocates a
live chain, nothing here grants a relocation, and no permit minted here names a
live `workspaceId`. The real hop is a separate, owner-gated act.

## Why it exists

`deploy/switch-rehearsal/` had to hand-rewrite `workspace.json`'s five stored
roots to make a byte-moved chain answer `validate` (`placementScriptText`). That
edit is exactly what engine `v0.9.0` / ADR 0003 replaced with a governed route.
Before that route is pointed at anything that matters, it gets walked end to end
on a chain nobody has to protect.

## Containment

- Governed **writes** only ever target a workspace under this session's
  scratchpad or under `/srv/tcrn/scratch-relocation-*` on the VM.
  `assertScratchWorkspace()` in `relocation-lib.mjs` is asserted on every
  mutating call on both hosts — a refusal, not a convention.
- `.tcrn-workspace/*` is **read-only** for the whole of this rehearsal. No
  mutating verb, including the relocation family, is pointed at it.
- The rehearsal starts no long-lived load at all. Teardown deletes both scratch
  estates, **verifies the absence** rather than assuming it, and counts process
  residue anyway.

## Running it

```sh
export TCRN_AOS_RELOCATION_SCRATCH=<this session's scratchpad>
node deploy/relocation-rehearsal/arc.mjs prepare    # chain + plan + both permits + copy-first red
node deploy/relocation-rehearsal/arc.mjs vacate     # kill the source, prove it dead on 10 faces
node deploy/relocation-rehearsal/arc.mjs transfer   # move the bytes, reconcile both directions
node deploy/relocation-rehearsal/arc.mjs adopt      # three refusal drills, then the adopt
node deploy/relocation-rehearsal/arc.mjs verify     # validate/status + the 5x4 matrix on the VM
node deploy/relocation-rehearsal/arc.mjs closeout   # the two-sided inspect ADR 0003 makes binding
node deploy/relocation-rehearsal/arc.mjs abort      # the recovery arc on a second scratch chain
node deploy/relocation-rehearsal/arc.mjs teardown   # delete both estates and verify the absence
node deploy/relocation-rehearsal/emit-evidence.mjs  # evidence/aos-relocation-rehearsal.json, redacted
```

Any step that goes red throws immediately; the stage receipts persist under the
scratchpad so a re-run resumes from the next stage rather than rebuilding.

## The refusal drills, and why each carries both halves

A red that would be red for an unrelated reason measures nothing, so every drill
asserts the other side too.

| Drill | Expected refusal | The half that keeps it honest |
| --- | --- | --- |
| adopt before vacate | `WORKSPACE_RELOCATION_NOT_PENDING` | the same command with the same flags is accepted after the vacate |
| a dropped empty `backups/` | `WORKSPACE_RELOCATION_CONTROL_TREE_INCOMPLETE` | `verifySnapshotManifest` is still `SNAPSHOT_VERIFIED` — the manifest is structurally blind to it |
| a carried-across `lease` | `WORKSPACE_RELOCATION_TRANSPORT_RESIDUE` | same |
| a permit for the right hop and the wrong stage | `WORKSPACE_RELOCATION_NOT_PERMITTED` | only `stage` differs from the permit that is accepted |
| an abort permit pre-minted in the vacate's own document | `WORKSPACE_RELOCATION_VACATE_COMMITMENT_MISMATCH` | a second document naming the committed value aborts cleanly |
| an `abort` permit without `vacateCommitmentSha256`, and a `vacate` permit carrying one | `WORKSPACE_RELOCATION_AUTHORITY_MALFORMED` | both directions, because an optional field nothing rejects when misplaced reads as applying where it does not |

## What this rehearsal does NOT establish

Read `docs/adr/0003-workspace-relocation.md`'s four ceilings before quoting any
result from here. In particular: the two-sided close-out is a statement about
**the two addresses on the hosts where it ran**, never about the `relocationId`
globally — one adopt permit presented at the same destination path on N hosts
yields N live authorities and the close-out is green at every one of them.
