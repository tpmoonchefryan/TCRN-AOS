# S4 commands — STORY-146 · Codex 名册缺口（S4.1 可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S4/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S4/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S4/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S4/payloads/close.json（同法）
```

## 生成增量 diff（只出文件，不应用）

```bash
cd "<local-platform-root>/tcrn-workflow"
# 复现：读 ~/.codex/config.toml → 在 [mcp_servers.codegraph] 块后插入 codegraph-ds/aos 两块 →
# diff -u 原版 vs 修改版 → scrubbed 落 docs/reports/init-018/S4/codex-config-incremental.diff
# 生成脚本见 notes.md 的构造要点；diff 已存档，无需重跑。
```

## 待门（S4.2 归审查层）

应用 diff → `codex` 会话实测三服务器 → `pnpm --dir TCRN-AOS parity:proof` 白名单收缩。

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S4/codex-config-incremental.diff` | `~/.codex/config.toml` 增量 diff（scrubbed） |
| `docs/reports/init-018/S4/notes.md` / `commands.md` | 说明与重跑 |
| `docs/reports/init-018/S4/payloads/` | 仪式载荷与回执 |
