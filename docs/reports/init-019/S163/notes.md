# STORY-163 收口 —— 知识面读写全走 MCP

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | store marker 版本 ≠ 链版本,CAS 用 marker(160 已修);`knowledge-*` 写动词全部经仪式 |
| 文件指针 | `S163/readface.md`(读面核对);`S163/outputs/`(create/promote/retire 回执);`.claude/skills/tcrn-workflow-helper/references/on-demand-context.md`(改写) |
| 验证命令 | 五读动词经 MCP 只读面各调一次;一次 create→promote→body 读回 |
| 收口动作 | 写动词 create/promote/retire/rebase 全部经写面工具跑通;文档改 MCP 形态 |
| 生效证据命令 | `tcrn_remote_read_knowledge_body` 读回 create 的卡;`doc-topology:proof` exit 0 |

## 实测记录

### 163.1 读面核对
- 五读动词全部可用,见 `readface.md`。`context-route` 需一次性供权,读面按设计拒绝。

### 163.2 写面经仪式(create→promote→retire→rebase 全经 156 工具)
- **create 两版**:第一版 `accountable-owner-id=agent:fable` 不满足 promote 的 `owner:` 前缀要求;
  第二版用 `owner:init019-writeface` + `evidence-ids=["evidence:init019-s163-writeface-proof"]` 通过。
  (逐字命中 STORY-161 红线:promote 需 evidence ≥1、source 与 accountable-owner 齐备。)
- **promote**:`KNOWLEDGE_PROMOTION_UPDATED`,卡 `knowledge:a13b39c88f3ff50025e22557` revision 1→2,
  promotionState candidate→promoted。
- **retire**:第一版卡 `knowledge:c777a4176e90693f1a43886e` `KNOWLEDGE_RETIRED`(lifecycle→retired)。
- **rebase**:每笔真写后自动 rebase(160 实现),回执 `knowledgeRebase` 字段 `KNOWLEDGE_STORE_REBASED`。
- **生效证据**:经 MCP 只读面 `knowledge-body` 读回 promoted 卡的 body,`bodySha256` 与 create 时一致。
- **发现**:`knowledge-create` 的 `scope` 是枚举 `workspace|project|role`,不是自由串;
  evidence id 形状为 protocol id(`evidence:<…>`)。已记入本 notes 与 readface。

### 163.3 文档与生效证据
- `on-demand-context.md` 的知识查询命令改为 MCP 只读面形态(`tcrn_remote_read_knowledge_*`,每工具带 `partition`)。
- `doc-topology:proof` exit 0(仍绿)。

## 已提交
- 本单证据(create/promote/retire 回执)随 S163 批提交。
