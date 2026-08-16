#!/bin/sh
# INC-037 — regenerate every artifact under outputs/ from scratch.
# Run from the tcrn-workflow repository root:
#   sh docs/reports/init-018/INC-037/rerun.sh
# Writes nothing outside docs/reports/init-018/INC-037/outputs/ and $TMPDIR.
set -u
EV=docs/reports/init-018/INC-037
OUT="$EV/outputs"
mkdir -p "$OUT"

# Exit codes are collected in outputs/exit-codes.txt rather than appended to the
# .json artifacts: the repository's format gate re-serializes every .json file, so a
# trailing "exit=0" line would turn this evidence directory into a red gate.
EXITS="$OUT/exit-codes.txt"
: > "$EXITS"

echo "== 1. green: corpus self-test =="
node scripts/ssh-write-observer.mjs --self-test > "$OUT/self-test-green.json"
echo "self-test-green.json exit=$? (0 expected)" >> "$EXITS"

echo "== 2. green: branch-coverage proof (one mutation per branch / list entry) =="
node --test scripts/ssh-write-observer.test.mjs > "$OUT/branch-proof-green.txt" 2>&1
echo "branch-proof-green.txt exit=$? (0 expected)" >> "$EXITS"

echo "== 3. RED: the same proof against a copy carrying only the original 21 samples =="
node "$EV/make-weakened-copy.mjs" "${TMPDIR:-/tmp}/inc037-weakened.mjs" > "$OUT/branch-proof-red-weakened-corpus.txt" 2>&1
INC037_SOURCE="${TMPDIR:-/tmp}/inc037-weakened.mjs" node --test scripts/ssh-write-observer.test.mjs \
  >> "$OUT/branch-proof-red-weakened-corpus.txt" 2>&1
echo "branch-proof-red-weakened-corpus.txt exit=$? (NON-ZERO expected: this is the red side)" >> "$EXITS"

echo "== 4. RED: delete one branch by hand, self-test goes red =="
cp scripts/ssh-write-observer.mjs "${TMPDIR:-/tmp}/inc037-single-branch.mjs"
node -e '
const fs = require("node:fs");
const path = process.argv[1];
const find = "      const units = remoteWriteUnits(transport.remote);";
let text = fs.readFileSync(path, "utf8");
if (!text.includes(find)) { console.error("anchor missing — refresh this proof"); process.exit(9); }
fs.writeFileSync(path, text.replace(find, "      const units = remoteWriteUnits(command);"));
console.log("mutation: write-primitive scan reverted to the whole command line (defect 3)");
' "${TMPDIR:-/tmp}/inc037-single-branch.mjs" > "$OUT/red-single-branch-selftest.txt" 2>&1
node "${TMPDIR:-/tmp}/inc037-single-branch.mjs" --self-test >> "$OUT/red-single-branch-selftest.txt" 2>&1
echo "red-single-branch-selftest.txt exit=$? (NON-ZERO expected: this is the red side)" >> "$EXITS"

echo "== 5. the post-fix corpus judged by the PRE-FIX observer =="
node "$EV/compare-pre-fix.mjs" > "$OUT/pre-fix-comparison.json" 2>&1
echo "pre-fix-comparison.json exit=$? (0 means the four defects reproduce on the pre-fix copy)" >> "$EXITS"

echo "== 6. acceptance samples from the ticket =="
{
  echo "--- must HIT: wrapper before ssh + remote tee into the governed tree"
  node scripts/ssh-write-observer.mjs --classify 'env X=1 ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs export --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace | tee /srv/tcrn/governance/x"'
  echo "--- must PASS: read-only ssh, local 2>&1"
  node scripts/ssh-write-observer.mjs --classify 'ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace" 2>&1'
} > "$OUT/acceptance.txt" 2>&1

echo "== 7. hook contract (unchanged stdin shape, always exit 0) =="
HOOKLOG="${TMPDIR:-/tmp}/inc037-hook.log"
rm -f "$HOOKLOG"
{
  for payload in \
    '{"tool_name":"Bash","tool_input":{"command":"env X=1 ssh tcrn-platform-dev \"rm /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/index.json\""}}' \
    '{"tool_name":"Bash","tool_input":{"command":"ssh tcrn-platform-dev \"node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace\" 2>&1"}}' \
    '{"tool_name":"Read","tool_input":{"file_path":"/etc/hosts"}}' \
    'not json at all'
  do
    printf '%s' "$payload" | S2_OBSERVE_LOG="$HOOKLOG" node scripts/ssh-write-observer.mjs
    echo "exit=$? for: $(printf '%s' "$payload" | cut -c1-70)"
  done
  echo "--- log (exactly one line, the HIT):"
  cat "$HOOKLOG"
} > "$OUT/hook-contract.txt" 2>&1

echo "== 8. RED: the entry-point guard this change repaired =="
cp scripts/ssh-write-observer.mjs "${TMPDIR:-/tmp}/inc037-old-entrypoint.mjs"
node -e '
const fs = require("node:fs");
const path = process.argv[1];
let text = fs.readFileSync(path, "utf8");
fs.writeFileSync(path, text.replace("if (isDirectInvocation()) {", "if (process.argv[1] === fileURLToPath(import.meta.url)) {"));
' "${TMPDIR:-/tmp}/inc037-old-entrypoint.mjs"
LINKDIR="${TMPDIR:-/tmp}/inc037-link"
rm -rf "$LINKDIR"; mkdir -p "$LINKDIR"
ln -s "${TMPDIR:-/tmp}/inc037-old-entrypoint.mjs" "$LINKDIR/observer.mjs"
ln -s "$PWD/scripts/ssh-write-observer.mjs" "$LINKDIR/observer-fixed.mjs"
{
  echo "--- pre-fix guard, invoked through a symlink: silent, exit 0, ZERO samples run"
  node "$LINKDIR/observer.mjs" --self-test
  echo "exit=$? (green-looking, but nothing ran)"
  echo "--- repaired guard, same invocation: the corpus actually runs"
  node "$LINKDIR/observer-fixed.mjs" --self-test
  echo "exit=$?"
} > "$OUT/silent-green-entrypoint.txt" 2>&1

echo "== 9. repository gates =="
{
  echo "--- lint"; node scripts/task.mjs lint
  echo "--- format-check (pre-existing failures only; INC-037 files must not appear)"; node scripts/task.mjs format-check
  echo "--- source allowlist (pre-existing INIT-018 failure; scripts/policy is owned elsewhere)"; node scripts/task.mjs source
} > "$OUT/repo-gates.txt" 2>&1

echo "done — artifacts in $OUT"
