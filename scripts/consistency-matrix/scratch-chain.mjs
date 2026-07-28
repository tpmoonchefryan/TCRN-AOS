// Disposable governed scratch chains for the consistency matrix and its red
// suite. Never pointed at a live partition: every build starts from `init` in
// a caller-supplied scratch directory (the session scratchpad, or a VM
// /srv/tcrn/scratch-* directory), and `destroyScratch` removes it and
// verifies the removal.
//
// All writes here go to the scratch chain only, through the governed CLI, so
// the perturbation targets of the red suite are engine-authored bytes — the
// same shape as the real thing, with none of the real thing at risk.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultEngineRoot } from "./run-matrix.mjs";

const ACTOR = "profile:tcrn-minerva-v1";

function cli(engineRoot, args) {
  const stdout = execFileSync(process.execPath,
    [join(engineRoot, "scripts/tcrn-workflow.mjs"), ...args],
    { cwd: engineRoot, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" });
  return JSON.parse(stdout);
}

/**
 * Build one scratch governed workspace with a short but representative chain:
 * a project, an attestation enablement (with attest-dir sidecar), a work item
 * created and moved after the enable point, an annotation, and a knowledge
 * store initialized LAST so the high-water mark equals the head (the lockstep
 * precondition the driver checks before anchoring).
 *
 * Returns { root, workspace, attestDir, engineRoot, head, version, events }.
 */
export function buildScratchChain(scratchRoot, { label = "matrix" } = {}) {
  const engineRoot = defaultEngineRoot();
  const root = resolve(scratchRoot, `scratch-${label}-${process.pid}-${Date.now()}`);
  const workspace = join(root, "workspace");
  const attestDir = join(root, "attest");
  for (const dir of [workspace, join(root, "transient"), join(root, "evidence-locator"), join(root, "release-trust"), attestDir]) {
    mkdirSync(dir, { recursive: true });
  }
  const at = (minute) => `2026-07-28T00:${String(minute).padStart(2, "0")}:00Z`;
  cli(engineRoot, ["init", "--workspace", workspace,
    "--framework", engineRoot,
    "--transient", join(root, "transient"),
    "--evidence-locator", join(root, "evidence-locator"),
    "--release-trust", join(root, "release-trust"),
    "--external-key", "SCRATCH-MATRIX-WORKSPACE", "--at", at(0)]);
  const project = cli(engineRoot, ["project-create", "--workspace", workspace,
    "--expected-version", "0", "--at", at(1),
    "--external-key", "SCRATCH-PROJ-001", "--name", "Consistency matrix scratch"]);
  cli(engineRoot, ["attestation-enable", "--workspace", workspace,
    "--expected-version", "1", "--at", at(2), "--actor", ACTOR, "--attest-dir", attestDir]);
  const work = cli(engineRoot, ["work-create", "--workspace", workspace,
    "--expected-version", "2", "--at", at(3),
    "--project-id", project.record.id, "--external-key", "SCRATCH-INIT-001",
    "--kind", "Initiative", "--actor", ACTOR, "--attest-dir", attestDir]);
  cli(engineRoot, ["work-transition", "--workspace", workspace,
    "--expected-version", "3", "--at", at(4),
    "--id", work.record.id, "--status", "ready", "--actor", ACTOR, "--attest-dir", attestDir]);
  cli(engineRoot, ["work-annotate", "--workspace", workspace,
    "--expected-version", "4", "--at", at(5),
    "--id", work.record.id, "--scope", "consistency matrix scratch fixture",
    "--actor", ACTOR, "--attest-dir", attestDir]);
  cli(engineRoot, ["knowledge-init", "--workspace", workspace, "--acknowledge-disposable", "true"]);
  const status = cli(engineRoot, ["status", "--workspace", workspace]);
  const exported = cli(engineRoot, ["export", "--workspace", workspace]);
  return {
    root, workspace, attestDir, engineRoot,
    actor: ACTOR,
    workId: work.record.id,
    head: status.headEventHash,
    version: status.version,
    events: exported.events
  };
}

/** Remove a scratch root and verify it is actually gone. */
export function destroyScratch(root) {
  rmSync(root, { recursive: true, force: true });
  if (existsSync(root)) {
    throw new Error("scratch cleanup failed: directory still present after removal");
  }
  return { removed: true, verified: true };
}
