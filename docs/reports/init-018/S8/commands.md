# S8 commands — STORY-148 · 行为套件接线（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `tcrn-workflow` 仓根起。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S8/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S8/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S8/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S8/payloads/close.json（同法）
```

## 一、确定性子集挂每 push CI

S7 黄金样本（`tests/s7-behavior-surface.test.mjs`）经 `test` 步自动发现（p1 序列含 `test`，通配 `tests/*.test.mjs`）；S6 离线断言经新增 CI 步骤显式挂载：

```bash
cd "<local-platform-root>/tcrn-workflow"
node scripts/verify-s6.mjs; echo $?   # 0 → EVAL_GREEN 6/6（CI 步骤 node scripts/verify-s6.mjs 同命令）
```

`.github/workflows/ci.yml` 新增步骤：`Verify S6 lessons deterministic subset` → `run: node scripts/verify-s6.mjs`，紧接 `Verify P1 offline`。`verify:ci` 加固断言复验：`node scripts/task.mjs ci` → `CI_HARDENING_VERIFIED`。

## 二、含模型调用全量挂 release 门 + 手动脚本（key 留接口）

```bash
# 手动脚本（release 门）：无 key fail-closed（exit 2）
node scripts/eval-s6-full.mjs; echo $?   # 2 → S6_FULL_API_KEY_MISSING
# release 门前审查层注入 key 后运行
S6_EVAL_API_KEY=<key> node scripts/eval-s6-full.mjs --out docs/reports/init-018/S8/outputs/full-metrics.json; echo $?
```

- 配置接口：`tests/promptfoo/s6-lessons/s6-models.yaml`（provider `anthropic:…` + `apiKeyEnvar: S6_EVAL_API_KEY`，模型 id 由审查层在 release 门前钉实）。
- `ci.yml` 新增 `release-eval` job（仅 `workflow_dispatch`，绝不随 push 触发），key 从 `secrets.S6_EVAL_API_KEY` 注入。
- pnpm 脚本：`pnpm verify:s6`（=node scripts/verify-s6.mjs）、`pnpm eval:s6:full`（=node scripts/eval-s6-full.mjs）。

## 三、红测（临时退化样本证 CI 能红，演示后撤下）

```bash
# 用 node 原子地：退化 L1 样本 → 跑 CI 同命令 → 恢复 → 再跑（存档于 outputs/ci-red-proof.json）
node -e '<见 notes.md 红测小节的可复现脚本>'
# 实测：RED exit=1 EVAL_NOT_GREEN 5/1；恢复后 GREEN exit=0 EVAL_GREEN 6/6；restored-identical=true
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S8/outputs/ci-red-proof.json` | 红测存档：退化样本 → 红 → 恢复 → 绿 |
| `docs/reports/init-018/S8/payloads/` | 仪式载荷与回执 |
| `scripts/verify-s6.mjs` | 确定性子集门（本地/CI 同一命令） |
| `scripts/eval-s6-full.mjs` | 全量 release 门脚本（fail-closed） |
| `tests/promptfoo/s6-lessons/s6-models.yaml` | 全量套件 provider 接口（key 不落仓） |
