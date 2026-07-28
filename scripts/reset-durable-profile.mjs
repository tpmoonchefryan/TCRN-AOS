import { existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * The explicit opt-in the two stateful proofs refuse to be.
 *
 * `p1:durable-runtime-profile-proof` and `kr01:knowledge-schema-fts-proof` both
 * require a clean durable profile root and fail closed on a dirty one
 * (`p1_clean_start_refuses_nonempty_durable_profile`). That refusal is correct
 * and stays: the profile holds real rows and its own backup directory, and a
 * proof that silently deleted it to go green would be destroying data to pass a
 * test — the exact trade this platform keeps refusing.
 *
 * So the reset is a separate tool, it must be asked for twice (`--yes` on top of
 * running it at all), and it archives rather than deletes: the root is renamed
 * beside itself with a timestamp, so "reset" is always reversible by renaming
 * back. Recorded against TCRN-AOS-INC-010, whose second finding was that the
 * precondition existed but was written nowhere.
 */
const DEFAULT_ROOT = join(
  homedir(),
  "Library",
  "Application Support",
  "TCRN-AOS",
  "conditional-dogfood-start-p1-runtime-profile"
);

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const explicitRoot = args.find((value) => value.startsWith("--root="))?.slice("--root=".length);
const root = resolve(explicitRoot ?? DEFAULT_ROOT);

if (!existsSync(root)) {
  console.log(JSON.stringify({ ok: true, reasonCode: "PROFILE_ROOT_ABSENT", root }));
  process.exit(0);
}

if (!confirmed) {
  console.error(JSON.stringify({
    ok: false,
    reasonCode: "RESET_NOT_CONFIRMED",
    root,
    wouldArchiveTo: `${root}.retired-<timestamp>`,
    hint: "re-run with --yes to archive the profile root aside; nothing is deleted"
  }));
  process.exit(1);
}

const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z");
const target = `${root}.retired-${stamp}`;
renameSync(root, target);
console.log(JSON.stringify({
  ok: true,
  reasonCode: "PROFILE_ROOT_ARCHIVED",
  root,
  archivedTo: target,
  reversal: "rename the archived directory back to restore the profile"
}));
