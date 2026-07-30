# AOS access boundary (MIN-007 D7 / D10)

This directory is the deployable statement of two CONF-007 rulings and the
scripts that prove and reproduce them. Nothing here is a default: each is a
ruling with an identified alternative that was considered and refused.

## D7 — the write face stays on 127.0.0.1, reached only through SSH

The cockpit service (the only HTTP surface that can reach chain-mutating verbs)
binds `127.0.0.1` and nothing else. The bind is hard-coded at the `listen` call
in `apps/cockpit-service/src/service.ts` — deliberately not an option, not an
environment variable. Any operator or process that is not on the Owner's device
reaches the write face exclusively through an SSH tunnel
(`ssh -L <local>:127.0.0.1:<port> <host>`), so every off-host caller has first
passed SSH's authentication, and the network never carries an unauthenticated
path to a pins-adjacent process.

### Escalation clause (the tripwire, upgraded to write-face level)

**Any change that lets the write face's address leave the Owner's device is
handled as an external-release-grade stop.** Concretely: rebinding to
`0.0.0.0`, a LAN or tailnet address, adding a reverse proxy or port-forward in
front of the service, or introducing a config/env knob that could carry such an
address, is *not* a config tweak — it pauses work exactly the way an external
release does (one of the three mandatory stop classes), and proceeds only on an
explicit Owner ruling recorded on the chain.

### Detection

Two independent layers, both of which have been seen red:

1. **Test tripwire** — `apps/cockpit-service/test/service.test.mjs`,
   test "the write face binds 127.0.0.1 and nothing else — the access-boundary
   tripwire". It asserts the *kernel-reported* bound address
   (`server.address().address`) is exactly `127.0.0.1`, so any rebind — however
   it is introduced in source — turns the standing test suite red. The red was
   manufactured once (dist bind flipped to `0.0.0.0`, watched fail, restored):
   see `evidence/aos-access-boundary-proof.json` (`tripwireDrill`).
2. **Tunnel/topology proof** — `node deploy/access-boundary/tunnel-proof.mjs`
   re-derives the whole boundary on the live VM: a loopback listener standing
   in for the write face refuses a direct LAN connection (red) and answers the
   same request through `ssh -L` with a run-specific nonce (green), then
   reclaims its own process group and scratch directory with verification.

Rationale for the split: the test guards the bytes that will be deployed; the
tunnel proof guards the topology those bytes run in. Either alone can be green
while the boundary is broken (a correct bind behind a reverse proxy; a correct
topology running a wrong build).

## D10 — gate identity authority: one canonical source, copies by digest

The canonical `gate-identity-authority.json` lives with the ceremony terminal
(the Owner's machine, under the platform workspace's `release-trust/`) and is
**read-only from this repository's point of view** — no script here writes it.
A host that has to resolve owner gates holds a *copy*, placed and verified by
full-value sha256 comparison against the canonical source, `0600`, **at the
governed workspace's own bound `release-trust` root** — and nowhere else on that
host.

### The same file, removed and placed on the same host — both correct

Read this before you conclude one of the two acts was a mistake.

D10's rule has never changed: one canonical source on the ceremony terminal,
copies by digest, **and only where a consumer exists**. What moved is the
consumer.

| When | Truth root / ceremony | Correct disposition on the VM |
| --- | --- | --- |
| MIN-007 D10 | ceremony on the Owner's machine, two-stage topology still live | copy **placed** at `/srv/tcrn/governance/gate-identity-authority.json` |
| MIN-011 (direction D) | truth root stays on the Owner's machine; the VM copy has no remaining consumer | copy **removed** — recorded in `evidence/aos-direction-d-disposition.json` → `gateAuthorityRemoval` |
| TCRN-AOS-INC-044 (now) | AOS truth root relocated to the VM (relocation `adopted`, sequence 2); the ceremony follows the chain | copy **placed** at the workspace's bound release-trust root, `/srv/tcrn/governance/tcrn-workspace/release-trust/` |

The defect INC-044 fixed is precise: the release-trust root relocated to the VM
**empty**, so `gate-transition` had no authority document at the address the
workspace itself declares, and the owner-gate ceremony could not be performed at
the new address at all.

Do **not** read the current placement as reverting the MIN-011 removal, and do
not recreate the retired path — the recipe asserts that path is still absent
before it places anything, precisely so the host never holds two authority
documents.

### Running it

```
node deploy/access-boundary/place-gate-authority.mjs             # place, verify, red-drill, owner-gate drill
node deploy/access-boundary/place-gate-authority.mjs --no-drill  # placement and red drill only
```

The script:

1. reads the canonical source (read-only) and takes its sha256;
2. **derives the destination from the chain's own control record** — the adopted
   relocation's `release-trust` root in the VM workspace's `workspace.json` —
   then checks it against a reviewed constant, so a relocation to an unreviewed
   address fails closed instead of quietly planting an authority somewhere new.
   It also asserts the MIN-011-removed path is still absent;
3. writes the copy on the VM with `umask 077` and `chmod 0600`, then compares
   the VM's own sha256 of the copy against the canonical digest, full value;
4. proves that comparison can go red at **two** layers — one flipped remote byte
   makes `sha256sum` disagree, and (in the drill) the same flip makes the VM
   *engine* refuse a `gate-transition` with `GATE_IDENTITY_AUTHORITY_DIGEST`.
   The filesystem layer alone only proves `sha256sum` works; the engine layer is
   the predicate the ceremony actually runs through. The copy is restored and
   re-verified after each flip;
5. stands up a disposable governed workspace under `/srv/tcrn/scratch-*`,
   creates an `owner_intent_required` gate, and shows the engine ruling **per the
   placed copy at the new address** across four states: wrong digest refused
   `GATE_IDENTITY_AUTHORITY_DIGEST`; unpermitted actor refused
   `WORKSPACE_GATE_IDENTITY_REFUSED`; permitted actor + correct digest passing
   the identity layer (`satisfied` then meets the engine's separate
   evidence-anchoring rule, `WORKSPACE_GATE_EVIDENCE_UNRESOLVED`); and a
   `blocked` transition completing as a real write. The scratch tree is removed
   and its absence verified.

**The live AOS chain is never a target of a mutating verb.** The only verb this
recipe runs against it is read-only `status`, recorded in the receipt so the
chain version and head hash before and after are checkable.

Receipt: `evidence/aos-gate-authority-at-new-address.json`. The older
`evidence/aos-gate-authority-placement.json` is kept as history of the
MIN-007-era placement at the now-retired path; it is not a live claim.

If the canonical roster ever changes, re-run the recipe; a stale VM copy fails
the digest comparison and the receipt refuses to claim placement.
