# Read-only LAN face (STORY-140)

The read face is the LAN path to the AOS workbench. It serves the resident
cockpit's web and reads its domain store, but it has **no write capability**:

- no ChainClient, no authority pins, no `/api/chain/*` routes (STORY-138)
- write methods are refused globally; the domain store is opened read-only at
  the SQLite connection
- bound to a concrete LAN interface (`192.168.51.249:4319`), never a wildcard
  (MIN-014)
- Host header allow-list (anti-DNS-rebinding), security headers on every
  response
- runs as a dynamic, low-privilege system user (`DynamicUser=yes`)

The write face is untouched: it stays on `127.0.0.1` behind SSH.

## How it is reached

```
http://192.168.51.249:4319/
```

The read face is **read-only by Owner decision** (MIN-014): governance records
are readable on the LAN, no per-viewer authentication. Content safety (no
untrusted rendering, nosniff, CSP) is the boundary instead.

## Verification

- `/api/health` answers `{ readonly: true, chainWriteAvailable: false }`
- any write method (POST/PUT/PATCH/DELETE) is refused
- `node deploy/aos-resident-cockpit/apply-read-face.mjs` deploys and proves it
- `node deploy/aos-resident-cockpit/read-face-proof.mjs` asserts the write face
  stays loopback-only
