import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  emitsOutput, moduleGraph, outputReads, REPO_ROOT, unbuiltOutputReads, verifyChain,
} from "./verify-self-sufficiency.mjs";

const scripts = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).scripts;

test("verify never reads dist/ before something has written it", () => {
  const { chain, firstEmitIndex, violations } = unbuiltOutputReads(scripts);
  // The chain must actually have been parsed, or an empty result would read as
  // a pass. Every link must also be a named script: a literal command in the
  // chain is one this gate can see but not resolve, and silently skipping it
  // would leave a hole exactly where somebody bypassed pnpm.
  assert.ok(chain.length > 10, `the verify chain must be parsed (saw ${chain.length} steps)`);
  assert.deepEqual(chain.filter((step) => step.kind !== "script"), [],
    "every verify step must be a `pnpm <script>` link so this gate can resolve its body");
  assert.notEqual(firstEmitIndex, -1, "verify must contain a step that emits into dist/");

  assert.deepEqual(
    violations.map((entry) => `${entry.step} (position ${entry.position}) reads dist/ via ${entry.file} — ${entry.reason}`),
    [],
    "a verify step before the first build reads dist/, so verify cannot run on a fresh checkout"
  );
});

test("the gate fires on the real ordering defect it was written for", () => {
  // Not a fixture: this is the repository's own verify chain with the two steps
  // put back in the order they were in when the closing clean-checkout run
  // failed. If this comes back green the gate is decorative.
  const chainParts = scripts.verify.split(" && ").map((part) => part.trim());
  const buildAt = chainParts.indexOf("pnpm build");
  const validateAt = chainParts.indexOf("pnpm validate:migrations");
  assert.ok(buildAt !== -1 && validateAt !== -1, "both steps must still be in the chain");
  assert.ok(buildAt < validateAt, "the fixed order is build before validate:migrations");

  const regressed = [...chainParts];
  regressed.splice(validateAt, 1);
  regressed.splice(buildAt, 0, "pnpm validate:migrations");
  const { violations } = unbuiltOutputReads({ ...scripts, verify: regressed.join(" && ") });

  assert.ok(violations.length > 0, "the regressed ordering must be reported");
  assert.ok(violations.some((entry) => entry.step === "validate:migrations"),
    `validate:migrations must be named; got ${JSON.stringify(violations.map((entry) => entry.step))}`);
  assert.ok(violations.some((entry) => entry.file.endsWith("validate-migrations.mjs")),
    `the reading file must be named; got ${JSON.stringify(violations.map((entry) => entry.file))}`);
});

test("emitsOutput separates building from typechecking", () => {
  assert.equal(emitsOutput(scripts.build), true, "build emits");
  assert.equal(emitsOutput(scripts.typecheck), false, "typecheck does not emit");
  // The distinction is the --noEmit flag and nothing else, so it is asserted
  // directly rather than inferred from the two script names above.
  assert.equal(emitsOutput("tsc -p tsconfig.json"), true);
  assert.equal(emitsOutput("tsc -p tsconfig.json --noEmit"), false);
  assert.equal(emitsOutput("node scripts/whatever.mjs"), false);
});

test("the module graph follows relative imports and stops at bare ones", () => {
  const graph = moduleGraph("scripts/validate-migrations.mjs");
  assert.ok(graph.has("scripts/validate-migrations.mjs"), "the entry itself is in the graph");
  assert.deepEqual([...graph].filter((path) => path.startsWith("..")), [],
    "nothing outside the repository may enter the graph");
  assert.deepEqual([...graph].filter((path) => path.includes("node_modules")), [],
    "bare specifiers are not followed");
});

test("outputReads reports the reading line, not merely that a read happened", () => {
  const hits = outputReads("node scripts/validate-migrations.mjs");
  assert.ok(hits.length > 0, "validate-migrations.mjs reads dist/");
  assert.ok(hits.every((hit) => /line \d+: /u.test(hit.reason) || hit.file === "<script body>"),
    `each hit must carry a line; got ${JSON.stringify(hits)}`);
  // And a body with no output read must come back empty, or "reports a read"
  // would be true of everything.
  assert.deepEqual(outputReads("node --test packages/nothing/test/none.mjs"), []);
});

test("verifyChain surfaces a non-pnpm link instead of dropping it", () => {
  const parsed = verifyChain("pnpm a && FOO=1 node x.mjs && pnpm b");
  assert.deepEqual(parsed.map((step) => step.kind), ["script", "literal", "script"]);
  assert.equal(parsed[1].text, "FOO=1 node x.mjs");
});
