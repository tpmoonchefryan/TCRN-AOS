# STORY-163.1 读面核对 —— 知识读动词经 MCP 只读面逐个可用

签发:执行层 agent:fable · 2026-08-05

## 核对结果(经 MCP 只读面 `tcrn_remote_read_*`,每个动词各调一次)

| 动词(MCP 工具) | 结果 | 说明 |
| --- | --- | --- |
| `knowledge-list` | ✓ `KNOWLEDGE_LIST_READY` | 空库 total 0;`selection=all` 列出含 retired 的卡 |
| `knowledge-candidates` | ✓ `KNOWLEDGE_LIST_READY` | 空库 candidates [] |
| `knowledge-snippet` | ✓ 转发正常 | 对不存在 id 返回 `KNOWLEDGE_NOT_FOUND`(证明到达引擎) |
| `knowledge-body` | ✓ 转发正常 | candidate 卡返回 `KNOWLEDGE_BODY_ACCESS_DENIED`;promoted 卡返回 body(见 163.2) |
| `knowledge-freshness` | ✓ `KNOWLEDGE_FRESHNESS_EVALUATED` | |

五个读动词全部在 MCP 只读面可用;不可用者为空集。`context-route` 需要一次性供权文件,
只读面按设计拒绝(与 shell 一致的 `CONTEXT_AUTHORITY_REQUIRED` 语义)——它由 162 的检索链按
「relevance 归 candidates、预算归 context-route」的分工处理,不从读面绕过。

## 注意

- 知识读动词的 CAS/读面已与 marker 修复联动(STORY-160):store 陈旧时读面整面拒读
  `KNOWLEDGE_HIGH_WATER_MISMATCH`,修后恢复。
- `knowledge-list` 的 `search` 走 FTS 索引,索引在 rebase 时重建——紧跟在写后立即 search
  可能因索引滞后返回空(见 163.2 实测)。元数据列举(`selection=all/default`)不受影响。
