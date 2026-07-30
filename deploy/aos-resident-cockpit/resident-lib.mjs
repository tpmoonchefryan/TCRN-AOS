// Shared plumbing for the resident cockpit deployment (TCRN-AOS-STORY-132).
//
// The transport, ledger and reclaim helpers are IMPORTED from the switch
// rehearsal's library rather than copied. MIN-011 retired the switchover
// direction and kept its instruments in service for their standing use; this is
// that standing use. A copy here would drift from the original the first time
// somebody fixed one of them, and the paid-for lessons those functions carry
// (`ssh -n` or a backgrounded remote command hangs the session; a `pgrep`
// pattern without a bracket class matches the shell running it; killing an
// `ssh -L` client leaves the ControlMaster's forward listening) would have to be
// re-learned on this side of the fence.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export {
  VM_HOST, compareLedgers, fileSetDigest, instant, localLedger, reclaimLocalTunnel,
  remoteLedger, rsyncToVm, sha256, sha256File, sha256Text, shellQuote, ssh, sshNode
} from "../switch-rehearsal/rehearsal-lib.mjs";

const runFile = promisify(execFile);

/**
 * Where this deployment keeps its between-step state.
 *
 * Never inside a repository: nothing in this flow may create a directory in a
 * checkout, and a state file is not evidence.
 */
export const STATE_DIR = process.env.TCRN_AOS_RESIDENT_STATE
  ?? join(tmpdir(), "aos-resident-cockpit-state");

export function saveState(name, value) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(join(STATE_DIR, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}
export function loadState(name) {
  return JSON.parse(readFileSync(join(STATE_DIR, `${name}.json`), "utf8"));
}
export function hasState(name) {
  return existsSync(join(STATE_DIR, `${name}.json`));
}

/** One local command, JSON in and out of it left to the caller. */
export async function run(command, args, options = {}) {
  const { stdout, stderr } = await runFile(command, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  return { stdout, stderr };
}

/**
 * `systemctl`, with the exit code kept rather than thrown away.
 *
 * `is-active` answers "inactive" with exit 3 and `is-enabled` answers "disabled"
 * with exit 1 — both are ANSWERS, not failures, and a wrapper that treated a
 * non-zero exit as an error could never read them.
 */
export async function systemctl(sshFn, args) {
  const result = await sshFn(["systemctl", ...args], { allowFailure: true });
  return { code: result.code, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

const stepLog = (tag, name, verdict) => process.stderr.write(`[${tag}] ${name}: ${verdict}\n`);

/**
 * A recipe's step recorder: appends to the receipt, logs, and stops the run on
 * the first red so a later step can never report against half-applied state.
 */
export function stepper(tag, receipt, onFail) {
  return (name, value) => {
    receipt.steps.push({ name, ...value });
    stepLog(tag, name, value.reasonCode ?? (value.ok ? "ok" : "FAILED"));
    if (value.ok === false) {
      onFail?.(receipt);
      throw new Error(`${tag} step failed: ${name} (${value.reasonCode ?? "no reason code"})`);
    }
    return value;
  };
}
