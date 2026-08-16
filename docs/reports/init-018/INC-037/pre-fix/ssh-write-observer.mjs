#!/usr/bin/env node
// S2 (TCRN-CROSS-STORY-144) — SSH-write heuristic observer (observe mode).
//
// PreToolUse hook matcher: flags Bash commands that would write to the governed
// chain tree on tcrn-platform-dev over SSH (redirection/tee/sed -i/cp/mv/rm via
// ssh, or rsync/scp toward the host, naming /srv/tcrn/governance). OBSERVE MODE
// ONLY: it appends hits to a log file and never blocks. Switching to enforce is
// the review layer's call (MIN-058) once this observer has run without false
// positives — the whole point of the observe period.
//
// Modes:
//   (no args)                    PreToolUse hook: read {tool_name, tool_input}
//                                 JSON on stdin, log any HIT, always exit 0.
//   --classify <command>          print {"verdict","reason"} JSON, exit 0.
//   --self-test                   run the adversarial corpus, print summary,
//                                 exit 0 only if every sample classifies as
//                                 its expected verdict.
//
// Classification is deliberately command-level and conservative: a command is a
// HIT when it both (a) carries a remote-write form toward tcrn-platform-dev and
// (b) names /srv/tcrn/governance, unless an exemption matches. Read-only and
// non-governance commands are PASS. The log path is S2_OBSERVE_LOG (default the
// S2 evidence dir), so the review layer can audit false positives before enforce.
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LOG = resolve(REPO_ROOT, "docs/reports/init-018/S2/observed-hits.log");

const HOST = /tcrn-platform-dev/;
const GOVERNANCE = /\/srv\/tcrn\/governance/;
const EXEMPTIONS = [
  /ceremony\.mjs/,          // governed chain write via the ceremony channel
  /paired-backup\.mjs/,     // paired backup (pull is the sanctioned direction)
  /engine-host:verify/,     // read-only engine-copy verification
  /aos-read.*verify|verify.*aos-read/, // read-face verification
  /ship-web\.mjs/,          // STORY-138 whitelisted web ship (web root, not governance)
];

// Write primitives that could touch a remote file under an ssh command. Bare
// words carry a leading \b so "platform" can never match "rm\b" — only a
// genuine standalone command token does.
const SSH_WRITE_PRIMITIVE =
  /(>>|>|tee\b|sed\s+-i\b|cat\s+>|\bcp\b|\bmv\b|\bdd\b|\binstall\b|\btouch\b|\brm\b)/u;

export function classify(command) {
  const cmd = command ?? "";
  if (cmd.trim() === "") return { verdict: "PASS", reason: "empty" };
  if (EXEMPTIONS.some((re) => re.test(cmd))) return { verdict: "PASS", reason: "exemption" };
  if (!GOVERNANCE.test(cmd)) return { verdict: "PASS", reason: "no-governance-path" };

  const hasSshWrite =
    HOST.test(cmd) && /(^|[;&|]\s*|&&\s*)\bssh\b/u.test(cmd) && SSH_WRITE_PRIMITIVE.test(cmd);
  const hasRsync = HOST.test(cmd) && /\brsync\b/u.test(cmd);
  const hasScp = HOST.test(cmd) && /\bscp\b/u.test(cmd);

  if (hasSshWrite || hasRsync || hasScp) {
    return { verdict: "HIT", reason: hasSshWrite ? "ssh-write" : hasRsync ? "rsync" : "scp" };
  }
  return { verdict: "PASS", reason: "no-write-primitive" };
}

const CORPUS = [
  // --- 10 HIT: dangerous SSH writes to the governed tree ---
  { command: `ssh tcrn-platform-dev "cat > /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/index.json"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "echo x > /srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace/ledger.json"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "printf 'x' >> /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/events.jsonl"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "tee /srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace/status.json <<< '{}'"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "sed -i 's/a/b/' /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/index.json"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "cp /tmp/f /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/file"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "mv /tmp/f /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/file"`, expect: "HIT" },
  { command: `ssh tcrn-platform-dev "rm /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/index.json"`, expect: "HIT" },
  { command: `rsync -av ./local tcrn-platform-dev:/srv/tcrn/governance/tcrn-workspace/cross-project/workspace/`, expect: "HIT" },
  { command: `scp ./f tcrn-platform-dev:/srv/tcrn/governance/tcrn-workspace/cross-project/workspace/f`, expect: "HIT" },
  // --- 11 PASS: exemptions + read-only + non-governance + non-ssh ---
  { command: `node deploy/aos-local-client/ceremony.mjs --payload x.json --partition cross-project --dry-run`, expect: "PASS" },
  { command: `node deploy/aos-local-client/ceremony.mjs --payload x.json --partition cross-project --receipt r.json`, expect: "PASS" },
  { command: `node deploy/aos-resident-cockpit/paired-backup.mjs --pull --workspace cross-project`, expect: "PASS" },
  { command: `pnpm --dir TCRN-AOS engine-host:verify`, expect: "PASS" },
  { command: `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace"`, expect: "PASS" },
  { command: `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs work-show --id work:x --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace"`, expect: "PASS" },
  { command: `ssh tcrn-platform-dev "ls /srv/tcrn/governance/"`, expect: "PASS" },
  { command: `ssh tcrn-platform-dev "systemctl status tcrn-aos-cockpit"`, expect: "PASS" },
  { command: `node scripts/ship-web.mjs --dry-run`, expect: "PASS" },
  { command: `curl -s http://192.168.51.249:4319/api/health`, expect: "PASS" },
  { command: `git push origin main`, expect: "PASS" },
];

export function runSelfTest() {
  const mismatches = [];
  for (const sample of CORPUS) {
    const result = classify(sample.command);
    if (result.verdict !== sample.expect) {
      mismatches.push({ command: sample.command, expected: sample.expect, got: result.verdict, reason: result.reason });
    }
  }
  return {
    total: CORPUS.length,
    hits: CORPUS.filter((s) => s.expect === "HIT").length,
    passes: CORPUS.filter((s) => s.expect === "PASS").length,
    mismatches,
    ok: mismatches.length === 0,
  };
}

function logHit(entry) {
  const path = process.env.S2_OBSERVE_LOG ?? DEFAULT_LOG;
  try {
    appendFileSync(path, `${JSON.stringify(entry)}\n`);
  } catch {
    // observe mode: a failed log write must never block the session
  }
}

function hookMode(stdin) {
  let input;
  try {
    input = JSON.parse(stdin);
  } catch {
    return;
  }
  if (input?.tool_name !== "Bash") return;
  const command = input?.tool_input?.command;
  if (!command) return;
  const result = classify(command);
  if (result.verdict === "HIT") {
    logHit({ at: new Date().toISOString(), tool: "Bash", reason: result.reason, command });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--self-test") {
    const report = runSelfTest();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.ok ? 0 : 1);
  } else if (mode === "--classify") {
    const command = process.argv[3] ?? "";
    const result = classify(command);
    process.stdout.write(`${JSON.stringify({ command, ...result })}\n`);
    process.exit(0);
  } else {
    let stdin = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { stdin += chunk; });
    process.stdin.on("end", () => { hookMode(stdin); process.exit(0); });
  }
}
