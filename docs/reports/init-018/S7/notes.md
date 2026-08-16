# S7 notes — STORY-141 · S7 引擎行为面黄金样本

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- `adapter-generate` 与 `persona-render` 固定输入 → golden 文件（`tests/fixtures/s7-golden/`）+ `node --test` 比对（`tests/s7-behavior-surface.test.mjs`，3/3 绿，自动被仓测试套件发现）。
- 红测：persona-render 换 profile-id → 全字段变（diff exit 1）；adapter-generate 改 promptText → requestDigest/manifestDigest 全变；真实红测（临时改 inputs 的 profile-id 跑测试 → 2 红，还原 → 3 绿）已演示并存档。
- 旗标以 `commands` 实测为准：`adapter-generate --request <json>`、`persona-render --profile-id <string>`。

## 关键决策：adapter-generate 走引擎纯函数而非 CLI

`adapter-generate` 经纯 CLI 无法运行：它需要 `io.codexAdapterHost`（独立受治 host 上下文），而纯 CLI 的
operator-authority 路径默认不携带（`commands` 只声明 `--request`；host 上下文需经权威 pins 的
`admitCodexAdapterHostInput` 注册）。因此 golden 采样经**引擎导出的纯函数**（`generateCodexAdapterBundle` +
`admitCodexAdapterHostInput`，与仓内 act4/p6b 测试同一构造口径）——锁定的同样是引擎行为面，只是不经 CLI 壳。
`persona-render` 无此依赖，走真实 CLI。

## 实现说明

- 固定输入集中 `tests/fixtures/s7-golden/inputs.mjs`：生成器与测试共用，快照不会与断言漂移。
- golden 为当前引擎行为快照：行为改变时测试转红，须**有意的**行为变更才重新生成并评审 diff。
- `canonicalJson` 自带尾换行，比较统一 trim。

## 范围外观察（报审查层，不动手）

- 无。

## 证据包

- `commands.md`、`notes.md`、`red-proof/`（3 文件）。
- 仓内交付：`tests/s7-behavior-surface.test.mjs` + `tests/fixtures/s7-golden/{inputs,adapter-generate,persona-render}`。
- 链上：TCRN-CROSS-STORY-141 已置 done。
