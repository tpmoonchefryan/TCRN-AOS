# R1 commands — STORY-137 · R1 freshness 门窗口对齐（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `TCRN-AOS` 仓根起。

## 环境自检（§1）

```bash
cd "<local-platform-root>"
node --version                    # v24.16.0
pnpm --version                    # 11.3.0
curl -s --max-time 5 http://192.168.51.249:4319/api/health   # {"ok":true,"service":"tcrn-aos-read",...}
cd TCRN-AOS
node deploy/aos-local-client/ceremony.mjs --payload /dev/null --dry-run   # 载荷拒收 = 通道可用
```

## 链上开工（§5 仪式，cross-project 分区）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload docs/reports/init-018/R1/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload docs/reports/init-018/R1/payloads/activate.json --partition cross-project --receipt docs/reports/init-018/R1/payloads/activate.receipt.json
```

## 代码改动

`scripts/read-face-freshness.mjs`：
- `DEFAULT_MAX_DATA_AGE_HOURS` 48 → **9**，注释更新为「两个刷新班次 + 一小时」，引用 INC-051 实测 7.23h 陈旧判 fresh。
- `parseArguments` 新增 `--max-age-hours <n>` 与 `--max-age-hours=<n>` 两种形式；未知参数报错仍 exit 2。
- 新增 `parsePositiveHours`，`resolveMaxAgeHours(env, cliOverride)` 优先级：**flag > env > default**（flag 命名 `maxAgeSource: "flag:--max-age-hours"`）。
- 超窗 verdict `not-fresh` + 退出码 1 是既有行为，未改（本故事确认它仍在）。

新增文件：
- `scripts/lib/freshness-fixture-server.mjs` — 本地 read face 替身，按 `--offset-hours` 供一份同戳的 bundle+shell+health；可独立启动。
- `scripts/read-face-freshness.test.mjs` — 6 个 `node --test` 用例，以子进程跑整脚本（绿/红/flag 覆盖/flag 优先/env 覆盖/畸形参数 exit 2）。

`package.json`：`test` 脚本追加 `scripts/read-face-freshness.test.mjs`（INC-030 reachability）。

## 测试（红绿夹具）

```bash
cd "<local-platform-root>/TCRN-AOS"
node --test scripts/read-face-freshness.test.mjs          # 6/6 pass
```

## 活面验证（应绿）

```bash
node scripts/read-face-freshness.mjs
# exit 0 · verdict fresh · maxAgeHours 9 · ageHours ~0.37 · findings []
```

## 红测（陈旧时间戳夹具）

```bash
node scripts/lib/freshness-fixture-server.mjs --port 4398 --offset-hours -20   # 起 fixture
AOS_READ_FACE_URL=http://127.0.0.1:4398 node scripts/read-face-freshness.mjs
# exit 1 · verdict not-fresh · 20.00h past 9h · finding served-snapshot-is-within-the-freshness-window
```

## flag 覆盖（红转绿）

```bash
AOS_READ_FACE_URL=http://127.0.0.1:4397 node scripts/read-face-freshness.mjs --max-age-hours 24
# exit 0 · verdict fresh · maxAgeSource "flag:--max-age-hours"
```

## 归档输出（R1/outputs/）

| 文件 | 内容 |
| --- | --- |
| `live-default-green.json` | 活面 exit 0，默认 9h，verdict fresh |
| `fixture-stale-red.json` / `.exit` / `.stderr` | 陈旧 -20h 夹具，exit 1，not-fresh |
| `fixture-stale-flag24-green.json` / `.exit` | 同夹具 + `--max-age-hours 24`，exit 0，fresh |
| `test-output.txt` | `node --test` 6/6 绿输出 |
