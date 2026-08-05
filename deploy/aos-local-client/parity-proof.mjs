#!/usr/bin/env node
// S3 (TCRN-CROSS-STORY-145) — instrument-roster parity proof.
// Rewritten under TCRN-AOS-INC-036 (2026-08-05); see "What INC-036 found" below.
//
// Verifies the two executor hosts carry the same platform instrument roster:
//   * Claude Code side — the platform root `.mcp.json` (project-level MCP servers)
//   * Codex side      — `~/.codex/config.toml` `[mcp_servers.*]` (READ-ONLY)
//
// Parity is over the platform-relevant servers: Claude-side servers are all
// platform instruments; Codex-side generic runtime servers (node_repl,
// computer-use) are declared non-platform and excluded from comparison, and
// Codex's TMS-scoped `codegraph` is normalized to the Claude-side canonical
// `codegraph-tms`. Known gaps are allowlisted with a DIRECTION and a dated
// reason; any other one-sided server is a defect and the proof goes red.
//
// This script NEVER writes ~/.codex/config.toml or any roster — the Codex side
// is read only. STORY-146 (S4) generates the diff that shrinks the allowlist.
//
//   node deploy/aos-local-client/parity-proof.mjs [--emit]
//   node deploy/aos-local-client/parity-proof.mjs --claude-mcp <fixture> [--codex-config <fixture>]
//
// Exit 0 green · 1 incomplete (a red, a missing truth source, or fixture mode).
//
// ── What INC-036 found, and what each fix is ────────────────────────────────
//
// 1. THE RED PROOF WAS A TAUTOLOGY. `redProof` hand-built mutated *rows* and ran
//    a *copy* of the defect filter over them. It proved "a copy of the predicate
//    goes red", which is true of any copy and says nothing about the gate. FIX:
//    there is now exactly one judgement — `judgeParity` — and a red case is an
//    INPUT mutation fed through it. `redProof` contains no predicate of its own,
//    only a call. The same function produces the live verdict, so a red case and
//    the green it contradicts cannot drift apart. The harness is also checked
//    against always-red: `HARNESS_MIRRORS_LIVE_VERDICT` runs the identity
//    mutation and requires it to reproduce the live verdict byte for byte.
//
// 2. THE ALLOWLIST WAS DIRECTIONLESS, SO IT WAS A HOLE. Exemption matched on the
//    server NAME while the gap predicate was symmetric (`claudeSide !== codexSide`).
//    An allowlisted server deleted from BOTH sides produced no gap at all, so the
//    proof stayed green — deleting `codegraph-aos` from the Claude side alone was
//    enough to make its Codex-side absence permanently invisible. FIX: every entry
//    declares `missingFrom`, exemption applies only to that exact direction, and
//    every entry is independently checked to still be PRESENT on the other side
//    (`ALLOWLIST_ENTRY_VANISHED`). Both-sides-gone and direction-flipped now red.
//
// 3. THE ROSTER WAS A PURE UNION OF WHAT WAS OBSERVED. A roster derived only from
//    the two observations cannot notice a server that left both of them, and the
//    "did we read anything" expectation was `length > 0`. FIX: `ANCHOR_ROSTER` is
//    a declared minimum — the servers the platform's `.mcp.json` states it carries,
//    each with the side(s) it must appear on. An anchor missing from its side is
//    `ANCHOR_SERVER_MISSING` whether or not any gap exists.
//
// 4. COMMAND AND ARGS WERE NEVER READ. Only `[mcp_servers.NAME]` headers were
//    matched, so a server pointing at a path that does not exist — or at a
//    copy-pasted `/Users/<you>/…` placeholder — counted as present and the proof
//    was green. FIX: both sides are parsed into `{command, args}` and judged:
//    non-empty command, string args, no placeholder tokens, absolute commands must
//    exist, and every `--path` / `--dir` value must be a real directory.
//
// FIXTURE MODE is a seam for end-to-end red demonstrations: `--claude-mcp` /
// `--codex-config` point the readers at fixture files. It can never manufacture a
// green — `TRUTH_SOURCES_ARE_CANONICAL` is unmet whenever an override is present,
// `--emit` is refused, and the reason code says so.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PLATFORM_ROOT, REPO_ROOT } from "./topology.mjs";
import { scrubHostPaths } from "../../scripts/lib/evidence-hygiene.mjs";

export const EVIDENCE_PATH = join(REPO_ROOT, "evidence/aos-instrument-parity.json");
export const CANONICAL_CODEX_CONFIG = resolve(homedir(), ".codex/config.toml");
export const CANONICAL_CLAUDE_MCP = resolve(PLATFORM_ROOT, ".mcp.json");

/** Stamped into every verdict so a receipt names the judgement that produced it. */
export const JUDGE_ID = "aos.instrument-parity.judgeParity.v2";

// Codex-side servers that are Codex runtime features, not platform instruments —
// out of the parity comparison entirely, not allowlisted gaps.
export const NON_PLATFORM_CODEX_SERVERS = ["node_repl", "computer-use"];

// Codex-side name → canonical platform server name (the Claude-side id).
export const CODEX_NAME_TO_PLATFORM = { codegraph: "codegraph-tms" };

/**
 * The declared minimum roster (INC-036 defect 3).
 *
 * A roster derived only from the union of the two observations is blind to a
 * server that vanished from both. These five are what the platform's `.mcp.json`
 * declares it carries, restated here as a literal so that deleting one from the
 * file is a difference between two independent statements rather than a change to
 * the only statement there is.
 *
 * `sides` is where the server MUST be found. Two of them are anchored on both
 * hosts because both hosts carry them today; the other three are anchored on the
 * Claude side only, and their Codex-side absence is what the ALLOWLIST below
 * exempts — the two mechanisms cover disjoint claims on purpose.
 */
export const ANCHOR_ROSTER = Object.freeze([
  Object.freeze({
    server: "tcrn-workflow", sides: Object.freeze(["claude", "codex"]), since: "2026-08-05",
    why: "治理引擎的 MCP 面；两侧同持，是名册的锚点之一"
  }),
  Object.freeze({
    server: "codegraph-tms", sides: Object.freeze(["claude", "codex"]), since: "2026-08-05",
    why: "TMS 代码图谱；两侧同持（Codex 侧名为 codegraph，归一后同名）"
  }),
  Object.freeze({
    server: "codegraph-ds", sides: Object.freeze(["claude"]), since: "2026-08-05",
    why: "DS 代码图谱；Claude 侧必须在——它在 Codex 侧的缺失由白名单具名豁免"
  }),
  Object.freeze({
    server: "codegraph-aos", sides: Object.freeze(["claude"]), since: "2026-08-05",
    why: "AOS 代码图谱；Claude 侧必须在——它在 Codex 侧的缺失由白名单具名豁免"
  }),
  Object.freeze({
    server: "tcrn-workflow-aos-read", sides: Object.freeze(["claude"]), since: "2026-08-05",
    why: "AOS 只读面；Claude 侧必须在——Codex 侧无对等服务器，由白名单具名豁免"
  }),
  Object.freeze({
    server: "aos-mcp-write", sides: Object.freeze(["claude"]), since: "2026-08-05",
    why: "AOS MCP 写面（单一 ceremony 工具）；Claude 侧必须在——Codex 侧无对等服务器，由白名单具名豁免"
  })
]);

/** The two sides a gap can be on. An entry naming anything else is malformed. */
export const SIDES = Object.freeze(["claude", "codex"]);

/**
 * Known one-sided servers, each with a DIRECTION and a dated reason.
 *
 * `missingFrom` is the fix for INC-036 defect 2. Before it, exemption matched the
 * server name against a symmetric gap predicate, so an entry silently exempted
 * three different worlds: missing from Codex (intended), missing from Claude (not
 * intended), and missing from both (not a "gap" at all under a symmetric
 * predicate, therefore invisible). Now an entry excuses exactly one direction and
 * simultaneously ASSERTS the server is still present on the other side — so the
 * allowlist can no longer be used, deliberately or by accident, to switch the
 * check off.
 *
 * The reasons and dates below are carried verbatim from the pre-INC-036 list.
 */
export const ALLOWLIST = Object.freeze([
  Object.freeze({
    server: "codegraph-ds", missingFrom: "codex", since: "2026-08-05",
    reason: "Codex 侧未接 codegraph-ds；STORY-146 S4.1 生成 diff，S4.2 由审查层应用"
  }),
  Object.freeze({
    server: "codegraph-aos", missingFrom: "codex", since: "2026-08-05",
    reason: "Codex 侧未接 codegraph-aos；STORY-146 S4.1 生成 diff，S4.2 由审查层应用"
  }),
  Object.freeze({
    server: "tcrn-workflow-aos-read", missingFrom: "codex", since: "2026-08-05",
    reason: "AOS 只读面仅 Claude 侧接入；Codex 侧无对等服务器"
  }),
  Object.freeze({
    server: "aos-mcp-write", missingFrom: "codex", since: "2026-08-05",
    reason: "AOS MCP 写面仅 Claude 侧接入；Codex 侧写路径走 ceremony.mjs，无 MCP 对等服务器"
  })
]);

/** Argument flags whose next value must name a directory that exists. */
export const PATH_VALUE_FLAGS = Object.freeze(["--path", "--dir"]);

/**
 * Token shapes that mean "nobody filled this in" (INC-036 defect 4).
 *
 * Deliberately narrow: each pattern names a shape that cannot occur in a real
 * resolved command line on this platform. A placeholder is reported separately
 * from a missing path because they need different fixes — a dangling path is a
 * moved directory, a placeholder is a config that was never adapted at all.
 */
export const PLACEHOLDER_PATTERNS = Object.freeze([
  Object.freeze({ id: "angle-bracket", pattern: /<[^<>\s]{1,64}>/u }),
  Object.freeze({ id: "shell-variable", pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Z_][A-Z0-9_]*/u }),
  Object.freeze({ id: "path-to", pattern: /(?:^|\/)path\/to\//iu }),
  Object.freeze({ id: "ellipsis", pattern: /\.\.\./u }),
  Object.freeze({ id: "unexpanded-home", pattern: /^~(?:\/|$)/u })
]);

const defaultProbeDir = (path) => {
  try { return statSync(path).isDirectory(); } catch { return false; }
};
const defaultProbeFile = (path) => existsSync(path);

const sortedEntries = (record) => Object.keys(record).sort()
  .reduce((out, key) => Object.assign(out, { [key]: record[key] }), {});

// ── truth-source readers ───────────────────────────────────────────────────

/** `{ name: { command, args } }` from the platform's `.mcp.json`. */
export function readClaudeSpecs(path = CANONICAL_CLAUDE_MCP) {
  if (!existsSync(path)) throw new Error(`平台 .mcp.json 不存在: ${path}`);
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const servers = parsed.mcpServers ?? {};
  const specs = {};
  for (const name of Object.keys(servers).sort()) {
    const raw = servers[name] ?? {};
    // `args` absent is legal (a command with no arguments); anything else is
    // carried through unchanged so the spec judge — not the reader — reds on it.
    specs[name] = { command: raw.command ?? null, args: raw.args === undefined ? [] : raw.args };
  }
  return specs;
}

/** One TOML basic/literal string starting at `start`. */
function readTomlString(text, start) {
  const quote = text[start];
  let index = start + 1;
  let value = "";
  while (index < text.length) {
    const char = text[index];
    if (char === "\\" && quote === "\"") {
      const escaped = text[index + 1];
      value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped ?? "";
      index += 2;
      continue;
    }
    if (char === quote) return { value, next: index + 1 };
    value += char;
    index += 1;
  }
  return { value, next: index };
}

/** The string members of a (possibly still-open) TOML array literal. */
export function parseTomlStringArray(text) {
  const values = [];
  let index = text.indexOf("[");
  if (index < 0) return { values, complete: false };
  index += 1;
  while (index < text.length) {
    const char = text[index];
    if (char === "]") return { values, complete: true };
    if (char === "\"" || char === "'") {
      const read = readTomlString(text, index);
      values.push(read.value);
      index = read.next;
      continue;
    }
    index += 1;
  }
  return { values, complete: false };
}

function parseTomlScalarString(raw) {
  const text = raw.trim();
  if (text.startsWith("\"") || text.startsWith("'")) return readTomlString(text, 0).value;
  return text;
}

/**
 * `{ name: { command, args } }` from a Codex `config.toml`.
 *
 * Direct `[mcp_servers.NAME]` subtables only: a `[mcp_servers.X.env]` header does
 * not open a server (the name must be followed immediately by `]`), and it does
 * close the previous one, so env keys are never mistaken for a command.
 */
export function parseCodexConfig(text) {
  const specs = {};
  let current = null;
  let pendingArgs = null;
  for (const line of text.split("\n")) {
    if (pendingArgs !== null) {
      pendingArgs.text += `\n${line}`;
      const parsed = parseTomlStringArray(pendingArgs.text);
      if (parsed.complete) {
        specs[pendingArgs.server].args = parsed.values;
        pendingArgs = null;
      }
      continue;
    }
    const header = line.match(/^\s*\[([^\]]*)\]\s*$/u);
    if (header) {
      const server = header[1].match(/^mcp_servers\.([^.]+)$/u);
      current = server ? server[1] : null;
      if (current !== null && specs[current] === undefined) specs[current] = { command: null, args: [] };
      continue;
    }
    if (current === null) continue;
    const command = line.match(/^\s*command\s*=\s*(.+?)\s*$/u);
    if (command) {
      specs[current].command = parseTomlScalarString(command[1]);
      continue;
    }
    const args = line.match(/^\s*args\s*=\s*(.+)$/u);
    if (args) {
      const parsed = parseTomlStringArray(args[1]);
      if (parsed.complete) specs[current].args = parsed.values;
      else pendingArgs = { server: current, text: args[1] };
    }
  }
  return sortedEntries(specs);
}

export function readCodexSpecs(path = CANONICAL_CODEX_CONFIG) {
  if (!existsSync(path)) throw new Error(`Codex 配置不存在: ${path}`);
  return parseCodexConfig(readFileSync(path, "utf8"));
}

/** Names only. Kept because callers and receipts still speak in server names. */
export function readClaudeServers(path = CANONICAL_CLAUDE_MCP) {
  return Object.keys(readClaudeSpecs(path)).sort();
}
export function readCodexServers(path = CANONICAL_CODEX_CONFIG) {
  return Object.keys(readCodexSpecs(path)).sort();
}

/** Codex-side specs reduced to the platform-relevant set, under canonical names. */
export function normalizeCodexSpecs(codexSpecs) {
  const specs = {};
  for (const name of Object.keys(codexSpecs).sort()) {
    if (NON_PLATFORM_CODEX_SERVERS.includes(name)) continue;
    specs[CODEX_NAME_TO_PLATFORM[name] ?? name] = codexSpecs[name];
  }
  return sortedEntries(specs);
}

export function normalizeCodexServers(codexServers) {
  return codexServers
    .filter((name) => !NON_PLATFORM_CODEX_SERVERS.includes(name))
    .map((name) => CODEX_NAME_TO_PLATFORM[name] ?? name);
}

/**
 * Claude-side skills truth source: the platform `.claude/skills/` directory.
 * Named skills (directories) are the parity-relevant surface; the provenance /
 * licence text files are noise. Codex-side skills parity is a distinct
 * comparison dimension with its own naming map — the first cut of this proof
 * covers the MCP roster and records the Claude-side skills for the reviewer.
 */
export function readClaudeSkills() {
  const dir = resolve(PLATFORM_ROOT, ".claude/skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => !/\.(txt|md)$/u.test(entry))
    .sort();
}

// ── the judgement (one implementation, no copies) ───────────────────────────

export function placeholderIn(token) {
  if (typeof token !== "string") return null;
  return PLACEHOLDER_PATTERNS.find((entry) => entry.pattern.test(token)) ?? null;
}

/**
 * Is this server's launch spec something a host could actually run?
 *
 * INC-036 defect 4: presence in the roster used to be decided by a section header
 * alone, so a server whose `--path` pointed at a directory that does not exist
 * counted as "configured". Two servers can agree on every name and still be a
 * parity failure if one of them cannot start.
 */
export function judgeSpec({ side, server, spec, probeDir = defaultProbeDir, probeFile = defaultProbeFile }) {
  const at = `${side}:${server}`;
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    return [{ code: "SPEC_MISSING", server, side, detail: `${at} 没有可解析的启动规格` }];
  }
  const found = [];
  const { command, args } = spec;

  if (typeof command !== "string" || command.trim() === "") {
    found.push({
      code: "SPEC_COMMAND_EMPTY", server, side,
      detail: `${at} command 为空或非字符串: ${JSON.stringify(command ?? null)}`
    });
  }
  const argsUsable = Array.isArray(args) && args.every((entry) => typeof entry === "string");
  if (!argsUsable) {
    found.push({
      code: "SPEC_ARGS_UNPARSEABLE", server, side,
      detail: `${at} args 不是字符串数组: ${JSON.stringify(args ?? null)}`
    });
  }

  const tokens = [
    ...(typeof command === "string" ? [command] : []),
    ...(argsUsable ? args : [])
  ];
  for (const token of tokens) {
    const hit = placeholderIn(token);
    if (hit) {
      found.push({
        code: "SPEC_PLACEHOLDER", server, side,
        detail: `${at} 含未填写的占位符(${hit.id}): ${token}`
      });
    }
  }

  if (typeof command === "string" && command.startsWith("/")
    && placeholderIn(command) === null && !probeFile(command)) {
    found.push({
      code: "SPEC_COMMAND_PATH_MISSING", server, side,
      detail: `${at} command 是绝对路径但不存在: ${command}`
    });
  }

  if (argsUsable) {
    for (let index = 0; index < args.length; index += 1) {
      if (!PATH_VALUE_FLAGS.includes(args[index])) continue;
      const flag = args[index];
      const value = args[index + 1];
      if (typeof value !== "string" || value.trim() === "" || value.startsWith("--")) {
        found.push({
          code: "SPEC_FLAG_VALUE_MISSING", server, side,
          detail: `${at} ${flag} 后没有取值: ${JSON.stringify(value ?? null)}`
        });
        continue;
      }
      if (placeholderIn(value) !== null) continue; // already named by SPEC_PLACEHOLDER
      if (!probeDir(value)) {
        found.push({
          code: "SPEC_PATH_NOT_A_DIRECTORY", server, side,
          detail: `${at} ${flag} 指向的目录不存在: ${value}`
        });
      }
    }
  }
  return found;
}

/**
 * THE judgement. Everything that decides green or red lives here and nowhere
 * else — the live verdict and every red case in this file are the same call with
 * different inputs (INC-036 defect 1).
 *
 * Pure: the two truth sources arrive as data and the two filesystem questions
 * arrive as `probeDir` / `probeFile`, so a case can be stated entirely in
 * literals and still exercise the real derivation.
 */
export function judgeParity(inputs) {
  const {
    claudeSpecs = {}, codexSpecs = {},
    allowlist = ALLOWLIST, anchors = ANCHOR_ROSTER,
    probeDir = defaultProbeDir, probeFile = defaultProbeFile
  } = inputs ?? {};

  const codexPlatformSpecs = normalizeCodexSpecs(codexSpecs);
  const claude = Object.keys(claudeSpecs).sort();
  const codexPlatform = Object.keys(codexPlatformSpecs).sort();
  const onClaude = (server) => claude.includes(server);
  const onCodex = (server) => codexPlatform.includes(server);
  const onSide = (server, side) => (side === "claude" ? onClaude(server) : onCodex(server));

  // Anchored ∪ observed — never a pure union of the two observations (defect 3).
  const roster = [...new Set([...anchors.map((entry) => entry.server), ...claude, ...codexPlatform])].sort();

  const defects = [];

  // (a) can each configured server actually be launched?
  for (const [side, specs] of [["claude", claudeSpecs], ["codex", codexPlatformSpecs]]) {
    for (const server of Object.keys(specs).sort()) {
      defects.push(...judgeSpec({ side, server, spec: specs[server], probeDir, probeFile }));
    }
  }

  // (b) the roster rows and their directed exemptions
  const rows = roster.map((server) => {
    const claudeSide = onClaude(server);
    const codexSide = onCodex(server);
    const gap = claudeSide !== codexSide;
    const entry = allowlist.find((candidate) => candidate.server === server) ?? null;
    const directed = entry !== null && SIDES.includes(entry.missingFrom);
    // Exemption is for one direction only: the declared side must be the missing
    // one AND the other side must actually still carry the server.
    const exempt = directed && gap
      && claudeSide === (entry.missingFrom !== "claude")
      && codexSide === (entry.missingFrom !== "codex");
    const anchor = anchors.find((candidate) => candidate.server === server) ?? null;
    return {
      server, claudeSide, codexSide, gap,
      anchored: anchor !== null,
      anchorSides: anchor?.sides ? [...anchor.sides] : [],
      allowlisted: entry !== null,
      allowlistDirection: entry?.missingFrom ?? null,
      exempt,
      since: entry?.since ?? null,
      reason: entry?.reason ?? null
    };
  });

  for (const row of rows) {
    if (!row.gap || row.exempt) continue;
    const missingSide = row.claudeSide ? "codex" : "claude";
    defects.push(row.allowlisted
      ? {
        code: "ALLOWLIST_DIRECTION_MISMATCH", server: row.server, side: missingSide,
        detail: `${row.server} 的豁免声明缺在 ${row.allowlistDirection} 侧，实测缺在 ${missingSide} 侧`
      }
      : {
        code: "UNALLOWLISTED_GAP", server: row.server, side: missingSide,
        detail: `${row.server} 只在 ${missingSide === "codex" ? "claude" : "codex"} 侧存在，且无带日期理由的豁免`
      });
  }

  // (c) every allowlist entry must still be a true, dated, one-directional claim
  for (const entry of allowlist) {
    if (!SIDES.includes(entry.missingFrom)) {
      defects.push({
        code: "ALLOWLIST_ENTRY_MALFORMED", server: entry.server, side: null,
        detail: `${entry.server} 的 missingFrom 必须是 ${SIDES.join("/")}，实为 ${JSON.stringify(entry.missingFrom ?? null)}`
      });
      continue;
    }
    const dated = typeof entry.since === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(entry.since)
      && typeof entry.reason === "string" && entry.reason.trim() !== "";
    if (!dated) {
      defects.push({
        code: "ALLOWLIST_ENTRY_UNDATED", server: entry.server, side: entry.missingFrom,
        detail: `${entry.server} 的豁免缺少 YYYY-MM-DD 日期或理由`
      });
    }
    const presentSide = entry.missingFrom === "codex" ? "claude" : "codex";
    // The load-bearing assertion of INC-036 defect 2: an exemption is a claim that
    // the server EXISTS on the other side. Both sides losing it is not a green.
    if (!onSide(entry.server, presentSide)) {
      defects.push({
        code: "ALLOWLIST_ENTRY_VANISHED", server: entry.server, side: presentSide,
        detail: onSide(entry.server, entry.missingFrom)
          ? `${entry.server} 的豁免声明它在 ${presentSide} 侧存在，实测方向已反转（只在 ${entry.missingFrom} 侧）`
          : `${entry.server} 的豁免声明它在 ${presentSide} 侧存在，实测两侧同时消失——豁免不得用来关掉这道门`
      });
    } else if (onSide(entry.server, entry.missingFrom)) {
      defects.push({
        code: "ALLOWLIST_ENTRY_OBSOLETE", server: entry.server, side: entry.missingFrom,
        detail: `${entry.server} 已在 ${entry.missingFrom} 侧接上，豁免条目应当删除（白名单只许收缩）`
      });
    }
  }

  // (d) the declared minimum roster
  for (const anchor of anchors) {
    for (const side of anchor.sides ?? []) {
      if (onSide(anchor.server, side)) continue;
      defects.push({
        code: "ANCHOR_SERVER_MISSING", server: anchor.server, side,
        detail: `锚定名册要求 ${anchor.server} 出现在 ${side} 侧（${anchor.since} 起：${anchor.why}），实测缺失`
      });
    }
  }

  const ok = defects.length === 0;
  return {
    judgeId: JUDGE_ID,
    claude,
    codexPlatform,
    roster,
    rows,
    defects,
    defectCodes: [...new Set(defects.map((defect) => defect.code))].sort(),
    ok,
    reasonCode: ok ? "PARITY_VERIFIED" : "PARITY_DRIFT_DETECTED"
  };
}

/** Read both truth sources (or accept injected ones) and judge. */
export function observeParity(options = {}) {
  const claudeMcpPath = options.claudeMcpPath ?? CANONICAL_CLAUDE_MCP;
  const codexConfigPath = options.codexConfigPath ?? CANONICAL_CODEX_CONFIG;
  const claudeSpecs = options.claudeSpecs ?? readClaudeSpecs(claudeMcpPath);
  const codexSpecs = options.codexSpecs ?? readCodexSpecs(codexConfigPath);
  const judged = judgeParity({
    claudeSpecs, codexSpecs,
    allowlist: options.allowlist ?? ALLOWLIST,
    anchors: options.anchors ?? ANCHOR_ROSTER,
    probeDir: options.probeDir,
    probeFile: options.probeFile
  });
  return {
    ...judged,
    sources: { claudeMcpPath, codexConfigPath },
    claudeSpecs,
    codexSpecs,
    codex: Object.keys(codexSpecs).sort(),
    claudeSkills: readClaudeSkills()
  };
}

// ── red cases: input mutations run through the judge above ──────────────────

function cloneInputs(inputs) {
  return {
    claudeSpecs: structuredClone(inputs.claudeSpecs),
    codexSpecs: structuredClone(inputs.codexSpecs),
    allowlist: structuredClone(inputs.allowlist),
    anchors: structuredClone(inputs.anchors),
    probeDir: inputs.probeDir,
    probeFile: inputs.probeFile
  };
}

/**
 * Mutate the INPUTS, then ask the real `judgeParity` what it makes of them.
 *
 * There is deliberately no predicate in this function. Before INC-036 this is
 * where a second copy of the defect filter lived, and a copy going red is a fact
 * about the copy. Everything below is bookkeeping over `judgeParity`'s answer.
 */
export function redProof({ id, why, baseline, mutate, expectDefectCodes = [], expectServer = null }) {
  const judged = judgeParity(mutate(cloneInputs(baseline)));
  const named = [...new Set(judged.defects.map((defect) => defect.server))].sort();
  return {
    id,
    why,
    judgeId: judged.judgeId,
    wentRed: judged.ok === false,
    reasonCode: judged.reasonCode,
    defectCodes: judged.defectCodes,
    named,
    defectCount: judged.defects.length,
    raisedExpectedCodes: expectDefectCodes.every((code) => judged.defectCodes.includes(code)),
    namedExpectedServer: expectServer === null || named.includes(expectServer),
    expected: { defectCodes: expectDefectCodes, server: expectServer }
  };
}

/** The `--path` value a codegraph server carries, or -1 if it carries none. */
function pathArgIndex(spec) {
  const index = spec.args.indexOf("--path");
  return index >= 0 && index + 1 < spec.args.length ? index + 1 : -1;
}

const VALID_SPEC = Object.freeze({ command: "node", args: Object.freeze([]) });

/** A directory that must not exist, for the dangling-path case. */
export const NOWHERE_DIR = join(PLATFORM_ROOT, "TCRN-Nowhere-INC-036");

export function redCases(baseline) {
  return [
    redProof({
      id: "UNALLOWLISTED_DRIFT_MUST_RED",
      why: "一侧新增一个另一侧没有、也无豁免的平台服务器：真实漂移，必须红并点名它。",
      baseline,
      mutate: (inputs) => {
        inputs.claudeSpecs["codegraph-xyz"] = { ...VALID_SPEC, args: [] };
        return inputs;
      },
      expectDefectCodes: ["UNALLOWLISTED_GAP"],
      expectServer: "codegraph-xyz"
    }),
    redProof({
      id: "ALLOWLIST_ENTRY_DROPPED_MUST_RED",
      why: "白名单少记一条(codegraph-ds 的缺口不再被豁免)：缺口立刻现形，说明绿不是白名单撑出来的。",
      baseline,
      mutate: (inputs) => {
        inputs.allowlist = inputs.allowlist.filter((entry) => entry.server !== "codegraph-ds");
        return inputs;
      },
      expectDefectCodes: ["UNALLOWLISTED_GAP"],
      expectServer: "codegraph-ds"
    }),
    redProof({
      id: "ALLOWLISTED_SERVER_VANISHED_BOTH_SIDES_MUST_RED",
      why: "INC-036 缺陷 2 的回归：把被豁免的 codegraph-ds 从 Claude 侧也删掉。"
        + "旧判据下对称缺口消失、门恒绿；现在豁免本身断言它必须在 Claude 侧存在。",
      baseline,
      mutate: (inputs) => {
        delete inputs.claudeSpecs["codegraph-ds"];
        return inputs;
      },
      expectDefectCodes: ["ALLOWLIST_ENTRY_VANISHED", "ANCHOR_SERVER_MISSING"],
      expectServer: "codegraph-ds"
    }),
    redProof({
      id: "ALLOWLIST_DIRECTION_FLIPPED_MUST_RED",
      why: "被豁免的服务器改成只在 Codex 侧存在：名字仍匹配，但方向反了，旧的按名豁免会放行。",
      baseline,
      mutate: (inputs) => {
        delete inputs.claudeSpecs["codegraph-ds"];
        inputs.codexSpecs["codegraph-ds"] = { ...VALID_SPEC, args: [] };
        return inputs;
      },
      expectDefectCodes: ["ALLOWLIST_DIRECTION_MISMATCH", "ALLOWLIST_ENTRY_VANISHED"],
      expectServer: "codegraph-ds"
    }),
    redProof({
      id: "PLACEHOLDER_IN_SPEC_MUST_RED",
      why: "INC-036 缺陷 4：把 codegraph-aos 的 --path 换成 /Users/<you>/… 这类没填写的占位符。",
      baseline,
      mutate: (inputs) => {
        const spec = inputs.claudeSpecs["codegraph-aos"];
        const index = pathArgIndex(spec);
        if (index >= 0) spec.args[index] = "/Users/<you>/Code/TCRN Platform/TCRN-AOS";
        return inputs;
      },
      expectDefectCodes: ["SPEC_PLACEHOLDER"],
      expectServer: "codegraph-aos"
    }),
    redProof({
      id: "DANGLING_PATH_IN_SPEC_MUST_RED",
      why: "INC-036 缺陷 4：--path 指向一个不存在的目录——服务器名齐全，但它根本起不来。",
      baseline,
      mutate: (inputs) => {
        const spec = inputs.claudeSpecs["codegraph-aos"];
        const index = pathArgIndex(spec);
        if (index >= 0) spec.args[index] = NOWHERE_DIR;
        return inputs;
      },
      expectDefectCodes: ["SPEC_PATH_NOT_A_DIRECTORY"],
      expectServer: "codegraph-aos"
    }),
    redProof({
      id: "CODEX_SIDE_SPEC_EMPTY_MUST_RED",
      why: "Codex 侧的规格同样被读：清空 codegraph 的 command，归一后以 codegraph-tms 之名判红。",
      baseline,
      mutate: (inputs) => {
        inputs.codexSpecs.codegraph.command = "";
        return inputs;
      },
      expectDefectCodes: ["SPEC_COMMAND_EMPTY"],
      expectServer: "codegraph-tms"
    })
  ];
}

// ── the runnable proof ─────────────────────────────────────────────────────

export function runParityProof(options = {}) {
  const fixtureMode = Boolean(options.claudeMcpPath || options.codexConfigPath);
  let observation;
  try {
    observation = observeParity(options);
  } catch (error) {
    return {
      schemaVersion: "aos.instrument-parity-proof.v2",
      story: "TCRN-CROSS-STORY-145",
      incident: "TCRN-AOS-INC-036",
      ok: false,
      reasonCode: "PARITY_PROOF_SOURCE_UNREADABLE",
      detail: String(error.message),
      expectations: [{ id: "TRUTH_SOURCES_READABLE", met: false, expected: true, observed: error.message }]
    };
  }

  const baseline = {
    claudeSpecs: observation.claudeSpecs,
    codexSpecs: observation.codexSpecs,
    allowlist: ALLOWLIST,
    anchors: ANCHOR_ROSTER,
    probeDir: options.probeDir,
    probeFile: options.probeFile
  };

  // The control that keeps the red harness from being always-red: the identity
  // mutation must reproduce the live verdict exactly. If this and a red case
  // ever agreed, one of them would be measuring nothing.
  const identity = redProof({
    id: "IDENTITY_MUTATION",
    why: "不改任何输入时，红侧机构必须复现活判定——这是「判据两侧能够不同」的那一侧。",
    baseline,
    mutate: (inputs) => inputs
  });
  const mirrors = identity.wentRed === (observation.ok === false)
    && identity.defectCodes.join("|") === observation.defectCodes.join("|");

  const reds = redCases(baseline);
  const codeOf = (code) => observation.defects.filter((defect) => defect.code === code);
  const specDefects = observation.defects.filter((defect) => defect.code.startsWith("SPEC_"));
  const allowlistDefects = observation.defects.filter((defect) => defect.code.startsWith("ALLOWLIST_"));

  const expectations = [
    {
      id: "TRUTH_SOURCES_ARE_CANONICAL", met: fixtureMode === false,
      expected: "读的是平台 .mcp.json 与 ~/.codex/config.toml 本身",
      observed: observation.sources
    },
    {
      id: "CODEX_SIDE_SERVERS_READ", met: observation.codex.length > 0,
      expected: "≥1 server in [mcp_servers]", observed: observation.codex
    },
    {
      id: "ANCHOR_ROSTER_SATISFIED", met: codeOf("ANCHOR_SERVER_MISSING").length === 0,
      expected: ANCHOR_ROSTER.map((entry) => `${entry.server}@${entry.sides.join("+")}`),
      observed: codeOf("ANCHOR_SERVER_MISSING").map((defect) => `${defect.server}@${defect.side}`)
    },
    {
      id: "EVERY_SPEC_LAUNCHABLE", met: specDefects.length === 0,
      expected: "命令非空、args 可解析、无占位符、--path/--dir 指向真实目录",
      observed: specDefects.map((defect) => `${defect.code}:${defect.side}:${defect.server}`)
    },
    {
      id: "EVERY_ALLOWLIST_ENTRY_DIRECTED_AND_DATED", met: allowlistDefects.length === 0,
      expected: ALLOWLIST.map((entry) => `${entry.server}@${entry.since}(missingFrom=${entry.missingFrom})`),
      observed: allowlistDefects.map((defect) => `${defect.code}:${defect.server}`)
    },
    {
      id: "CLAUDE_SIDE_HAS_PLATFORM_SKILL", met: observation.claudeSkills.includes("tcrn-workflow-helper"),
      expected: "tcrn-workflow-helper in platform .claude/skills/", observed: observation.claudeSkills
    },
    {
      id: "GREEN_ON_THIS_PLATFORM", met: observation.ok === true,
      expected: "PARITY_VERIFIED",
      observed: observation.defects.map((defect) => `${defect.code}:${defect.server}`)
    },
    {
      id: "HARNESS_MIRRORS_LIVE_VERDICT", met: mirrors,
      expected: { wentRed: observation.ok === false, defectCodes: observation.defectCodes },
      observed: { wentRed: identity.wentRed, defectCodes: identity.defectCodes }
    },
    ...reds.map((red) => ({
      id: `RED_${red.id}`,
      met: red.wentRed && red.raisedExpectedCodes && red.namedExpectedServer,
      expected: red.expected,
      observed: { wentRed: red.wentRed, defectCodes: red.defectCodes, named: red.named }
    }))
  ];

  const unmet = expectations.filter((entry) => entry.met !== true).map((entry) => entry.id);
  const reasonCode = fixtureMode
    ? "PARITY_PROOF_FIXTURE_MODE"
    : unmet.length === 0
      ? "PARITY_VERIFIED"
      : observation.ok === false ? "PARITY_DRIFT_DETECTED" : "PARITY_PROOF_INCOMPLETE";

  return {
    schemaVersion: "aos.instrument-parity-proof.v2",
    story: "TCRN-CROSS-STORY-145",
    incident: "TCRN-AOS-INC-036",
    ok: fixtureMode ? false : unmet.length === 0,
    reasonCode,
    fixtureMode,
    unmetExpectations: unmet,
    expectations,
    claim: {
      predicate: "平台仪器名册(平台相关 MCP 服务器)须由 Claude Code 与 Codex 两侧同持;"
        + "单侧缺口须有带方向、带日期理由的白名单豁免,且该豁免同时断言服务器仍在另一侧存在;"
        + "名册不得只由观测并集派生,须覆盖锚定最小集;每个服务器的 command/args 须可解析且指向真实路径。",
      truthSources: ["platform/.mcp.json (Claude Code)", "~/.codex/config.toml [mcp_servers] (Codex, 只读)"],
      whereTheJudgementLives: "deploy/aos-local-client/parity-proof.mjs → judgeParity() (pnpm parity:proof)",
      howRedIsProven: "红侧一律构造输入后调用同一个 judgeParity();本文件中没有第二份判据副本。"
    },
    judgeId: JUDGE_ID,
    observation,
    identityControl: identity,
    reds,
    observedAt: new Date().toISOString().replace(/\.\d+Z$/u, "Z")
  };
}

export function parseArgv(argv) {
  const valueOf = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
  };
  return {
    emit: argv.includes("--emit"),
    claudeMcpPath: valueOf("--claude-mcp"),
    codexConfigPath: valueOf("--codex-config")
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const argv = parseArgv(process.argv.slice(2));
  const result = runParityProof({
    claudeMcpPath: argv.claudeMcpPath ?? undefined,
    codexConfigPath: argv.codexConfigPath ?? undefined
  });
  const artifact = scrubHostPaths(result);
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  if (argv.emit) {
    // A fixture run must never be able to leave a receipt behind that reads like
    // a measurement of this platform.
    if (result.fixtureMode) {
      process.stderr.write("refusing --emit in fixture mode: the artifact would not describe this platform\n");
      process.exitCode = 1;
    } else {
      mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
      writeFileSync(EVIDENCE_PATH, text);
    }
  }
  process.stdout.write(text);
  if (result.ok !== true) process.exitCode = 1;
}
