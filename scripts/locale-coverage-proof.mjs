// Locale coverage proof — TCRN-AOS-STORY-101, the rule half of TCRN-AOS-INC-013.
//
// The Owner's first report was that large parts of the product only spoke Chinese
// and English. Every string named in that report has since been translated, and
// this gate is not about those strings: it is about why a five-locale product
// shipped two-locale copy without anything noticing.
//
// The DS consumption contract declares five locales and states an `i18nDisposition`,
// but a declaration is enforced in the repository that *renders*, and on this side
// there was nothing — a new copy entry with `en` and `zh-CN` alone typecheckd,
// built, passed seventeen gates and reached the Owner. The 558 copy entries in this
// app are all complete today; entry 559 is what this exists for.
//
// Two invariants, and the second is the one with teeth:
//
//   1. Every copy entry carries all five locales. Measured over the source, because
//      a page only renders the strings its route needs — a rendered-page check can
//      never see the entry that is missing from the one screen nobody probed.
//   2. The locale menu is derived from what the copy layer can serve, not from the
//      DS-declared list. Offering a language the copy cannot answer is a control
//      that claims a capability the bytes do not have, and it fails in the worst
//      direction: silently, in the reader's own language, on a page that looks fine.
//
// Scope, in the house phrase: a gate only protects the bytes it reads. This reads
// every `.ts`/`.tsx` under `apps/web/src` except declarations and generated data.
// Generated data is excluded deliberately and it is not a hole — those strings are
// chain records (a work item's scope note, a minutes body) written by whoever wrote
// them. Tenant content is not product vocabulary, and demanding five locales of a
// governance record would be demanding that the gate translate the chain.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { tcrnSupportedLocales } from "@tcrn/ui-copy-state";
import { localeCopy } from "../dist/apps/web/src/data.js";

const viewSourceDir = new URL("../apps/web/src/", import.meta.url);
const sourceFiles = readdirSync(viewSourceDir)
  .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !name.endsWith(".generated.ts"))
  .sort();

const findings = [];
const checks = [];

function record(id, ok, detail) {
  checks.push({ id, ok, detail });
  if (!ok) findings.push({ id, detail });
}

// ── 1. every copy entry carries all five locales ──────────────────────────────
//
// A copy entry is an object literal with an `en:` string in it — the shape the two
// copy helpers (`pick` and `format`) consume. Matching the shape rather than a
// naming convention is deliberate: a table called `governanceCopy` and one called
// `roomCopy` and an inline literal passed straight to `pick` are the same risk, and
// a convention-based probe would only find the ones that followed the convention.
const entryPattern = /\{[^{}]*\ben:\s*"(?:[^"\\]|\\.)*"[^{}]*\}/g;
let entriesSeen = 0;
const incompleteEntries = [];

for (const name of sourceFiles) {
  const source = readFileSync(new URL(name, viewSourceDir), "utf8");
  for (const literal of source.match(entryPattern) ?? []) {
    entriesSeen += 1;
    // `zh-CN` is only valid quoted; the other four appear bare. Both forms are
    // accepted for all five rather than assuming which each entry used.
    const present = tcrnSupportedLocales.filter((locale) =>
      new RegExp(`(?:"${locale}"|(?<![A-Za-z-])${locale.replace("-", "\\-")})\\s*:`).test(literal));
    if (present.length < tcrnSupportedLocales.length) {
      const absent = tcrnSupportedLocales.filter((locale) => !present.includes(locale));
      incompleteEntries.push({
        file: name,
        absent: absent.join(" "),
        excerpt: literal.replace(/\s+/g, " ").slice(0, 100)
      });
    }
  }
}

record(
  "copy-entries-carry-every-locale",
  entriesSeen > 0 && incompleteEntries.length === 0,
  entriesSeen === 0
    ? "found no copy entries in the view source — this probe has gone stale"
    : `${entriesSeen - incompleteEntries.length}/${entriesSeen} copy entries carry all ` +
      `${tcrnSupportedLocales.length} locales` +
      (incompleteEntries.length
        ? `; missing: ${incompleteEntries.slice(0, 6).map((e) => `${e.file} [${e.absent}] ${e.excerpt}`).join(" | ")}`
        : "")
);

// The shell dictionary is keyed rather than literal, so it is checked by key parity.
const englishKeys = Object.keys(localeCopy.en);
for (const locale of tcrnSupportedLocales) {
  const missing = englishKeys.filter((key) => !(key in (localeCopy[locale] ?? {})));
  record(
    `shell-dictionary-complete:${locale}`,
    missing.length === 0,
    `${englishKeys.length - missing.length}/${englishKeys.length} keys present` +
      (missing.length ? `; missing ${missing.slice(0, 6).join(" ")}` : "")
  );
}

// ── 2. the locale menu is derived from coverage, not from the declared list ────
//
// `tcrnLocaleMetadata` is the DS-declared roster: the five languages the Design
// System says a consumer may offer. It is not a statement about whether *this*
// consumer's copy can answer in them, and passing it straight to the shell is how a
// menu comes to offer a language the product does not speak. The fix is one hop:
// derive the offered set from the copy layer, so dropping a locale's copy removes
// it from the menu instead of leaving a control that silently renders English.
//
// This asserts the shape of that hop in the source. A rendered-page check cannot
// distinguish "derived and happens to equal all five" from "not derived at all",
// because today those produce identical bytes — every locale is fully covered. The
// two only diverge on the day coverage regresses, which is the day this must
// already have been wired.
const shellSource = readFileSync(new URL("app.tsx", viewSourceDir), "utf8");
const menuProp = /locales=\{([^}]+)\}/.exec(shellSource);
record(
  "locale-menu-derived-from-coverage",
  Boolean(menuProp) && /servedLocaleMetadata/.test(menuProp[1]),
  menuProp
    ? `shell locale menu is fed \`${menuProp[1].trim()}\`` +
      (/servedLocaleMetadata/.test(menuProp[1])
        ? " — derived from copy coverage"
        : " — the DS-declared roster, which says nothing about this consumer's coverage")
    : "no `locales={…}` prop found on the shell — this probe has gone stale"
);

// And that the derivation is honest: the served set must be computed from the copy
// layer, not written out as a second hand-maintained list that happens to match.
const derivation = /const servedLocaleMetadata\s*=\s*([\s\S]{0,400}?);\n/.exec(shellSource);
record(
  "served-locales-computed-not-restated",
  Boolean(derivation) && /localeCopy|filter|Object\.keys/.test(derivation[1]),
  derivation
    ? `\`servedLocaleMetadata\` is computed: ${derivation[1].replace(/\s+/g, " ").slice(0, 120)}`
    : "no `servedLocaleMetadata` binding found in app.tsx"
);

const result = {
  ok: findings.length === 0,
  gate: "aos-locale-coverage-proof",
  invariants: [
    "every copy entry carries all five declared locales",
    "the locale menu offers only what the copy layer can serve",
    "the served-locale set is computed from coverage, not restated"
  ],
  sourceFilesRead: sourceFiles.length,
  copyEntriesRead: entriesSeen,
  checksRun: checks.length,
  failed: findings.length,
  findings,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error(
    `\n${findings.length} of ${checks.length} locale invariant(s) fail. ` +
    "A locale offered is a locale promised.");
  process.exit(1);
}
assert.equal(result.failed, 0);
