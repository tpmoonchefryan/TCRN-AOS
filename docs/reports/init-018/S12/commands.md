# S12 commands — STORY-142 · S12 回放基准（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `tcrn-workflow` 仓根起。
合成工作区与结果默认落在 scratch base（OS 临时目录，不在任何仓库内）。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S12/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S12/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S12/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S12/payloads/close.json（同法）
```

## S12.1 — 合成链生成器（仅经引擎公开 CLI）

```bash
cd "<local-platform-root>/tcrn-workflow"
B=<local-private-tmp>/claude-501/<local-project-dir>/f176a613-8a18-4330-8ef7-91d8ca65e63c/scratchpad/s12-bench
node scripts/bench/synthesize-chain.mjs --events 3000 --base-dir "$B"     # 3k
node scripts/bench/synthesize-chain.mjs --events 10000 --base-dir "$B"    # 10k
```

生成器只用 `init / project-create / work-create / work-transition` 四个引擎动词，每个事件一次 CLI 调用；
`--expected-version` 从前一次调用返回的 version 链式推进（CAS 非猜）。工作层次遵循引擎 parent-kind 映射
（Initiative→Epic→Story→Subtask），每事件一个虚拟秒（小时级进位，10k 链约 2.8h 虚拟时间）。
输出 `<base>/synthesized-<n>.json`（workspace 路径 + 事件数）。

## S12.2 — 回放基准

```bash
node scripts/bench/bench-replay.mjs --workspace "$B/ws-3000/workspace" --label 3000 --out-dir docs/reports/init-018/S12
node scripts/bench/bench-replay.mjs --workspace "$B/ws-10000/workspace" --label 10000 --out-dir docs/reports/init-018/S12
```

每个只读动词（status/validate/export/work-list）跑 5 次取中位墙钟；输出 json + md 表。
拒绝的动词记 `FAILED <reasonCode>`（stderr 解析），其计时是拒绝本身的墙钟。基准只跑合成链，**禁对 VM 活链跑**。

## 3k 结果（实测）

| verb | median ms | verdict |
| --- | --- | --- |
| status | 363 | ok |
| validate | 397 | ok |
| export | 421 | **FAILED INPUT_OVERSIZED**（1 MiB canonical 上限） |
| work-list | 401 | ok |

## 10k 尝试 → 撞引擎写上限（核心发现）

```bash
node scripts/bench/synthesize-chain.mjs --events 10000 --base-dir "$B"
# work-create 在版本 3354（3353 条 work 记录）报 INPUT_OVERSIZED: Canonical input exceeds one MiB
# → 10k 事件工作区无法经引擎写动词构建（物化 index 超 1 MiB 协议上限）
node scripts/bench/bench-replay.mjs --workspace "$B/ws-10000/workspace" --label 10k-ceiling --out-dir docs/reports/init-018/S12
# status 440ms ok；validate/export/work-list 全 FAILED INPUT_OVERSIZED
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `S12/bench-3000.json` / `.md` | 3k 链基准（3157 work 记录） |
| `S12/bench-10k-ceiling.json` / `.md` | 10k 部分链基准（3353 work 记录，撞顶） |
| `S12/commands.md` / `notes.md` | 本文件 / 结论与 S12.3 判定草案 |
| scratchbase `synthesized-3000.json` / `synthesized-10000.log` | 合成摘要 / 10k 失败日志 |
