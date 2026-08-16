# R1 notes — STORY-137 · R1 freshness 门窗口对齐

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- 默认窗口 48h → **9h**（`DEFAULT_MAX_DATA_AGE_HOURS = 9`）。
- 新增 `--max-age-hours <n>` 旗标，优先级 flag > env > default。
- 超窗退出码非 0 是既有契约（EXIT_RED=1），本故事确认未改坏。
- 活面实测绿：exit 0，age 0.37h，零 findings。
- `node --test scripts/read-face-freshness.test.mjs` 6/6 绿，含一红一绿夹具。
- 测试已接入 `package.json` `test`（INC-030 reachability：树上存在的测试必须可从脚本到达）。

## 红测结论

陈旧 -20h 夹具在默认 9h 窗口下 exit 1、verdict not-fresh、finding `served-snapshot-is-within-the-freshness-window` 命中——本门的红被真实演示过，红绿输出均存档（`outputs/`）。同一夹具 + `--max-age-hours 24` 转绿，证明旗标确实覆盖窗口。

## 实现说明

- `resolveMaxAgeHours` 改为接受 CLI 覆盖；`parsePositiveHours` 统一解析 flag/env，`null`/空串视为未给定（`Number(null)===0` 是初版漏判，测试抓出后修正）。
- 测试以子进程整跑脚本而非 mock：绿/红都是真实 HTTP 探活 + 判龄，覆盖两个载体的同戳一致性。
- 畸形 `--max-age-hours`（banana/-3/0）走既有 exit 2 路径，stdout 无 receipt（参数阶段即抛），测试断言此行为。

## 范围外观察（报审查层，不动手）

- 无。脚本注释引用的 `apps/web` 相关构建步与本改动无交叉。

## 证据包

- `commands.md`、`outputs/`（6 文件）、`payloads/`（activate.json + 回执）。
- 链上：TCRN-CROSS-STORY-137 已置 done（收口载荷见 `payloads/close.json`）。
