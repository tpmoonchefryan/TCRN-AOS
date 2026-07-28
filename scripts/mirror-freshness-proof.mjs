#!/usr/bin/env node
/**
 * The mirror bundle committed to this repository is the one this source builds.
 *
 * apps/web/mirror is a build output kept under version control, and it fell three
 * source commits behind without anything noticing (TCRN-AOS-INC-030). Both halves of
 * the machinery existed — scripts/build-mirror.mjs writes it, scripts/mirror-acceptance-
 * proof.mjs checks a deployed one — and neither was reachable from any npm script, so
 * nothing rebuilt it and nothing compared it. Tagging a release in that state would have
 * shipped a bundle missing every mobile fix the release is about.
 *
 * This is the fourth instance of one shape in this repository: delivered once, then
 * never verified again. The other three were a receipt that failed ten others silently,
 * six proof scripts running red outside `pnpm verify`, and a chain partition that was
 * never snapshotted. None of them produced an error. They produced a plausible-looking
 * artefact and a run nobody made.
 *
 * The comparison is against the COMMITTED tree, not the live chain. build-mirror reads
 * the built copy of apps/web/src/cockpit-data.generated.ts, which is a checked-in
 * snapshot refreshed deliberately by `pnpm cockpit:data`; the mirror build itself reads
 * no clock and no network, so rebuilding it here is deterministic. That separation is
 * what keeps this gate quiet while the governance chains move and loud when the source
 * moves without the bundle.
 *
 * Not covered here, and deliberately: whether the mirror DEPLOYED to the VM matches this
 * one. That question needs the VM, and scripts/mirror-acceptance-proof.mjs is where it is
 * asked. A green result here means the committed bytes are current, not that anything was
 * published.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRACKED = join(repoRoot, "apps", "web", "mirror");

function fileMap(root) {
  const out = new Map();
  if (!existsSync(root)) return out;
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(root, full), createHash("sha256").update(readFileSync(full)).digest("hex"));
    }
  };
  walk(root);
  return out;
}

const findings = [];
const tracked = fileMap(TRACKED);

if (tracked.size === 0) {
  findings.push("apps/web/mirror is absent or empty — either build and commit it, or stop tracking it, but do not leave the repository claiming a bundle it does not have");
}

const scratch = join(tmpdir(), `tcrn-aos-mirror-freshness-${process.pid}`);
let rebuilt = new Map();
let buildError = "";
if (tracked.size > 0) {
  try {
    execFileSync(process.execPath, [join(repoRoot, "scripts", "build-mirror.mjs")], {
      cwd: repoRoot,
      env: { ...process.env, AOS_MIRROR_OUT: scratch },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    rebuilt = fileMap(scratch);
  } catch (error) {
    buildError = String(error?.stderr || error?.message || error).slice(0, 400);
    findings.push(`scripts/build-mirror.mjs could not run, so freshness could not be measured: ${buildError}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (rebuilt.size > 0) {
  const missing = [...rebuilt.keys()].filter((path) => !tracked.has(path));
  const extra = [...tracked.keys()].filter((path) => !rebuilt.has(path));
  const differing = [...rebuilt.keys()].filter((path) => tracked.has(path) && tracked.get(path) !== rebuilt.get(path));

  if (missing.length > 0) findings.push(`a rebuild produces ${missing.length} file(s) the committed mirror does not have: ${missing.slice(0, 6).join(", ")}`);
  if (extra.length > 0) findings.push(`the committed mirror carries ${extra.length} file(s) a rebuild does not produce: ${extra.slice(0, 6).join(", ")}`);
  if (differing.length > 0) findings.push(`${differing.length} committed file(s) differ from a rebuild: ${differing.slice(0, 6).join(", ")}`);
}

const report = {
  ok: findings.length === 0,
  proof: "aos_mirror_freshness",
  trackedRoot: "apps/web/mirror",
  trackedFileCount: tracked.size,
  rebuiltFileCount: rebuilt.size,
  comparedAgainst: "a rebuild from the committed source and the committed cockpit snapshot",
  notCovered: "whether the deployed mirror matches these bytes — see scripts/mirror-acceptance-proof.mjs, which needs the VM",
  findings,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);
