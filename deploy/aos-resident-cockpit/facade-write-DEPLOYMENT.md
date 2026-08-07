# Facade write service (STORY-182 / STORY-184)

The facade is the loopback resident that fronts the engine's **governed writes**
as **one ceremony endpoint**. The read facade (STORY-181) fronts the engine's
read verbs; this service is the complementary surface — `POST /api/ceremony`
performs a governed write batch (a payload of steps plus at least one read-back)
by driving the engine CLI in-process. It is the server-side form of
`deploy/aos-local-client/ceremony.mjs`.

It is a **distinct systemd unit** from the read facade and the cockpit, so it can
be stopped, restarted or rolled back on its own (single-point rollback). It binds
`127.0.0.1:4321` and is reached through the SSH tunnel, the same shape CONF-007
D7 rules for the write face.

## The one write surface

- **no per-verb write route.** There is exactly one write surface: `POST
  /api/ceremony`. The ceremony discipline is ONE invariant — a payload of steps
  plus at least one read-back, reserved flags, expected-version from a live read,
  receipts — and per-verb forwarding would push that discipline onto the caller.
- **no pins, by shape.** The service accepts no authority argument and holds no
  operator-authority pins; it drives the engine CLI, which needs none for the
  file backend. A verb that requires a per-invocation authority file is refused
  (`VERB_REQUIRES_OUT_OF_BAND_AUTHORITY`).
- **the whitelist is derived, not hand-written**: the engine's own `commands`
  catalogue (`mutates:true`, not authority-bearing, no one-shot authority file)
  AND the engine's own `workflowMcpTools()` descriptors — two independent
  sources, so a verb either source withholds is never driven as a write.
- **expected-version is supplied by the service** from a live head read before
  every mutating step (the knowledge-store marker for the `knowledge-*` family);
  the payload may not name it.
- **receipts are materialised** for every call — including a call that throws —
  scrubbed of host paths, under the evidence root, uncommitted until closeout
  (INC-042).

## How it is reached

```
ssh -L 4321:127.0.0.1:4321 tcrn-platform-dev
curl http://127.0.0.1:4321/api/health
curl http://127.0.0.1:4321/api/engine/catalog
curl -X POST http://127.0.0.1:4321/api/ceremony \
  -d '{"partition":"TCRN-TMS","payload":{...}}'
```

## Five partitions

The service knows each partition's workspace path and attestation sidecar through
the same `workspaces` / `attestDirs` record seams `CockpitServiceOptions` uses,
populated from `aos-partitions.mjs` (the single roster). A caller names a
`partition`, never a path.

## Verification

- `GET /api/health` answers `{ readonly: false, chainWriteAvailable: true, noPins: true }`
- `GET /api/engine/catalog` lists the forwardable write verbs and the withheld
  (refused) half with their reason codes
- a ceremony with no read-back answers `PAYLOAD_INVALID`; a step naming a
  whitelist-external verb is refused whole before anything is sent
- `node deploy/aos-resident-cockpit/facade-write-service.test.mjs` proves both
  legs against a scratch file-backed chain on the local engine
- `node deploy/aos-resident-cockpit/apply-facade-write.mjs` deploys to the VM and
  proves it answers and can DRY-RUN plan a write against the real TCRN-TMS chain
  without sending (CEREMONY_PLANNED_ONLY); the real governed write is the
  STORY-184 proof, driven separately through the tunnel.
