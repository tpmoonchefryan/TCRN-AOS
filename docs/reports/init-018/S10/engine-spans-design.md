# S10 · 引擎动词出入口 span 设计（起草 · 发布归 v0.11.0 列车）

> 执行层 agent:deepseek-v4-flash · 2026-08-05。本设计实现 `packages/cli/src/otel-spans.ts`（emitter 模块，已实现、可测）；**接线 + 重建 + 发布归审查层**（搭 v0.11.0 列车）。执行层不改 `packages/cli/src/index.ts`（避免在发布前扰动引擎）。

## 目标

引擎 103 个动词（CLI 与 MCP 门面共用 `dispatchCli`）每次派发记一条入口 + 出口 span，供 S9 选的 OTel sink 观测。隐私：sink 只收 `verb`/`outcome`/`reasonCode`，**禁任何 flag、args、载荷、链字节**。

## 接线点（审查层在 v0.11.0 执行）

`packages/cli/src/index.ts` 的 `runCli`（单一口径，覆盖 CLI 与 MCP 派发）：

```ts
export async function runCli(arguments_, io) {
  const command = arguments_[0];
  if (!command || command.startsWith("--")) fail("CLI_COMMAND_REQUIRED", "...");
  emitVerbSpan(command, "entry", io.clock());              // ← 入口 span
  try {
    await dispatchCli(arguments_, { ...io, write: ... });
    emitVerbSpan(command, "exit", io.clock());             // ← 出口 span（成功）
  } catch (error) {
    emitVerbSpan(command, "failed", io.clock(), reasonOf(error));  // ← 出口 span（拒绝/异常）
    throw error;
  }
}
```

- `io.clock()` 注入墙钟（WSE-4：库内不直接读 `new Date()`）。
- `reasonOf(error)` 取稳定 reasonCode（如 `CLI_COMMAND_REQUIRED`），不含错误正文。
- 全部经 `emitVerbSpan`（env 门控：`TCRN_OTEL_SINK` 未设则 no-op，引擎行为逐字节不变；103 动词目录与全部 hermetic 测试不受影响）。

## emitter 模块（已实现）

`packages/cli/src/otel-spans.ts`：
- `engineSinkPath()`：`TCRN_OTEL_SINK` env，未设返回 null（门控）。
- `emitVerbSpan(verb, outcome, at, reasonCode)`：JSONL append；标签仅 `span/at/verb/outcome/reasonCode`；非抛错式（sink 写失败静默，观测永不打断动词）。
- 隐私契约在 emitter 强制：字段不在 `ALLOWED_VERB_SPAN_KEYS` 即抛错。

## 验证（审查层接线后）

1. 设 `TCRN_OTEL_SINK=/tmp/v.jsonl`，跑任一动词（如 `commands`）→ sink 出现 `entry` + `exit` 两条，字段 ⊆ 允许集。
2. 不设 sink → 跑动词 → 无 span 写出、行为与基线一致。
3. 隐私自查：`node scripts/verify-otel-privacy.mjs --sink /tmp/v.jsonl --kind verb` → exit 0。

## 范围外（报审查层）

- 引擎侧 span 的 OTLP 导出（S9 选 Collector）需 sink 就位后由审查层接隧道；首版 emitter 为 JSONL，与 S9 文件 sink 同形。
- MCP 门面 `mcp.ts` 是否独立埋点（它复用 `dispatchCli`，接线点在 `runCli` 即覆盖）由审查层接线时确认。
