// TCRN-AOS-INC-036 — the parity judgement, against literals.
//
// This file may not read the platform's `.mcp.json` or `~/.codex/config.toml`: a
// test that depended on files outside this repository would fail in a fresh clone
// for a reason unrelated to the code, and — worse here — it would let the live
// state decide which branches ever run. So every input is synthesised and both
// filesystem questions arrive as injected probes. The real files are judged by
// `parity-proof.mjs` itself (`pnpm parity:proof`), which carries its own red
// cases. Neither run stands in for the other.
//
// Every case is written so the mutation that should make it fail is visible in
// the case: the world and the expectation differ by exactly one term. INC-036 was
// filed because the previous red proof did not have that property — it mutated
// rows and then ran a copy of the predicate, so nothing it asserted could fail
// for a reason that had anything to do with the gate.

import { strict as assert } from "node:assert";
import test from "node:test";
import {
  ALLOWLIST, ANCHOR_ROSTER, JUDGE_ID, judgeParity, judgeSpec, normalizeCodexSpecs,
  parseCodexConfig, parseTomlStringArray, placeholderIn, redProof
} from "./parity-proof.mjs";

// ── a synthetic world ──────────────────────────────────────────────────────

const REAL_DIR = "/opt/real-dir";
const REAL_FILE = "/opt/real-bin/pnpm";

const probeDir = (path) => path === REAL_DIR;
const probeFile = (path) => path === REAL_FILE;

const spec = (overrides = {}) => ({ command: "node", args: [], ...overrides });
const graphSpec = (path = REAL_DIR) => spec({ command: "pnpm", args: ["--path", path] });

const ANCHORS = Object.freeze([
  { server: "both-sides", sides: ["claude", "codex"], since: "2026-08-05", why: "两侧同持" },
  { server: "claude-only", sides: ["claude"], since: "2026-08-05", why: "只在 Claude 侧" }
]);

const EXEMPT = Object.freeze([
  { server: "claude-only", missingFrom: "codex", since: "2026-08-05", reason: "Codex 侧未接" }
]);

const world = (overrides = {}) => ({
  claudeSpecs: { "both-sides": spec(), "claude-only": spec() },
  codexSpecs: { "both-sides": spec() },
  allowlist: EXEMPT,
  anchors: ANCHORS,
  probeDir,
  probeFile,
  ...overrides
});

const codesOf = (judged) => judged.defectCodes;

// ── the control: this predicate can be green ───────────────────────────────
//
// First test on purpose. A red-only suite proves a gate that is always red, which
// is exactly as useless as one that is always green.

test("a balanced world with a correctly directed exemption is green", () => {
  const judged = judgeParity(world());
  assert.equal(judged.ok, true, JSON.stringify(judged.defects));
  assert.equal(judged.reasonCode, "PARITY_VERIFIED");
  assert.deepEqual(judged.defects, []);
});

test("the roster covers anchors that neither side reported", () => {
  const judged = judgeParity(world({ claudeSpecs: {}, codexSpecs: {} }));
  // Union-derived rosters cannot do this — INC-036 defect 3.
  assert.deepEqual(judged.roster, ["both-sides", "claude-only"]);
});

// ── gaps and directed exemptions (INC-036 defect 2) ────────────────────────

test("an unallowlisted one-sided server is a defect naming the missing side", () => {
  const judged = judgeParity(world({
    claudeSpecs: { "both-sides": spec(), "claude-only": spec(), intruder: spec() }
  }));
  assert.equal(judged.ok, false);
  const defect = judged.defects.find((entry) => entry.server === "intruder");
  assert.equal(defect.code, "UNALLOWLISTED_GAP");
  assert.equal(defect.side, "codex");
});

test("an exemption excuses ONLY the direction it declares", () => {
  // Same server, same allowlist, opposite direction: the one term that differs
  // between this case and the green control is which side carries it.
  const judged = judgeParity(world({
    claudeSpecs: { "both-sides": spec() },
    codexSpecs: { "both-sides": spec(), "claude-only": spec() }
  }));
  assert.equal(judged.ok, false);
  assert.ok(codesOf(judged).includes("ALLOWLIST_DIRECTION_MISMATCH"));
  assert.ok(codesOf(judged).includes("ALLOWLIST_ENTRY_VANISHED"));
});

test("an allowlisted server vanishing from BOTH sides is red, not green", () => {
  // The INC-036 regression. Under a symmetric gap predicate plus name-only
  // matching, this world has no gap at all and the old gate returned green —
  // which made deleting the server from the Claude side a way to switch the
  // Codex-side check off permanently.
  const judged = judgeParity(world({ claudeSpecs: { "both-sides": spec() } }));
  assert.equal(judged.ok, false);
  const vanished = judged.defects.find((entry) => entry.code === "ALLOWLIST_ENTRY_VANISHED");
  assert.equal(vanished.server, "claude-only");
  assert.equal(vanished.side, "claude");
  assert.match(vanished.detail, /两侧同时消失/u);
  assert.ok(codesOf(judged).includes("ANCHOR_SERVER_MISSING"));
});

test("an exemption whose gap has closed must be deleted, not left standing", () => {
  const judged = judgeParity(world({
    codexSpecs: { "both-sides": spec(), "claude-only": spec() }
  }));
  assert.equal(judged.ok, false);
  assert.ok(codesOf(judged).includes("ALLOWLIST_ENTRY_OBSOLETE"));
});

test("an undated or unreasoned exemption is a defect", () => {
  for (const broken of [{ since: null }, { since: "August 2026" }, { reason: "  " }]) {
    const judged = judgeParity(world({
      allowlist: [{ ...EXEMPT[0], ...broken }]
    }));
    assert.ok(codesOf(judged).includes("ALLOWLIST_ENTRY_UNDATED"), JSON.stringify(broken));
  }
});

test("an exemption with no direction is malformed, and excuses nothing", () => {
  const judged = judgeParity(world({
    allowlist: [{ server: "claude-only", since: "2026-08-05", reason: "无方向" }]
  }));
  assert.ok(codesOf(judged).includes("ALLOWLIST_ENTRY_MALFORMED"));
  assert.ok(codesOf(judged).includes("ALLOWLIST_DIRECTION_MISMATCH"));
});

// ── the anchored minimum roster (INC-036 defect 3) ─────────────────────────

test("an anchor absent from its declared side is a defect even with no gap", () => {
  const judged = judgeParity(world({
    claudeSpecs: { "claude-only": spec() },
    codexSpecs: {}
  }));
  const missing = judged.defects.filter((entry) => entry.code === "ANCHOR_SERVER_MISSING");
  assert.deepEqual(missing.map((entry) => `${entry.server}@${entry.side}`).sort(),
    ["both-sides@claude", "both-sides@codex"]);
  // `both-sides` is absent from both, so `gap` is false — the anchor is the only
  // thing that can see it.
  assert.equal(judged.rows.find((row) => row.server === "both-sides").gap, false);
});

test("the shipped anchor roster names every server the platform .mcp.json declares", () => {
  assert.deepEqual(ANCHOR_ROSTER.map((entry) => entry.server).sort(),
    ["aos-mcp-write", "codegraph-aos", "codegraph-ds", "codegraph-tms", "tcrn-workflow", "tcrn-workflow-aos-read"]);
  for (const anchor of ANCHOR_ROSTER) {
    assert.ok(anchor.sides.includes("claude"), `${anchor.server} 必须锚在 Claude 侧`);
    assert.match(anchor.since, /^\d{4}-\d{2}-\d{2}$/u);
  }
});

test("the shipped allowlist is empty after STORY-192 closes the four gaps", () => {
  assert.deepEqual(ALLOWLIST, []);
});

// ── launch specs (INC-036 defect 4) ────────────────────────────────────────

test("a well-formed spec raises nothing", () => {
  assert.deepEqual(judgeSpec({ side: "claude", server: "s", spec: graphSpec(), probeDir, probeFile }), []);
  assert.deepEqual(judgeSpec({
    side: "claude", server: "s", spec: { command: REAL_FILE, args: [] }, probeDir, probeFile
  }), []);
});

test("an empty or non-string command is a defect", () => {
  for (const command of ["", "   ", null, 7]) {
    const found = judgeSpec({ side: "claude", server: "s", spec: { command, args: [] }, probeDir, probeFile });
    assert.ok(found.some((entry) => entry.code === "SPEC_COMMAND_EMPTY"), JSON.stringify(command));
  }
});

test("args that are not an array of strings are a defect", () => {
  for (const args of ["--path", [1, 2], { "0": "--path" }]) {
    const found = judgeSpec({ side: "claude", server: "s", spec: { command: "node", args }, probeDir, probeFile });
    assert.ok(found.some((entry) => entry.code === "SPEC_ARGS_UNPARSEABLE"), JSON.stringify(args));
  }
});

test("placeholder shapes are named, and a resolved path is not", () => {
  const placeholders = [
    "/Users/<you>/Code/TCRN Platform/TCRN-AOS",
    "/Users/${USER}/Code",
    "/Users/$USER/Code",
    "/path/to/repo",
    "/opt/.../repo",
    "~/Code/TCRN Platform"
  ];
  for (const value of placeholders) {
    assert.notEqual(placeholderIn(value), null, value);
    const found = judgeSpec({
      side: "claude", server: "s", spec: { command: "pnpm", args: ["--path", value] }, probeDir, probeFile
    });
    assert.ok(found.some((entry) => entry.code === "SPEC_PLACEHOLDER"), value);
  }
  // The other side of the same predicate: real values on this platform's shape.
  for (const value of [REAL_DIR, "/Users/someone/Code/TCRN Platform/TCRN-AOS", REAL_FILE]) {
    assert.equal(placeholderIn(value), null, value);
  }
});

test("a --path or --dir that is not a directory is a defect", () => {
  for (const flag of ["--path", "--dir"]) {
    const found = judgeSpec({
      side: "codex", server: "s", spec: { command: "pnpm", args: [flag, "/opt/gone"] }, probeDir, probeFile
    });
    assert.deepEqual(found.map((entry) => entry.code), ["SPEC_PATH_NOT_A_DIRECTORY"]);
  }
});

test("a path flag with no value, or followed by another flag, is a defect", () => {
  for (const args of [["--path"], ["--path", "--mcp"], ["--dir", "  "]]) {
    const found = judgeSpec({ side: "claude", server: "s", spec: { command: "pnpm", args }, probeDir, probeFile });
    assert.ok(found.some((entry) => entry.code === "SPEC_FLAG_VALUE_MISSING"), JSON.stringify(args));
  }
});

test("an absolute command that does not exist is a defect; a relative one is not probed", () => {
  const absent = judgeSpec({
    side: "codex", server: "s", spec: { command: "/opt/gone/pnpm", args: [] }, probeDir, probeFile
  });
  assert.deepEqual(absent.map((entry) => entry.code), ["SPEC_COMMAND_PATH_MISSING"]);
  const onPath = judgeSpec({ side: "codex", server: "s", spec: { command: "pnpm", args: [] }, probeDir, probeFile });
  assert.deepEqual(onPath, []);
});

test("spec defects reach the verdict from either side", () => {
  const claudeBroken = judgeParity(world({
    claudeSpecs: { "both-sides": spec(), "claude-only": graphSpec("/opt/gone") }
  }));
  assert.equal(claudeBroken.ok, false);
  assert.deepEqual(claudeBroken.defects.map((entry) => [entry.side, entry.code]),
    [["claude", "SPEC_PATH_NOT_A_DIRECTORY"]]);

  const codexBroken = judgeParity(world({
    codexSpecs: { "both-sides": { command: "", args: [] } }
  }));
  assert.equal(codexBroken.ok, false);
  assert.deepEqual(codexBroken.defects.map((entry) => [entry.side, entry.code]),
    [["codex", "SPEC_COMMAND_EMPTY"]]);
});

// ── the Codex-side reader ──────────────────────────────────────────────────

const TOML = [
  "model = \"gpt-5\"",
  "",
  "[mcp_servers]",
  "",
  "[mcp_servers.codegraph]",
  "command = \"/opt/real-bin/pnpm\"",
  "args = [\"--dir\", \"/opt/real-dir\", \"exec\", \"codegraph\"]",
  "startup_timeout_sec = 120.0",
  "",
  "[mcp_servers.node_repl]",
  "command = \"/opt/node_repl\"",
  "",
  "[mcp_servers.node_repl.env]",
  "command = \"THIS IS AN ENV KEY, NOT A COMMAND\"",
  "CODEX_HOME = \"/home/x/.codex\"",
  "",
  "[mcp_servers.spread]",
  "command = \"node\"",
  "args = [",
  "  \"one\",",
  "  \"two\"",
  "]",
  "",
  "[features]",
  "js_repl = false"
].join("\n");

test("the TOML reader lifts command and args out of direct subtables only", () => {
  const specs = parseCodexConfig(TOML);
  assert.deepEqual(Object.keys(specs), ["codegraph", "node_repl", "spread"]);
  assert.deepEqual(specs.codegraph, {
    command: "/opt/real-bin/pnpm",
    args: ["--dir", "/opt/real-dir", "exec", "codegraph"]
  });
  // `[mcp_servers.node_repl.env]` closes the server: its `command` key is env, and
  // must not overwrite the one read from the server's own table.
  assert.equal(specs.node_repl.command, "/opt/node_repl");
  assert.deepEqual(specs.spread.args, ["one", "two"]);
  // `[mcp_servers]` and `[features]` open no server.
  assert.equal(specs.features, undefined);
  assert.equal(specs.mcp_servers, undefined);
});

test("a multi-line args array is not treated as complete until it closes", () => {
  assert.deepEqual(parseTomlStringArray("[\"a\", \"b\"]"), { values: ["a", "b"], complete: true });
  assert.deepEqual(parseTomlStringArray("[\"a\","), { values: ["a"], complete: false });
  assert.deepEqual(parseTomlStringArray("no bracket"), { values: [], complete: false });
});

test("normalization renames the Codex codegraph and drops runtime servers", () => {
  const specs = normalizeCodexSpecs(parseCodexConfig(TOML));
  assert.deepEqual(Object.keys(specs), ["codegraph-tms", "spread"]);
  assert.equal(specs["codegraph-tms"].command, "/opt/real-bin/pnpm");
});

test("the parsed Codex spec is judged, not just its name", () => {
  const specs = parseCodexConfig(TOML.replace("/opt/real-dir", "/opt/gone"));
  const judged = judgeParity(world({
    claudeSpecs: { "both-sides": spec(), "claude-only": spec(), "codegraph-tms": spec() },
    codexSpecs: { "both-sides": spec(), codegraph: specs.codegraph }
  }));
  assert.equal(judged.ok, false);
  assert.ok(judged.defects.some((entry) =>
    entry.code === "SPEC_PATH_NOT_A_DIRECTORY" && entry.server === "codegraph-tms" && entry.side === "codex"));
});

// ── the red harness itself (INC-036 defect 1) ──────────────────────────────

test("redProof reports the verdict of judgeParity, and can report a green one", () => {
  const identity = redProof({
    id: "IDENTITY", why: "control", baseline: world(), mutate: (inputs) => inputs
  });
  assert.equal(identity.wentRed, false);
  assert.equal(identity.reasonCode, "PARITY_VERIFIED");
  assert.equal(identity.judgeId, JUDGE_ID);
  assert.deepEqual(identity.defectCodes, []);
});

test("redProof's answer follows the inputs, so it is not a canned red", () => {
  // Same mutation, two allowlists. If `redProof` carried its own predicate — the
  // INC-036 defect — the exemption could not change the answer.
  const mutate = (inputs) => {
    inputs.claudeSpecs.extra = spec();
    return inputs;
  };
  const withoutExemption = redProof({ id: "A", why: "", baseline: world(), mutate });
  assert.equal(withoutExemption.wentRed, true);
  assert.deepEqual(withoutExemption.named, ["extra"]);

  const withExemption = redProof({
    id: "B", why: "",
    baseline: world({
      allowlist: [...EXEMPT, { server: "extra", missingFrom: "codex", since: "2026-08-05", reason: "已裁定" }]
    }),
    mutate
  });
  assert.equal(withExemption.wentRed, false);
});

test("redProof does not mutate the baseline it was handed", () => {
  const baseline = world();
  redProof({
    id: "C", why: "", baseline,
    mutate: (inputs) => {
      delete inputs.claudeSpecs["claude-only"];
      inputs.allowlist = [];
      return inputs;
    }
  });
  assert.deepEqual(Object.keys(baseline.claudeSpecs).sort(), ["both-sides", "claude-only"]);
  assert.equal(baseline.allowlist.length, 1);
  assert.equal(judgeParity(baseline).ok, true);
});

test("expectation bookkeeping distinguishes 'went red' from 'went red for the stated reason'", () => {
  const wrongReason = redProof({
    id: "D", why: "",
    baseline: world(),
    mutate: (inputs) => {
      inputs.claudeSpecs.extra = spec();
      return inputs;
    },
    expectDefectCodes: ["SPEC_PLACEHOLDER"],
    expectServer: "codegraph-aos"
  });
  assert.equal(wrongReason.wentRed, true);
  assert.equal(wrongReason.raisedExpectedCodes, false);
  assert.equal(wrongReason.namedExpectedServer, false);
});
