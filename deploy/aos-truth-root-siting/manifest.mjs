// TCRN AOS — declarative manifest for siting the four governance chains' truth
// roots on the platform dev VM (TCRN-AOS-MIN-012, EPIC/STORY-129).
//
// What this is: the candidate address on tcrn-platform-dev for the governed
// workspaces themselves, plus the contract by which a candidate is judged
// admissible. What it is NOT: a move. Nothing in this directory reads, writes,
// or names the live chains under the platform's .tcrn-workspace/. The probe
// this manifest drives builds a throwaway governed workspace at each candidate
// address, asks the engine whether it is admissible there, and removes it.
//
// Why the engine is the judge rather than a filesystem table: the engine pins a
// set of local filesystem magics (packages/core/src/workspace.ts,
// supportedFilesystemTypes) and refuses WORKSPACE_FILESYSTEM_UNSUPPORTED
// anywhere else. Restating that table here and comparing would only prove this
// file agrees with itself. A real `init` completing at the address is the
// engine asserting admissibility in its own voice; statfs magic and `df -T` are
// recorded alongside as the reason, not as the predicate.
//
// Shape: the VM layout is congruent with the Mac layout, one directory per
// partition holding the four per-partition roots, with release-trust shared at
// the parent. That congruence is load-bearing, not cosmetic — `--attest-dir`
// must resolve OUTSIDE the workspace root (packages/cli/src/index.ts:
// "--attest-dir must resolve outside the workspace root", CLI_ARGUMENT_MALFORMED),
// and the relocation family emits its stage attestations through that same flag.
// Siting `attestations/` as a SIBLING of `workspace/` is what keeps the
// invariant satisfiable at the new address; siting it under the workspace root
// would make every attested relocation stage fail closed. The probe proves both
// directions of that at the real candidate address rather than assuming it.

export const manifest = {
  schemaVersion: "aos.truth-root-siting-manifest.v1",
  ruling: "TCRN-AOS-MIN-012",
  story: "TCRN-AOS-STORY-129",

  destination: {
    sshHost: "tcrn-platform-dev",
    // The governance parent already exists on the VM as root:root 0700. The
    // truth root goes one level inside it so that "governance" can hold
    // sibling concerns (paired backups, authority material) without those
    // sharing a directory with the chains.
    governanceParent: "/srv/tcrn/governance",
    truthRoot: "/srv/tcrn/governance/tcrn-workspace",
    // The engine copy STORY-129 places on this host; it is the --framework root
    // every workspace at the candidate address would be bound to.
    frameworkPath: "/srv/tcrn/engine/tcrn-workflow",
    // Rehearsal that must not touch the candidate address lives here.
    scratchParent: "/srv/tcrn",
  },

  // The four partitions of the platform's event chain, named exactly as the Mac
  // names them so a per-partition path is a rename of its counterpart and not a
  // re-mapping anyone has to hold in their head.
  partitions: ["cross-project", "TCRN-AOS", "TCRN-Design-System", "TCRN-TMS"],

  layout: {
    // Per partition, under truthRoot/<partition>/.
    perPartition: {
      workspace: "workspace",
      transient: "transient",
      evidenceLocator: "evidence-locator",
      // Sibling of workspace, never inside it — see the header. Created for all
      // four partitions, not only the one that has attestation enabled today,
      // because relocation stage attestations are emitted per relocated
      // workspace regardless of whether that workspace attests its actors.
      attestations: "attestations",
    },
    // Shared by all four partitions at truthRoot/, mirroring the Mac, where a
    // single gate-identity-authority.json serves every partition.
    sharedReleaseTrust: "release-trust",
  },

  verification: {
    // The engine's own answers, in its own reason codes. Each is a predicate
    // that a wrong answer turns red.
    initReasonCode: "WORKSPACE_COMMAND_COMPLETED",
    // The receiving-side read verb of the relocation family, exercised at the
    // candidate address: if this address could not host an adoption, the verb
    // that interrogates a relocation cannot answer here either.
    inspectVerb: "relocation-inspect",
    // Green: attest-dir as a sibling of the workspace root is accepted AND
    // leaves a file behind.
    attestDirSiblingAccepted: true,
    // Red: attest-dir inside the workspace root is refused with this code. Run
    // in scratch, never at the candidate address, because the refusal happens
    // after the mutation commits and would consume the probe's one-shot enable.
    attestDirInsideReasonCode: "CLI_ARGUMENT_MALFORMED",
    // Red: the filesystem gate refuses an address outside the pinned set.
    filesystemRefusalReasonCode: "WORKSPACE_FILESYSTEM_UNSUPPORTED",
    // The actor id the probe attests with. Prefix must be one of
    // {owner, profile, agent} (packages/core/src/actor-attestation.ts).
    probeActor: "agent:aos-siting-probe",
  },

  // Planning outputs — recorded, deliberately NOT applied by the probe. Siting
  // is a question about where; ownership and backup pairing are questions about
  // how the address is operated, and MIN-012 has not been asked them yet.
  plannedButNotApplied: {
    ownership: {
      // Mirrors what the engine deployment already produced on this host: the
      // rsync ran as root but mapped names, leaving /srv/tcrn/engine/tcrn-workflow
      // as ryanlan:staff. The chains should be owned by the same principal that
      // will run the engine, not by root, so that a compromise of a service
      // running as root is not automatically write access to the chain.
      owner: "ryanlan",
      group: "staff",
      truthRootMode: "0700",
      partitionMode: "0700",
      workspaceMode: "0700",
      rationale:
        "0700 matches the Mac, where .tcrn-workspace/<partition>/workspace/.tcrn-workflow is 0700 "
        + "and release-trust/gate-identity-authority.json is 0600. The VM has k3s and other "
        + "services on the same root filesystem, so group- and world-readable chain bytes would "
        + "widen the read surface for no operational gain.",
      releaseTrustFileMode: "0600",
    },
    pairedBackup: {
      // The existing pair on this host was written FROM the Mac TO the VM. If
      // the chain lives here, that direction inverts, and the pair's far end
      // must stop being the same machine as the chain.
      currentPairDestination: "/srv/tcrn/backups",
      afterRelocation: {
        localSnapshotDestination: "/srv/tcrn/backups",
        offHostDestination: "<Owner Mac>:.tcrn-workspace-backups",
        note:
          "After relocation the VM holds the chain, so a backup that lives only on the VM proves "
          + "the machine agrees with itself — the same failure the current arrangement was built to "
          + "avoid, pointing the other way. The pair's far end must become the Mac (and/or the "
          + "existing OneDrive cadence), and the far end must be able to answer snapshot-verify / "
          + "validate / event-list itself. Direction, retention and cadence are unruled; this "
          + "records the constraint, not the decision.",
      },
    },
  },

  // The honest ceiling: what a green probe does and does not establish.
  trust: {
    statement:
      "a disposable governed workspace can be created, attested and read at each candidate address, "
      + "and the engine refuses both an out-of-set filesystem and an attest-dir inside the workspace "
      + "root; this establishes the address is admissible, not that any chain has moved, nor that the "
      + "host is authorized to write one",
    authorityMaterialPresent: false,
    liveChainsTouched: false,
  },
};
