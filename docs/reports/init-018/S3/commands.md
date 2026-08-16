# S3 commands — STORY-145 · 仪器名册 parity:proof（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S3/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S3/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S3/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S3/payloads/close.json（同法）
```

## 绿跑（PARITY_VERIFIED）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/parity-proof.mjs; echo $?   # 0
pnpm parity:proof; echo $?                                 # 同（入 proof 家族）
```

## 红证（in-memory，随绿跑一并执行）

- RED A：注入假服务器 `codegraph-xyz` → 红，点名 `codegraph-xyz`。
- RED B：去掉 `codegraph-ds` 白名单豁免 → 红，点名 `codegraph-ds`。
- 两条红都随 `node deploy/aos-local-client/parity-proof.mjs` 的 `reds` 字段输出；`unmetExpectations` 空即通过。

## 证据 emit

```bash
node deploy/aos-local-client/parity-proof.mjs --emit   # 写 evidence/aos-instrument-parity.json（scrubHostPaths 清洗）
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `tcrn-workflow/docs/reports/init-018/S3/spec.md` | 判断型规格（起草稿，待终审） |
| `TCRN-AOS/evidence/aos-instrument-parity.json` | parity 全量证据（绿 + 两条红 + 观测行） |
| `TCRN-AOS/deploy/aos-local-client/parity-proof.mjs` | parity 判据实现 |
| `TCRN-AOS/package.json` | +`parity:proof` |
| 平台 `CLAUDE.md` | §一.6「workflow-MCP 两侧未接」过时句修正 |
