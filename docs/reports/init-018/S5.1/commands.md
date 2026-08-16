# S5 commands — STORY-140 · S5 promptfoo 采纳（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `tcrn-workflow` 仓根起。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S5.1/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S5.1/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S5.1/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S5.1/payloads/close.json（同法）
```

## S5.1 — 包元数据（防幻觉包名审查）

```bash
cd "<local-platform-root>/tcrn-workflow"
npm_config_offline=false npm view promptfoo name version license maintainers
# 项目 .npmrc 默认 offline=true，registry 查询需单命令覆盖（network 可达，curl 200 实测）
# name=promptfoo · version=0.121.20 · license=MIT · 5 maintainers
```

## S5.2 — 安装 + 离线 echo smoke

```bash
pnpm add -D promptfoo@0.121.20
node_modules/.bin/promptfoo --version                     # 0.121.20
PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_UPDATE_CHECK=1 \
  node_modules/.bin/promptfoo eval -c docs/reports/init-018/S5.2/promptfooconfig.yaml \
  -o docs/reports/init-018/S5.2/smoke-results.json
# [PASS] Echo back exactly: deterministic-smoke · 1/1 · 无 API key · 无网络模型调用
```

配置 `docs/reports/init-018/S5.2/promptfooconfig.yaml`：`providers: [echo]` + 一条确定性 `contains` 断言。

## S5.3 — 护栏（并发 ≤2、断言上限）+ 运行指标

```bash
node scripts/promptfoo-eval.mjs \
  --config docs/reports/init-018/S5.2/promptfooconfig.yaml \
  --out docs/reports/init-018/S5.3/run-metrics.json
# EVAL_GREEN · maxConcurrency 2 · assertions 1 · passed 1 · exit 0
```

红测（断言上限）：

```bash
node scripts/promptfoo-eval.mjs --config /tmp/promptfoo-overcap.yaml --out docs/reports/init-018/S5.3/red-cap-metrics.json
# 250 断言 > 200 上限 → ASSERTION_CAP_EXCEEDED · 运行前拒绝 · exit 2
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `S5.1/npm-view-raw.txt` | npm view 原始输出 |
| `S5.1/notes.md` | 选定版本 0.121.20 与理由（防幻觉包名审查） |
| `S5.2/promptfooconfig.yaml` | 最小 echo provider 配置 |
| `S5.2/smoke-results.json` | 离线 smoke 结果（1/1 pass） |
| `S5.3/run-metrics.json` | 护栏运行指标（EVAL_GREEN） |
| `S5.3/red-cap-metrics.json` | 断言上限红测（拒绝） |
