# STORY-194 Codex stop-pact 对等物

执行者：`agent:gpt-5-codex`；执行形态：single-context；宿主：Codex。

已落地 `tcrn-workflow/tools/stop-pact/codex-executor.mjs`。它是宿主适配层，不
是第二份 stop-pact：读取 Claude 侧同一个 `~/.claude/stop-pact/current.json`
（测试以 `TCRN_STOP_PACT_PATH` 注入临时路径），调用同一个 `decide.mjs`，并用
同一个 `pact.mjs` 的 `readPact` / `writePact` / `withRuntime` 更新计数和会话
绑定。

判据对齐：

- 工作状态来自共享 pact 的 `status`，不接受 Codex 事件自供的第二份状态；
- 缺少 session、时间或工作增量时放行且不写 pact；
- 模型缺失、`unknown`、`unavailable`、`redacted` 等不可识别值走 `observe`；
- 已识别的非旗舰模型才可能进入 `enforce`，仍受同一运行状态、并行会话隔离、
  TTL 和无进展释放阀约束；
- 任意异常返回机器可读 allow，不能把 Codex 会话锁死。

复核命令：

```text
pnpm --dir tcrn-workflow verify:stop-pact:codex
```

结果：5 test / 5 pass；覆盖共享状态、缺信息放行、未知模型 observe、工作状态
判定、运行计数/绑定、并行会话隔离和 stdin 桥 fail-open。

宿主差异：Codex 没有 Claude Code 的 Stop 事件，本文件只提供可由未来/当前
Codex stop-event bridge 调用的执行器，不声称当前 Codex Desktop 已加载或触发
它。`ssh-write-observer` 仍只观察 Claude PreToolUse/Bash；Codex App Server
execution collector 是 read-only 且不调用该 observer，因此这条执行面被矩阵
标作 `explicitly-uncovered-residual`，没有默认安全推断。
