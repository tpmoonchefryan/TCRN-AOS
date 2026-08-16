# STORY-168 收口 —— 统一运行者

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 回收与失败通知写在起手同一处;失败不许静默(INC-032) |
| 文件指针 | `TCRN-AOS/deploy/aos-resident-cockpit/platform-runner.mjs`(新建)、`com.tcrn.platform-runner.plist`(新建);`~/Library/LaunchAgents/`(加载) |
| 验证命令 | `node deploy/aos-resident-cockpit/platform-runner.mjs` → 全门退出码落日志;`launchctl kickstart` 真触发 |
| 收口动作 | 一个 timer 跑全部门(投影巡检/owner 队列/inject 通道),失败留痕可见 |
| 生效证据命令 | `launchctl kickstart gui/$(id -u)/com.tcrn.platform-runner` 真触发,日志末次 `failed: []` |

## 实测记录

- 运行者 `platform-runner.mjs`:三门(projection-freshness / owner-queue / inject-channel)逐门跑,
  退出码写 `<platform>/var/tcrn-observe/platform-runner.log`(可见、非静默);子进程超时上限 120s(回收与 spawn 同处)。
- owner-queue 的 exit 1 是**提醒语义**(167.3),记为 `expected non-zero`,不算运行者失败。
- launchd plist:显式 PATH(nvm node,INC-032 的 exit-127 教训)、StartInterval 3600s、RunAtLoad。
- **168.3 真触发**:`launchctl load` + `launchctl kickstart`(非手跑)→ 日志出现 15:26:12-13 触发行,
  整体结果 `failed: []`(exit 0)。

## 已提交
- 运行者 + plist(AOS 仓);`~/Library/LaunchAgents/com.tcrn.platform-runner.plist` 已加载(系统侧)。
