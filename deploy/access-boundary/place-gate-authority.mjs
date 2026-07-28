#!/usr/bin/env node
// TCRN AOS — gate identity authority placement on the platform dev VM
// (MIN-007 D10, EPIC-034-S121).
//
// D10 rules that the gate identity authority has exactly ONE canonical source,
// which stays with the ceremony terminal (the Owner's machine, in the platform
// workspace's release-trust/), and that any other host holds a copy placed by
// digest — never an independently edited file, never a second authority. This
// script is the declarative recipe for that placement:
//
//   1. read      — the canonical source is read (READ-ONLY: this script never
//                  writes, renames, or touches it) and its sha256 taken;
//   2. place     — the bytes are written to the VM at
//                  /srv/tcrn/governance/gate-identity-authority.json under
//                  umask 077 + chmod 0600, idempotently;
//   3. verify    — the VM computes its own sha256 of the copy; the two 64-hex
//                  values are compared in full. A mismatch refuses the receipt;
//   4. red drill — one byte of the VM copy is flipped, the comparison is
//                  watched going red, the copy is re-placed, the comparison
//                  watched going green. A predicate that has never been red is
//                  not a predicate;
//   5. drill     — (--drill) a disposable governed workspace inits under
//                  /srv/tcrn/scratch-*, an owner_intent_required gate is
//                  created, and the VM engine is watched RULING PER THE PLACED
//                  COPY: wrong digest refused GATE_IDENTITY_AUTHORITY_DIGEST,
//                  unpermitted actor refused WORKSPACE_GATE_IDENTITY_REFUSED,
//                  permitted actor + correct digest passing the identity layer
//                  (surfacing the engine's separate evidence-anchoring rule for
//                  `satisfied`) and completing a `blocked` transition on the
//                  chain. The scratch tree is then removed and verified absent.
//
// The receipt lands in evidence/aos-gate-authority-placement.json and never
// carries a machine-local absolute path.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const platformRoot = resolve(repoRoot, "..");
const receiptPath = join(repoRoot, "evidence", "aos-gate-authority-placement.json");

// The single canonical source (D10). Read-only from here: the only fs calls
// against this path in this file are readFile.
const canonicalPath = join(platformRoot, ".tcrn-workspace", "release-trust", "gate-identity-authority.json");
const canonicalLocator = "<platform-root>/.tcrn-workspace/release-trust/gate-identity-authority.json";

const host = "tcrn-platform-dev";
const enginePath = "/srv/tcrn/engine/tcrn-workflow";
const vmCopyPath = "/srv/tcrn/governance/gate-identity-authority.json";
const drillRequested = process.argv.includes("--drill");

const log = (line) => process.stderr.write(`${line}\n`);
const instant = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// ssh joins argv with spaces and the remote shell re-tokenizes, so every value
// that could carry a space (or shell syntax) is single-quoted before travel.
const shq = (value) => `'${String(value).replace(/'/gu, `'\\''`)}'`;

async function ssh(command, { allowFailure = false } = {}) {
  try {
    const { stdout, stderr } = await run("ssh", [host, command], { maxBuffer: 8 * 1024 * 1024 });
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

async function remoteCopySha() {
  const result = await ssh(`sha256sum ${shq(vmCopyPath)} | cut -d" " -f1`);
  const digest = result.stdout.trim();
  if (!/^[0-9a-f]{64}$/u.test(digest)) throw new Error(`remote sha256 unreadable: ${digest}`);
  return digest;
}

async function place(bytes) {
  await sshWithStdin(
    `umask 077 && mkdir -p ${shq(dirname(vmCopyPath))} && cat > ${shq(vmCopyPath)} && chmod 0600 ${shq(vmCopyPath)}`,
    bytes);
}

/* 1. read (read-only) --------------------------------------------------- */
const startedAt = instant();
log(`[1/5] reading canonical source (read-only)`);
const canonicalBytes = await readFile(canonicalPath);
const canonicalDigest = sha256(canonicalBytes);
const document = JSON.parse(canonicalBytes.toString("utf8"));
const roster = document.permits.map((permit) => ({ actorId: permit.actorId, outcomeClasses: permit.outcomeClasses }));

/* 2. place -------------------------------------------------------------- */
log(`[2/5] placing copy at ${host}:${vmCopyPath} (0600)`);
await place(canonicalBytes);
const statLine = (await ssh(`stat -c "%a %U:%G %s" ${shq(vmCopyPath)}`)).stdout.trim();
if (!statLine.startsWith("600 ")) throw new Error(`VM copy permissions are not 0600: ${statLine}`);

/* 3. verify ------------------------------------------------------------- */
log(`[3/5] full-value digest comparison, both sides`);
const placedDigest = await remoteCopySha();
if (placedDigest !== canonicalDigest) {
  throw new Error(`VM copy digest ${placedDigest} does not match canonical ${canonicalDigest}`);
}

/* 4. red drill on the comparison ---------------------------------------- */
log(`[4/5] red drill: one flipped VM byte must fail the comparison`);
await ssh(`printf '\\000' | dd of=${shq(vmCopyPath)} bs=1 count=1 conv=notrunc status=none`);
const flippedDigest = await remoteCopySha();
const wentRed = flippedDigest !== canonicalDigest;
await place(canonicalBytes);
const restoredDigest = await remoteCopySha();
if (!wentRed) throw new Error("flipping a VM byte did not change the comparison; the predicate is not real");
if (restoredDigest !== canonicalDigest) throw new Error("could not restore the VM copy to the canonical bytes");

/* 5. owner-gate drill ---------------------------------------------------- */
let drill = { executed: false, reason: "run with --drill to exercise the authority on the VM engine" };
if (drillRequested) {
  log(`[5/5] owner-gate drill on a scratch governed workspace`);
  const scratchRoot = `/srv/tcrn/scratch-s121-${Date.now()}`;
  const workspace = `${scratchRoot}/workspace`;
  try {
    await ssh(`mkdir -p ${[workspace, `${scratchRoot}/transient`, `${scratchRoot}/evidence-locator`, `${scratchRoot}/release-trust`].map(shq).join(" ")}`);
    const base = ["--workspace", workspace, "--at", instant()];
    const headed = [...base, "--expected-version", "head"];

    const init = await engine("init", [...base,
      "--framework", enginePath, "--transient", `${scratchRoot}/transient`,
      "--evidence-locator", `${scratchRoot}/evidence-locator`, "--release-trust", `${scratchRoot}/release-trust`,
      "--external-key", "SCRATCH-S121-GATE-DRILL"]);
    if (!init.accepted) throw new Error(`scratch init refused: ${JSON.stringify(init.json)}`);

    const project = await engine("project-create", [...headed,
      "--external-key", "SCRATCH-S121-PROJ", "--name", "S121 authority drill", "--actor", "owner:governance"]);
    if (!project.accepted) throw new Error(`project-create refused: ${JSON.stringify(project.json)}`);
    const projectId = project.json.record.id;

    const gate = await engine("gate-create", [...headed,
      "--external-key", "SCRATCH-S121-GATE", "--project-id", projectId, "--work-id", "-",
      "--title", "S121 owner intent drill gate", "--outcome-class", "owner_intent_required",
      "--actor", "owner:governance"]);
    if (!gate.accepted) throw new Error(`gate-create refused: ${JSON.stringify(gate.json)}`);
    const gateId = gate.json.recordId;

    const transition = (status, actor, digest) => engine("gate-transition", [...headed,
      "--id", gateId, "--status", status, "--actor", actor,
      "--identity-authority", vmCopyPath, "--identity-authority-digest", digest]);

    // RED 1 — right file, wrong digest: refused before anything else happens.
    const wrongDigest = await transition("satisfied", "owner:governance", "0".repeat(64));
    if (wrongDigest.accepted || wrongDigest.json.reasonCode !== "GATE_IDENTITY_AUTHORITY_DIGEST") {
      throw new Error(`wrong digest was not refused as GATE_IDENTITY_AUTHORITY_DIGEST: ${JSON.stringify(wrongDigest.json)}`);
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
    // authority resolved on the VM, the digest matched, the engine ruled.
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
      scratch: "<vm-scratch> (created for this run, removed below, absence verified)",
      workspaceId: init.json.workspaceId,
      gate: { id: gateId, outcomeClass: "owner_intent_required" },
      rulings: {
        wrongDigest: { status: "satisfied", actor: "owner:governance", digest: "64x0",
          reasonCode: wrongDigest.json.reasonCode, verdict: "red — refused before the identity layer" },
        unpermittedActor: { status: "satisfied", actor: "agent:fable", digest: "canonical",
          reasonCode: wrongActor.json.reasonCode, error: wrongActor.json.error,
          verdict: "red — the engine consulted the placed roster and refused by name" },
        permittedSatisfied: { status: "satisfied", actor: "owner:governance", digest: "canonical",
          reasonCode: satisfied.json.reasonCode,
          verdict: "identity layer passed; the engine's separate evidence-anchoring rule spoke next" },
        permittedBlocked: { status: "blocked", actor: "owner:governance", digest: "canonical",
          reasonCode: blocked.json.reasonCode, chainVersion: blocked.json.version,
          verdict: "green — completed write, ruled per the placed authority copy" },
      },
    };
  } finally {
    await ssh(`rm -rf ${shq(scratchRoot)}`);
    const gone = (await ssh(`test ! -e ${shq(scratchRoot)}`, { allowFailure: true })).code === 0;
    if (!gone) throw new Error(`scratch ${scratchRoot} survived cleanup`);
    // Bracket the first character so the pgrep's own remote command line does
    // not match the pattern it is searching for.
    const selfSafePattern = `[/]${scratchRoot.slice(1)}`;
    const engineProcs = await ssh(`pgrep -f ${shq(selfSafePattern)} | wc -l`, { allowFailure: true });
    drill.reclaim = { scratchRemoved: gone, scratchProcessesLeft: Number(engineProcs.stdout.trim() || 0) };
  }
} else {
  log(`[5/5] owner-gate drill skipped (no --drill)`);
}

/* receipt ---------------------------------------------------------------- */
const receipt = {
  schemaVersion: "aos.gate-authority-placement.v1",
  ruling: "TCRN-AOS-MIN-007 D10",
  ok: true,
  startedAt,
  finishedAt: instant(),
  canonicalSource: {
    locator: canonicalLocator,
    heldBy: "ceremony terminal (Owner's machine); read-only for this recipe",
    sha256: canonicalDigest,
    bytes: canonicalBytes.length,
    schemaVersion: document.schemaVersion,
    roster,
  },
  placement: {
    destinationHost: host,
    path: vmCopyPath,
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
    predicate: "sha256(VM copy) === sha256(canonical source)",
    flip: "first byte of the VM copy overwritten in place",
    flippedDigest,
    wentRed,
    restoredGreen: restoredDigest === canonicalDigest,
  },
  drill,
};

let text = `${JSON.stringify(receipt, null, 2)}\n`;
text = text.split(platformRoot).join("<platform-root>");
text = text.split(homedir()).join("<operator-home>");
if (text.includes("/Users/")) throw new Error("a machine-local absolute path survived scrubbing; refusing to write");
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, text);
log("receipt written to evidence/aos-gate-authority-placement.json");
