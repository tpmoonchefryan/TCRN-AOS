#!/usr/bin/env node
// TCRN-AOS-INC-036 — build the truth-source fixtures the end-to-end red runs use.
//
// The fixtures are GENERATED, never committed, for two reasons:
//   1. a committed copy of this machine's `.mcp.json` / `config.toml` would carry
//      host paths into a public repository — the exact drift INC-037 was filed for;
//   2. a frozen copy would stop tracking the real files, so a red demonstrated
//      against it would slowly stop being a demonstration about this platform.
//
// Each fixture differs from the real file by exactly ONE term, named in its id.
//
//   node make-fixtures.mjs <outDir>
//
// Prints one line per fixture: `<id>\t<relative path>\t<the one term changed>`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CANONICAL_CLAUDE_MCP, CANONICAL_CODEX_CONFIG, NOWHERE_DIR
} from "../../../../deploy/aos-local-client/parity-proof.mjs";
import { PLATFORM_ROOT } from "../../../../deploy/aos-local-client/topology.mjs";

const outDir = resolve(process.argv[2] ?? ".");
mkdirSync(outDir, { recursive: true });

const realMcp = JSON.parse(readFileSync(CANONICAL_CLAUDE_MCP, "utf8"));
const realCodex = readFileSync(CANONICAL_CODEX_CONFIG, "utf8");

const clone = () => JSON.parse(JSON.stringify(realMcp));

const pathArgOf = (spec) => {
  const index = spec.args.indexOf("--path");
  if (index < 0 || index + 1 >= spec.args.length) throw new Error("codegraph-aos 没有 --path 参数");
  return index + 1;
};

const withAosPath = (value) => {
  const doc = clone();
  doc.mcpServers["codegraph-aos"].args[pathArgOf(doc.mcpServers["codegraph-aos"])] = value;
  return doc;
};

const FIXTURES = [
  {
    id: "control",
    file: "mcp-control.json",
    changed: "无——与真文件逐字节相同（对照组：fixture 模式本身不会把判定变红）",
    write: () => JSON.stringify(realMcp, null, 2)
  },
  {
    id: "drift",
    file: "mcp-drift.json",
    changed: "新增 mcpServers.codegraph-xyz（Codex 侧没有、白名单也没有）",
    write: () => {
      const doc = clone();
      doc.mcpServers["codegraph-xyz"] = { command: "node", args: [] };
      return JSON.stringify(doc, null, 2);
    }
  },
  {
    id: "vanished",
    file: "mcp-vanished.json",
    changed: "删除 mcpServers.codegraph-ds（该服务器本就不在 Codex 侧，于是两侧同时消失）",
    write: () => {
      const doc = clone();
      delete doc.mcpServers["codegraph-ds"];
      return JSON.stringify(doc, null, 2);
    }
  },
  {
    id: "placeholder",
    file: "mcp-placeholder.json",
    changed: "codegraph-aos 的 --path 改成 /Users/<you>/… 占位符",
    write: () => JSON.stringify(withAosPath("/Users/<you>/Code/TCRN Platform/TCRN-AOS"), null, 2)
  },
  {
    id: "dangling",
    file: "mcp-dangling.json",
    changed: "codegraph-aos 的 --path 改成一个不存在的目录",
    write: () => JSON.stringify(withAosPath(NOWHERE_DIR), null, 2)
  },
  {
    id: "codex-dangling",
    file: "codex-dangling.toml",
    changed: "Codex 侧 codegraph 的 --dir 改成一个不存在的目录",
    write: () => realCodex.split(join(PLATFORM_ROOT, "TCRN-TMS")).join(NOWHERE_DIR)
  }
];

for (const fixture of FIXTURES) {
  const text = fixture.write();
  writeFileSync(join(outDir, fixture.file), text.endsWith("\n") ? text : `${text}\n`);
  process.stdout.write(`${fixture.id}\t${fixture.file}\t${fixture.changed}\n`);
}
