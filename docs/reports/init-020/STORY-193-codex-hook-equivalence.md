# STORY-193 Codex hook-surface proof

执行者：`agent:gpt-5-codex`；执行形态：single-context；宿主：Codex。

## 已落地

`tcrn-workflow/tests/qa4-codex-hook-equivalence.test.mjs` 在临时证据根上通过引擎动词族完成了：

`adapter-generate` → `adapter-install` → `adapter-validate` → `adapter-simulate` → `adapter-activation-assess` → `adapter-activation-record`。

临时根由引擎创建，`hooks.json` 未由本作业手写；生成的 persona-free `SessionStart` handler 实际被一次子进程调用，stdout 被纳入 digest-bound observation，再由 `adapter-activation-record` 记录为 `host_observed_active`。该临时根运行后已移除。

随后按同一引擎 adapter 在真实平台根完成了项目级安装：

- `.codex/hooks.json` 已生成，包含 1 个 `SessionStart`（`startup|resume`）定义；
- `.codex/tcrn-workflow/session-start.mjs` 与 `session-summary.json` 已写入当前 persona-free v2 字节；
- 激活安装回执：`STORY-193-codex-activation-installation.json`，`activationState=pending_host_approval`；
- 当前本地 handler 以真实生成字节触发一次，退出码为 0，并观察到 `SessionStart` 输出；
- 用户级 `~/.codex/config.toml` 的六条平台根陈旧 `hooks.state` 登记已按本次 Owner 指令清除，保留原始 diff 作为证据。

复核命令：

```text
pnpm --dir TCRN-AOS codex-hooks:proof
```

结果：1 test / 1 pass。

## 必须保持的边界

项目级文件已落地，但这仍不是当前 Codex Desktop 的活跃证据。当前安装回执明确是 `pending_host_approval`；还需要在 `/hooks` 中批准这一精确定义，并以新 Codex 会话验证宿主加载。没有声称当前会话已加载或新会话已触发。

用户级清理已应用；前后字节差异保存在 `STORY-193-codex-config-hooks-state.diff`。

`ssh-write-observer` 的 Codex 执行面对已显式列为 `explicitly-uncovered-residual`：Codex App Server collector 只观察通知/读回执，不调用 Claude 的 PreToolUse/Bash observer；因此不把一次 Codex 执行观察默认为安全。矩阵同步记录该残余。
