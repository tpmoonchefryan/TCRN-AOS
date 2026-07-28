# VM minimal operator-authority bundle (S120, ruling D4)

The VM (`tcrn-platform-dev`) never receives the local full-power operator
bundle. Ruling D4: the VM gets its own **minimal bundle** carrying only the
safe write surface, in an **independent lineage** — separate generation
counter, separate revocation set — from the local full-power bundle. This
document records the forge parameters, the lineage/revocation semantics, the
renewal ritual (defined here, before any switchover, as D4 requires), and the
pins re-signing clause for deployment.

This story forged and locally verified the pair. **No supply material was
placed on the VM.** Placing the pair on the VM is part of the switchover
ceremony, which is a separate, Owner-gated step.

## What was forged

Two files, both emitted as the engine's own canonical bytes (`canonicalJson`
from the governed installed copy — no serializer of our own), living outside
the repository under the operator's home:

```
~/.tcrn-workflow/live/tcrn-platform/authority/vm/operator-authority.json
~/.tcrn-workflow/live/tcrn-platform/authority/vm/operator-authority-pins.json
```

Both files are mode `0600`, matching the rest of the authority directory. The
pre-existing files directly under `authority/` (the local full-power bundle,
its pins, and the codex adapter request) are untouched.

### Bundle parameters

| Field | Value | Why |
| --- | --- | --- |
| `schemaVersion` | `tcrn.operator-authority-bundle.v1` | engine schema |
| `authorityId` | `authority:tcrn-platform-vm-aos-safe-write-d31d669` | new lineage; suffix is the first 7 hex of sha256 of the lineage name, so a re-forge reproduces it |
| `generation` | `1` | independent counter — the local full-power bundle is at generation 4 in **its** lineage; the two never share a number line |
| `issuedAt` | `2026-07-28T00:00:00Z` | forge date |
| `expiresAt` | `2026-08-24T19:00:00Z` | aligned with the local bundle's ceiling (D4: aligned or shorter) |
| `status` | `active` | |
| `fileAuthorities` | all six keys `null` | the VM facade never admits adapter/profile/route/compatibility files |
| `hostInputs` | all four keys `null` | no host adapter contexts on the VM |
| `mcp.writeCommands` | exactly `["work-annotate", "work-create", "work-transition"]` | the safe write surface; enrolment rides `work-annotate`, so three verbs cover it |
| `mcp.authorityOutputCommands` | `[]` | the VM can never mint or export authority |
| `authorityDigest` | `e45dd748adaec4fc7ed329f15ef2228f306cdc015a750714faeadd8890b33193` | `canonicalSha256` of the basis, derived by the engine |

Bundle file sha256 (whole canonical bytes):
`2a68878a5e4e55e716aaa9c80545d2add81f8205bf1ca5f3edf84f30bcf47ef0`.

### Pins parameters

| Field | Value |
| --- | --- |
| `authorityId` | `authority:tcrn-platform-vm-aos-safe-write-d31d669` |
| `authorityPath` | the **local** absolute path of the bundle above |
| `authorityFileSha256` | `2a68878a5e4e55e716aaa9c80545d2add81f8205bf1ca5f3edf84f30bcf47ef0` |
| `minimumGeneration` | `1` |
| `revokedAuthorityDigests` | `[]` |
| `pinsDigest` | `6db75f95d49b468adcfc2b2d018a12017cdc766e370ab3dc15825c1ade422c38` |

Pins file sha256: `faf68e56587b8b1e9b3d4cfc22dcbe95dbd676e44a2272a053a291965b466542`.

### Pins bind a path: the deployment re-signing clause

`authorityPath` is an absolute path by engine schema, and the pins digest
covers it. These pins were signed against the **local verification path** so
the pair could be proven on this machine. That is the honest reading of the
pins semantics, and it has a consequence:

> **Deployment onto the VM must re-sign the pins.** The switchover ceremony
> copies the bundle bytes verbatim (its `authorityDigest` and file sha do not
> change), writes new pins whose `authorityPath` is the VM target path (under
> `/srv/tcrn/`), re-derives `pinsDigest` with the engine's `canonicalSha256`,
> and starts the VM facade with the new pins file's sha256. The local pins
> file never works on the VM and must not be copied there.

## Lineage and revocation semantics

- **Separate generations.** The VM lineage counts 1, 2, 3, … on its own.
  Renewing or revoking the VM bundle never touches the local full-power
  bundle's generation, and vice versa.
- **Separate revocation sets.** Revoking the VM bundle means adding its
  `authorityDigest` to the **VM pins'** `revokedAuthorityDigests` (and
  re-deriving `pinsDigest`), or raising `minimumGeneration` past it, or
  issuing a re-derived bundle with `status: "revoked"`. None of these appear
  in the local bundle's pins.
- **Kill radius.** Because the VM facade is started with the VM pins path and
  digest, revocation in the VM pins kills every mutating verb on the VM
  facade at the next call — proven below — while the local facade keeps
  running on its own lineage.
- **Anti-rollback.** As with every file-native pin, anti-rollback ends at the
  operator retaining the newest pins digest. Raising `minimumGeneration` at
  each renewal is what retires older generations.

## Local verification performed (evidence: `evidence/aos-vm-bundle-forge.json`)

Against a **scratch** governed chain (created in the session scratchpad,
deleted and the deletion verified afterwards; the live chain saw zero writes),
the real MCP facade was started with the VM pins pair:

- **Three greens** — `work-create`, `work-transition` (`planned → ready`),
  `work-annotate` each succeeded exactly once through the facade.
- **Not-granted red** — `conference-open` refused with
  `OPERATOR_AUTHORITY_COMMAND_NOT_GRANTED`.
- **Revocation red** — the VM pins' `revokedAuthorityDigests` gained the
  bundle digest, the facade was restarted with the new pins digest, and a
  write was refused with `OPERATOR_AUTHORITY_REVOKED`; the original pins were
  then restored **byte-identically** (sha256 compared before/after).
- **Forge-time reds** — a tampered bundle (`status` flipped without
  re-deriving the digest) and tampered pins (revocation set edited without
  re-deriving `pinsDigest`) both refused with
  `OPERATOR_AUTHORITY_CANONICAL_INVALID`.
- **Reclaim** — both facade process groups verified empty after teardown.

## Renewal ritual (defined before switchover, as D4 requires)

**Who.** The Owner, or an operator the Owner has directed, on the **local
machine** (the forge host). The VM never forges, renews, or re-signs its own
authority — it only ever receives already-signed bytes during a switchover
ceremony.

**When.** Before `expiresAt`, with at least 72 hours of margin. An expired
bundle fails closed (`OPERATOR_AUTHORITY_EXPIRED`), so a missed renewal stops
VM writes rather than extending them — but a planned renewal avoids the
outage.

**Steps.**

1. **Forge the successor bundle** in the same lineage: same `authorityId`,
   `generation` incremented by 1, new `issuedAt` (renewal date), new
   `expiresAt` no later than the then-current local full-power bundle's
   ceiling. The write surface stays exactly the three safe verbs unless a
   recorded ruling changes the surface — a surface change is a new decision,
   not a renewal.
2. **Re-derive the bundle bytes**: `authorityDigest = canonicalSha256(basis)`
   via the engine's own function; emit the file as engine canonical bytes.
3. **Re-sign the pins**: `authorityFileSha256` = sha256 of the new bundle
   file, `minimumGeneration` = the new generation (this is the anti-rollback
   step that retires the previous generation), `revokedAuthorityDigests`
   carried forward, `pinsDigest` re-derived; emit as canonical bytes.
4. **Verify locally before anything ships**: run the same verification as
   this story — three greens on a scratch chain, the not-granted red, and
   the revocation red — with the successor pair.
5. **Switchover** is its own ceremony: copy the bundle bytes to the VM
   target path, re-sign pins against that path (clause above), restart the
   VM facade with the new pins digest, and re-prove the revocation red on
   the VM before declaring the renewal done.

**Which bytes are re-signed at each renewal**: the bundle basis (hence
`authorityDigest` and the bundle file bytes) and the pins basis (hence
`pinsDigest` and the pins file bytes). Nothing else — in particular, the
local full-power bundle and its pins are never touched by a VM renewal.
