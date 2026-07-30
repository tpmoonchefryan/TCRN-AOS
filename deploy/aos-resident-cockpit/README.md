# The resident cockpit (TCRN-AOS-STORY-132)

The AOS operations cockpit runs as a systemd unit on `tcrn-platform-dev`, against
the governance chain that relocated there under TCRN-AOS-STORY-131. It is not a
process an operator starts before using the product; the machine brings it up,
and `journalctl` says why when it does not.

Owner ruling behind that: **the cockpit is resident**. That UI is what mode A is.

It is also the ONLY AOS read face now. The static LAN mirror that used to stand in
for one — `aos.tcrn.lan`, an nginx pod serving a pre-rendered copy — was retired
under `TCRN-AOS-MIN-012` decision 7 once this unit existed, and its route was
removed rather than repointed here: a LAN ingress in front of a loopback-bound write
face would be the CONF-007 D7 overturn, not a redeployment. Details and evidence:
`deploy/aos-mirror-retirement/`.

## What is where

| Thing | Path on the VM |
| --- | --- |
| Deployment root | `/srv/tcrn/aos-cockpit` |
| Compiled runtime + built web | `/srv/tcrn/aos-cockpit/runtime` (rsynced with `--delete`) |
| Operator authority (bundle + pins, mode 0600) | `/srv/tcrn/aos-cockpit/authority` |
| The precious domain store | `/srv/tcrn/aos-cockpit/data/domain.db` |
| systemd unit | `/etc/systemd/system/tcrn-aos-cockpit.service` |
| Governed chain (truth root) | `/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace` |
| Attestation sidecar (sibling of the workspace root) | `/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/attestations` |
| Engine | `/srv/tcrn/engine/tcrn-workflow` (v0.9.0) |

`data/` is outside `runtime/` on purpose. `runtime/` is rsynced with `--delete`
on every deployment, and `domain.db` is the one store on this platform that
cannot be rebuilt from anything — a redeploy must not be able to reach it.

## Access

Loopback only: `127.0.0.1:4318`. The bind is hard-coded in
`apps/cockpit-service/src/service.ts` and no environment variable can move it.
From anywhere that is not the VM itself, the only path in is an SSH tunnel
(CONF-007 D7):

```
ssh -L 4318:127.0.0.1:4318 tcrn-platform-dev
# then open http://127.0.0.1:4318/
```

The tripwire for that ruling is `deploy/aos-resident-cockpit/tripwire.mjs`. It
asks the kernel — `ss -ltnH`, local address column, full-value — rather than
reading the source or trusting what the service says about itself, and it has
been driven red once against the live deployment by flipping the deployed bind to
`0.0.0.0` and restoring it.

## Running it

```
node deploy/aos-resident-cockpit/emit-unit.mjs     # renders the unit from the manifest
node deploy/aos-resident-cockpit/apply.mjs         # stage, migrate, install, enable, start
node deploy/aos-resident-cockpit/tripwire.mjs      # the loopback predicate, with its red drill
node deploy/aos-resident-cockpit/walkthrough.mjs   # eleven modules, four write routes, two refusals
node deploy/aos-resident-cockpit/paired-backup.mjs # the paired backup, taken where both halves live
```

`emit-unit.mjs` is a separate step so that `apply.mjs` can compare three copies
of the unit — the one committed here, the one it renders, the one installed on the
machine — without having authored any of the others. A check whose two sides are
produced by the same act in the same run can only ever be green.

`manifest.mjs` is the single source for every path and every environment value.
Nothing in these recipes carries its own copy of one.

## Operating it

```
systemctl status tcrn-aos-cockpit
systemctl restart tcrn-aos-cockpit
journalctl -u tcrn-aos-cockpit -n 50
curl -s http://127.0.0.1:4318/api/health
```

`Restart=on-failure` with a start limit rather than `Restart=always`: the
STORY-112 refusal (no `AOS_ACTOR`, no service) exits non-zero deliberately, and
an unbounded restart would turn a stated misconfiguration into an invisible loop.
Five attempts and the unit sits in `failed`, where `systemctl status` says why.

## Backups: the pair is taken here, and pulled off-site (TCRN-AOS-INC-045)

Both halves of the AOS pair now live on this host — the governed chain under
`/srv/tcrn/governance` and `domain.db` under `/srv/tcrn/aos-cockpit/data` — so the
pair is taken HERE, at one instant, by `vm-take-pair.mjs` (streamed over ssh
stdin, never installed). `snapshot-verify` and the domain restore drill both need
something that lives on this host with the bytes, which is the standing use MIN-011
kept the VM engine for.

The off-site copy goes the other way and is initiated by the operator's machine:
whoever holds the credential initiates, and this host holds nothing that can reach
back. `paired-backup.mjs` orchestrates take → pull → judge on both sides → rotate.

Primary pairs: `/srv/tcrn/backups/pairs/<instant>/`. Full procedure, red drills and
the residual-applicability analysis of the retired push leg:
`docs/paired-backup-runbook.md`.

## Things this deployment does NOT claim

- **It writes one partition.** `TCRN-AOS` only. The other three chains are still
  on the operator's machine and this host cannot reach them, so a write aimed at
  them answers `UNKNOWN_PARTITION` from the surface. Their data is still shown —
  the cockpit's read side is built from all four projections — but it is read-only
  from here.
- **Ceremonial verbs stay off HTTP.** `conference-*`, `gate-transition`,
  `attestation-enable` and `work-delete` are not missing features; they are a
  boundary, and the HTTP surface answers 404 for each of them. The VM's authority
  bundle grants exactly three write commands (`work-create`, `work-transition`,
  `work-annotate`), so even a route that existed would be refused
  `OPERATOR_AUTHORITY_COMMAND_NOT_GRANTED`.
- **It runs as root.** `/srv/tcrn/governance` is mode 0700 `root:root` — the
  relocation ceremony put it there — so no unprivileged account can traverse to
  the chain this service writes. Running as a lesser user requires changing the
  governance tree's ownership, which is a decision about the truth root's
  containment and not one a deployment recipe gets to make on the way past.
- **The cockpit's data is baked at deploy time, not live.** The read side is a
  generated module projected from the chains when `apply.mjs` ran; the chain moves
  on afterwards. `/api/health` and the partition banner state the version the
  document was built from. Re-running `apply.mjs` refreshes it.
