# S9 commands — STORY-149 · 观测选型 spike

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S9/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S9/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S9/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S9/payloads/close.json（同法）
```

## 交付物

`docs/reports/init-018/S9/spike.md`：三候选运营成本对比表（进程数/内存/持久化依赖/月维护）+ 决策 + PoC 可执行清单（VM 姿势沿 CONF-007）。本单为研究型交付，无代码改动。

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S9/spike.md` | 对比表 + 决策 + PoC 清单 |
| `docs/reports/init-018/S9/notes.md` | 决策理由与边界 |
| `docs/reports/init-018/S9/payloads/` | 仪式载荷与回执 |
