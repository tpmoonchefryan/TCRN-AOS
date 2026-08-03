// TCRN AOS — declarative manifest for the engine copy on the platform dev VM.
//
// What this is: the single statement of what /srv/tcrn/engine/tcrn-workflow on
// tcrn-platform-dev must contain — the local governed engine copy at v0.9.0,
// minus node_modules and .git. What it deliberately is not: an authority supply.
// No pins, no operator bundle, no supply material of any kind travels with this
// manifest; the VM copy can read and answer `commands`, and it can host scratch
// workspaces, but it holds nothing that would let it act with the Mac copy's
// authority. Supplying that is a separate, separately-ruled step (EPIC-034-S120).
//
// v0.9.0 (TCRN-AOS-MIN-012 preparation, STORY-129): the engine gains the governed
// relocation verb family — relocation-plan / -vacate / -adopt / -abort / -inspect.
// Those verbs are what a future move of the chain onto this host would run on the
// receiving side, so the version this manifest names is now chosen for capability,
// not only for parity. Naming two of them in requiredVerbs makes "the VM can host
// the receiving half" a checked predicate rather than an inference from a count.
//
// node_modules is excluded because the built dist imports nothing but node:
// builtins (verified before this manifest was written: the catalog answers
// CLI_CATALOG_READY from a tree with no node_modules at all), so shipping 29MB
// of dev-time dependencies would only widen the surface without adding a single
// capability. .git is excluded because the deployment is the working-tree bytes;
// the object database proves nothing on the VM and carries history the VM has
// no reason to hold. dist IS shipped although the v0.8.0 tag does not cover it
// (it is gitignored): it is the build product of that tagged source, and the
// per-file digest ledger — not the tag — is what vouches for its bytes on the
// far side. The receipt states exactly that and no more.
//
// MIN-002 discipline: the VM is only ever brought to this manifest's state by
// running apply.mjs, which converges with `rsync --delete` (repeated runs are
// idempotent) and then proves convergence with a full per-file sha256 ledger,
// compared value-for-value (full 64-hex digests, both directions — a file the
// manifest has that the VM lacks and a file the VM has that the manifest lacks
// are both failures). Hand-editing the VM tree is not a supported operation;
// the drill in apply.mjs exists precisely to show such an edit is caught.

import { homedir } from "node:os";
import { join } from "node:path";

export const manifest = {
  schemaVersion: "aos.engine-host-deploy-manifest.v1",
  ruling: "TCRN-AOS-MIN-007",

  source: {
    // Resolved from the operator home at apply time, never hard-coded, so the
    // manifest itself carries no machine-specific absolute path. This is the
    // installed governed copy — the same tree every governed session verifies —
    // not a repository checkout.
    root: join(homedir(), ".tcrn-workflow", "tcrn-workflow"),
    locator: "<local-governed-copy>",
    // The anchor is the release tag, checked three ways before a single byte
    // moves: package.json says this version, HEAD carries this tag, and the
    // working tree is clean. A dirty tree would make "v0.8.0 tag anchor" a lie.
    requiredVersion: "0.10.1",
    requiredTag: "v0.10.1",
  },

  transfer: {
    // Name-based, any depth — matching rsync's --exclude semantics exactly, so
    // the ledger walk and the transfer agree about what "the tree" is.
    excludes: ["node_modules", ".git"],
    method: "rsync --archive --delete over ssh",
  },

  destination: {
    sshHost: "tcrn-platform-dev",
    enginePath: "/srv/tcrn/engine/tcrn-workflow",
    // Scratch workspaces for the filesystem proof live under here and are
    // removed by the same apply run that creates them; after a run the only
    // thing this deployment leaves on the VM is enginePath.
    scratchParent: "/srv/tcrn",
  },

  verification: {
    // What the far copy must answer to count as the same engine. 101 is the
    // cli-availability verb count (the catalog also carries 2 fixture-only
    // entries, recorded but not part of the operator surface). v0.8.0 answered
    // 96; v0.9.0 added the five relocation verbs; v0.10.0 adds a graph-validation
    // rule, no verb, so the cli count holds at 101. These are real predicates:
    // a different engine version red-flags here.
    catalogReasonCode: "CLI_CATALOG_READY",
    cliVerbCount: 101,
    remoteVersion: "0.10.1",
    // Named verbs the far catalog must actually carry. A count alone would be
    // satisfied by any 101 verbs. event-list is why v0.7.0 → v0.8.0 happened;
    // relocation-adopt and relocation-inspect are why v0.8.0 → v0.9.0 happens —
    // adopt is the receiving verb a move would run here, inspect is how this host
    // would be interrogated about a relocation in flight. Checked by name, and by
    // availability with it: a fixture-only entry is not a verb the VM can run.
    requiredVerbs: ["event-list", "relocation-adopt", "relocation-inspect"],
    // Digest ledger serialization follows the paired-backup/export-manifest
    // precedent: sha256 over "path sha256" lines joined by newline.
    fileSetDigestForm: "sha256(lines of `<path> <sha256>` joined by \\n)",
  },

  // The honest ceiling of what this deployment claims, written down so the
  // receipt cannot drift above it: byte-identity with the local governed copy,
  // proven by full-value digest comparison. Not provenance beyond that copy,
  // not authority, not independence of the two copies.
  trust: {
    statement:
      "the VM copy is byte-identical to the local governed copy (v0.9.0 tag anchor for "
      + "tracked source, digest ledger for the whole shipped set including dist); no claim "
      + "stronger than that comparison is made",
    pinsTransferred: false,
    authorityMaterialDeferredTo: "EPIC-034-S120",
  },
};
