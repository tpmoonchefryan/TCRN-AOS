# STORY-167 收口 —— 待 Owner 队列

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 不许把队列写成散文——必须从链和仓里取数 |
| 文件指针 | `tcrn-workflow/scripts/owner-queue.mjs`(新建) |
| 验证命令 | `node tcrn-workflow/scripts/owner-queue.mjs` → 从链取 blocked 项 + 声明项,exit 非空=1 |
| 收口动作 | 一条命令渲染队列;判据=非空即提醒 |
| 生效证据命令 | 当前队列跑一次,列出 ≥INC-041 四件代办 + 发布必停点 |

## 实测记录

- 队列 9 行:4 条链上 `blocked` 工作项(EPIC-025 / STORY-075/073/074)+ INC-041 四件代办(S4.2 Codex diff / STORY-144 enforce / S154 archify / otel-spans)+ 发布必停点。
- 数据源:链(经 MCP 只读面 `work-list status=blocked`)+ 声明(INC-041 代办与发布必停点,来自 BRIEFING 第 7 节)。
- 判据:`OWNER_QUEUE_NONEMPTY_REMIND` → exit 1(非静默提醒);168 运行者可定时调用。

## 已提交
- `tcrn-workflow/scripts/owner-queue.mjs`(tcrn-workflow 仓)。
