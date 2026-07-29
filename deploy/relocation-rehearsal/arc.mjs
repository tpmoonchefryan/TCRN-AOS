#!/usr/bin/env node
// TCRN-AOS-STORY-130 — the governed relocation rehearsal, full arc, on
// throwaway chains only.
//
// What it walks, in the order the engine mechanically enforces:
//
//   plan → mint permits → vacate → copy → adopt → two-sided inspect
//
// and, on a SECOND throwaway chain that never leaves this machine:
//
//   plan → mint → vacate → (no adopt) → abort
//
// Why this exists: `deploy/switch-rehearsal/` had to hand-rewrite
// `workspace.json`'s five stored roots to make a byte-moved chain answer
// `validate` — the ungoverned edit ADR 0003 was written to replace. This
// rehearsal proves the governed route end to end before it is pointed at
// anything that matters.
//
// THIS DIRECTORY PRODUCES EVIDENCE, NEVER AUTHORITY. Nothing here relocates a
// live chain, and no permit minted here names a live workspaceId.
//
// Usage: node deploy/relocation-rehearsal/arc.mjs <stage>
//   prepare | vacate | transfer | adopt | verify | closeout | abort | teardown

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ACTOR, LOCAL_ENGINE, REPO_ROOT, SCRATCHPAD, VM_ENGINE, VM_HOST, VM_SCRATCH_PREFIX,
  TRANSPORT_RESIDUE_EXCLUDES,
  assertScratchWorkspace, compareLedgers, engineLocal, engineVm, hasState, instant,
  loadState, localLedger, mintAuthorityLocal, mintAuthorityVm, reasonOf, remoteLedger,
  rsyncToVm, saveState, sha256Text, sshNode, ssh, validateAuthorityLocal, vacateCommitmentOf
} from "./relocation-lib.mjs";

const stage = process.argv[2];
const STAGES = ["prepare", "vacate", "transfer", "adopt", "verify", "closeout", "abort", "teardown"];
if (!STAGES.includes(stage)) {
  console.error(`stage must be one of: ${STAGES.join(" | ")}`);
  process.exit(2);
}

const log = (name, value) => {
  process.stderr.write(`[${stage}] ${name}: ${value?.reasonCode ?? (value?.ok === false ? "FAILED" : "ok")}\n`);
  if (value?.ok === false) throw new Error(`${stage}/${name} went red: ${JSON.stringify(value).slice(0, 700)}`);
  return value;
};

const P = () => loadState("paths");

// ---------------------------------------------------------------------------
// prepare — build the source chain, plan the hop, mint the two permits
// ---------------------------------------------------------------------------
if (stage === "prepare") {
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-").replace(/-\d{3}Z$/u, "Z");
  const localRoot = join(SCRATCHPAD, `relocation-rehearsal-${stamp}`);
  const vmRoot = `${VM_SCRATCH_PREFIX}${stamp}`;
  const paths = {
    stamp, localRoot, vmRoot,
    workspace: join(localRoot, "workspace"),
    transient: join(localRoot, "transient"),
    evidenceLocator: join(localRoot, "evidence-locator"),
    releaseTrust: join(localRoot, "release-trust"),
    attest: join(localRoot, "attest"),
    authority: join(localRoot, "authority"),
    control: join(localRoot, "control"),
    vm: {
      workspace: `${vmRoot}/workspace`,
      transient: `${vmRoot}/transient`,
      evidenceLocator: `${vmRoot}/evidence-locator`,
      releaseTrust: `${vmRoot}/release-trust`,
      attest: `${vmRoot}/attest`,
      attestMigrated: `${vmRoot}/attest-migrated`,
      authority: `${vmRoot}/authority`,
      control: `${vmRoot}/control`,
      tools: `${vmRoot}/tools`,
      mirror: `${vmRoot}/mirror`,
      framework: VM_ENGINE
    }
  };
  assertScratchWorkspace(paths.workspace);
  for (const dir of ["workspace", "transient", "evidence-locator", "release-trust", "attest", "authority", "control"]) {
    mkdirSync(join(localRoot, dir), { recursive: true });
  }

  const steps = [];
  const record = (name, value) => { steps.push({ name, ...value }); return log(name, value); };

  // ---- 1. a source chain shaped like a real one --------------------------
  const initArgs = ["--workspace", paths.workspace, "--framework", LOCAL_ENGINE,
    "--transient", paths.transient, "--evidence-locator", paths.evidenceLocator,
    "--release-trust", paths.releaseTrust];
  const init = await engineLocal("init", [...initArgs, "--external-key", "RR-WORKSPACE-001", "--at", instant()]);
  const project = (await engineLocal("project-create", ["--workspace", paths.workspace,
    "--expected-version", "head", "--at", instant(),
    "--external-key", "RR-PROJ-001", "--name", "Relocation rehearsal scratch"])).json;
  await engineLocal("attestation-enable", ["--workspace", paths.workspace,
    "--expected-version", "head", "--at", instant(), "--actor", ACTOR, "--attest-dir", paths.attest]);
  const common = ["--workspace", paths.workspace, "--expected-version", "head",
    "--actor", ACTOR, "--attest-dir", paths.attest];
  const initiative = (await engineLocal("work-create", [...common, "--at", instant(),
    "--project-id", project.record.id, "--external-key", "RR-INIT-001", "--kind", "Initiative"])).json;
  await engineLocal("work-transition", [...common, "--at", instant(),
    "--id", initiative.record.id, "--status", "ready"]);
  await engineLocal("work-annotate", [...common, "--at", instant(),
    "--id", initiative.record.id, "--scope", "Relocation rehearsal fixture initiative"]);
  const epic = (await engineLocal("work-create", [...common, "--at", instant(),
    "--project-id", project.record.id, "--external-key", "RR-EPIC-001", "--kind", "Epic",
    "--parent-id", initiative.record.id])).json;
  const story = (await engineLocal("work-create", [...common, "--at", instant(),
    "--project-id", project.record.id, "--external-key", "RR-STORY-001", "--kind", "Story",
    "--parent-id", epic.record.id])).json;
  await engineLocal("work-transition", [...common, "--at", instant(),
    "--id", story.record.id, "--status", "ready"]);

  // A conference, so the transported tree carries the deliberation shape too.
  const conference = (await engineLocal("conference-open", [...common, "--at", instant(),
    "--external-key", "RR-CONF-001", "--project-id", project.record.id,
    "--type", "verification", "--title", "Relocation rehearsal deliberation",
    "--work-ids", story.record.id, "--desired-outcome", "recommendation",
    "--participant-ids", "profile:tcrn-minerva-v1,profile:tcrn-verity-v1"])).json;
  const conferenceId = conference.recordId ?? conference.record?.id ?? conference.id;
  if (typeof conferenceId !== "string") throw new Error(`conference-open receipt shape unexpected: ${JSON.stringify(conference).slice(0, 400)}`);
  await engineLocal("conference-append-position", [...common, "--at", instant(),
    "--conference-id", conferenceId, "--external-key", "RR-POS-001",
    "--actor-id", "profile:tcrn-verity-v1",
    "--position", "The governed relocation route must be walked on a throwaway chain before it is pointed at a live one.",
    "--risks", "an unrehearsed ceremony is discovered at the worst moment",
    "--recommendations", "walk plan/vacate/adopt/inspect end to end first",
    "--evidence-ids", "-"]);
  await engineLocal("conference-close", [...common, "--at", instant(),
    "--conference-id", conferenceId, "--minutes-external-key", "RR-MIN-001",
    "--summary", "Rehearse the full relocation arc on scratch before the real hop.",
    "--outcome-class", "recommendation",
    "--decisions", "rehearse first on a throwaway chain",
    "--unresolved-issues", "-"]);

  // knowledge store LAST so its high-water mark equals the head: snapshot-manifest
  // (which `relocation-plan` takes under the lease) fails closed otherwise.
  await engineLocal("knowledge-init", ["--workspace", paths.workspace, "--acknowledge-disposable", "true"]);
  const status = (await engineLocal("status", ["--workspace", paths.workspace])).json;
  const validate = (await engineLocal("validate", ["--workspace", paths.workspace])).json;
  record("build-source-chain", {
    ok: validate.reasonCode === "WORKSPACE_COMMAND_COMPLETED" && status.version > 0,
    reasonCode: validate.reasonCode,
    workspaceId: status.workspaceId, version: status.version, headEventHash: status.headEventHash,
    workItems: 3, conferences: 1, attestationEnabled: true,
    externalKey: init.json?.record?.externalKey ?? null
  });

  // ---- 2. the destination roots, realpathed BY THE DESTINATION -----------
  await ssh(["mkdir", "-p", paths.vm.workspace, paths.vm.transient, paths.vm.evidenceLocator,
    paths.vm.releaseTrust, paths.vm.attest, paths.vm.authority, paths.vm.control,
    paths.vm.tools, paths.vm.mirror]);
  const realpaths = await ssh(["sh", "-c",
    `'for p in ${paths.vm.framework} ${paths.vm.workspace} ${paths.vm.transient} ${paths.vm.evidenceLocator} ${paths.vm.releaseTrust}; do realpath "$p"; done'`]);
  const resolved = realpaths.stdout.trim().split("\n");
  const declared = [paths.vm.framework, paths.vm.workspace, paths.vm.transient,
    paths.vm.evidenceLocator, paths.vm.releaseTrust];
  record("destination-roots-realpathed-by-destination", {
    ok: resolved.length === 5 && resolved.every((value, index) => value === declared[index]),
    reasonCode: "DESTINATION_ROOTS_CANONICAL",
    declared, resolvedOnVm: resolved,
    predicate: "declared destination roots must equal the DESTINATION's own realpath — adopt refuses otherwise, and the source engine cannot measure another host"
  });

  // ---- 3. relocation-plan: the only route to the relocationId ------------
  const plan = (await engineLocal("relocation-plan", ["--workspace", paths.workspace,
    "--at", instant(), "--expected-version", String(status.version),
    "--to-framework", paths.vm.framework, "--to-workspace-root", paths.vm.workspace,
    "--to-transient", paths.vm.transient, "--to-evidence-locator", paths.vm.evidenceLocator,
    "--to-release-trust", paths.vm.releaseTrust])).json;
  const manifestPath = join(paths.control, "vacate-control-manifest.json");
  writeFileSync(manifestPath, plan.controlManifest);
  record("relocation-plan", {
    ok: plan.reasonCode === "WORKSPACE_RELOCATION_PLANNED"
      && /^relocation:[a-f0-9]{24}$/u.test(plan.relocationId)
      && sha256Text(plan.controlManifest) === plan.basis.controlManifestSha256,
    reasonCode: plan.reasonCode,
    relocationId: plan.relocationId, sequence: plan.sequence,
    basis: plan.basis, permitStages: plan.permitStages,
    hopsRemaining: plan.hopsRemaining, ledgerEntriesRemaining: plan.ledgerEntriesRemaining,
    controlManifestBytes: Buffer.byteLength(plan.controlManifest, "utf8"),
    controlManifestSha256Recomputed: sha256Text(plan.controlManifest)
  });

  // ---- 4. the vacate permit, in the ENGINE's canonical bytes -------------
  const vacatePermit = {
    actorId: ACTOR,
    workspaceIds: [status.workspaceId],
    destinations: [paths.vm.workspace],
    basis: { headEventHash: plan.basis.headEventHash, version: plan.basis.version },
    relocationId: plan.relocationId,
    stage: "vacate"
  };
  const vacateAuthority = await mintAuthorityLocal(join(paths.authority, "vacate-authority.json"), [vacatePermit]);
  record("mint-vacate-authority", {
    ok: /^[a-f0-9]{64}$/u.test(vacateAuthority.sha256),
    reasonCode: "RELOCATION_AUTHORITY_MINTED",
    byteAuthority: "local governed engine canonicalRelocationAuthority",
    sha256: vacateAuthority.sha256, bytes: vacateAuthority.bytes,
    permitTerms: ["actorId", "workspaceIds", "destinations", "basis", "relocationId", "stage"]
  });

  // ---- 5. the adopt permit, minted ON THE DESTINATION HOST ---------------
  const adoptPermit = { ...vacatePermit, stage: "adopt" };
  const adoptAuthority = await mintAuthorityVm(`${paths.vm.authority}/adopt-authority.json`, [adoptPermit]);
  // A wrong-stage document for the same hop, also minted on the VM: it is what
  // proves the `stage` term is a live control rather than a decorative restatement.
  const wrongStageAuthority = await mintAuthorityVm(`${paths.vm.authority}/wrong-stage-authority.json`, [vacatePermit]);
  record("mint-adopt-authority-on-destination", {
    ok: /^[a-f0-9]{64}$/u.test(adoptAuthority.sha256) && adoptAuthority.sha256 !== vacateAuthority.sha256,
    reasonCode: "RELOCATION_AUTHORITY_MINTED",
    byteAuthority: adoptAuthority.byteAuthority,
    sha256: adoptAuthority.sha256, bytes: adoptAuthority.bytes,
    wrongStageAuthoritySha256: wrongStageAuthority.sha256,
    differsFromVacateAuthority: adoptAuthority.sha256 !== vacateAuthority.sha256
  });

  // ---- 6. RED: copy-first, adopt-before-vacate --------------------------
  // The natural operator instinct, and it must fail closed at the destination.
  await rsyncToVm(paths.control, paths.vm.control);
  await rsyncToVm(paths.workspace, paths.vm.workspace, { excludes: [...TRANSPORT_RESIDUE_EXCLUDES] });
  const copyFirst = await engineVm("relocation-adopt", ["--workspace", paths.vm.workspace,
    "--framework", paths.vm.framework, "--transient", paths.vm.transient,
    "--evidence-locator", paths.vm.evidenceLocator, "--release-trust", paths.vm.releaseTrust,
    "--at", instant(), "--actor", ACTOR, "--relocation-id", plan.relocationId,
    "--control-manifest", `${paths.vm.control}/vacate-control-manifest.json`,
    "--relocation-authority", `${paths.vm.authority}/adopt-authority.json`,
    "--relocation-authority-digest", adoptAuthority.sha256], { allowFailure: true });
  await ssh(["rm", "-rf", `${paths.vm.workspace}/.tcrn-workflow`]);
  record("red-copy-first-adopt-refused", {
    ok: copyFirst.accepted === false,
    reasonCode: reasonOf(copyFirst),
    predicate: "copy-first is the operator's natural instinct and must fail closed rather than produce an unauthorized live target",
    bothHalves: "the SAME command with the same flags is accepted in the `adopt` stage below, so this refusal measures the ordering rather than a broken invocation"
  });

  paths.relocationId = plan.relocationId;
  paths.workspaceId = status.workspaceId;
  saveState("paths", paths);
  saveState("prepare", {
    stage: "prepare", recordedAt: instant(), steps,
    chain: { workspaceId: status.workspaceId, version: status.version, headEventHash: status.headEventHash },
    plan: { relocationId: plan.relocationId, sequence: plan.sequence, basis: plan.basis,
      hopsRemaining: plan.hopsRemaining, ledgerEntriesRemaining: plan.ledgerEntriesRemaining,
      controlManifestSha256: plan.basis.controlManifestSha256 },
    authorities: { vacate: vacateAuthority, adopt: adoptAuthority, wrongStage: wrongStageAuthority },
    ok: true
  });
  console.log(JSON.stringify({ ok: true, localRoot, vmRoot, relocationId: plan.relocationId,
    workspaceId: status.workspaceId, version: status.version }, null, 2));
}

// ---------------------------------------------------------------------------
// vacate — kill the source, then prove it is dead on every face
// ---------------------------------------------------------------------------
if (stage === "vacate") {
  const paths = P();
  const prepare = loadState("prepare");
  const steps = [];
  const record = (name, value) => { steps.push({ name, ...value }); return log(name, value); };

  const before = (await engineLocal("status", ["--workspace", paths.workspace])).json;
  const vacate = await engineLocal("relocation-vacate", ["--workspace", paths.workspace,
    "--at", instant(), "--actor", ACTOR, "--expected-version", String(before.version),
    "--to-framework", paths.vm.framework, "--to-workspace-root", paths.vm.workspace,
    "--to-transient", paths.vm.transient, "--to-evidence-locator", paths.vm.evidenceLocator,
    "--to-release-trust", paths.vm.releaseTrust,
    "--relocation-authority", prepare.authorities.vacate.path,
    "--relocation-authority-digest", prepare.authorities.vacate.sha256,
    "--attest-dir", paths.attest]);
  const receipt = vacate.json;
  writeFileSync(join(paths.control, "vacate-receipt.json"), JSON.stringify(receipt, null, 2));
  record("relocation-vacate", {
    ok: receipt.reasonCode === "WORKSPACE_RELOCATION_VACATE_COMPLETED"
      && receipt.relocationId === paths.relocationId
      && /^[a-f0-9]{64}$/u.test(receipt.vacateCommitmentSha256)
      && receipt.controlManifestSha256 === prepare.plan.controlManifestSha256,
    reasonCode: receipt.reasonCode,
    relocationId: receipt.relocationId, stage: receipt.stage,
    vacateCommitmentSha256: receipt.vacateCommitmentSha256,
    controlManifestSha256: receipt.controlManifestSha256,
    planAndVacateAgreeOnRelocationId: receipt.relocationId === prepare.plan.relocationId,
    planAndVacateAgreeOnControlManifest: receipt.controlManifestSha256 === prepare.plan.controlManifestSha256
  });

  // ---- the source is dead on every read AND write face -------------------
  const faces = [];
  const probe = async (label, verb, args) => {
    const result = await engineLocal(verb, args, { allowFailure: true });
    faces.push({ face: label, verb, accepted: result.accepted, reasonCode: reasonOf(result) });
    return result;
  };
  await probe("read/status", "status", ["--workspace", paths.workspace]);
  await probe("read/validate", "validate", ["--workspace", paths.workspace]);
  await probe("read/export", "export", ["--workspace", paths.workspace]);
  await probe("read/work-list", "work-list", ["--workspace", paths.workspace]);
  await probe("read/snapshot-manifest", "snapshot-manifest", ["--workspace", paths.workspace, "--at", instant()]);
  await probe("read/conference-minutes-list", "conference-minutes-list", ["--workspace", paths.workspace]);
  await probe("write/work-create", "work-create", ["--workspace", paths.workspace,
    "--expected-version", "head", "--at", instant(), "--project-id", "project:000000000000000000000000",
    "--external-key", "RR-DEAD-001", "--kind", "Story", "--actor", ACTOR]);
  await probe("write/work-annotate", "work-annotate", ["--workspace", paths.workspace,
    "--expected-version", "head", "--at", instant(), "--id", "work:000000000000000000000000",
    "--scope", "should never land", "--actor", ACTOR]);
  await probe("write/knowledge-checkpoint", "knowledge-checkpoint", ["--workspace", paths.workspace,
    "--at", instant()]);
  await probe("write/lease-break", "lease-break", ["--workspace", paths.workspace,
    "--at", instant(), "--owner-token", "nonexistent"]);
  const refusedFaces = faces.filter((face) => face.reasonCode === "WORKSPACE_RELOCATION_VACATED");
  record("source-dead-on-every-face", {
    ok: faces.length > 0 && faces.every((face) => face.accepted === false)
      && refusedFaces.length === faces.length,
    reasonCode: "WORKSPACE_RELOCATION_VACATED",
    facesProbed: faces.length, facesRefusedWithVacated: refusedFaces.length, faces
  });

  // ---- the three carve-outs, which are load-bearing ----------------------
  const inspect = await engineLocal("relocation-inspect", ["--workspace", paths.workspace, "--at", instant()], { allowFailure: true });
  const leaseInspect = await engineLocal("lease-inspect", ["--workspace", paths.workspace, "--at", instant()], { allowFailure: true });
  record("carve-outs-still-answer", {
    ok: inspect.accepted === true && leaseInspect.accepted === true
      && inspect.json.state === "vacated"
      && inspect.json.vacateCommitmentSha256 === receipt.vacateCommitmentSha256,
    reasonCode: inspect.json.reasonCode,
    relocationInspect: { state: inspect.json.state, stage: inspect.json.stage,
      relocationId: inspect.json.relocationId,
      ledgerEntriesRemaining: inspect.json.ledgerEntriesRemaining,
      vacateCommitmentSha256: inspect.json.vacateCommitmentSha256,
      unmovedRoots: inspect.json.unmovedRoots },
    leaseInspectAccepted: leaseInspect.accepted,
    commitmentIsPureFunctionOfTree: inspect.json.vacateCommitmentSha256 === receipt.vacateCommitmentSha256,
    note: "relocation-inspect at the vacated source is one half of the mandated close-out; relocation-abort is the only exit. Both carve-outs are load-bearing, not incidental."
  });

  saveState("vacate", { stage: "vacate", steps, receipt, sourceInspect: inspect.json, ok: true });
  console.log(JSON.stringify({ ok: true, reasonCode: receipt.reasonCode,
    vacateCommitmentSha256: receipt.vacateCommitmentSha256, facesRefused: faces.length }, null, 2));
}

// ---------------------------------------------------------------------------
// transfer — the operator moves the bytes; both sides answer for them
// ---------------------------------------------------------------------------
if (stage === "transfer") {
  const paths = P();
  const prepare = loadState("prepare");
  const steps = [];
  const record = (name, value) => { steps.push({ name, ...value }); return log(name, value); };

  await rsyncToVm(paths.workspace, paths.vm.workspace, { excludes: [...TRANSPORT_RESIDUE_EXCLUDES] });
  await rsyncToVm(paths.attest, paths.vm.attest);
  await rsyncToVm(paths.control, paths.vm.control);

  const wsLocal = localLedger(paths.workspace);
  const wsRemote = await remoteLedger(paths.vm.workspace, { excludes: [...TRANSPORT_RESIDUE_EXCLUDES] });
  const wsCompare = compareLedgers(wsLocal, wsRemote);
  const atLocal = localLedger(paths.attest);
  const atRemote = await remoteLedger(paths.vm.attest);
  const atCompare = compareLedgers(atLocal, atRemote);
  record("per-file-reconciliation-both-directions", {
    ok: wsCompare.ok && atCompare.ok,
    reasonCode: wsCompare.ok && atCompare.ok ? "TRANSFER_LEDGERS_EQUAL" : "TRANSFER_LEDGERS_DIVERGENT",
    controlTree: { compared: wsCompare.compared, comparedRemote: wsCompare.comparedRemote,
      missingOnVm: wsCompare.missingOnVm.length, extraOnVm: wsCompare.extraOnVm.length,
      mismatched: wsCompare.mismatched.length, fileSetDigest: wsCompare.fileSetDigest },
    attestSidecar: { compared: atCompare.compared, comparedRemote: atCompare.comparedRemote,
      missingOnVm: atCompare.missingOnVm.length, extraOnVm: atCompare.extraOnVm.length,
      mismatched: atCompare.mismatched.length, fileSetDigest: atCompare.fileSetDigest },
    predicate: "each side computes its own per-file sha256 with its own node; the comparison is full-value and runs in both directions"
  });

  // ---- the transported bytes are what the source signed for -------------
  //
  // A finding, not a formality. The plain CLI `snapshot-verify` CANNOT be green
  // against a vacate-time control manifest, and no operator instruction should
  // say it will be: the manifest is computed under the lease BEFORE the ledger
  // entry is appended, and appending that entry rewrites `workspace.json` — the
  // vacate is the last writer of the one file its own manifest describes. So the
  // step is recorded as BOTH halves:
  //   (a) the CLI verb refuses, naming EXACTLY ONE file — which is itself the
  //       transport proof: nothing else moved;
  //   (b) the engine's own `verifySnapshotManifest(..., { excludePaths:
  //       ["workspace.json"] })` — literally the call `relocation-adopt` makes —
  //       answers SNAPSHOT_VERIFIED over everything else.
  const verifyCli = await engineVm("snapshot-verify", ["--root", paths.vm.workspace,
    "--manifest", `${paths.vm.control}/vacate-control-manifest.json`], { allowFailure: true });
  const excludedVerify = JSON.parse(await sshNode(`
    import { pathToFileURL } from "node:url";
    import { resolve } from "node:path";
    const engine = ${JSON.stringify(VM_ENGINE)};
    const core = await import(pathToFileURL(resolve(engine, "dist/build/packages/core/src/workspace-snapshot.js")).href);
    const manifest = await core.readSnapshotManifestFile(${JSON.stringify(`${paths.vm.control}/vacate-control-manifest.json`)});
    try {
      const result = await core.verifySnapshotManifest(${JSON.stringify(paths.vm.workspace)}, manifest, { excludePaths: ["workspace.json"] });
      process.stdout.write(JSON.stringify({ accepted: true, result }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ accepted: false, reasonCode: error?.reasonCode ?? null, message: String(error?.message ?? error).slice(0, 300) }));
    }
  `, { module: true }));
  record("vm-verifies-the-transported-bytes-against-the-vacate-manifest", {
    ok: reasonOf(verifyCli) === "SNAPSHOT_MISMATCH"
      && verifyCli.json?.error === "workspace.json"
      && excludedVerify.accepted === true
      && (excludedVerify.result?.reasonCode ?? null) === "SNAPSHOT_VERIFIED",
    reasonCode: excludedVerify.result?.reasonCode ?? excludedVerify.reasonCode ?? null,
    manifestSha256: prepare.plan.controlManifestSha256,
    cliSnapshotVerify: { reasonCode: reasonOf(verifyCli), namesExactlyOneFile: verifyCli.json?.error ?? null },
    engineVerifyExcludingWorkspaceJson: excludedVerify.result?.reasonCode ?? excludedVerify.reasonCode ?? null,
    finding: "the vacate is the LAST WRITER of workspace.json, so the plain CLI snapshot-verify can never be green against a vacate-time manifest. It names exactly one file and that is the transport proof; the byte comparison the adopt actually performs excludes that file and is green here."
  });

  // ---- the copy is dead too, and with a DIFFERENT code ------------------
  const faces = [];
  const probe = async (label, verb, args) => {
    const result = await engineVm(verb, args, { allowFailure: true });
    faces.push({ face: label, verb, accepted: result.accepted, reasonCode: reasonOf(result) });
  };
  await probe("read/status", "status", ["--workspace", paths.vm.workspace]);
  await probe("read/validate", "validate", ["--workspace", paths.vm.workspace]);
  await probe("read/export", "export", ["--workspace", paths.vm.workspace]);
  await probe("read/work-list", "work-list", ["--workspace", paths.vm.workspace]);
  await probe("read/snapshot-manifest", "snapshot-manifest", ["--workspace", paths.vm.workspace, "--at", instant()]);
  await probe("write/work-annotate", "work-annotate", ["--workspace", paths.vm.workspace,
    "--expected-version", "head", "--at", instant(), "--id", "work:000000000000000000000000",
    "--scope", "should never land", "--actor", ACTOR]);
  const adoptionRequired = faces.filter((face) => face.reasonCode === "WORKSPACE_RELOCATION_ADOPTION_REQUIRED");
  const destInspect = await engineVm("relocation-inspect", ["--workspace", paths.vm.workspace, "--at", instant()]);
  record("destination-refuses-until-adopted", {
    ok: faces.every((face) => face.accepted === false) && adoptionRequired.length === faces.length
      && destInspect.json.state === "adoption-required",
    reasonCode: "WORKSPACE_RELOCATION_ADOPTION_REQUIRED",
    facesProbed: faces.length, facesRefused: adoptionRequired.length, faces,
    destinationInspect: { state: destInspect.json.state, stage: destInspect.json.stage,
      relocationId: destInspect.json.relocationId },
    note: "between vacate and adopt ZERO addresses are alive; source and copy refuse with DIFFERENT codes and both are actionable"
  });

  saveState("transfer", { stage: "transfer", steps,
    ledgers: { controlTree: wsCompare, attestSidecar: atCompare }, ok: true });
  console.log(JSON.stringify({ ok: true, controlTreeFiles: wsCompare.compared,
    sidecarFiles: atCompare.compared, snapshotVerify: excludedVerify.result?.reasonCode ?? null }, null, 2));
}

// ---------------------------------------------------------------------------
// adopt — three refusal drills at the real destination, then the real adopt
// ---------------------------------------------------------------------------
if (stage === "adopt") {
  const paths = P();
  const prepare = loadState("prepare");
  const steps = [];
  const record = (name, value) => { steps.push({ name, ...value }); return log(name, value); };

  const adoptArgs = (authorityPath, authorityDigest) => ["--workspace", paths.vm.workspace,
    "--framework", paths.vm.framework, "--transient", paths.vm.transient,
    "--evidence-locator", paths.vm.evidenceLocator, "--release-trust", paths.vm.releaseTrust,
    "--at", instant(), "--actor", ACTOR, "--relocation-id", paths.relocationId,
    "--control-manifest", `${paths.vm.control}/vacate-control-manifest.json`,
    "--relocation-authority", authorityPath, "--relocation-authority-digest", authorityDigest,
    "--attest-dir", paths.vm.attest];
  const goodAuthority = [`${paths.vm.authority}/adopt-authority.json`, prepare.authorities.adopt.sha256];

  // The SAME comparison `relocation-adopt` performs internally: the engine's own
  // verifySnapshotManifest excluding workspace.json (the file the vacate itself
  // rewrote). The plain CLI verb cannot express that exclusion, and using it for
  // the "still green" half of a residue drill would make that half permanently
  // red for an unrelated reason — which measures nothing.
  const manifestVerifyExcludingWorkspaceJson = async () => JSON.parse(await sshNode(`
    import { pathToFileURL } from "node:url";
    import { resolve } from "node:path";
    const engine = ${JSON.stringify(VM_ENGINE)};
    const core = await import(pathToFileURL(resolve(engine, "dist/build/packages/core/src/workspace-snapshot.js")).href);
    const manifest = await core.readSnapshotManifestFile(${JSON.stringify(`${paths.vm.control}/vacate-control-manifest.json`)});
    try {
      const result = await core.verifySnapshotManifest(${JSON.stringify(paths.vm.workspace)}, manifest, { excludePaths: ["workspace.json"] });
      process.stdout.write(JSON.stringify({ reasonCode: result?.reasonCode ?? null }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ reasonCode: error?.reasonCode ?? null }));
    }
  `, { module: true }));

  // ---- RED 1: the manifest is blind to a DROPPED EMPTY DIRECTORY --------
  await ssh(["rm", "-rf", `${paths.vm.workspace}/.tcrn-workflow/backups`]);
  const stillVerifiesA = await manifestVerifyExcludingWorkspaceJson();
  const skeleton = await engineVm("relocation-adopt", adoptArgs(...goodAuthority), { allowFailure: true });
  await ssh(["mkdir", "-p", `${paths.vm.workspace}/.tcrn-workflow/backups`]);
  record("red-dropped-empty-directory", {
    ok: skeleton.accepted === false
      && reasonOf(skeleton) === "WORKSPACE_RELOCATION_CONTROL_TREE_INCOMPLETE"
      && stillVerifiesA.reasonCode === "SNAPSHOT_VERIFIED",
    reasonCode: reasonOf(skeleton),
    bothHalves: { snapshotVerifyStillGreen: stillVerifiesA.reasonCode, adoptRefusedUnder: reasonOf(skeleton) },
    note: "without the first half the second would be a check that cannot be shown to measure anything"
  });

  // ---- RED 2: the manifest is blind to a CARRIED-ACROSS LOCK ------------
  await ssh(["mkdir", "-p", `${paths.vm.workspace}/.tcrn-workflow/lease`]);
  const stillVerifiesB = await manifestVerifyExcludingWorkspaceJson();
  const residue = await engineVm("relocation-adopt", adoptArgs(...goodAuthority), { allowFailure: true });
  await ssh(["rm", "-rf", `${paths.vm.workspace}/.tcrn-workflow/lease`]);
  record("red-transport-residue", {
    ok: residue.accepted === false
      && reasonOf(residue) === "WORKSPACE_RELOCATION_TRANSPORT_RESIDUE"
      && stillVerifiesB.reasonCode === "SNAPSHOT_VERIFIED",
    reasonCode: reasonOf(residue),
    bothHalves: { snapshotVerifyStillGreen: stillVerifiesB.reasonCode, adoptRefusedUnder: reasonOf(residue) }
  });

  // ---- RED 3: a permit for the right hop and the WRONG STAGE ------------
  const wrongStage = await engineVm("relocation-adopt",
    adoptArgs(`${paths.vm.authority}/wrong-stage-authority.json`, prepare.authorities.wrongStage.sha256),
    { allowFailure: true });
  record("red-wrong-stage-permit", {
    ok: wrongStage.accepted === false && reasonOf(wrongStage) === "WORKSPACE_RELOCATION_NOT_PERMITTED",
    reasonCode: reasonOf(wrongStage),
    note: "same actor, same workspaceId, same destination, same relocationId — only `stage` differs, which is the term that makes the permit per-verb rather than per-hop"
  });

  // ---- the real adopt ----------------------------------------------------
  const adopt = await engineVm("relocation-adopt", adoptArgs(...goodAuthority));
  const receipt = adopt.json;
  record("relocation-adopt", {
    ok: receipt.reasonCode === "WORKSPACE_RELOCATION_ADOPT_COMPLETED"
      && receipt.relocationId === paths.relocationId && receipt.stage === "adopted",
    reasonCode: receipt.reasonCode,
    relocationId: receipt.relocationId, stage: receipt.stage
  });

  // idempotence: operators retry
  const again = await engineVm("relocation-adopt", adoptArgs(...goodAuthority), { allowFailure: true });
  record("adopt-is-idempotent", {
    ok: reasonOf(again) === "WORKSPACE_RELOCATION_ALREADY_ADOPTED",
    reasonCode: reasonOf(again),
    note: "a verb that half-applies on retry is the same defect as a torn write"
  });

  saveState("adopt", { stage: "adopt", steps, receipt, ok: true });
  console.log(JSON.stringify({ ok: true, reasonCode: receipt.reasonCode, relocationId: receipt.relocationId }, null, 2));
}

// ---------------------------------------------------------------------------
// verify — validate / status / snapshot-verify / the 5x4 consistency matrix
// ---------------------------------------------------------------------------
if (stage === "verify") {
  const paths = P();
  const prepare = loadState("prepare");
  const steps = [];
  const record = (name, value) => { steps.push({ name, ...value }); return log(name, value); };

  const validate = await engineVm("validate", ["--workspace", paths.vm.workspace]);
  const status = await engineVm("status", ["--workspace", paths.vm.workspace]);
  record("vm-validate-and-status", {
    ok: validate.json.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
      && status.json.headEventHash === prepare.chain.headEventHash
      && status.json.version === prepare.chain.version
      && status.json.workspaceId === prepare.chain.workspaceId,
    reasonCode: validate.json.reasonCode,
    headEventHash: status.json.headEventHash, version: status.json.version,
    workspaceId: status.json.workspaceId,
    fullValueEqualToPreVacateSource: {
      headEventHash: status.json.headEventHash === prepare.chain.headEventHash,
      version: status.json.version === prepare.chain.version,
      workspaceId: status.json.workspaceId === prepare.chain.workspaceId
    },
    note: "relocation transforms no event and advances no version; a head that moved would mean the hop rewrote the chain"
  });

  // snapshot-verify against the VACATE-time manifest, after the adopt. The adopt
  // wrote one file (workspace.json, now carrying the ledger), so the honest
  // answer is a refusal naming exactly that file — recorded rather than hidden.
  const post = await engineVm("snapshot-verify", ["--root", paths.vm.workspace,
    "--manifest", `${paths.vm.control}/vacate-control-manifest.json`], { allowFailure: true });
  const postExcluded = JSON.parse(await sshNode(`
    import { pathToFileURL } from "node:url";
    import { resolve } from "node:path";
    const engine = ${JSON.stringify(VM_ENGINE)};
    const core = await import(pathToFileURL(resolve(engine, "dist/build/packages/core/src/workspace-snapshot.js")).href);
    const manifest = await core.readSnapshotManifestFile(${JSON.stringify(`${paths.vm.control}/vacate-control-manifest.json`)});
    try {
      const result = await core.verifySnapshotManifest(${JSON.stringify(paths.vm.workspace)}, manifest, { excludePaths: ["workspace.json"] });
      process.stdout.write(JSON.stringify({ accepted: true, reasonCode: result?.reasonCode ?? null }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ accepted: false, reasonCode: error?.reasonCode ?? null }));
    }
  `, { module: true }));
  record("post-adopt-bytes-still-answer-to-the-vacate-manifest", {
    ok: reasonOf(post) === "SNAPSHOT_MISMATCH" && post.json?.error === "workspace.json"
      && postExcluded.reasonCode === "SNAPSHOT_VERIFIED",
    reasonCode: postExcluded.reasonCode,
    cliSnapshotVerify: { reasonCode: reasonOf(post), namesExactlyOneFile: post.json?.error ?? null },
    engineVerifyExcludingWorkspaceJson: postExcluded.reasonCode,
    note: "after the adopt EXACTLY ONE control file has legitimately changed — workspace.json, which now carries the relocation ledger — and every other byte still matches what the source signed for at the vacate. The adopt is a binding change, not a chain change"
  });

  // ---- ship the matrix driver + the A-side container to the VM ----------
  await ssh(["mkdir", "-p", `${paths.vm.tools}/consistency-matrix`, `${paths.vm.tools}/projection`]);
  await rsyncToVm(resolve(REPO_ROOT, "scripts/consistency-matrix"), `${paths.vm.tools}/consistency-matrix`);
  await rsyncToVm(resolve(REPO_ROOT, "dist/packages/projection"), `${paths.vm.tools}/projection`);

  // A side: rebuild the event-row mirror ON THE VM from the VM chain's own export.
  const ingestScript = `
    import { pathToFileURL } from "node:url";
    import { resolve } from "node:path";
    import { execFileSync } from "node:child_process";
    import { cpSync, rmSync, existsSync } from "node:fs";
    const engine = ${JSON.stringify(VM_ENGINE)};
    const workspace = ${JSON.stringify(paths.vm.workspace)};
    const mirrorPath = ${JSON.stringify(`${paths.vm.mirror}/mirror.db`)};
    const attest = ${JSON.stringify(paths.vm.attest)};
    const attestMigrated = ${JSON.stringify(paths.vm.attestMigrated)};
    const matrixModule = ${JSON.stringify(`${paths.vm.tools}/consistency-matrix/run-matrix.mjs`)};
    const mirrorModule = ${JSON.stringify(`${paths.vm.tools}/projection/src/index.js`)};
    const whitelist = ${JSON.stringify(`${paths.vm.tools}/consistency-matrix/na-whitelist.json`)};
    if (existsSync(mirrorPath)) rmSync(mirrorPath, { force: true });
    if (existsSync(attestMigrated)) rmSync(attestMigrated, { recursive: true, force: true });
    cpSync(attest, attestMigrated, { recursive: true });
    const read = (verb) => JSON.parse(execFileSync(process.execPath,
      [resolve(engine, "scripts/tcrn-workflow.mjs"), verb, "--workspace", workspace],
      { cwd: engine, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" }));
    const status = read("status");
    const exported = read("export");
    const { EventMirrorStore } = await import(pathToFileURL(mirrorModule).href);
    const { loadJudges, runMatrix } = await import(pathToFileURL(matrixModule).href);
    const judges = await loadJudges(engine);
    const store = new EventMirrorStore(mirrorPath);
    const appended = store.ingest(${JSON.stringify("RELOCATION-REHEARSAL")}, status.version, exported.events, judges);
    store.close();
    const matrix = await runMatrix({
      fWorkspace: workspace,
      aDatabasePath: mirrorPath,
      partitionId: ${JSON.stringify("RELOCATION-REHEARSAL")},
      fAttestDir: attest,
      aAttestDir: attestMigrated,
      engineRoot: engine,
      mirrorModulePath: mirrorModule,
      whitelistPath: whitelist,
      labels: { f: "relocated-file-container-on-vm", a: "event-row-mirror-rebuilt-on-vm" }
    });
    process.stdout.write(JSON.stringify({ appended, chainEvents: exported.events.length, matrix }));
  `;
  const matrixOut = JSON.parse(await sshNode(ingestScript, { module: true }));
  const matrix = matrixOut.matrix;
  record("consistency-matrix-on-the-destination", {
    ok: matrix.ok === true && matrix.summary.mismatch === 0
      && matrix.summary.acceptanceGatePending === 0
      && matrixOut.appended === matrixOut.chainEvents && matrixOut.chainEvents > 0,
    reasonCode: matrix.ok ? "MATRIX_ALL_APPLICABLE_EQUAL" : (matrix.reasonCode ?? "MATRIX_HAS_RED_OR_UNSTABLE_CELLS"),
    summary: matrix.summary,
    engineVersion: matrix.engineVersion,
    anchorStable: matrix.anchorStability?.stable,
    headAgreement: matrix.mutualReference?.chainHeadEventHash,
    mirrorRowsAppended: matrixOut.appended, chainEvents: matrixOut.chainEvents,
    sides: matrix.sides,
    bothContainersOnTheDestinationHost: true
  });

  saveState("verify", { stage: "verify", steps,
    matrix: { summary: matrix.summary, cells: matrix.cells, anchor: matrix.anchor,
      anchorStability: matrix.anchorStability, mutualReference: matrix.mutualReference,
      whitelist: matrix.whitelist, sides: matrix.sides, engineVersion: matrix.engineVersion },
    postAdoptSnapshotVerify: { reasonCode: reasonOf(post), accepted: post.accepted },
    ok: true });
  console.log(JSON.stringify({ ok: true, matrix: matrix.summary, matrixOk: matrix.ok }, null, 2));
}

// ---------------------------------------------------------------------------
// closeout — the two-sided inspect ADR 0003 makes binding gate evidence
// ---------------------------------------------------------------------------
if (stage === "closeout") {
  const paths = P();
  const observedAt = instant();
  const source = (await engineLocal("relocation-inspect", ["--workspace", paths.workspace, "--at", observedAt])).json;
  const target = (await engineVm("relocation-inspect", ["--workspace", paths.vm.workspace, "--at", observedAt])).json;
  writeFileSync(join(paths.control, "closeout-source-inspection.json"), JSON.stringify(source, null, 2));
  writeFileSync(join(paths.control, "closeout-target-inspection.json"), JSON.stringify(target, null, 2));

  const verdict = {
    reasonCode: "WORKSPACE_RELOCATION_INSPECTED",
    observedAt,
    source: { address: "<local-scratch-source>", state: source.state, stage: source.stage,
      relocationId: source.relocationId, workspaceId: source.workspaceId,
      relocations: source.relocations, ledgerEntriesRemaining: source.ledgerEntriesRemaining,
      activeWorkspaceRootIsSource: source.activeWorkspaceRoot === paths.workspace,
      unmovedRoots: source.unmovedRoots, nearMissDestination: source.nearMissDestination },
    target: { address: target.address, state: target.state, stage: target.stage,
      relocationId: target.relocationId, workspaceId: target.workspaceId,
      relocations: target.relocations, ledgerEntriesRemaining: target.ledgerEntriesRemaining,
      activeWorkspaceRoot: target.activeWorkspaceRoot,
      unmovedRoots: target.unmovedRoots, nearMissDestination: target.nearMissDestination },
    sharedRelocationId: source.relocationId === target.relocationId ? source.relocationId : null,
    sameWorkspaceId: source.workspaceId === target.workspaceId,
    ok: source.state === "vacated" && source.stage === "vacated"
      && target.stage === "adopted" && target.state === "live"
      && source.relocationId === target.relocationId
      && source.workspaceId === target.workspaceId
  };
  log("two-sided-closeout", verdict);
  saveState("closeout", { stage: "closeout", verdict, sourceRaw: source, targetRaw: target, ok: true });
  console.log(JSON.stringify({ ok: verdict.ok, source: verdict.source.state,
    target: verdict.target.stage, relocationId: verdict.sharedRelocationId }, null, 2));
}

// ---------------------------------------------------------------------------
// abort — the recovery arc, on a SECOND throwaway chain that never leaves here
// ---------------------------------------------------------------------------
if (stage === "abort") {
  const paths = P();
  const steps = [];
  const record = (name, value) => { steps.push({ name, ...value }); return log(name, value); };
  const root = join(SCRATCHPAD, `relocation-abort-drill-${paths.stamp}`);
  const workspace = join(root, "workspace");
  const attest = join(root, "attest");
  const authority = join(root, "authority");
  assertScratchWorkspace(workspace);
  for (const dir of ["workspace", "transient", "evidence-locator", "release-trust", "attest", "authority", "control"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  // A destination that will never be built: this hop is going to be aborted.
  const destination = {
    framework: VM_ENGINE,
    workspace: `${paths.vmRoot}-abort-destination/workspace`,
    transient: `${paths.vmRoot}-abort-destination/transient`,
    evidenceLocator: `${paths.vmRoot}-abort-destination/evidence-locator`,
    releaseTrust: `${paths.vmRoot}-abort-destination/release-trust`
  };

  await engineLocal("init", ["--workspace", workspace, "--framework", LOCAL_ENGINE,
    "--transient", join(root, "transient"), "--evidence-locator", join(root, "evidence-locator"),
    "--release-trust", join(root, "release-trust"),
    "--external-key", "RR-ABORT-WORKSPACE-001", "--at", instant()]);
  const project = (await engineLocal("project-create", ["--workspace", workspace,
    "--expected-version", "head", "--at", instant(),
    "--external-key", "RR-ABORT-PROJ-001", "--name", "Abort drill scratch"])).json;
  await engineLocal("attestation-enable", ["--workspace", workspace,
    "--expected-version", "head", "--at", instant(), "--actor", ACTOR, "--attest-dir", attest]);
  const item = (await engineLocal("work-create", ["--workspace", workspace,
    "--expected-version", "head", "--at", instant(), "--project-id", project.record.id,
    "--external-key", "RR-ABORT-INIT-001", "--kind", "Initiative",
    "--actor", ACTOR, "--attest-dir", attest])).json;
  await engineLocal("knowledge-init", ["--workspace", workspace, "--acknowledge-disposable", "true"]);
  const before = (await engineLocal("status", ["--workspace", workspace])).json;

  const plan = (await engineLocal("relocation-plan", ["--workspace", workspace,
    "--at", instant(), "--expected-version", String(before.version),
    "--to-framework", destination.framework, "--to-workspace-root", destination.workspace,
    "--to-transient", destination.transient, "--to-evidence-locator", destination.evidenceLocator,
    "--to-release-trust", destination.releaseTrust])).json;
  record("abort-drill-plan", {
    ok: plan.reasonCode === "WORKSPACE_RELOCATION_PLANNED",
    reasonCode: plan.reasonCode, relocationId: plan.relocationId,
    ledgerEntriesRemaining: plan.ledgerEntriesRemaining, hopsRemaining: plan.hopsRemaining
  });

  const basePermit = {
    actorId: ACTOR,
    workspaceIds: [before.workspaceId],
    destinations: [destination.workspace],
    basis: { headEventHash: plan.basis.headEventHash, version: plan.basis.version },
    relocationId: plan.relocationId
  };

  // ---- the field-set rule, both directions -------------------------------
  const abortWithoutCommitment = await validateAuthorityLocal({
    schemaVersion: "tcrn.workspace-relocation-authority.v1",
    permits: [{ ...basePermit, stage: "abort" }]
  });
  const vacateWithCommitment = await validateAuthorityLocal({
    schemaVersion: "tcrn.workspace-relocation-authority.v1",
    permits: [{ ...basePermit, stage: "vacate", vacateCommitmentSha256: "0".repeat(64) }]
  });
  record("abort-permit-field-set-is-stage-dependent-both-ways", {
    ok: abortWithoutCommitment.accepted === false && vacateWithCommitment.accepted === false,
    reasonCode: abortWithoutCommitment.reasonCode ?? vacateWithCommitment.reasonCode,
    abortPermitWithoutCommitment: abortWithoutCommitment,
    vacatePermitCarryingCommitment: vacateWithCommitment,
    note: "an optional field that nothing rejects when misplaced is how a reader concludes the binding applies to stages where it does not"
  });

  // ---- ONE document carrying BOTH permits, minted BEFORE the vacate ------
  // Representable, and that is the point: it is refused by ARITHMETIC, not by a
  // syntax rule, because the abort permit would have to name a digest of the file
  // it sits in.
  const guessedCommitment = sha256Text("a commitment guessed before the vacate committed");
  // Permit order is the document's own canonical order (`actorId relocationId
  // stage`), so the abort permit sorts ahead of the vacate permit. The engine
  // refuses an unsorted document outright, which is why this is stated rather
  // than left to luck.
  const combined = await mintAuthorityLocal(join(authority, "combined-pre-minted.json"), [
    { ...basePermit, stage: "abort", vacateCommitmentSha256: guessedCommitment },
    { ...basePermit, stage: "vacate" }
  ]);
  record("one-document-carrying-both-permits-is-representable", {
    ok: /^[a-f0-9]{64}$/u.test(combined.sha256),
    reasonCode: "RELOCATION_AUTHORITY_MINTED",
    sha256: combined.sha256, permits: ["vacate", "abort"],
    note: "the engine does not reject this document syntactically; the refusal below is arithmetic"
  });

  const vacate = await engineLocal("relocation-vacate", ["--workspace", workspace,
    "--at", instant(), "--actor", ACTOR, "--expected-version", String(before.version),
    "--to-framework", destination.framework, "--to-workspace-root", destination.workspace,
    "--to-transient", destination.transient, "--to-evidence-locator", destination.evidenceLocator,
    "--to-release-trust", destination.releaseTrust,
    "--relocation-authority", combined.path, "--relocation-authority-digest", combined.sha256,
    "--attest-dir", attest]);
  const trueCommitment = vacate.json.vacateCommitmentSha256;
  const inspectVacated = (await engineLocal("relocation-inspect", ["--workspace", workspace, "--at", instant()])).json;
  record("abort-drill-vacate", {
    ok: vacate.json.reasonCode === "WORKSPACE_RELOCATION_VACATE_COMPLETED"
      && inspectVacated.state === "vacated"
      && inspectVacated.vacateCommitmentSha256 === trueCommitment,
    reasonCode: vacate.json.reasonCode,
    relocationId: vacate.json.relocationId,
    vacateCommitmentSha256: trueCommitment,
    restatedByInspect: inspectVacated.vacateCommitmentSha256 === trueCommitment,
    note: "the commitment travels in the receipt AND is restated by inspect, so abort stays a pure function of the tree"
  });

  // ---- RED: the pre-minted abort permit cannot satisfy this hop ----------
  const preMintedAbort = await engineLocal("relocation-abort", ["--workspace", workspace,
    "--at", instant(), "--actor", ACTOR, "--relocation-id", plan.relocationId,
    "--acknowledge-fork-risk", "true",
    "--relocation-authority", combined.path, "--relocation-authority-digest", combined.sha256],
    { allowFailure: true });
  // The arithmetic, measured rather than asserted: substituting the true value
  // into the very document that authorised the vacate changes that document's
  // digest, which is an input to the commitment it would have to name.
  const combinedText = readFileSync(combined.path, "utf8");
  const substituted = combinedText.split(guessedCommitment).join(trueCommitment);
  record("red-abort-permit-cannot-be-pre-minted-in-the-vacate-document", {
    ok: preMintedAbort.accepted === false
      && reasonOf(preMintedAbort) === "WORKSPACE_RELOCATION_VACATE_COMMITMENT_MISMATCH",
    reasonCode: reasonOf(preMintedAbort),
    guessedCommitment, trueCommitment,
    selfReference: {
      documentSha256AsVacated: combined.sha256,
      documentSha256IfTheTrueValueWereSubstituted: sha256Text(substituted),
      digestsDiffer: combined.sha256 !== sha256Text(substituted),
      why: "the vacated ledger entry contains authority.authorityFileSha256, and the commitment is sha256 over that entry — so a document carrying a satisfiable abort permit for the hop its own vacate permit authorised would have to contain a digest of itself"
    },
    ceiling: "this is a review device, not a barrier: a SECOND document minted after the vacate satisfies it trivially. What it buys is two documents and two approvals where there was one, and a permanent difference between the two authorityFileSha256 values of an aborted hop"
  });

  // ---- the second document, and the abort ------------------------------
  const abortAuthority = await mintAuthorityLocal(join(authority, "abort-authority.json"), [
    { ...basePermit, stage: "abort", vacateCommitmentSha256: trueCommitment }
  ]);
  const abort = await engineLocal("relocation-abort", ["--workspace", workspace,
    "--at", instant(), "--actor", ACTOR, "--relocation-id", plan.relocationId,
    "--acknowledge-fork-risk", "true",
    "--relocation-authority", abortAuthority.path,
    "--relocation-authority-digest", abortAuthority.sha256,
    "--attest-dir", attest]);
  record("relocation-abort", {
    ok: abort.json.reasonCode === "WORKSPACE_RELOCATION_ABORT_COMPLETED"
      && abort.json.stage === "aborted"
      && abort.json.targetInspectionSupplied === false
      && typeof abort.json.forkRisk === "string",
    reasonCode: abort.json.reasonCode,
    stage: abort.json.stage,
    targetInspectionSupplied: abort.json.targetInspectionSupplied,
    vacateCommitmentSha256: abort.json.vacateCommitmentSha256,
    forkRiskRecorded: typeof abort.json.forkRisk === "string",
    note: "--target-inspection omitted deliberately: this hop's copy was never made, which is the legitimate abort the flag is optional for, and the receipt records the omission"
  });

  // ---- the source is alive again, on every face -------------------------
  const after = (await engineLocal("status", ["--workspace", workspace])).json;
  const validateAfter = (await engineLocal("validate", ["--workspace", workspace])).json;
  const workList = (await engineLocal("work-list", ["--workspace", workspace])).json;
  const revivedWrite = await engineLocal("work-annotate", ["--workspace", workspace,
    "--expected-version", "head", "--at", instant(), "--id", item.record.id,
    "--scope", "written after the abort revived this address",
    "--actor", ACTOR, "--attest-dir", attest], { allowFailure: true });
  record("source-revived", {
    ok: validateAfter.reasonCode === "WORKSPACE_COMMAND_COMPLETED"
      && after.headEventHash === before.headEventHash && after.version === before.version
      && revivedWrite.accepted === true,
    reasonCode: validateAfter.reasonCode,
    headEventHash: after.headEventHash, version: after.version,
    headUnchangedByTheVacateAbortPair: after.headEventHash === before.headEventHash,
    workItemsReadable: Array.isArray(workList.records) ? workList.records.length : null,
    writeFaceAcceptedAgain: revivedWrite.accepted,
    note: "read faces AND a write face: a revived address that only answers reads is not revived"
  });

  // ---- the ledger keeps the pair, forever -------------------------------
  const metadata = JSON.parse(readFileSync(join(workspace, ".tcrn-workflow/workspace.json"), "utf8"));
  const ledger = metadata.relocations ?? [];
  const inspectAfter = (await engineLocal("relocation-inspect", ["--workspace", workspace, "--at", instant()])).json;
  record("ledger-keeps-the-vacated-aborted-pair", {
    ok: ledger.length === 2 && ledger[0].stage === "vacated" && ledger[1].stage === "aborted"
      && ledger[0].relocationId === ledger[1].relocationId
      && ledger[0].authority.authorityFileSha256 !== ledger[1].authority.authorityFileSha256
      && inspectAfter.state === "live" && typeof inspectAfter.forkRisk === "string"
      && inspectAfter.ledgerEntriesRemaining === 14,
    reasonCode: "WORKSPACE_RELOCATION_LEDGER_APPEND_ONLY",
    entries: ledger.map((entry) => ({ sequence: entry.sequence, stage: entry.stage,
      relocationId: entry.relocationId, authorityFileSha256: entry.authority.authorityFileSha256 })),
    twoEntriesNameDifferentAuthorityFiles:
      ledger[0]?.authority?.authorityFileSha256 !== ledger[1]?.authority?.authorityFileSha256,
    vacateAuthoritySha256: combined.sha256, abortAuthoritySha256: abortAuthority.sha256,
    inspectAfterAbort: { state: inspectAfter.state, stage: inspectAfter.stage,
      ledgerEntriesRemaining: inspectAfter.ledgerEntriesRemaining,
      forkRiskCarried: typeof inspectAfter.forkRisk === "string" },
    budget: "the cap is spent by ATTEMPTS, not by moves: this hop moved zero bytes and cost two of sixteen ledger entries, permanently"
  });

  saveState("abort", { stage: "abort", root, steps,
    chain: { workspaceId: before.workspaceId, version: before.version, headEventHash: before.headEventHash },
    ok: true });
  console.log(JSON.stringify({ ok: true, reasonCode: abort.json.reasonCode,
    ledgerEntries: ledger.length, ledgerEntriesRemaining: inspectAfter.ledgerEntriesRemaining }, null, 2));
}

// ---------------------------------------------------------------------------
// teardown — delete both scratch estates, then VERIFY the absence
// ---------------------------------------------------------------------------
if (stage === "teardown") {
  const paths = P();
  const abortState = hasState("abort") ? loadState("abort") : null;
  const results = {};

  const vmTargets = [paths.vmRoot, `${paths.vmRoot}-abort-destination`];
  await ssh(["rm", "-rf", ...vmTargets]);
  const vmCheck = await ssh(["sh", "-c",
    `'for p in ${vmTargets.join(" ")}; do if [ -e "$p" ]; then echo "PRESENT $p"; else echo "ABSENT $p"; fi; done; ls -A /srv/tcrn | tr "\\n" " "; echo; ls -A /srv/tcrn/scratch-relocation-* 2>/dev/null | wc -l'`],
    { allowFailure: true });
  const vmLines = vmCheck.stdout.trim().split("\n");
  results.vm = {
    targets: vmTargets,
    absence: vmLines.filter((line) => line.startsWith("PRESENT") || line.startsWith("ABSENT")),
    srvTcrnEntries: vmLines.find((line) => line.includes("engine")) ?? null,
    allAbsent: vmLines.filter((line) => line.startsWith("PRESENT")).length === 0
  };

  const localTargets = [paths.localRoot, ...(abortState ? [abortState.root] : [])];
  for (const target of localTargets) {
    assertScratchWorkspace(join(target, "workspace"));
    rmSync(target, { recursive: true, force: true });
  }
  results.local = {
    targets: localTargets.map(() => "<local-scratch-root>"),
    absence: localTargets.map((target) => (existsSync(target) ? "PRESENT" : "ABSENT")),
    allAbsent: localTargets.every((target) => !existsSync(target))
  };

  // Process residue: this rehearsal starts no long-lived load at all, and the
  // check is run rather than assumed — an unclaimed process is the leak, a
  // registered daemon is not.
  const vmProcs = await ssh(["sh", "-c",
    "'pgrep -f \"scratch-relocatio[n]-\" | wc -l; pgrep -f \"tcrn-workflow-mc[p]\" | wc -l'"], { allowFailure: true });
  const [scratchProcs, facades] = vmProcs.stdout.trim().split(/\s+/u).map((n) => Number.parseInt(n, 10) || 0);
  results.processResidue = {
    vmScratchProcesses: scratchProcs, vmEngineFacades: facades,
    ok: scratchProcs === 0,
    note: "no dev server, tunnel, watcher or headless browser was started by this rehearsal; the check runs anyway"
  };

  results.ok = results.vm.allAbsent && results.local.allAbsent && results.processResidue.ok;
  log("teardown", results);
  saveState("teardown", { stage: "teardown", ...results });
  console.log(JSON.stringify(results, null, 2));
}
