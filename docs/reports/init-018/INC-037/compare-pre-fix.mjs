// INC-037 — run the post-fix corpus against the PRE-FIX observer (byte copy kept in
// pre-fix/, sha256 recorded in commands.md) so the four defects are shown on samples
// rather than asserted in prose. Exits 0 only if the pre-fix code gets samples wrong,
// i.e. only if the defects are real; a clean pre-fix run would mean the corpus proves
// nothing and is itself a failure.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const { CORPUS } = await import(resolve(repoRoot, "scripts/ssh-write-observer.mjs"));
const { classify: classifyPreFix } = await import(resolve(here, "pre-fix/ssh-write-observer.mjs"));

const wrong = [];
for (const sample of CORPUS) {
  const got = classifyPreFix(sample.command);
  if (got.verdict !== sample.expect) {
    wrong.push({
      id: sample.id,
      defect: sample.id.startsWith("B") ? 1 : sample.id.startsWith("C") ? 2 : sample.id.startsWith("D") ? 3 : "other",
      expected: sample.expect,
      preFixVerdict: got.verdict,
      preFixReason: got.reason,
      command: sample.command,
    });
  }
}
const byDirection = {
  missedWrites: wrong.filter((row) => row.expected === "HIT").length,
  falseAlarms: wrong.filter((row) => row.expected === "PASS").length,
};
process.stdout.write(`${JSON.stringify({ corpus: CORPUS.length, wrongOnPreFix: wrong.length, byDirection, rows: wrong }, null, 2)}\n`);
process.exit(wrong.length === 0 ? 1 : 0);
