# STORY-161 收口 —— 内容灌入:三源策展 ≥20 卡

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 每卡可被证伪(body 写「此条不再成立当」);promote 需 evidence ≥1、source 与 accountable-owner 齐备;evidence id 只验形状,人保证真实 |
| 文件指针 | `S161/sources.md`(源清点)、`card-template.md`(模板)、`batch-1/cards.json`(20 卡)、`retrieval-check.md`(抽检)、`generate-payloads.mjs`(生成器)、`outputs/`(回执) |
| 验证命令 | 落卡后经 MCP 只读面 `knowledge-list` 数目一致;抽检 5 prompt 记录命中 |
| 收口动作 | 首批 20 卡全部在 cross 链上、全部 promoted、默认 selection 可读 |
| 生效证据命令 | `tcrn_remote_read_knowledge_list` 返回 ≥20 条;`knowledge-candidates` 关键词命中 |

## 实测记录

### 161.1/161.2
- 三源(记忆索引 / 链上 scope / docs/reports)去重规则成文;sources.md 与 card-template.md 落地。

### 161.3 首批 20 卡
- `batch-1/cards.json` 20 张,每张含主张 + evidence(≥1)+ source(≥1)+ owner:` 前缀 + body 证伪性。
- 生成器算 source-digest(sha256 source-references join),分批 create。

### 161.4 经写面落卡
- create 两批(10+10)→ `CEREMONY_COMPLETED_AND_READ_BACK`,20 卡建成;
  promote 一批(20 卡,expected-revision 1)→ `KNOWLEDGE_PROMOTION_UPDATED` 全部成功。
- 生效证据:`knowledge-list`(default selection)经 MCP 返回 **total 20**,卡元数据完整。

### 161.5 检索质量抽检(如实)
- 原始自然语言 prompt:`0/5`(candidates 是 AND-token FTS,连接词把查询拉成 0)。
- 关键词提取后:`5/5` 命中(复核命令→C11/C05、恒真→C02、rebase→C12/C20、hook→C13、仪式→C12/C11/C20/C14)。
- 结论:**162 注入必须做关键词/主题提取,不能整句喂 candidates**;并带 role-scope。

### 161.6 收口
- 首批范围:20 张平台教训卡(探针/判据/门/知识/仪式/SSH/hook/卫生)。未覆盖:产品域事实(留给后续批次)。

## 已知保留
- candidates 的 AND-token FTS 特性是引擎行为,不是缺陷;162 按此设计检索链。
- 卡的目标分区是 cross-project(平台级教训);AOS 链另有 STORY-163 的证明卡。
