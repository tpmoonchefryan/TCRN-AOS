#!/usr/bin/env node
// INIT-020 STORY-193 proof runner.
//
// The proof delegates all hook generation, installation, validation, simulation,
// activation assessment, and activation recording to the tcrn-workflow engine's
// adapter verbs. It does not create or edit a project hooks.json itself. The
// underlying test uses a temporary evidence root and fires the generated handler
// once in a bounded subprocess; that is explicitly hermetic evidence, not a claim
// about the currently running Codex Desktop process.

import { spawnSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const aosRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workflowRoot = resolve(aosRoot, "..").replace(/\\/gu, "/");
const testPath = join(workflowRoot, "tcrn-workflow", "tests", "qa4-codex-hook-equivalence.test.mjs");
const result = spawnSync(process.execPath, ["--test", testPath], {
  cwd: join(workflowRoot, "tcrn-workflow"),
  encoding: "utf8",
  env: { ...process.env },
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const passed = result.status === 0 && /tests 1[\s\S]*pass 1/iu.test(output);
const report = {
  schemaVersion: "tcrn.init-020.story-193-codex-hook-proof.v1",
  story: "STORY-193",
  ok: passed,
  actor: "agent:gpt-5-codex",
  executionShape: "single-context",
  host: "Codex",
  engineVerbs: [
    "adapter-generate",
    "adapter-install",
    "adapter-validate",
    "adapter-simulate",
    "adapter-activation-assess",
    "adapter-activation-record",
  ],
  command: `node --test ${testPath}`,
  test: {
    status: result.status,
    signal: result.signal,
    outputTail: output.slice(-4000),
  },
  activeEvidence: {
    class: "hermetic-generated-handler-subprocess",
    event: "SessionStart",
    fireObserved: passed,
    evidenceSource: "actual generated handler stdout, digest-bound observation file",
    brandedCodexHostActive: false,
    hostApprovalClaimed: false,
    note: "The adapter activation receipt is recorded through the engine's authority-bearing verb, but this proof does not claim that the user's running Codex Desktop process loaded or fired the definition.",
  },
  userConfig: {
    path: "~/.codex/config.toml",
    staleHooksStateEntries: 6,
    diff: "docs/reports/init-020/STORY-193-codex-config-hooks-state.diff",
    applied: false,
  },
  sshWriteObserver: {
    claudeCoverage: "PreToolUse/Bash command observer",
    codexCoverage: "not connected to App Server execution notifications",
    disposition: "explicit-uncovered-residual",
    defaultSafeClaim: false,
    note: "Codex execution collection remains read-only and drives no host; SSH write safety is not inferred from an execution observation.",
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = passed ? 0 : 1;
