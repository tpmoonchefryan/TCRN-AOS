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
Hosts that need to resolve owner gates locally (the VM) hold a *copy*, placed
and verified by full-value sha256 comparison against the canonical source, with
`0600` permissions at `/srv/tcrn/governance/gate-identity-authority.json`.

To place (or re-place, idempotently) the copy and prove it:

```
node deploy/access-boundary/place-gate-authority.mjs           # place + verify
node deploy/access-boundary/place-gate-authority.mjs --drill   # + owner-gate drill on a VM scratch workspace
```

The script:

1. reads the canonical source (read-only) and takes its sha256;
2. writes the copy on the VM with `umask 077` and `chmod 0600`, then compares
   the VM's own sha256 of the copy against the canonical digest, full value,
   and proves the comparison can go red (one flipped remote byte, mismatch
   observed, copy restored, match re-observed);
3. with `--drill`, stands up a disposable governed workspace under
   `/srv/tcrn/scratch-*`, creates an `owner_intent_required` gate, and shows
   the engine ruling **per the placed copy**: a permitted actor with the
   correct digest advances past the identity layer; a wrong digest is refused
   `GATE_IDENTITY_AUTHORITY_DIGEST`; an unpermitted actor is refused
   `WORKSPACE_GATE_IDENTITY_REFUSED`. The scratch tree is removed and its
   absence verified.

Receipt: `evidence/aos-gate-authority-placement.json`.

If the canonical roster ever changes, re-run the placement script; a stale VM
copy fails the digest comparison and the receipt refuses to claim placement.
