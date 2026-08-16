# STORY-162.1 触发点选型 —— hook 按 prompt 检索

签发:执行层 agent:fable · 2026-08-05

## 触发点与触发条件

| 事件 | 触发条件 | 注入内容 |
| --- | --- | --- |
| **SessionStart** | 每会话**保底一次**(无 prompt) | 基线注入:单宽词查询(所有卡共同的 `lesson` tag),预算封顶;让 agent 开局就带平台教训元数据 |
| **UserPromptSubmit** | prompt 含任一触发关键词(`hook/仪式/rebase/门/探针/复核/证据/判据/CI/验证/CAS/marker/store/SSH`) | 按命中的关键词查 candidates,预算封顶,元数据级注入 |

**红线:不得每轮无条件全量注入。** 上下文预算是硬约束:UserPromptSubmit 有本地关键词门
(harness matcher + 脚本内 trigger gate 双道),不命中即零注入、不起网络。

## 「什么会触发 / 什么不会」各一例

- **会触发**:`"hook 没有生效,应该查什么"` → 命中 `hook` → 注入 C13(hook-cwd-trap)。
- **不会触发**:`"今天天气如何"` → 无关键词 → `TRIGGER_GATE_NO_MATCH`,零注入。

## 注入形态(元数据级,非全文 body)

每候选一行:`· [knowledge:id] 标题 — summary`。全文 body 永不注入(162.2 收口判据)。

## 检索链分工

- relevance 归 `knowledge-candidates`(MCP 只读面);注入脚本**不另写相关性**。
- 预算封顶由脚本执行(上限可配置 `--budget`,默认 8000 字节,超限显式截断并声明)——因
  `context-route` 需一次性供权(暂不可用),这是 on-demand-context 文档已声明的过渡形态;
  将来 authority 供给落地后预算归 context-route。

## 实测结论(161.5 输入)

- candidates 是 AND-token FTS:自然语言整句喂会因连接词归零,须先做关键词提取/命中触发词。
- 触发词与 matcher 共用同一张词表(settings.json matcher 与脚本 TRIGGER_KEYWORDS 对齐)。
