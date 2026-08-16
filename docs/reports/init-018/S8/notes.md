# S8 notes — STORY-148 · 行为套件接线

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- **确定性子集挂每 push CI**：S7 黄金样本在 p1 `test` 步自动发现（实测 3/3 绿）；S6 离线断言经新增 CI 步骤 `Verify S6 lessons deterministic subset` → `node scripts/verify-s6.mjs` 显式挂载（实测 6/6 EVAL_GREEN exit 0）。`verify:ci` 复验通过（CI_HARDENING_VERIFIED）。
- **含模型调用全量挂 release 门 + 手动脚本**：`scripts/eval-s6-full.mjs`（无 key fail-closed exit 2）+ `tests/promptfoo/s6-lessons/s6-models.yaml`（provider 接口，`apiKeyEnvar: S6_EVAL_API_KEY`）+ `ci.yml` `release-eval` job（仅 workflow_dispatch）。真实 key 配置留接口归审查层，脚本不落 key。
- **红测**：临时退化 L1 样本 → `node scripts/verify-s6.mjs`（=CI 同命令）EVAL_NOT_GREEN exit 1（5 passed / 1 failed）；恢复后 EVAL_GREEN exit 0。存档 `outputs/ci-red-proof.json`。演示后样本已撤下，`s6-lessons.yaml` 与仓内一致（restored-identical=true）。

## 实现说明

- `pnpm run` 会做隐式依赖新鲜度检查，本机 offline 下想拉 `@openai/codex` darwin-arm64 二进制而卡死（npmmirror 不可达）。CI 步骤改直跑 `node scripts/verify-s6.mjs` 规避 pnpm 层；CI 的 `pnpm install --frozen-lockfile --config.offline=false` 先物化依赖（有网），无此问题。
- `verify:ci` 对 ci.yml 的加固断言全部是 `includes` 型，新增步骤与 job 不破坏（实测 CI_HARDENING_VERIFIED）。
- 红测脚本要可复现：原子地「改 → 跑 → 恢复 → 跑」，任何一步失败都不会留下被改的配置（本次实测 restored-identical=true）。
- release-eval job 未实测（禁 push，且无 key）；其底层 `eval-s6-full.mjs` 的 fail-closed 路径已实测（exit 2）。

## 范围外观察（报审查层，不动手）

1. **`pnpm run` 隐式安装检查的离线陷阱**：offline=true 下 `pnpm run <script>` 若 node_modules 与 lockfile 有细微差异（如平台专属二进制未取），会尝试联网解析并卡住/重试。建议 pnpm 侧或 CI 侧文档化「本地跑脚本直用 `node scripts/…`」。
2. **release-eval job 需要审查层配置 `S6_EVAL_API_KEY` secret**：未配置时该 job fail-closed（脚本 exit 2），不会静默放行。

## 证据包

- `commands.md`、`notes.md`、`outputs/ci-red-proof.json`、`payloads/`。
- 仓内改动：`.github/workflows/ci.yml`（+步骤 +release-eval job）、`scripts/verify-s6.mjs`（新）、`scripts/eval-s6-full.mjs`（新）、`tests/promptfoo/s6-lessons/s6-models.yaml`（新）、`package.json`（+`verify:s6`/`eval:s6:full`）。
