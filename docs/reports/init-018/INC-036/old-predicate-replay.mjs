#!/usr/bin/env node
// TCRN-AOS-INC-036 — the old judgement and the new one, on the same worlds.
//
// A red test only proves something if the code BEFORE the fix would have been
// green on the same input. So this replays the pre-INC-036 predicate — copied
// verbatim from the shipped file's lines 96–114, reproduced below — beside
// `judgeParity`, over one world per defect the incident names.
//
// It reads the real `.mcp.json` and `~/.codex/config.toml` for its baseline and
// mutates in memory; it writes nothing and touches no configuration.
//
//   node old-predicate-replay.mjs
//
// Exit 0 when every row behaves as INC-036 says it must (old green / new red for
// the four defect worlds, both red for the drift control, both green unmutated),
// 1 otherwise. Prints only server names and reason codes — no host paths.
import {
  ALLOWLIST, ANCHOR_ROSTER, NOWHERE_DIR, judgeParity, normalizeCodexSpecs,
  readClaudeSpecs, readCodexSpecs
} from "../../../../deploy/aos-local-client/parity-proof.mjs";

/**
 * THE PRE-INC-036 JUDGEMENT, verbatim in substance.
 *
 * Roster is the union of the two observations; a gap is symmetric; exemption is a
 * name lookup; `command` and `args` are never read because the old readers only
 * ever produced names.
 */
function oldJudge({ claudeSpecs, codexSpecs, allowlist }) {
  const claude = Object.keys(claudeSpecs).sort();
  const codexPlatform = Object.keys(normalizeCodexSpecs(codexSpecs)).sort();
  const roster = [...new Set([...claude, ...codexPlatform])].sort();
  const rows = roster.map((server) => {
    const claudeSide = claude.includes(server);
    const codexSide = codexPlatform.includes(server);
    const allowlisted = allowlist.find((entry) => entry.server === server) ?? null;
    return { server, gap: claudeSide !== codexSide, allowlisted: allowlisted !== null };
  });
  const defects = rows.filter((row) => row.gap && !row.allowlisted);
  return { ok: defects.length === 0, named: defects.map((row) => row.server) };
}

const baseline = {
  claudeSpecs: readClaudeSpecs(),
  codexSpecs: readCodexSpecs(),
  allowlist: ALLOWLIST,
  anchors: ANCHOR_ROSTER
};

const clone = () => ({
  claudeSpecs: structuredClone(baseline.claudeSpecs),
  codexSpecs: structuredClone(baseline.codexSpecs),
  allowlist: structuredClone(baseline.allowlist),
  anchors: structuredClone(baseline.anchors)
});

const aosPathIndex = (spec) => spec.args.indexOf("--path") + 1;

const WORLDS = [
  {
    id: "unmutated-control",
    defect: "对照组",
    expect: { old: "green", new: "green" },
    mutate: (inputs) => inputs
  },
  {
    id: "real-drift",
    defect: "对照组：旧判据本来就抓得住的漂移，修复后不得丢失",
    expect: { old: "red", new: "red" },
    mutate: (inputs) => {
      inputs.claudeSpecs["codegraph-xyz"] = { command: "node", args: [] };
      return inputs;
    }
  },
  {
    id: "allowlisted-vanished-both-sides",
    defect: "缺陷 2：白名单只按服务器名匹配，两侧同时消失即恒绿",
    expect: { old: "green", new: "red" },
    mutate: (inputs) => {
      delete inputs.claudeSpecs["codegraph-ds"];
      return inputs;
    }
  },
  {
    id: "allowlist-direction-flipped",
    defect: "缺陷 2：豁免无方向，缺口反向仍被放行",
    expect: { old: "green", new: "red" },
    mutate: (inputs) => {
      delete inputs.claudeSpecs["codegraph-ds"];
      inputs.codexSpecs["codegraph-ds"] = { command: "node", args: [] };
      return inputs;
    }
  },
  {
    id: "anchor-lost-from-both-sides",
    defect: "缺陷 3：名册由观测并集派生，没有锚定最小集",
    expect: { old: "green", new: "red" },
    mutate: (inputs) => {
      delete inputs.claudeSpecs["tcrn-workflow"];
      delete inputs.codexSpecs["tcrn-workflow"];
      return inputs;
    }
  },
  {
    id: "placeholder-in-path",
    defect: "缺陷 4：从不校验 command/args，占位符判绿",
    expect: { old: "green", new: "red" },
    mutate: (inputs) => {
      const spec = inputs.claudeSpecs["codegraph-aos"];
      spec.args[aosPathIndex(spec)] = "/Users/<you>/Code/TCRN Platform/TCRN-AOS";
      return inputs;
    }
  },
  {
    id: "dangling-path",
    defect: "缺陷 4：--path 指向不存在的目录，判绿",
    expect: { old: "green", new: "red" },
    mutate: (inputs) => {
      const spec = inputs.claudeSpecs["codegraph-aos"];
      spec.args[aosPathIndex(spec)] = NOWHERE_DIR;
      return inputs;
    }
  }
];

const verdict = (result) => (result.ok ? "green" : "red");

let failures = 0;
const rows = [];
for (const world of WORLDS) {
  const oldResult = oldJudge(world.mutate(clone()));
  const newResult = judgeParity(world.mutate(clone()));
  const got = { old: verdict(oldResult), new: verdict(newResult) };
  const asExpected = got.old === world.expect.old && got.new === world.expect.new;
  if (!asExpected) failures += 1;
  rows.push({
    world: world.id,
    defect: world.defect,
    old: got.old,
    new: got.new,
    expected: `${world.expect.old}/${world.expect.new}`,
    asExpected,
    newDefectCodes: newResult.defectCodes,
    newNamed: [...new Set(newResult.defects.map((entry) => entry.server))].sort(),
    oldNamed: oldResult.named
  });
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: "aos.instrument-parity.old-vs-new.v1",
  incident: "TCRN-AOS-INC-036",
  claim: "每个缺陷世界里，修复前的判据判绿、修复后的判据判红；两个对照组两侧一致。",
  ok: failures === 0,
  rows
}, null, 2)}\n`);
if (failures > 0) process.exitCode = 1;
