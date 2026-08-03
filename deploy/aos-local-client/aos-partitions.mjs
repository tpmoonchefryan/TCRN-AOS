// TCRN-CROSS-INIT-017 — partition → AOS (VM) workspace map.
//
// Under single-authority + fallback, every partition's chain lives on the AOS
// host (the VM), reached through the ceremony over SSH. This is the single place
// that maps a partition id to its AOS workspace path and attest-dir, so a
// ceremony (or a fallback replay) can target the right chain. Only partitions
// whose chain has actually been relocated to the VM are listed; a partition
// still hosted locally is not an AOS target yet.
//
// Paths here are the VM deployment facts (mirror of the partition's own
// workspace.json roots), imported from the resident cockpit's manifest where it
// already exists, stated inline where the partition's relocation defined them.

const GOVERNANCE = "/srv/tcrn/governance/tcrn-workspace";

/** Partition id → { workspace, attestDir } on the AOS host. */
export const AOS_PARTITIONS = Object.freeze({
  "TCRN-AOS": {
    workspace: `${GOVERNANCE}/TCRN-AOS/workspace`,
    attestDir: `${GOVERNANCE}/TCRN-AOS/attestations`,
  },
  "Joi-Button": {
    workspace: `${GOVERNANCE}/Joi-Button/workspace`,
    attestDir: `${GOVERNANCE}/Joi-Button/attestations`,
  },
  "cross-project": {
    workspace: `${GOVERNANCE}/cross-project/workspace`,
    attestDir: `${GOVERNANCE}/cross-project/attestations`,
  },
  "TCRN-Design-System": {
    workspace: `${GOVERNANCE}/TCRN-Design-System/workspace`,
    attestDir: `${GOVERNANCE}/TCRN-Design-System/attestations`,
  },
  "TCRN-TMS": {
    workspace: `${GOVERNANCE}/TCRN-TMS/workspace`,
    attestDir: `${GOVERNANCE}/TCRN-TMS/attestations`,
  },
});

export function aosPartition(partitionId) {
  const entry = AOS_PARTITIONS[partitionId];
  if (!entry) {
    throw new Error(
      `partition ${partitionId} has no AOS target yet; known: ${Object.keys(AOS_PARTITIONS).join(", ")}`
    );
  }
  return entry;
}
