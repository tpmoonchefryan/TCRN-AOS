#!/usr/bin/env node
// TCRN AOS — gate identity authority placement at the governed workspace's
// bound release-trust root (MIN-007 D10; retargeted for TCRN-AOS-INC-044).
//
// ---------------------------------------------------------------------------
// THE SAME FILE, TWO OPPOSITE CORRECT DISPOSITIONS — read this before you
// conclude one of them was a mistake.
// ---------------------------------------------------------------------------
// MIN-007 D10 rules that the gate identity authority has exactly ONE canonical
// source, which stays with the ceremony terminal, and that any other host holds
// a copy placed BY DIGEST — never an independently edited file, never a second
// authority. That ruling never changed. What changed is where the ceremony runs.
//
//   * Under MIN-011 (direction D) the truth root was the Owner's machine and the
//     ceremony ran there. The VM's copy at /srv/tcrn/governance/
//     gate-identity-authority.json therefore had no remaining consumer, and
//     REMOVING it was the correct disposition — recorded in
//     evidence/aos-direction-d-disposition.json (`gateAuthorityRemoval`) and in
//     the superseded receipt evidence/aos-gate-authority-placement.json.
//
//   * The AOS truth root has since relocated to the VM (relocation stage
//     `adopted`, sequence 2). The ceremony follows the chain, so the ceremony now
//     runs on the VM, and the authority document must be PRESENT at the
//     workspace's own bound release-trust root. That root relocated with the
//     chain and arrived empty — which is exactly TCRN-AOS-INC-044: with no
//     authority document at the address the workspace declares, `gate-transition`
//     cannot be performed at the new address at all.
//
// So this repository has, correctly, both removed and placed the same 199 bytes
// on the same host within days. Neither act was an error and neither reverses the
// other's reasoning: D10's rule is "one canonical source, copies by digest, only
// where a consumer exists". The consumer moved. Do not "restore" the MIN-011
// removal and do not read this placement as undoing it.
//
// ---------------------------------------------------------------------------
// What this script does
// ---------------------------------------------------------------------------
//   1. read       — the canonical source is read (READ-ONLY: this script never
//                   writes, renames, chmods or touches it) and its sha256 taken;
//   2. address     — the destination is DERIVED from the governed workspace's own
//                   control record on the VM (the adopted relocation's
//                   release-trust root), not from a literal typed here, and then
//                   checked against a pinned expectation so a surprise fails
//                   closed rather than silently placing an authority somewhere
//                   new. The MIN-011-removed path is asserted still absent, so
//                   this run cannot leave two authority documents on the host;
//   3. place       — the bytes are written under umask 077 + chmod 0600,
//                   idempotently;
//   4. verify      — the VM computes its own sha256 of the copy; the two 64-hex
//                   values are compared in full. A mismatch refuses the receipt;
//   5. red drill   — one byte of the VM copy is flipped, the comparison is
//                   watched going red, the copy is re-placed, the comparison
//                   watched going green. A predicate that has never been red is
//                   not a predicate;
//   6. owner drill — a disposable governed workspace inits under
//                   /srv/tcrn/scratch-*, an owner_intent_required gate is
//                   created, and the VM engine is watched RULING PER THE PLACED
//                   COPY at its new address: wrong digest refused
//                   GATE_IDENTITY_AUTHORITY_DIGEST, unpermitted actor refused
//                   WORKSPACE_GATE_IDENTITY_REFUSED, permitted actor + correct
//                   digest passing the identity layer (surfacing the engine's
//                   separate evidence-anchoring rule for `satisfied`) and
//                   completing a `blocked` transition on the scratch chain. The
//                   scratch tree is removed and verified absent.
//                   The drill NEVER touches the real AOS chain — the only verb
//                   this script runs against it is the read-only `status`.
//
// Usage:
//   node deploy/access-boundary/place-gate-authority.mjs             # full run
//   node deploy/access-boundary/place-gate-authority.mjs --no-drill  # skip step 6
//
// The receipt lands in evidence/aos-gate-authority-at-new-address.json and never
// carries a machine-local absolute path.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const platformRoot = resolve(repoRoot, "..");
const receiptPath = join(repoRoot, "evidence", "aos-gate-authority-at-new-address.json");

// The single canonical source (D10). Read-only from here: the only fs call
// against this path anywhere in this file is readFile.
const canonicalPath = join(platformRoot, ".tcrn-workspace", "release-trust", "gate-identity-authority.json");
const canonicalLocator = "<platform-root>/.tcrn-workspace/release-trust/gate-identity-authority.json";

const host = "tcrn-platform-dev";
const enginePath = "/srv/tcrn/engine/tcrn-workflow";
const vmWorkspace = "/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace";
const vmControlRecord = posix.join(vmWorkspace, ".tcrn-workflow", "workspace.json");
const authorityFileName = "gate-identity-authority.json";
// Pinned expectation for step 2. The destination is derived from the chain; this
// constant only decides whether the derived value is the one this recipe was
// reviewed for.
const expectedReleaseTrustRoot = "/srv/tcrn/governance/tcrn-workspace/release-trust";
const expectedWorkspaceId = "workspace:fbc32e3ff874fbbd637a1b85";
// The copy MIN-011 removed. Asserted ABSENT, never recreated.
const retiredCopyPath = "/srv/tcrn/governance/gate-identity-authority.json";
const drillRequested = !process.argv.includes("--no-drill");

const log = (line) => process.stderr.write(`${line}\n`);
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// ssh joins argv with spaces and the remote shell re-tokenizes, so every value
// that could carry a space (or shell syntax) is single-quoted before travel.
const shq = (value) => `'${String(value).replace(/'/gu, `'\\''`)}'`;

async function ssh(command, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await run("ssh", ["-n", host, command], { maxBuffer: 16 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (allowFailure && typeof error.code === "number") {
      return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
    }
    throw error;
  }
}

/** ssh with bytes piped to the remote command's stdin (execFile has no input option). */
function sshWithStdin(command, bytes) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("ssh", [host, command], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`remote command exited ${code}: ${stderr.slice(0, 500)}`));
    });
    child.stdin.end(bytes);
  });
}

/** The remote engine CLI; refusals come back as parsed JSON with accepted=false. */
async function engine(verb, args) {
  const command = ["node", `${enginePath}/scripts/tcrn-workflow.mjs`, verb, ...args.map(shq)].join(" ");
  const result = await ssh(command, { allowFailure: true });
  const emitted = result.code === 0 ? result.stdout : (result.stderr.trim() || result.stdout.trim());
  let json;
  try { json = JSON.parse(emitted); } catch {
    throw new Error(`engine ${verb} emitted non-JSON (exit ${result.code}): ${emitted.slice(0, 500)}`);
  }
  return { accepted: result.code === 0, json };
}

async function remoteSha(path) {
  const result = await ssh(`sha256sum ${shq(path)} | cut -d" " -f1`);
  const digest = result.stdout.trim();
  if (!/^[0-9a-f]{64}$/u.test(digest)) throw new Error(`remote sha256 unreadable: ${digest}`);
  return digest;
}

async function place(destination, bytes) {
  await sshWithStdin(
    `umask 077 && mkdir -p ${shq(posix.dirname(destination))} && cat > ${shq(destination)} && chmod 0600 ${shq(destination)}`,
    bytes);
}

/* 1. read (read-only) --------------------------------------------------- */
const startedAt = instant();
log(`[1/6] reading canonical source (read-only)`);
const canonicalBytes = await readFile(canonicalPath);
const canonicalDigest = sha256(canonicalBytes);
const document = JSON.parse(canonicalBytes.toString("utf8"));
const roster = document.permits.map((permit) => ({ actorId: permit.actorId, outcomeClasses: permit.outcomeClasses }));

/* 2. derive the destination from the chain's own control record ---------- */
log(`[2/6] deriving the destination from the governed workspace's control record`);
const controlRecord = JSON.parse((await ssh(`cat ${shq(vmControlRecord)}`)).stdout);
if (controlRecord.workspaceId !== expectedWorkspaceId) {
  throw new Error(`control record is workspace ${controlRecord.workspaceId}, expected ${expectedWorkspaceId}`);
}
const adopted = (controlRecord.relocations ?? [])
  .filter((entry) => entry.stage === "adopted")
  .sort((a, b) => a.sequence - b.sequence)
  .at(-1);
const rootsInForce = adopted ? adopted.to : controlRecord.roots;
const releaseTrustRoot = rootsInForce.find((root) => root.kind === "release-trust")?.path;
if (releaseTrustRoot !== expectedReleaseTrustRoot) {
  throw new Error(
    `the workspace's release-trust root is ${releaseTrustRoot}; this recipe was reviewed for ${expectedReleaseTrustRoot}. ` +
    `Refusing to place an authority document at an unreviewed address.`);
}
const vmCopyPath = posix.join(releaseTrustRoot, authorityFileName);
// No second authority on the host: the MIN-011-removed copy must still be gone.
const retiredAbsent = (await ssh(`test ! -e ${shq(retiredCopyPath)}`, { allowFailure: true })).code === 0;
if (!retiredAbsent) {
  throw new Error(`${retiredCopyPath} exists again; two authority documents on one host violates D10. Investigate before placing.`);
}
// The only verb this script runs against the real chain: read-only status.
// `status` takes --workspace and nothing else; adding --at would be refused.
const status = await engine("status", ["--workspace", vmWorkspace]);
if (!status.accepted) throw new Error(`status on the live AOS chain refused: ${JSON.stringify(status.json)}`);

/* 3. place -------------------------------------------------------------- */
log(`[3/6] placing copy at ${host}:${vmCopyPath} (0600)`);
await place(vmCopyPath, canonicalBytes);
const statLine = (await ssh(`stat -c "%a %U:%G %s" ${shq(vmCopyPath)}`)).stdout.trim();
if (!statLine.startsWith("600 ")) throw new Error(`VM copy permissions are not 0600: ${statLine}`);

/* 4. verify ------------------------------------------------------------- */
log(`[4/6] full-value digest comparison, both sides`);
const placedDigest = await remoteSha(vmCopyPath);
if (placedDigest !== canonicalDigest) {
  throw new Error(`VM copy digest ${placedDigest} does not match canonical ${canonicalDigest}`);
}

/* 5. red drill on the comparison ---------------------------------------- */
log(`[5/6] red drill: one flipped VM byte must fail the comparison`);
await ssh(`printf '\\000' | dd of=${shq(vmCopyPath)} bs=1 count=1 conv=notrunc status=none`);
const flippedDigest = await remoteSha(vmCopyPath);
const wentRed = flippedDigest !== canonicalDigest;
// A flipped byte must also make the ENGINE refuse, not merely make sha256sum
// disagree: the predicate that matters is the one the ceremony runs through.
let engineRefusedFlipped = null;
await place(vmCopyPath, canonicalBytes);
const restoredDigest = await remoteSha(vmCopyPath);
if (!wentRed) throw new Error("flipping a VM byte did not change the comparison; the predicate is not real");
if (restoredDigest !== canonicalDigest) throw new Error("could not restore the VM copy to the canonical bytes");

/* 6. owner-gate drill ---------------------------------------------------- */
let drill = { executed: false, reason: "--no-drill was passed; the owner gate was not exercised" };
if (drillRequested) {
  log(`[6/6] owner-gate drill on a scratch governed workspace (real chain untouched)`);
  const scratchRoot = `/srv/tcrn/scratch-inc044-${Date.now()}`;
  const workspace = `${scratchRoot}/workspace`;
  try {
    await ssh(`mkdir -p ${[workspace, `${scratchRoot}/transient`, `${scratchRoot}/evidence-locator`, `${scratchRoot}/release-trust`].map(shq).join(" ")}`);
    const base = ["--workspace", workspace, "--at", instant()];
    const headed = [...base, "--expected-version", "head"];

    const init = await engine("init", [...base,
      "--framework", enginePath, "--transient", `${scratchRoot}/transient`,
      "--evidence-locator", `${scratchRoot}/evidence-locator`, "--release-trust", `${scratchRoot}/release-trust`,
      "--external-key", "SCRATCH-INC044-GATE-DRILL"]);
    if (!init.accepted) throw new Error(`scratch init refused: ${JSON.stringify(init.json)}`);

    const project = await engine("project-create", [...headed,
      "--external-key", "SCRATCH-INC044-PROJ", "--name", "INC-044 authority drill", "--actor", "owner:governance"]);
    if (!project.accepted) throw new Error(`project-create refused: ${JSON.stringify(project.json)}`);
    const projectId = project.json.record.id;

    const gate = await engine("gate-create", [...headed,
      "--external-key", "SCRATCH-INC044-GATE", "--project-id", projectId, "--work-id", "-",
      "--title", "INC-044 owner intent drill gate", "--outcome-class", "owner_intent_required",
      "--actor", "owner:governance"]);
    if (!gate.accepted) throw new Error(`gate-create refused: ${JSON.stringify(gate.json)}`);
    const gateId = gate.json.recordId;

    // Every transition below resolves the authority from the PLACED COPY at the
    // new address — the same path and bytes the real ceremony will now use.
    const transition = (status_, actor, digest) => engine("gate-transition", [...headed,
      "--id", gateId, "--status", status_, "--actor", actor,
      "--identity-authority", vmCopyPath, "--identity-authority-digest", digest]);

    // RED 1 — right file, wrong digest: refused before anything else happens.
    const wrongDigest = await transition("satisfied", "owner:governance", "0".repeat(64));
    if (wrongDigest.accepted || wrongDigest.json.reasonCode !== "GATE_IDENTITY_AUTHORITY_DIGEST") {
      throw new Error(`wrong digest was not refused as GATE_IDENTITY_AUTHORITY_DIGEST: ${JSON.stringify(wrongDigest.json)}`);
    }

    // RED 1b — the byte-flip red proof, re-run through the engine rather than
    // through sha256sum: a tampered copy at the new address is refused with the
    // digest the caller correctly holds.
    await ssh(`printf '\\000' | dd of=${shq(vmCopyPath)} bs=1 count=1 conv=notrunc status=none`);
    const tampered = await transition("blocked", "owner:governance", canonicalDigest);
    engineRefusedFlipped = {
      accepted: tampered.accepted,
      reasonCode: tampered.json.reasonCode,
      refused: !tampered.accepted && tampered.json.reasonCode === "GATE_IDENTITY_AUTHORITY_DIGEST",
    };
    await place(vmCopyPath, canonicalBytes);
    if (await remoteSha(vmCopyPath) !== canonicalDigest) throw new Error("could not restore the VM copy after the engine-level red drill");
    if (!engineRefusedFlipped.refused) {
      throw new Error(`a tampered authority copy was not refused by the engine: ${JSON.stringify(tampered.json)}`);
    }

    // RED 2 — correct digest, actor outside the roster: the engine consulted
    // the placed copy's permits and refused by name.
    const wrongActor = await transition("satisfied", "agent:fable", canonicalDigest);
    if (wrongActor.accepted || wrongActor.json.reasonCode !== "WORKSPACE_GATE_IDENTITY_REFUSED") {
      throw new Error(`unpermitted actor was not refused: ${JSON.stringify(wrongActor.json)}`);
    }

    // GREEN (identity layer) — permitted actor, correct digest, `satisfied`:
    // the identity layer passes and the engine's NEXT rule speaks (satisfied
    // requires anchoring conference minutes, which a scratch chain does not
    // have). That explicit refusal code is the ruling this drill is after: the
    // authority resolved at the NEW address, the digest matched, the engine ruled.
    const satisfied = await transition("satisfied", "owner:governance", canonicalDigest);
    if (satisfied.accepted || satisfied.json.reasonCode !== "WORKSPACE_GATE_EVIDENCE_UNRESOLVED") {
      throw new Error(`satisfied did not surface the evidence-anchoring rule: ${JSON.stringify(satisfied.json)}`);
    }

    // GREEN (completed write) — same identity path, `blocked`: no minutes
    // requirement, so the transition completes and the scratch chain advances.
    const blocked = await transition("blocked", "owner:governance", canonicalDigest);
    if (!blocked.accepted || blocked.json.reasonCode !== "WORKSPACE_COMMAND_COMPLETED") {
      throw new Error(`blocked transition did not complete: ${JSON.stringify(blocked.json)}`);
    }

    drill = {
      executed: true,
      isolation: "a disposable workspace under <vm-scratch>; the live AOS chain was never a target of a mutating verb",
      authorityResolvedFrom: vmCopyPath,
      scratch: "<vm-scratch> (created for this run, removed below, absence verified)",
      workspaceId: init.json.workspaceId,
      gate: { id: gateId, outcomeClass: "owner_intent_required" },
      rulings: {
        wrongDigest: { status: "satisfied", actor: "owner:governance", digest: "64x0",
          reasonCode: wrongDigest.json.reasonCode, verdict: "red — refused before the identity layer" },
        tamperedCopy: { status: "blocked", actor: "owner:governance", digest: "canonical, copy byte-flipped",
          reasonCode: engineRefusedFlipped.reasonCode,
          verdict: "red — the engine itself refused the tampered copy at the new address; copy restored and re-verified" },
        unpermittedActor: { status: "satisfied", actor: "agent:fable", digest: "canonical",
          reasonCode: wrongActor.json.reasonCode, error: wrongActor.json.error,
          verdict: "red — the engine consulted the placed roster and refused by name" },
        permittedSatisfied: { status: "satisfied", actor: "owner:governance", digest: "canonical",
          reasonCode: satisfied.json.reasonCode,
          verdict: "identity layer passed; the engine's separate evidence-anchoring rule spoke next" },
        permittedBlocked: { status: "blocked", actor: "owner:governance", digest: "canonical",
          reasonCode: blocked.json.reasonCode, chainVersion: blocked.json.version,
          verdict: "green — completed write, ruled per the placed authority copy at the new address" },
      },
    };
  } finally {
    await ssh(`rm -rf ${shq(scratchRoot)}`);
    const gone = (await ssh(`test ! -e ${shq(scratchRoot)}`, { allowFailure: true })).code === 0;
    if (!gone) throw new Error(`scratch ${scratchRoot} survived cleanup`);
    // Judge remote processes by comm, not by argv: an argv pattern match would
    // find the very shell running the check. `ps -e -o comm=` lists command
    // names only, so nothing here can match this command line.
    const nodeProcs = await ssh(`ps -e -o comm= | grep -cx node`, { allowFailure: true });
    drill.reclaim = {
      scratchRemoved: gone,
      // The drill spawns no background load; every engine invocation is a
      // synchronous ssh round trip that has already exited. This count is the
      // host's steady-state node population, recorded so a future run can see
      // a change rather than trust a claim.
      nodeProcessesOnHost: Number(nodeProcs.stdout.trim() || 0),
    };
  }
} else {
  log(`[6/6] owner-gate drill skipped (--no-drill)`);
}

/* receipt ---------------------------------------------------------------- */
const receipt = {
  schemaVersion: "aos.gate-authority-at-new-address.v1",
  ruling: "TCRN-AOS-MIN-007 D10, applied at the relocated truth root",
  defect: "TCRN-AOS-INC-044 — the release-trust root relocated to the VM empty, so gate-transition had no authority document at the address the workspace declares",
  ok: true,
  startedAt,
  finishedAt: instant(),
  directionReversalNote: {
    headline: "the same 199 bytes were correctly REMOVED from this host under MIN-011 and are correctly PLACED here now; neither act was a mistake",
    d10Rule: "one canonical source on the ceremony terminal; other hosts hold a copy placed by digest, and only where a consumer exists",
    whatChanged: "not the rule — the location of the consumer. MIN-011 kept the truth root and the ceremony on the Owner's machine, so the VM copy had no consumer and was removed. The AOS truth root has since relocated to the VM (relocation stage adopted, sequence 2), so the ceremony runs on the VM and the authority must be present at the workspace's own bound release-trust root.",
    removalRecord: "evidence/aos-direction-d-disposition.json → gateAuthorityRemoval",
    supersededReceipt: "evidence/aos-gate-authority-placement.json (the MIN-007-era placement at the now-retired path; kept as history, not as a live claim)",
    doNotDo: "do not read this placement as reverting the MIN-011 removal, and do not recreate the retired path — this run asserts that path is still absent precisely so the host never holds two authority documents",
  },
  canonicalSource: {
    locator: canonicalLocator,
    heldBy: "ceremony terminal (Owner's machine); read-only for this recipe — the only fs call against it is readFile",
    sha256: canonicalDigest,
    bytes: canonicalBytes.length,
    schemaVersion: document.schemaVersion,
    roster,
    unchangedSinceMin011: canonicalDigest === "fab89e256b7a4df472ac6310ae1b5e85e6993a3655c062dcf5ba82e140ed15b7",
  },
  placement: {
    destinationHost: host,
    path: vmCopyPath,
    addressDerivedFrom: {
      controlRecord: `${vmWorkspace}/.tcrn-workflow/workspace.json (read only)`,
      workspaceId: controlRecord.workspaceId,
      relocation: adopted ? { relocationId: adopted.relocationId, stage: adopted.stage, sequence: adopted.sequence } : null,
      releaseTrustRootInForce: releaseTrustRoot,
      pinnedExpectation: expectedReleaseTrustRoot,
      note: "the destination is read out of the chain's own record and then checked against a reviewed constant; a relocation to an unreviewed address fails closed instead of placing an authority somewhere new",
    },
    liveChainAtPlacement: {
      verbsRunAgainstTheRealChain: ["status (read-only)"],
      version: status.json.version ?? status.json.record?.version ?? null,
      reasonCode: status.json.reasonCode ?? null,
    },
    retiredCopy: {
      path: retiredCopyPath,
      state: "ABSENT — verified before placing",
      why: "MIN-011 removed it; D10 forbids a second authority document on one host",
    },
    mode: statLine,
    method: "bytes over existing ssh (stdin), umask 077 + chmod 0600, idempotent",
    digestComparison: {
      canonical: canonicalDigest,
      vmCopy: restoredDigest,
      comparedAs: "full 64-hex values",
      match: restoredDigest === canonicalDigest,
    },
  },
  predicateRedProof: {
    executed: true,
    filesystemLayer: {
      predicate: "sha256(VM copy) === sha256(canonical source)",
      flip: "first byte of the VM copy overwritten in place",
      flippedDigest,
      wentRed,
      restoredGreen: restoredDigest === canonicalDigest,
    },
    engineLayer: engineRefusedFlipped === null
      ? { executed: false, reason: "requires the drill (--no-drill was passed)" }
      : {
        executed: true,
        predicate: "the VM engine refuses a gate-transition whose --identity-authority bytes do not hash to --identity-authority-digest",
        flip: "first byte of the placed copy overwritten in place, correct digest still supplied",
        ...engineRefusedFlipped,
        restoredGreen: true,
        why: "the filesystem comparison alone proves sha256sum works; this proves the predicate the ceremony actually runs through",
      },
  },
  // Step 2 introduced two fail-closed assertions that a green run cannot
  // exercise (a green run is precisely the case where neither fires). Each was
  // manufactured red once, by hand, and the refusal observed verbatim. Recorded
  // here rather than claimed: a predicate that has never been red is not a
  // predicate, and these two are the ones standing between a relocation surprise
  // and an authority document quietly appearing at an unreviewed address.
  failClosedPredicatesRedProof: [
    {
      predicate: "the release-trust root read out of the chain equals the address this recipe was reviewed for",
      howRedWasMade: "the pinned constant was temporarily set to a path the chain does not name",
      observed: "Error: the workspace's release-trust root is /srv/tcrn/governance/tcrn-workspace/release-trust; this recipe was reviewed for /srv/tcrn/governance/tcrn-workspace/release-trust-UNREVIEWED. Refusing to place an authority document at an unreviewed address.",
      placedAnything: false,
      why: "the assertion runs in step 2, before any write in step 3, so a red leaves the host untouched",
      restored: true,
    },
    {
      predicate: "the MIN-011-removed authority path is still absent, so the host never holds two authority documents",
      howRedWasMade: "the retired-path constant was temporarily pointed at a file that does exist — the placed copy itself. The retired path was NEVER recreated to manufacture this red",
      observed: "Error: /srv/tcrn/governance/tcrn-workspace/release-trust/gate-identity-authority.json exists again; two authority documents on one host violates D10. Investigate before placing.",
      placedAnything: false,
      restored: true,
    },
  ],
  ownerGateDrill: drill,
};

let text = `${JSON.stringify(receipt, null, 2)}\n`;
text = text.split(platformRoot).join("<platform-root>");
text = text.split(homedir()).join("<operator-home>");
if (text.includes("/Users/")) throw new Error("a machine-local absolute path survived scrubbing; refusing to write");
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, text);
log("receipt written to evidence/aos-gate-authority-at-new-address.json");
