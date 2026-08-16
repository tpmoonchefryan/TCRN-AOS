# S3 · 仪器名册 parity:proof 规格（起草稿 · 判断型）

> 起草：执行层 `agent:deepseek-v4-flash` · 2026-08-05。流程：**执行层起草 → 核验层复核 → 审查层终审**。实现载体：`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`（pnpm `parity:proof`）。

## 两侧名册真值源

| 侧 | 真值源 | 读取 |
| --- | --- | --- |
| Claude Code | 平台根 `.mcp.json` 的 `mcpServers` | JSON.parse |
| Codex | `~/.codex/config.toml` `[mcp_servers.*]` 直接子表 | 正则解析，**只读**（脚本永不写） |
| Claude skills | 平台 `.claude/skills/` 命名 skill（目录） | `readdirSync`（txt/md 噪音过滤） |
| 平台仪器名册 | 两侧平台相关服务器的并集（归一化后） | 由脚本派生，非散文 |

> skills 维度：首版记录 Claude 侧 skill 名单并断言 `tcrn-workflow-helper` 在位（平台关键 skill）；Codex 侧 skills 对等比较是另一张命名映射，属审查层后续项（S4 处理 MCP 名册，skills-parity 单独成题）。

## 判定语义

- **平台相关服务器**：Claude 侧 `.mcp.json` 全部计入；Codex 侧 `node_repl`、`computer-use` 为 Codex 运行时特性，**非平台仪器，排除出比较**（不是豁免缺口）。
- **归一化**：Codex 的 TMS 作用域 `codegraph` ↔ Claude 侧 `codegraph-tms`（同一服务器，两侧命名不同）。
- **缺口**：服务器仅在一侧出现。缺口必须被白名单豁免（带 `since` 日期与理由），否则为**缺陷** → parity 红。
- **绿**：无未豁免缺口 → `PARITY_VERIFIED`。
- **fail-closed**：任一真值源不可读（`.mcp.json` / `config.toml` 缺失）→ 红（无法核对的 parity 不算过）。

## 当前实测（2026-08-05）

- Claude 侧：`codegraph-aos` / `codegraph-ds` / `codegraph-tms` / `tcrn-workflow` / `tcrn-workflow-aos-read`（5）。
- Codex 侧（平台相关，归一化后）：`codegraph-tms` / `tcrn-workflow`（2）；`node_repl`、`computer-use` 排除。
- 缺口 3 条，全被白名单豁免（`codegraph-ds` / `codegraph-aos` / `tcrn-workflow-aos-read`）→ **绿起步**。
- **顺带修正**：平台 CLAUDE.md §一.6「workflow-MCP 两侧都还没接」已过时——`tcrn-workflow` MCP 现两侧都接。已更新为 2026-08-05 实测状态（Codex 缺 codegraph-ds/aos + aos-read），并指向 `parity:proof` 机器核对。

## 红证（in-memory，真实判定路径变红）

- **RED A 注入伪漂移**：在一侧注入不在另一侧、也不在白名单的假服务器 `codegraph-xyz` → 红，点名 `codegraph-xyz`。
- **RED B 白名单少记**：把 `codegraph-ds` 的豁免去掉 → 红，点名 `codegraph-ds`（收缩白名单的正确方向被证到反面）。

## 待审查层（判断型终审项）

1. **白名单收缩节奏**：STORY-146（S4.2 审查层应用 Codex diff）后收缩 `codegraph-ds`/`codegraph-aos` 两条豁免；`tcrn-workflow-aos-read` 是否在 Codex 侧补对等服务器由审查层决。
2. **是否并入 `pnpm verify`**：本单只入 proof 家族（`pnpm parity:proof`）；并入 verify 序列归审查层决。
3. **归一化表维护**：新增平台 MCP 服务器时两侧命名若不同，须同步更新 `CODEX_NAME_TO_PLATFORM`。

## 证据包

`tcrn-workflow/docs/reports/init-018/S3/`。仓内交付：`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`、`TCRN-AOS/package.json`（+`parity:proof`）、`TCRN-AOS/evidence/aos-instrument-parity.json`、平台 `CLAUDE.md`（§一.6 过时句修正）。
