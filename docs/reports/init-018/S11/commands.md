# S11 commands — STORY-151 · 成本归因

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S11/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S11/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S11/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S11/payloads/close.json（同法）
```

## parser

```bash
cd "<local-platform-root>/tcrn-workflow"
node scripts/token-attribution.mjs --file ~/.claude/projects/<local-project-dir>/<session>.jsonl
node scripts/token-attribution.mjs --dir ~/.claude/projects/<local-project-dir> --match INIT-018
# gap 如实标注(unparseable/missingUsage/missingModel/incompleteUsage),禁静默上限
```

## 首份报表

`docs/reports/init-018/S11/report.md`：三层流水线成本表（INIT-018 样本 6 会话）+ 关联规则 + 读数 + 缺口如实标注。数据 `init018-attribution.json`。

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `scripts/token-attribution.mjs` | host 会话 JSONL token 解析器 |
| `docs/reports/init-018/S11/report.md` | 首份报表（三层成本） |
| `docs/reports/init-018/S11/init018-attribution.json` | 原始聚合数据 |
| `docs/reports/init-018/S11/payloads/` | 仪式载荷与回执 |
