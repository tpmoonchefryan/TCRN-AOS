// INC-037 red-side helper. Produces a copy of scripts/ssh-write-observer.mjs whose
// corpus is cut back to the original S2 21 samples (the A-block). Running the branch
// proof against that copy reproduces defect 4 on demand: the branches those 21
// samples cannot distinguish report themselves by name instead of passing silently.
//
//   node docs/reports/init-018/INC-037/make-weakened-copy.mjs /tmp/weakened.mjs
//   INC037_SOURCE=/tmp/weakened.mjs node --test scripts/ssh-write-observer.test.mjs
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const source = await readFile(resolve(repoRoot, "scripts/ssh-write-observer.mjs"), "utf8");
const destination = process.argv[2];
if (!destination) {
  process.stderr.write("usage: make-weakened-copy.mjs <destination.mjs>\n");
  process.exit(2);
}

const lines = source.split("\n");
const kept = lines.filter((line) => {
  const match = /^ {2}\{ id: "([A-Z])\d+"/u.exec(line);
  return !match || match[1] === "A";
});
const removed = lines.length - kept.length;
if (removed === 0) {
  process.stderr.write("refusing to write: no corpus entries matched — the shape of CORPUS changed\n");
  process.exit(3);
}
await writeFile(destination, kept.join("\n"));
process.stdout.write(`${JSON.stringify({ destination, corpusEntriesRemoved: removed }, null, 2)}\n`);
