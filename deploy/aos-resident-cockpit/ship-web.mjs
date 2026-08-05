#!/usr/bin/env node
// R2 — ship the locally built cockpit web to the VM web root, proven by ledger
// (TCRN-CROSS-STORY-138, the ruled follow-up to the INC-051 "refresh shipped
// nothing a browser loads" defect).
//
// The 4-hourly refresh originally ran cockpit:data + apply-read-face, which moved
// runner and unit but NO bytes a browser loads — every step exited 0 and the page
// stayed stale. The ruling's fix ran the full apply.mjs, and its own comment names
// the lighter follow-up this file is: ship the web, nothing else.
//
// WHAT "THE WEB" IS. The read face and the resident cockpit both serve
// /srv/tcrn/aos-cockpit/runtime/web, and that root is NOT the `pnpm build` output
// by itself: build.ts writes the /cockpit PRODUCT shell into apps/web/dist, while
// the served cockpit root is the operations shell rendered for path "/" plus one
// SSR shell per MODULE_VIEWS route (apply.mjs step 4, and the reason the two
// index.html files differ by 290 KB). So this ships the ASSEMBLED web root built
// from the already-compiled renderer and the already-bundled client, mirroring
// apply.mjs's web step without its chain projection, authority, unit or service
// management.
//
// Precondition: the local build is present and fresh — apps/web/dist exists and
// its bundle carries a generation stamp. That is the guard against shipping a
// tree the build did not produce.
//
// Reconciliation: after rsync, both sides compute their OWN per-file sha256
// ledger — the VM by its own node, this machine by its own — and they are compared
// FULL-VALUE IN BOTH DIRECTIONS (missing on VM, extra on VM, mismatched), the S118
// shape apply.mjs's runtime-transfer-reconciled step uses. Equality is the only
// green.
//
// --dry-run: every step is local — precondition, assembly, local ledger — and the
// report says what WOULD be synced. Nothing touches the network.
//
// Every host name and remote path comes from manifest.mjs (VM_HOST, VM_WEB,
// MODULE_VIEWS); a hand-typed address here is a defect by construction.
//
// Usage:
//   node deploy/aos-resident-cockpit/ship-web.mjs [--dry-run]

import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VM_HOST, VM_WEB, MODULE_VIEWS } from "./manifest.mjs";
import { compareLedgers, instant, localLedger, remoteLedger, rsyncToVm } from "./resident-lib.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The default local web build; a test passes its own. */
export function defaultLocalWebRoot() {
  return join(REPO_ROOT, "apps/web/dist");
}

/**
 * The generation stamp, as carried in the served bundle.
 *
 * Same shape the freshness gate scans (read-face-freshness.mjs) — tolerant of
 * either quote style and an unquoted key. Found here means the build produced
 * a bundle whose age the freshness gate can judge.
 */
const STAMP_PATTERN = /["']?\bgeneratedAt["']?\s*:\s*["'](\d{4}-\d{2}-\d{2}T[^"']{1,40})["']/u;

export function checkPrecondition(localWebRoot) {
  const problems = [];
  const indexHtml = join(localWebRoot, "index.html");
  const bundle = join(localWebRoot, "assets/aos-client.js");
  const brand = join(localWebRoot, "assets/tcrn-brand-mark.svg");
  if (!existsSync(indexHtml)) problems.push(`local web build is absent: no index.html at ${indexHtml}`);
  if (!existsSync(bundle)) problems.push(`local web build is absent: no bundle at ${bundle}`);
  else if (!existsSync(brand)) problems.push(`local web build is absent: no brand mark at ${brand}`);
  let bundleStamp = null;
  if (existsSync(bundle)) {
    const stamp = readFileSync(bundle, "utf8").match(STAMP_PATTERN)?.[1] ?? null;
    if (stamp === null) problems.push(`the local bundle at ${bundle} carries no generation stamp; the build did not produce a fresh snapshot`);
    else bundleStamp = stamp;
  }
  return { ok: problems.length === 0, problems, bundleStamp };
}

/**
 * Assemble the served web root from the already-built artifacts (apply.mjs step 4's
 * shape, without the esbuild re-bundle — build.ts already emitted the client).
 */
export async function assembleWebRoot(localWebRoot, outDir) {
  const { renderAosShellHtml } = await import(pathToFileURL(
    join(REPO_ROOT, "dist/apps/web/src/app.js")).href);
  mkdirSync(join(outDir, "assets"), { recursive: true });
  writeFileSync(join(outDir, "index.html"), renderAosShellHtml({ path: "/" }));
  for (const [route] of MODULE_VIEWS) {
    mkdirSync(join(outDir, route.slice(1)), { recursive: true });
    writeFileSync(join(outDir, route.slice(1), "index.html"), renderAosShellHtml({ path: route }));
  }
  cpSync(join(localWebRoot, "assets/aos-client.js"), join(outDir, "assets/aos-client.js"));
  cpSync(join(localWebRoot, "assets/tcrn-brand-mark.svg"), join(outDir, "assets/tcrn-brand-mark.svg"));
}

/**
 * The whole ship, dependency-injected so the tests exercise the real assembly,
 * the real local ledger and the real comparator against a fake far side.
 *
 * Defaults are the real far side (VM via ssh). `remoteLedgerFn` and `rsyncFn`
 * take the same signatures as resident-lib's `remoteLedger` and `rsyncToVm`.
 */
export async function shipWeb({
  dryRun = false,
  localWebRoot = defaultLocalWebRoot(),
  remoteWebRoot = VM_WEB,
  remoteLedgerFn = remoteLedger,
  rsyncFn = rsyncToVm
} = {}) {
  const startedAt = instant();
  const source = {
    host: VM_HOST,
    remoteWebRoot,
    localWebRoot,
    addressesFrom: "deploy/aos-resident-cockpit/manifest.mjs (VM_HOST, VM_WEB, MODULE_VIEWS)",
    assembledFrom: [
      "renderAosShellHtml({ path: '/' }) + one SSR shell per MODULE_VIEWS route",
      "apps/web/dist/assets/aos-client.js (the built client bundle)",
      "apps/web/dist/assets/tcrn-brand-mark.svg"
    ]
  };
  const precondition = checkPrecondition(localWebRoot);
  if (!precondition.ok) {
    return { schemaVersion: "aos.ship-web.v1", story: "TCRN-CROSS-STORY-138", ok: false,
      reasonCode: "PRECONDITION_FAILED", dryRun, startedAt, source, precondition };
  }

  const staging = mkdtempSync(join(tmpdir(), "aos-ship-web-"));
  // mkdtempSync creates 0700, and rsyncToVm's `--archive` carries `--perms`, so an
  // un-fixed staging root would propagate its 0700 onto the remote web root — which
  // is exactly how the first real run locked the read face out: its process runs as
  // an unprivileged user (aosread) and could no longer traverse drwx------ (the
  // freshness gate then answered HTTP 404 on every path). The web root must stay
  // world-traversable, matching what apply.mjs's own staging produces.
  chmodSync(staging, 0o755);
  // The mode is reported so the fix has a regression anchor: a staging root that is
  // not world-traversable would re-propagate 0700 onto the remote web root and lock
  // the read face's unprivileged user out (the 404 incident this chmod fixes).
  const stagingRootMode = (statSync(staging).mode & 0o777).toString(8);
  try {
    await assembleWebRoot(localWebRoot, staging);
    const local = localLedger(staging);
    if (dryRun) {
      return {
        schemaVersion: "aos.ship-web.v1", story: "TCRN-CROSS-STORY-138",
        ok: true, reasonCode: "DRY_RUN_NO_NETWORK", dryRun: true,
        startedAt, finishedAt: instant(), source, precondition,
        stagingRootMode,
        wouldSync: { files: local.length, bytes: local.reduce((sum, f) => sum + f.bytes, 0), to: remoteWebRoot },
        localLedger: local
      };
    }
    await rsyncFn(staging, remoteWebRoot);
    const remote = await remoteLedgerFn(remoteWebRoot);
    const comparison = compareLedgers(local, remote);
    return {
      schemaVersion: "aos.ship-web.v1", story: "TCRN-CROSS-STORY-138",
      ok: comparison.ok,
      reasonCode: comparison.ok ? "TRANSFER_LEDGERS_EQUAL" : "TRANSFER_LEDGERS_DIVERGENT",
      dryRun, startedAt, finishedAt: instant(), source, precondition, stagingRootMode,
      comparison: {
        compared: comparison.compared,
        missingOnVm: comparison.missingOnVm,
        extraOnVm: comparison.extraOnVm,
        mismatched: comparison.mismatched,
        fileSetDigest: comparison.fileSetDigest,
        bothSidesComputedTheirOwn: "each side computed its ledger with its own node, over its own tree; full-value, both directions",
        ok: comparison.ok
      },
      localLedger: local,
      remoteLedger: remote
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dryRun = process.argv.includes("--dry-run");
  const result = await shipWeb({ dryRun });
  process.stdout.write(`${JSON.stringify(scrubHostPaths(result), null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
