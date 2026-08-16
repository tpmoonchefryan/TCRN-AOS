# S10 commands — STORY-150 · 埋点

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S10/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S10/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S10/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S10/payloads/close.json（同法）
```

## ceremony 四点 span（已实现 + 测试）

```bash
cd "<local-platform-root>/TCRN-AOS"
rm -f /tmp/s10-spans.jsonl
TCRN_OTEL_SINK=/tmp/s10-spans.jsonl node deploy/aos-local-client/ceremony.mjs --payload <任意载荷> --partition cross-project --dry-run
cat /tmp/s10-spans.jsonl   # 期望 ceremony.start + ceremony.end（或 ceremony.refused）
```

- 实现：`deploy/aos-local-client/ceremony-spans.mjs`（emitter）+ `ceremony.mjs` 四处接线（start 入口 / end 收口 / readback 每次回读 / refused 各拒绝点）。
- 实测：dry-run 出 start+end（CEREMONY_PLANNED_ONLY）；无效载荷出 start+refused（PAYLOAD_INVALID）；字段仅 partition/verb/expectedVersion/outcome/reasonCode。

> **订正（2026-08-05，核验层 · INC-038）：上面这条重跑配方证不出 `ceremony.readback`。**
> `--dry-run` 在 readback 循环里于 `ceremony.mjs:237-239` 就 `continue` 了，而 readback span 的
> emit 在同一循环末尾的 `ceremony.mjs:274`——两条归档路径（dry-run、无效载荷）都到不了它。
> 所以本节只证了 start / end / refused 三点。要证第四点必须跑一次**真实**仪式
> （受治写，须走 §5 仪式通路），本配方不含该路径。详见 `notes.md` 的订正块。

## 引擎动词 span（emitter 已实现；接线归 v0.11.0 列车）

```bash
cd "<local-platform-root>/tcrn-workflow"
# emitter 模块：packages/cli/src/otel-spans.ts（env 门控 TCRN_OTEL_SINK，默认关）
# 设计文档：docs/reports/init-018/S10/engine-spans-design.md（runCli 接线点，审查层执行）
```

## 隐私自查（sink 无链内容）

```bash
node scripts/verify-otel-privacy.mjs --sink /tmp/s10-spans.jsonl --kind ceremony   # 0 → PRIVACY_SINK_CLEAN
node scripts/verify-otel-privacy.mjs --sink <含 payload 键的记录> --kind ceremony   # 1 → PRIVACY_SINK_VIOLATION 点名
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `TCRN-AOS/deploy/aos-local-client/ceremony-spans.mjs` | ceremony span emitter（隐私契约 + 非抛错） |
| `TCRN-AOS/deploy/aos-local-client/ceremony.mjs` | +4 类 span 接线 |
| `tcrn-workflow/packages/cli/src/otel-spans.ts` | 引擎 verb span emitter（env 门控，待接线） |
| `tcrn-workflow/docs/reports/init-018/S10/engine-spans-design.md` | 引擎接线设计（runCli 点，发布归审查层） |
| `tcrn-workflow/scripts/verify-otel-privacy.mjs` | 隐私自查（红绿双证） |
