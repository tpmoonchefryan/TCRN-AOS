# S2 notes — STORY-144 · SSH 写启发式

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- **判断型规格起草**：`docs/reports/init-018/S2/spec.md`（危险模式 + 豁免 + 判定 + 接线 + 验证 + 待审查层项）。终审与 enforce 切换归审查层（MIN-058）。
- **matcher 实现**：`scripts/ssh-write-observer.mjs`，observe 模式（只记日志不拦，恒 exit 0）。
- **接线**：`tcrn-workflow/.claude/settings.json` PreToolUse hook（matcher Bash → `node scripts/ssh-write-observer.mjs`），原 S1.2 deny 规则保留（4 条）。
- **自检**：21 样例（10 HIT + 11 PASS）0 mismatch，exit 0。
- **红测**：临时删 `\brm\b` 判定规则 → self-test 红（1 mismatch）→ 还原 → 绿；restored-identical=true。

## 实现说明

- 第一版 `SSH_WRITE_PRIMITIVE` 裸词无前导 `\b`，`rm\b` 误匹配 "platform" 里的 "rm"（`platform-` 后接 `-` 构成词界）→ 3 条只读 ssh 命令被误报 HIT。修复为前导 `\b` 后 21/21 绿。这是一次真实的「先自检再接线」捕获——若直接上 hook 会污染观察日志。
- hook 模式经 stdin JSON 实测：HIT 落日志、PASS 不落、恒 exit 0（不拦）。
- 判定为命令级、保守：不解析脚本内部 rsync；`node scripts/ship-web.mjs` 不展开。ssh + 治理路径 + 写原语同现即 HIT（observe 期宁多不少）。

## 待审查层（判断型终审项，见 spec.md「待审查层」）

1. enforce 切换（输出 deny 阻断）；2. rsync pull/push 方向收窄；3. 多仓传播；4. 观察日志误报复核。

## 证据包

- `commands.md`、`notes.md`、`spec.md`、`self-test.json`、`red-proof.json`、`observed-hits.log`、`payloads/`。
- 仓内改动：`scripts/ssh-write-observer.mjs`（新）、`.claude/settings.json`（+hook）、`docs/reports/init-018/S2/`。
