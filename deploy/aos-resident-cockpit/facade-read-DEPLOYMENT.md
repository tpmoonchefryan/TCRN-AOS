# Facade read service (STORY-181)

The facade is the loopback resident that fronts the engine's **read verbs**. The
LAN read face (cockpit-read, STORY-140) serves the built web and the domain
store; this service is the complementary surface — every read-only verb in the
engine's command catalogue, reachable without driving the engine CLI by hand.

It is a **distinct systemd unit** from the LAN read face, so it can be stopped,
restarted or rolled back on its own (single-point rollback). It binds
`127.0.0.1:4320` and is reached through the SSH tunnel, the same shape CONF-007
D7 rules for the write face.

## Read-only, by shape

- no authority pins, no ChainClient, no mutating verb route — a mutating or
  authority-bearing verb is refused with `MCP_REMOTE_WRITE_REFUSED` /
  `MCP_REMOTE_AUTHORITY_OUTPUT_REFUSED` before any route to the engine runs;
- the tool table is derived from the engine's own `commands` catalogue (the
  `mutates` / `authorityBearing` / `fixture-only` flags) **and** re-checked
  against the engine's own `workflowMcpTools()` descriptors
  (`readOnlyHint` / `destructiveHint`) — two independent sources, so a verb
  either source withholds is never published;
- the derived table is refreshed every 60s, so a verb whose `mutates` flag flips
  mid-session stops being forwarded within one TTL;
- reason codes are the engine's own, unaltered.

## How it is reached

```
ssh -L 4320:127.0.0.1:4320 tcrn-platform-dev
curl http://127.0.0.1:4320/api/health
curl http://127.0.0.1:4320/api/engine/catalog
curl -X POST http://127.0.0.1:4320/api/engine/work-list \
  -d '{"partition":"TCRN-AOS"}'
```

## Five partitions

The service knows each partition's workspace path through the same
`workspaces` record seam the write face's `CockpitServiceOptions` uses, populated
from `aos-partitions.mjs` (the single roster). A caller names a `partition`,
never a path.

## Verification

- `GET /api/health` answers `{ readonly: true, chainWriteAvailable: false, noPins: true }`
- `GET /api/engine/catalog` lists the forwardable read verbs and the withheld
  (refused) half with their reason codes
- a `POST` to a mutating verb answers `409` with `MCP_REMOTE_WRITE_REFUSED`
- `node deploy/aos-resident-cockpit/facade-read-service.test.mjs` proves both legs
  against a scratch file-backed chain on the local engine
- `node deploy/aos-resident-cockpit/apply-facade-read.mjs` deploys to the VM and
  proves it; the read-face-gate asserts the source never holds pins
