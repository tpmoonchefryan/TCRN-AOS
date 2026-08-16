# S7 commands — STORY-141 · S7 引擎行为面黄金样本（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `tcrn-workflow` 仓根起。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S7/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S7/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S7/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S7/payloads/close.json（同法）
```

## 旗标实测（不要猜）

```bash
node scripts/tcrn-workflow.mjs commands
# adapter-generate: --request <json> (required, json) · mutates=false
# persona-render:   --profile-id <string> (required)     · mutates=false
```

## 固定输入（生成器与测试共用）

`tests/fixtures/s7-golden/inputs.mjs` — adapter-generate 的固定 request+host 构造（复用 act4 fixture 口径：
`contextResult()` 完整上下文路由结果 + `adapterHost()` 经 `admitCodexAdapterHostInput` 注册），persona-render 固定
`profile:tcrn-mneme-v1`。这是 golden 快照与测试断言共用的唯一输入源。

## 生成 golden（当前引擎行为快照）

```bash
cd "<local-platform-root>/tcrn-workflow"
# adapter-generate（经引擎纯函数，CLI 无默认 host 上下文，见 notes）
node --input-type=module -e '
import { generateCodexAdapterBundle } from "./dist/build/packages/core/src/index.js";
import { canonicalJson } from "./dist/build/packages/protocol/src/index.js";
import { adapterRequest, adapterHost } from "./tests/fixtures/s7-golden/inputs.mjs";
import { writeFileSync } from "node:fs";
writeFileSync("tests/fixtures/s7-golden/adapter-generate.json",
  canonicalJson(generateCodexAdapterBundle(adapterRequest(), adapterHost(adapterRequest()))));
'
# persona-render（经 CLI）
node scripts/tcrn-workflow.mjs persona-render --profile-id profile:tcrn-mneme-v1 > tests/fixtures/s7-golden/persona-render.json
```

## 黄金比对测试

```bash
node --test tests/s7-behavior-surface.test.mjs    # 3/3 pass
# 自动被 scripts/task.mjs test 发现（tests/*.test.mjs 通配）
```

## 红测（故意改一处输入证明能红）

```bash
# persona-render：换 profile-id → 全字段变（diff exit 1）
node scripts/tcrn-workflow.mjs persona-render --profile-id profile:tcrn-verity-v1 > docs/reports/init-018/S7/red-proof/persona-tampered.json
diff tests/fixtures/s7-golden/persona-render.json docs/reports/init-018/S7/red-proof/persona-tampered.json   # exit 1
# adapter-generate：改 promptText → requestDigest/manifestDigest 全变
# 实测：临时把 inputs.mjs 的 PERSONA_PROFILE_ID 改成 profile:tcrn-verity-v1 → node --test 2 红；还原 → 3 绿
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `tests/fixtures/s7-golden/adapter-generate.json` | adapter-generate golden（manifestDigest 6743c754…） |
| `tests/fixtures/s7-golden/persona-render.json` | persona-render golden（mneme） |
| `tests/fixtures/s7-golden/inputs.mjs` | 共享固定输入 |
| `tests/s7-behavior-surface.test.mjs` | 黄金比对测试（3 用例） |
| `docs/reports/init-018/S7/red-proof/` | 红测证据（persona-tampered/diff + adapter-tampered + 摘要） |
