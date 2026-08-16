# STORY-165.1 晋级判据 —— enforce 切换成文(观察窗自 2026-08-05 重置起算)

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1
红线:**不得引用观察窗重置前的数据**(165.3);**必须排除 `probe:true` 记录**(门自身流量)。

## 观察窗

- 起点:2026-08-05(本单签发日)。
- 时长:连续 **7 天**(至 2026-08-12 评估)。期间观察器以 observe 模式持续运行
  (`tcrn-workflow/scripts/ssh-write-observer.mjs`,经 PreToolUse hook 注入)。
- 窗口终点评估一次;够不够都照写结论。

## 探针排除规则

- 观察器自带的 `--self-test`、`--classify`、`--verify-channel` 流量以及本仓库 CI/verify 对观察器的调用
  均记为 `probe:true`,**不计入误报**。
- 判定「零误报」只统计**真实 agent 会话**里 PreToolUse hook 判 HIT 的记录,且必须排除 `probe:true`。

## 零误报的可证形态

1. **排除探针后零 HIT**:窗口内非探针 HIT 记录数为 0(此时可读作「零误报」——没有任何真实命令被错标)。
2. **或全部 HIT 均可归因**:若存在非探针 HIT,逐条核对是否属真实 SSH 直驱引擎违规(判对了)或误标(误报)。
  只有全部为「判对了」才够晋级;任一误标 → 不晋级,记录误标样例。
3. **活性门同时为绿**:`pnpm --dir tcrn-workflow verify:observe-channel` exit 0——
  空日志只有在活性门绿时才可读作「零命中」,否则读作「观察通道断了」,不晋级。
4. **统一巡检绿**:`projection-freshness:proof` exit 0(观察器所依赖的宿主环境无陈旧侧车)。

## 切换与回退(165.2)

- 切换:观察器 enforce 开关(将 HIT 从「记录」改为「拦截」)。拦截判据与 observe 完全同一入口(同一 classify)。
- 回退路径:enforce 开关拨回 observe 即可;切换与回退各记一次,留痕在 `S165/outputs/`。

## 生效证据(165.2 完成后)

- 切换后拦截一次真实 SSH 直驱引擎命令(喂真实输入,reason code 可见),再回退,回退后观察器恢复 observe。
