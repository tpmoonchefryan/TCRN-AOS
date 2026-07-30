#!/usr/bin/env node
/**
 * The mirror stays retired (TCRN-AOS-STORY-134).
 *
 * `mirror:freshness-proof` used to sit in `pnpm verify` and asked one question:
 * does the committed bundle still equal a rebuild from source. Its subject is
 * gone, so the gate goes with it — but the slot should not simply empty out. The
 * reason is written into this repository's own history: `apps/web/mirror` fell
 * three source commits behind with both its builder and its acceptance gate
 * present in the tree and unreachable from any npm script, and nothing signalled
 * it (TCRN-AOS-INC-030). Removing a thing and removing the only mechanism that
 * would notice it coming back are two different acts, and only the first one was
 * ruled.
 *
 * So this replaces it, and asks the retirement's own questions instead:
 *
 *   1. the bundle is absent — a build output nobody consumes cannot fall behind
 *      if it is not there, and one that is there with no freshness gate is
 *      exactly INC-030's lying copy waiting to happen again;
 *   2. the producers are absent — a builder for a deleted target is a loaded gun
 *      with the safety off, since `pnpm mirror:build` would recreate the bundle
 *      and nothing downstream would object;
 *   3. no npm script reaches for any of them, which is where INC-030's finding
 *      actually landed: presence in the tree told nobody anything, reachability
 *      from a script is the property with teeth;
 *   4. the deployment manifest, which is deliberately KEPT, still says it is
 *      retired. It is the one artefact a future reader will find by searching for
 *      `aos.tcrn.lan`, and a manifest that looks applicable is worse than no
 *      manifest at all — re-applying it republishes a LAN route in front of a
 *      cockpit that CONF-007 D7 confines to loopback.
 *
 * Offline and byte-cheap on purpose: it belongs in `pnpm verify`, which must run
 * without the VM. Whether the CLUSTER still holds the route is a different
 * question with a different authority, and it is asked by
 * `deploy/aos-mirror-retirement/retire.mjs` against the cluster itself.
 *
 * Driven red three ways before being trusted, each recorded in
 * `evidence/aos-mirror-retirement.json`: a file recreated under the bundle path,
 * a `mirror:build` script restored to package.json, and the RETIRED marker
 * removed from the manifest.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const at = (relative) => join(REPO_ROOT, relative);

/** The bundle, and the three scripts that produced or judged it. */
const RETIRED_PATHS = [
  "apps/web/mirror",
  "scripts/build-mirror.mjs",
  "scripts/mirror-freshness-proof.mjs",
  "scripts/mirror-acceptance-proof.mjs"
];

/**
 * Names no npm script may mention.
 *
 * Matched against script BODIES and script NAMES both: a script called
 * `mirror:build` whose body had been repointed somewhere else would still tell a
 * reader the mirror is a thing this repository builds.
 */
const FORBIDDEN_IN_SCRIPTS = [
  "build-mirror", "mirror-freshness-proof", "mirror-acceptance-proof", "apps/web/mirror"
];

const MANIFEST = "deploy/aos-mirror.yaml";
const RETIREMENT_MARKER = "RETIRED — 2026-07-30, TCRN-AOS-STORY-134";

const findings = [];
const checks = [];
const record = (id, ok, detail) => {
  checks.push({ id, ok, detail });
  if (!ok) findings.push({ id, detail });
};

for (const path of RETIRED_PATHS) {
  const present = existsSync(at(path));
  record(`absent:${path}`, !present, present
    ? `${path} exists again; it was retired with the mirror segment and has no consumer — `
      + "recover it from git history if a revival is being ruled, do not leave it standing here"
    : "absent");
}

const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
const offending = Object.entries(pkg.scripts ?? {}).flatMap(([name, body]) =>
  FORBIDDEN_IN_SCRIPTS
    .filter((needle) => name.includes(needle) || String(body).includes(needle))
    .map((needle) => ({ script: name, mentions: needle })));
record("no-npm-script-reaches-the-mirror", offending.length === 0,
  offending.length === 0
    ? `${Object.keys(pkg.scripts ?? {}).length} scripts, none reaching a retired mirror artefact`
    : offending);

/**
 * Nothing new under the retired `mirror:` namespace.
 *
 * Checked by prefix and not only by body, so `mirror:build` cannot come back
 * pointing somewhere else. This gate's own entry point is the one exception, and
 * naming it here is not a loophole being carved — it is the check reporting
 * honestly what it excludes. It caught itself on its first run, which is the
 * cheapest possible way to learn that this predicate has teeth.
 */
const SELF = "mirror:retirement-proof";
const mirrorNamespaced = Object.keys(pkg.scripts ?? {})
  .filter((name) => name.startsWith("mirror:") && name !== SELF);
record("no-mirror-namespaced-scripts",
  mirrorNamespaced.length === 0,
  mirrorNamespaced.length === 0 ? `none besides ${SELF}` : mirrorNamespaced);

const manifestExists = existsSync(at(MANIFEST));
record(`kept:${MANIFEST}`, manifestExists, manifestExists
  ? "kept as the record of a segment that ran"
  : `${MANIFEST} is missing; the retirement ruling keeps it as the record, annotated`);

if (manifestExists) {
  const manifestText = readFileSync(at(MANIFEST), "utf8");
  record("manifest-declares-itself-retired", manifestText.includes(RETIREMENT_MARKER),
    manifestText.includes(RETIREMENT_MARKER)
      ? "the retirement notice is present"
      : `${MANIFEST} no longer carries the retirement notice; it is the artefact a future reader `
        + "finds by searching for aos.tcrn.lan, and applying it republishes a LAN route in front of a "
        + "cockpit CONF-007 D7 confines to loopback");
}

const report = {
  ok: findings.length === 0,
  proof: "aos_mirror_retirement_holds",
  story: "TCRN-AOS-STORY-134",
  replaces: "mirror:freshness-proof, whose subject no longer exists",
  notCovered: "whether the CLUSTER still holds the aos.tcrn.lan route — that authority is the "
    + "cluster, and deploy/aos-mirror-retirement/retire.mjs asks it there",
  checks,
  findings
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);
