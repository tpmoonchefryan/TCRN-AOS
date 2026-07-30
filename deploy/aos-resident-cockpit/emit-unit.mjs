#!/usr/bin/env node
// Write deploy/aos-resident-cockpit/tcrn-aos-cockpit.service from the manifest.
//
// A separate step from apply.mjs on purpose. apply.mjs checks that the unit
// committed in this repository, the unit it renders, and the unit installed on
// the machine are the same bytes — and that check is worth nothing if the thing
// performing it also writes one of the three. A predicate whose two sides are
// produced by the same act in the same run can only ever be green.
//
// So the unit is emitted here, deliberately, and reviewed and committed like any
// other source. apply.mjs then reads it and refuses to deploy when it disagrees.
//
// The only rendered value is the pins file digest, and it comes from the bytes of
// the re-signed pins rather than from a choice — so running this twice on the
// same authority produces the same file.

import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { UNIT_NAME, renderUnit } from "./manifest.mjs";
import { resignPinsForVm } from "./authority.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const target = resolve(HERE, UNIT_NAME);

const staged = await resignPinsForVm(mkdtempSync(join(tmpdir(), "aos-unit-emit-")));
const rendered = renderUnit({ pinsFileDigest: staged.pinsFileDigest });
const before = existsSync(target) ? readFileSync(target, "utf8") : null;
writeFileSync(target, rendered);

console.log(JSON.stringify({
  ok: true,
  unit: `deploy/aos-resident-cockpit/${UNIT_NAME}`,
  changed: before !== rendered,
  createdFresh: before === null,
  pinsFileDigest: staged.pinsFileDigest,
  authorityId: staged.bundle.authorityId,
  writeCommands: staged.bundle.mcp.writeCommands,
  reminder: "review and commit this file; apply.mjs refuses to deploy a unit that differs from it"
}, null, 2));
