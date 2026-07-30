// Re-signing the VM's operator authority pins for their new absolute path.
//
// MIN-007 D4 already ruled this, and the rule is a consequence of how the pins
// work rather than a policy on top of them: a pins document binds one authority
// bundle BY PATH, byte digest and minimum generation, and its own `pinsDigest`
// is the canonical hash of exactly those fields. Move the bundle and the path
// field is wrong; correct the path and the digest no longer matches. So a
// placement mints new pins. The bundle itself never changes — its digest covers
// its grant, not its location — which is why the two halves are treated
// differently here.
//
// The byte authority is the governed engine's own canonicalJson and
// canonicalSha256. A serializer of our own would be a second opinion about
// canonical form, and the engine is the only judge of that.
//
// Lifted out of apply.mjs so the unit emitter and the deployment compute the
// digest through the same code. Two computations of a trust value that must
// agree is one computation too many.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { VM_AUTHORITY_BUNDLE } from "./manifest.mjs";

const sha256Text = (text) => createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");

/** The forged VM-scoped minimal bundle and its local pins (S120, generation 1). */
export const VM_BUNDLE_SOURCE = process.env.AOS_VM_BUNDLE_SOURCE
  ?? resolve(homedir(), ".tcrn-workflow/live/tcrn-platform/authority/vm");

export const LOCAL_ENGINE = process.env.TCRN_AOS_ENGINE_ROOT
  ?? resolve(homedir(), ".tcrn-workflow/tcrn-workflow");

/**
 * Stage the bundle unchanged and the pins re-minted for the VM path.
 *
 * `stageDir` receives both files; nothing is placed on any host from here.
 */
export async function resignPinsForVm(stageDir) {
  mkdirSync(stageDir, { recursive: true });
  const protocol = await import(pathToFileURL(
    resolve(LOCAL_ENGINE, "dist/build/packages/protocol/src/index.js")).href);

  const bundleBytes = readFileSync(join(VM_BUNDLE_SOURCE, "operator-authority.json"));
  const bundle = JSON.parse(bundleBytes.toString("utf8"));
  const sourcePins = JSON.parse(
    readFileSync(join(VM_BUNDLE_SOURCE, "operator-authority-pins.json"), "utf8"));
  writeFileSync(join(stageDir, "operator-authority.json"), bundleBytes);

  const basis = {
    schemaVersion: "tcrn.operator-authority-pins.v1",
    authorityId: bundle.authorityId,
    // The one field that changes.
    authorityPath: VM_AUTHORITY_BUNDLE,
    authorityFileSha256: createHash("sha256").update(bundleBytes).digest("hex"),
    minimumGeneration: sourcePins.minimumGeneration,
    revokedAuthorityDigests: sourcePins.revokedAuthorityDigests
  };
  const document = { ...basis, pinsDigest: protocol.canonicalSha256(basis) };
  const pinsBytes = protocol.canonicalJson(document);
  writeFileSync(join(stageDir, "operator-authority-pins.json"), pinsBytes);

  return {
    bundle,
    sourcePins,
    pins: document,
    /** sha256 of the pins FILE — what `--authority-pins-digest` is checked against. */
    pinsFileDigest: sha256Text(pinsBytes.toString("utf8")),
    bundleFileSha256: basis.authorityFileSha256,
    bundleUnchanged: basis.authorityFileSha256 === sourcePins.authorityFileSha256,
    pathBefore: sourcePins.authorityPath,
    pathAfter: basis.authorityPath,
    pinsDigestBefore: sourcePins.pinsDigest,
    pinsDigestAfter: document.pinsDigest,
    byteAuthority: "engine canonicalJson + canonicalSha256 (governed copy)"
  };
}
