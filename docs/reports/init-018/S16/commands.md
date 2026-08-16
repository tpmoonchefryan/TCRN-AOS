# S16 commands — STORY-153 · 代际复审（S16.1/S16.2 可重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S16/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S16/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S16/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S16/payloads/close.json（同法）
```

## 交付物

`docs/reports/init-018/S16/catalog.md`：S16.1 编目（A 公约 6 / B 门 11 / C hook 4 / D 约束 14，来源列全）+ S16.2 三档起草（仍在 15 / 已消失 1 / 条件化 4）。S16.3 终稿归审查层。

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S16/catalog.md` | 编目 + 三档起草（提案非删除） |
| `docs/reports/init-018/S16/notes.md` | 说明 |
| `docs/reports/init-018/S16/payloads/` | 仪式载荷与回执 |
