// TCRN-CROSS-INIT-017 — partition → AOS (VM) workspace map.
//
// Under single-authority + fallback, every partition's chain lives on the AOS
// host (the VM), reached through the ceremony over SSH. This is the single place
// that maps a partition id to its AOS workspace path, attest-dir and read-back
// anchor, so a ceremony (or a fallback replay) can target the right chain AND
// prove it landed there. Only partitions whose chain has actually been relocated
// to the VM are listed; a partition still hosted locally is not an AOS target yet.
//
// Paths here are the VM deployment facts (mirror of the partition's own
// workspace.json roots), imported from the resident cockpit's manifest where it
// already exists, stated inline where the partition's relocation defined them.

const GOVERNANCE = "/srv/tcrn/governance/tcrn-workspace";

/**
 * Partition id → { workspace, attestDir, anchor } on the AOS host.
 *
 * `anchor` is a stable record on THAT partition's own chain — its root Initiative,
 * chosen because a root Initiative is not retired out from under a read and its
 * external key is fixed at creation. A remote ceremony
 * proves it reached the intended chain by reading the anchor back, because a record
 * the ceremony just created has no id until after the write lands. The anchor must
 * be per-partition: an id belonging to another partition's chain resolves nowhere
 * (`WORKSPACE_INPUT_INVALID`), which is exactly how the fallback replay was broken
 * for every non-Joi partition before TCRN-CROSS-STORY-127.
 *
 * Only `externalKey` is safe to assert on: `status` moves as the Initiative
 * progresses, so a read-back expecting it would go red on its own.
 *
 * Verified 2026-08-04 against each partition's own VM chain; recheck with
 * `ssh <AOS host> "node <engine>/scripts/tcrn-workflow.mjs work-show --workspace
 * <that partition's workspace above> --id <that partition's anchor.id>"` and compare
 * `record.externalKey`.
 */
export const AOS_PARTITIONS = Object.freeze({
  "TCRN-AOS": {
    workspace: `${GOVERNANCE}/TCRN-AOS/workspace`,
    attestDir: `${GOVERNANCE}/TCRN-AOS/attestations`,
    anchor: { id: "work:4c678a5fe78b6313ce56ea39", externalKey: "TCRN-AOS-INIT-004" },
  },
  "Joi-Button": {
    workspace: `${GOVERNANCE}/Joi-Button/workspace`,
    attestDir: `${GOVERNANCE}/Joi-Button/attestations`,
    anchor: { id: "work:170682d8fbf860d6e9c293de", externalKey: "JOI-BUTTON-INIT-001" },
  },
  "cross-project": {
    workspace: `${GOVERNANCE}/cross-project/workspace`,
    attestDir: `${GOVERNANCE}/cross-project/attestations`,
    anchor: { id: "work:a9f610a2e09324269b8fd9bb", externalKey: "TCRN-CROSS-INIT-001" },
  },
  "TCRN-Design-System": {
    workspace: `${GOVERNANCE}/TCRN-Design-System/workspace`,
    attestDir: `${GOVERNANCE}/TCRN-Design-System/attestations`,
    anchor: { id: "work:e96846b1de494a2589015993", externalKey: "TCRN-DS-INIT-001" },
  },
  "TCRN-TMS": {
    workspace: `${GOVERNANCE}/TCRN-TMS/workspace`,
    attestDir: `${GOVERNANCE}/TCRN-TMS/attestations`,
    anchor: { id: "work:1a4aabcc5db3ae3735bc45f6", externalKey: "TCRN-TMS-INIT-001" },
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
