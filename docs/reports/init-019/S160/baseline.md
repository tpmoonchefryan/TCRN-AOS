# STORY-160.1 现状定量 —— 知识 store 标记 vs 链版本

签发:执行层 agent:fable · 2026-08-05 · 取数全部经 MCP 只读面(`tcrn_remote_read_*`),非 SSH。

## 基线表(2026-08-05 实测)

| 分区 | store 标记版本 | 链版本 | 知识面读(修正前) | 取数命令 |
| --- | --- | --- | --- | --- |
| `TCRN-AOS` | 18 | 1048 | **拒读** `KNOWLEDGE_HIGH_WATER_MISMATCH` | `tcrn_remote_read_knowledge_freshness`(at=当时) + `tcrn_remote_read_status`;标记版本由 ceremony `readKnowledgeMarker` 读 store.json |
| `cross-project` | 1 | 1782 | **拒读** `KNOWLEDGE_HIGH_WATER_MISMATCH` | 同上 |
| `Joi-Button` | 1 | 586 | **拒读** `KNOWLEDGE_HIGH_WATER_MISMATCH` | 同上 |
| `TCRN-Design-System` | 0 | 983 | 可读(空 store,`KNOWLEDGE_FRESHNESS_EVALUATED`) | 同上 |
| `TCRN-TMS` | 5 | 228 | 可读(2 条 freshness 记录) | 同上 |

## 判读

- **三链拒读**(AOS/cross/Joi),与简报「cross 与 AOS 整面拒读、store 标记停在 v1」一致并多出 Joi;
  标记版本确实小(cross/Joi=1、AOS=18),与链版本(三位数)是两个无关计数器。
- **DS/TMS 一致但 DS 双零**——store 从未灌入过知识事件(与 STORY-161 现状一致);TMS 有 2 条 seed 记录但
  `knowledge-list` 默认 selection 为 0(freshness 评估的 2 条在其它 selection)。
- 根因(简报已裁):store 是 `disposable` 物化索引,迁 VM 后从未 rebase,每次链写再拉开差距。
  判据是 `store.json` 的 `eventHighWaterDigest ≠ 链 head`(knowledge-core `scanKnowledgeStore`)。

## 修正后(160.3 一次性补齐之后)

| 分区 | 标记版本(修正后) | 链版本 | 知识面读 |
| --- | --- | --- | --- |
| `TCRN-AOS` | 21 | 1048 | `KNOWLEDGE_LIST_READY` |
| `cross-project` | 2 | 1782 | `KNOWLEDGE_LIST_READY` |
| `Joi-Button` | 2 | 586 | `KNOWLEDGE_LIST_READY` |
| `TCRN-Design-System` | 1 | 983 | `KNOWLEDGE_LIST_READY` |
| `TCRN-TMS` | 6 | 228 | `KNOWLEDGE_LIST_READY` |

取数命令:五个动词 `knowledge-{list,freshness}` 经 MCP 只读面各跑一次(见 S160 outputs 五链回读)。
