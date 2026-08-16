# S3 notes — STORY-145 · 仪器名册 parity:proof

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- **判断型规格起草**：`docs/reports/init-018/S3/spec.md`（真值源 / 判定语义 / 当前实测 / 红证 / 待审查层）。
- **实现**：`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs` + `pnpm parity:proof`。实测 **PARITY_VERIFIED**（Claude 5 服务器 / Codex 平台相关 2；缺口 3 条全白名单豁免、带日期理由）。两条红证都红并点名（`codegraph-xyz`、`codegraph-ds`）。`--emit` 证据已出（scrubHostPaths 清洗）。
- **CLAUDE.md 修正**：平台 §一.6「workflow-MCP 两侧都还没接」过时——实测 2026-08-05 `tcrn-workflow` MCP 两侧都已接（平台 `.mcp.json` + `~/.codex/config.toml` `[mcp_servers.tcrn-workflow]`）。已更新为实测状态。`doc-topology:proof` 复验仍绿（DOC_TOPOLOGY_IN_SYNC），声明块未受波及。

## 关键实测事实（本单最重要的产出）

1. **`tcrn-workflow` MCP 两侧都已接**（不是「两侧未接」）：Claude 侧平台 `.mcp.json` 有 `tcrn-workflow`（指向 `~/.tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow-mcp.mjs` + authority pins）；Codex 侧 `~/.codex/config.toml` 有 `[mcp_servers.tcrn-workflow]`（同一 path + 同一 pins digest `d25ebfc1…`）。
2. **Codex 侧仍缺**：`codegraph-ds`、`codegraph-aos`、`tcrn-workflow-aos-read`（STORY-146 S4 生成 diff，S4.2 审查层应用后白名单收缩）。

## 实现说明

- 正则只匹配 `[mcp_servers.NAME]` 直接子表（`[^.\]]+` 后须紧跟 `]`），`[mcp_servers.X.env]` 这类子段不误采。
- Codex 侧 `codegraph`（TMS 作用域，无 `--path`）归一化为 `codegraph-tms`；`node_repl`/`computer-use` 声明为非平台仪器、排除出比较。
- fail-closed：`.mcp.json` 或 `config.toml` 不可读 → `PARITY_PROOF_SOURCE_UNREADABLE` 红（不静默算过）。

## 待审查层

见 spec.md「待审查层」：白名单收缩节奏、是否并入 `pnpm verify`、归一化表维护。

## 证据包

- `commands.md`、`notes.md`、`spec.md`、`payloads/`。
- 仓内交付：`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`、`TCRN-AOS/package.json`（+`parity:proof`）、`TCRN-AOS/evidence/aos-instrument-parity.json`、平台 `CLAUDE.md`（§一.6 修正）。
