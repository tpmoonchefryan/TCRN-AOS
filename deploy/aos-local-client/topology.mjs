// TCRN-AOS-STORY-133 — the one place this machine's client-side topology is stated.
//
// Owner's sentence, machine-readable: "本地原则上只应存在框架而没有生成物." After
// MIN-012 direction D and the STORY-131 relocation, this laptop is a CLIENT of the
// AOS governance chain, not its host. Two things follow, and both need a single
// declared home rather than a path hand-typed into each script:
//
//   1. a governance write from here is a REMOTE ceremony. Every such ceremony needs
//      the same four values (host, engine CLI, workspace root, attest-dir) and one
//      actor id. Those five were previously retyped per invocation, which is how an
//      operator ends up attesting into the wrong sidecar or driving the wrong chain;
//   2. what remains on this machine must be classifiable. "Is there a control tree
//      here" is the wrong question — three partitions still live here legitimately.
//      The question is "which partition does this tree belong to, and is that
//      partition's truth supposed to be on this host". That needs a roster.
//
// The VM half is IMPORTED from the resident cockpit's manifest, never copied. Those
// constants already have an owner (deploy/aos-resident-cockpit/manifest.mjs), they
// are already rendered into the systemd unit that serves the chain, and a second
// copy here would drift the first time somebody moved the truth root — leaving the
// service and the ceremony pointed at different addresses with nothing red. What
// this file adds is only what is genuinely new: the local addresses, the partition
// roster, and the scan scope.

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

export {
  VM_HOST, VM_WORKSPACE, VM_ATTEST_DIR, VM_ENGINE, PARTITION_ID, ACTOR
} from "../aos-resident-cockpit/manifest.mjs";

import { VM_ENGINE } from "../aos-resident-cockpit/manifest.mjs";

// STORY-186 — the facade read/write services (STORY-181/182) are the platform's sole
// read/write face. Their addresses belong to the single topology source too, so a
// ceremony, a tunnel, or a future client imports them instead of hand-typing a loopback
// port. Both are VM-half facts and both are IMPORTED from their own resident manifests
// (never copied), the same rule manifest.mjs already holds for the engine and the chains.
import {
  FACADE_HOST, FACADE_PORT, FACADE_UNIT_NAME, FACADE_ALLOWED_HOSTS
} from "../aos-resident-cockpit/facade-read-manifest.mjs";
import {
  FACADE_WRITE_HOST, FACADE_WRITE_PORT, FACADE_WRITE_UNIT_NAME, FACADE_WRITE_ALLOWED_HOSTS
} from "../aos-resident-cockpit/facade-write-manifest.mjs";

export {
  FACADE_HOST, FACADE_PORT, FACADE_UNIT_NAME, FACADE_ALLOWED_HOSTS,
  FACADE_WRITE_HOST, FACADE_WRITE_PORT, FACADE_WRITE_UNIT_NAME, FACADE_WRITE_ALLOWED_HOSTS
};

/** The governed engine CLI on the host that now owns the chain. */
export const VM_ENGINE_CLI = `${VM_ENGINE}/scripts/tcrn-workflow.mjs`;

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PLATFORM_ROOT = resolve(REPO_ROOT, "..");

/** Where this platform sites governed workspaces on this machine. */
export const WORKSPACE_CONTAINER = join(PLATFORM_ROOT, ".tcrn-workspace");

/**
 * The AOS partition's local remains, retained read-only under MIN-012.
 *
 * `NOTICE_PATH` sits INSIDE the partition directory, beside `workspace/` rather
 * than beside the partition itself. Two reasons, and the second is the load-bearing
 * one: a reader who opens the archived thing sees the notice without having to look
 * up a level, and a file called ARCHIVED.md one level higher would sit next to
 * `cross-project/`, `TCRN-Design-System/` and `TCRN-TMS/` — three partitions whose
 * truth IS still on this machine — where it would read as a statement about all
 * four. It is also outside the control tree and outside `attestations/`, so it
 * changes no byte any manifest or relocation ledger covers.
 */
export const ARCHIVED_PARTITION_DIR = join(WORKSPACE_CONTAINER, "TCRN-AOS");
export const ARCHIVED_WORKSPACE = join(ARCHIVED_PARTITION_DIR, "workspace");
export const ARCHIVED_CONTROL_TREE = join(ARCHIVED_WORKSPACE, ".tcrn-workflow");
export const NOTICE_PATH = join(ARCHIVED_PARTITION_DIR, "ARCHIVED.md");

/** The domain store's local archive and its own sentinel (STORY-132's precedent). */
export const DOMAIN_ARCHIVE_DIR = join(homedir(), ".tcrn-aos");
export const DOMAIN_ARCHIVE_SENTINEL = join(DOMAIN_ARCHIVE_DIR, "RELOCATED-TO-VM.json");

/**
 * The partition roster: who each control tree belongs to and where its truth lives.
 *
 * Identity is the workspace's OWN `externalKey` and `workspaceId`, read out of its
 * `workspace.json` — never the directory name. A directory can be renamed, copied
 * or nested; `externalKey` is what the chain calls itself. Both terms are carried
 * and both are compared, because either one alone can be reproduced by hand while
 * the pair pins a specific chain.
 *
 * `home` is the declaration this whole story exists to enforce:
 *   "vm"    — the truth is on tcrn-platform-dev; a LIVE tree here is a defect;
 *   "local" — the truth is still on this machine, legitimately, this round.
 *
 * TIGHTENING: when cross-project, TCRN-Design-System and TCRN-TMS relocate too,
 * flip their `home` to "vm". Nothing else changes — `permittedLocalPartitions`
 * becomes empty and the same predicate then reads "this machine holds zero live
 * governed workspaces". The predicate is parameterised by the roster precisely so
 * that tightening is a data edit and not a rewrite; see local-purity-predicates.mjs.
 */
export const PARTITION_ROSTER = Object.freeze([
  Object.freeze({
    partitionId: "TCRN-AOS",
    externalKey: "TCRN-AOS-WORKSPACE",
    workspaceId: "workspace:fbc32e3ff874fbbd637a1b85",
    home: "vm",
    // The hop that moved it. Recorded so a tree carrying a DIFFERENT relocationId
    // is not silently accepted as "the archive we expected to find".
    relocationId: "relocation:bba03004faf175867349495b",
    liveAddress: "/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace"
  }),
  Object.freeze({
    partitionId: "cross-project",
    externalKey: "TCRN-CROSS-WORKSPACE",
    workspaceId: "workspace:7732a51de4c38afb83bb77cf",
    home: "vm",
    relocationId: "relocation:6549cb2da7c72db2236f805e",
    liveAddress: "/srv/tcrn/governance/tcrn-workspace/cross-project/workspace"
  }),
  Object.freeze({
    partitionId: "TCRN-Design-System",
    externalKey: "TCRN-DS-WORKSPACE",
    workspaceId: "workspace:e7386bdcff8b3407e43ece51",
    home: "vm",
    relocationId: "relocation:8a3ca7ecb2550a2ff30e2642",
    liveAddress: "/srv/tcrn/governance/tcrn-workspace/TCRN-Design-System/workspace"
  }),
  Object.freeze({
    partitionId: "TCRN-TMS",
    externalKey: "TCRN-TMS-WORKSPACE",
    workspaceId: "workspace:f15c5abb6cd777c44453c2c9",
    home: "vm",
    relocationId: "relocation:984c5bf637f4967b984ae4cd",
    liveAddress: "/srv/tcrn/governance/tcrn-workspace/TCRN-TMS/workspace"
  }),
  Object.freeze({
    // Born 2026-07-31 (JOI-BUTTON-INIT-001 kickoff): a personal, non-TCRN project whose
    // chain is nevertheless governed on this machine — registered here because the purity
    // scan classifies every live control tree it can see, not only TCRN ones.
    partitionId: "Joi-Button",
    externalKey: "JOI-BUTTON-WORKSPACE",
    workspaceId: "workspace:f4edc54804be7e499804e3f0",
    home: "vm",
    relocationId: "relocation:65814dd2b21b5fb9be809d50",
    liveAddress: "/srv/tcrn/governance/tcrn-workspace/Joi-Button/workspace"
  })
]);

/**
 * The four fallback SHADOW workspaces (`TCRN-CROSS-INIT-017`), declared 2026-08-04.
 *
 * SEPARATE FROM `PARTITION_ROSTER` ON PURPOSE, and the separation is load-bearing.
 * Two consumers read a roster and they are asking different questions:
 *
 *   - the purity scan asks "which live control trees on this machine are legitimate",
 *     and a shadow is one — unregistered, it reads as a roster violation, and the only
 *     way to hold the gate green would be to stop scanning, which is how a gate gets
 *     switched off instead of answered;
 *   - `doc-topology` asks "which partitions must every platform document declare the
 *     truth location of", and a shadow is NOT one. Putting these four in
 *     `PARTITION_ROSTER` was tried first and it demanded a `cross-project-shadow` row in
 *     the platform's declaration blocks — a document asserting that a buffer is a
 *     partition with a local truth, which is false and would mislead every later reader.
 *
 * A shadow is a distinct workspace with its own id and external key. It buffers governed
 * writes while the AOS host is unreachable and is replayed onto the authority afterwards,
 * so `cross-project`'s truth is on the VM while `cross-project-shadow`'s own truth is
 * here: two workspaces, two homes, and no ambiguity about which one a write is
 * authoritative on.
 *
 * There is deliberately no `TCRN-AOS-shadow` — AOS is the fallback HOST, so a shadow of
 * it would buffer against the machine it is buffering for. The set is DECLARED, never
 * derived as `${partitionId}-shadow`, so a shadow present on disk but absent here reds
 * rather than being admitted by a naming rule.
 */
export const SHADOW_ROSTER = Object.freeze([
  Object.freeze({
    partitionId: "cross-project-shadow",
    shadowFor: "cross-project",
    externalKey: "CROSS-PROJECT-SHADOW-WORKSPACE",
    workspaceId: "workspace:b3d8cabe00063c9e9734258a",
    home: "local",
    liveAddress: ".tcrn-workspace/cross-project-shadow/workspace"
  }),
  Object.freeze({
    partitionId: "TCRN-Design-System-shadow",
    shadowFor: "TCRN-Design-System",
    externalKey: "TCRN-DS-SHADOW-WORKSPACE",
    workspaceId: "workspace:3b55e56a4d57c4095c7c20b6",
    home: "local",
    liveAddress: ".tcrn-workspace/TCRN-Design-System-shadow/workspace"
  }),
  Object.freeze({
    partitionId: "TCRN-TMS-shadow",
    shadowFor: "TCRN-TMS",
    externalKey: "TCRN-TMS-SHADOW-WORKSPACE",
    workspaceId: "workspace:aa522f0d9c41d63873294b4b",
    home: "local",
    liveAddress: ".tcrn-workspace/TCRN-TMS-shadow/workspace"
  }),
  Object.freeze({
    partitionId: "Joi-Button-shadow",
    shadowFor: "Joi-Button",
    externalKey: "JOI-BUTTON-SHADOW-WORKSPACE",
    workspaceId: "workspace:317832b6fadd1ab8d8b8212e",
    home: "local",
    liveAddress: ".tcrn-workspace/Joi-Button-shadow/workspace"
  })
]);

/** The partitions that have a local shadow, for `containerWorkspaceRoster`'s second argument. */
export const SHADOWED_PARTITIONS = Object.freeze(SHADOW_ROSTER.map((entry) => entry.shadowFor));

export const RELOCATED_PARTITIONS = Object.freeze(
  PARTITION_ROSTER.filter((entry) => entry.home === "vm").map((entry) => entry.partitionId));
export const LOCAL_LIVE_PARTITIONS = Object.freeze(
  PARTITION_ROSTER.filter((entry) => entry.home === "local").map((entry) => entry.partitionId));

/**
 * Where the scan looks, and — stated in the same breath — where it does not.
 *
 * `depth` is per root, counted in directory levels below the root. A whole-disk
 * walk was rejected: it costs minutes, it cannot finish inside this platform's
 * one-command budget, and a gate that is too slow to run in `verify` is a gate
 * with a one-day lifespan. So the scope is declared, narrow, and stated in the
 * receipt, which is the honest form: a green means "no live AOS control tree at
 * these addresses", never "nowhere on this disk".
 */
export const SCAN_ROOTS = Object.freeze([
  Object.freeze({
    id: "platform-root",
    path: PLATFORM_ROOT,
    depth: 8,
    why: "the five repositories and the workspace container. Catches both the archived "
      + "partition and an `init` somebody ran inside a checkout by accident."
  }),
  Object.freeze({
    id: "home-shallow",
    path: homedir(),
    depth: 3,
    why: "the home directory's own top levels, where the framework root and the domain "
      + "archive live. Shallow on purpose: deep home trees are other people's projects."
  })
]);

/** Directory names the walk never descends into. */
export const SCAN_PRUNE = Object.freeze([
  "node_modules", ".git", "Library", ".Trash", "OneDrive", "OneDrive - Shiji Group",
  ".codegraph", "dist", ".pnpm-store", ".cache", "Applications", "Movies", "Music",
  "Pictures", "Downloads"
]);

/**
 * What this scan cannot see, stated where the scan is configured rather than in a
 * footnote of a receipt nobody re-reads.
 */
export const SCAN_CEILING = Object.freeze({
  notAWholeDiskWalk: "roots and depths are declared above; a control tree outside them is not seen",
  archivesAreOutOfScope:
    "a tar/zip snapshot of a control tree is not a bindable workspace and is not looked for. "
    + "It is still revival material — ADR 0003 ceiling 2 — so 'zero live trees' is not 'zero ways back'",
  timeOfCheck:
    "the answer is about the instant the walk ran. Nothing here prevents a tree from being "
    + "created a second later; the predicate is a measurement, not a lock"
});

/**
 * TCRN-CROSS-INIT-020 INC-076 — the engine pathway registry. Every way this
 * repository can reach a governed engine is declared here with its data surface.
 * A switch story (S185 etc.) changes these entries, and `pathway-registry-proof`
 * scans the repo: an engine-invoking file that is not registered reds — the
 * "switch scope decided by a roster, not by memory" machine.
 *
 * surface: "facade-read" | "facade-write" | "ssh-file" | "ssh-rsync".
 * status: "live" (the pathway in use) | "fallback" (kept for break-glass).
 */
export const ENGINE_PATHWAYS = Object.freeze([
  Object.freeze({ id: "read-mcp-face", files: ["deploy/aos-local-client/remote-read-mcp.mjs"], surface: "facade-read", status: "live" }),
  Object.freeze({ id: "write-mcp-face", files: ["deploy/aos-mcp-write/server.mjs"], surface: "facade-write", status: "live" }),
  Object.freeze({ id: "ceremony-cli", files: ["deploy/aos-local-client/ceremony.mjs"], surface: "facade-read+facade-write", status: "live" }),
  Object.freeze({ id: "projection-freshness", files: ["deploy/aos-local-client/projection-freshness.mjs"], surface: "facade-read", status: "live" }),
  Object.freeze({ id: "fallback-cli", files: ["deploy/aos-local-client/fallback-cli.mjs"], surface: "ssh-probe+ssh-file", status: "fallback" }),
  Object.freeze({ id: "engine-host-apply", files: ["deploy/aos-engine-host/apply.mjs"], surface: "ssh-rsync", status: "fallback" }),
  Object.freeze({ id: "emit-evidence", files: ["deploy/aos-resident-cockpit/emit-evidence.mjs", "deploy/switch-rehearsal/emit-evidence.mjs", "deploy/relocation-rehearsal/emit-evidence.mjs"], surface: "ssh-file", status: "fallback" }),
  Object.freeze({ id: "facade-read-service", files: ["deploy/aos-resident-cockpit/facade-read-service.mjs"], surface: "facade-read", status: "live" }),
  Object.freeze({ id: "facade-write-service", files: ["deploy/aos-resident-cockpit/facade-write-service.mjs"], surface: "facade-write", status: "live" }),
  Object.freeze({ id: "tip-gate", files: ["deploy/aos-local-client/tip-gate.mjs"], surface: "facade-read+ssh-file", status: "live" }),

  Object.freeze({ id: "doc-topology-proof", files: ["deploy/aos-local-client/doc-topology-proof.mjs", "deploy/aos-local-client/scan-local.mjs", "deploy/aos-local-client/key-occupancy.mjs", "deploy/aos-local-client/aos-partitions.mjs"], surface: "ssh-file", status: "live" }),
  Object.freeze({ id: "access-boundary", files: ["deploy/access-boundary/place-gate-authority.mjs"], surface: "ssh-file", status: "fallback" }),
  Object.freeze({ id: "facade-deploy", files: ["deploy/aos-resident-cockpit/apply-facade-read.mjs", "deploy/aos-resident-cockpit/apply-facade-write.mjs", "deploy/aos-resident-cockpit/apply.mjs", "deploy/aos-resident-cockpit/facade-write-manifest.mjs"], surface: "ssh-rsync", status: "fallback" }),
  Object.freeze({ id: "facade-runners", files: ["deploy/aos-resident-cockpit/facade-read-runner.mjs", "deploy/aos-resident-cockpit/facade-write-runner.mjs", "deploy/aos-resident-cockpit/facade-write-rejection-corpus.mjs", "deploy/aos-resident-cockpit/facade-downtime-drill.mjs"], surface: "facade-write+ssh-file", status: "live" }),
  Object.freeze({ id: "paired-backup", files: ["deploy/aos-resident-cockpit/paired-backup.mjs", "deploy/aos-resident-cockpit/vm-take-pair.mjs"], surface: "ssh-file", status: "live" }),
  Object.freeze({ id: "walkthrough", files: ["deploy/aos-resident-cockpit/walkthrough.mjs"], surface: "ssh-file", status: "fallback" }),
  Object.freeze({ id: "truth-root-siting", files: ["deploy/aos-truth-root-siting/probe.mjs"], surface: "ssh-file", status: "fallback" }),
  Object.freeze({ id: "relocation-rehearsal", files: ["deploy/relocation-rehearsal/arc.mjs", "deploy/relocation-rehearsal/relocation-lib.mjs"], surface: "ssh-file", status: "fallback" }),
  Object.freeze({ id: "switch-rehearsal", files: ["deploy/switch-rehearsal/act1-scratch-arc.mjs", "deploy/switch-rehearsal/act2-real-chain-arc.mjs", "deploy/switch-rehearsal/act4-rollback-arc.mjs", "deploy/switch-rehearsal/rehearsal-lib.mjs"], surface: "ssh-file", status: "fallback" }),
]);
