# S6 commands — STORY-147 · 教训场景库（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `tcrn-workflow` 仓根起。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S6/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S6/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S6/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S6/payloads/close.json（同法）
```

## 实现载体（仓内持久资产）

| 文件 | 内容 |
| --- | --- |
| `tests/promptfoo/s6-lessons/lessons-spec.md` | 起草规格：6 条教训 given-when-then + rubric + 来源（判断型交付物） |
| `tests/promptfoo/s6-lessons/s6-provider.mjs` | 离线确定性 provider（返回 `vars.agentDecision`，无网络/API key/模型调用） |
| `tests/promptfoo/s6-lessons/s6-lessons.yaml` | 绿配置：6 条正确行为，断言全绿 |
| `tests/promptfoo/s6-lessons/s6-red-proof.yaml` | 红证明配置：6 条反模式，断言全红 |

## 绿跑（正确行为 → EVAL_GREEN exit 0）

```bash
cd "<local-platform-root>/tcrn-workflow"
node scripts/promptfoo-eval.mjs --config tests/promptfoo/s6-lessons/s6-lessons.yaml \
  --out docs/reports/init-018/S6/outputs/run-metrics.json
echo $?   # 0
```

## 红证明（故意答错样本 → EVAL_NOT_GREEN exit 1）

```bash
node scripts/promptfoo-eval.mjs --config tests/promptfoo/s6-lessons/s6-red-proof.yaml \
  --out docs/reports/init-018/S6/outputs/red-metrics.json
echo $?   # 1
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S6/outputs/run-metrics.json` | 绿：6/6 passed，EVAL_GREEN，exit 0 |
| `docs/reports/init-018/S6/outputs/red-metrics.json` | 红：0 passed / 6 failed，EVAL_NOT_GREEN，exit 1 |
| `docs/reports/init-018/S6/payloads/` | 仪式载荷与回执 |
