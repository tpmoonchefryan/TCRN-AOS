# S6 notes — STORY-147 · 教训场景库

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- 起草规格 `tests/promptfoo/s6-lessons/lessons-spec.md`（判断型：执行层起草 → 核验层复核 → 审查层终审；本单交付=提案与实现，终稿与采纳归审查层）。
- promptfoo 实现 6 条教训：绿配置 6/6 通过；红证明配置 6/6 失败（反模式被 rubric 捕获）。红绿两份 metrics 存档。
- 全程离线：本地 JS provider（`s6-provider.mjs`），无 API key、无模型调用、无网络。

## 六条教训与来源（详见 spec）

1. L1 上下文将满不收尾 → `context-limit-is-not-a-reason-to-stop`
2. L2 ARCHIVE_LIMIT_EXCEEDED 先核对对象 → `helper-trust-state-unreleased`（2026-08-04 重钉实测）
3. L3 IDENTITY_MISMATCH 先分诊两型 → `helper-trust-state-unreleased`（2026-07-23 例）
4. L4 push 后主动查 CI → `local-green-is-not-ci-green`
5. L5 索引工具先验新鲜度 → 平台 CLAUDE.md §一.3 + `codegraph-deployment`
6. L6 到没到远端问 ls-remote → 平台 CLAUDE.md §一.4 / tcrn-workflow CLAUDE.md §4

## 实现说明

- promptfoo 0.121.20 的 JS 文件 provider 接口：模块默认导出须是**类**（构造调用），实例需 `id()` 与 `callApi(prompt, context)`（返回 `{output}`）。初版写成纯函数报 `(intermediate value) is not a constructor`；补类 + `id()` 后绿。这是本仓 promptfoo 接入的第二个 provider 形态（echo 之外），已录入本 notes 备 S8 复用。
- provider 经 `context.vars.agentDecision` 取罐头决策；绿/红纯数据驱动，同一组 rubric 断言。

## 范围外观察（报审查层，不动手）

- `scripts/promptfoo-eval.mjs` 的 metrics 把 `provider` 字段**硬编码**为 `"echo (offline, no API key)"`。S6 实际用的是本地 JS provider（`s6-provider.mjs`），字段名不符（纯标签性，不影响判定）。建议：由配置文件推导 provider 标签，或改为通用中性标签。

## 证据包

- `commands.md`、`notes.md`、`outputs/run-metrics.json`、`outputs/red-metrics.json`、`payloads/`。
- 仓内持久资产：`tests/promptfoo/s6-lessons/`（spec + provider + 绿/红配置）。
