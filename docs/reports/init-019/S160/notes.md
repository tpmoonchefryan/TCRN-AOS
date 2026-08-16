# STORY-160 收口 —— 标记纪律:每写必 rebase

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | rebase 是 mutating 动词必须经仪式;不让 rebase 变成人工步骤;store marker 版本 ≠ 链版本,CAS 用 marker |
| 文件指针 | `TCRN-AOS/deploy/aos-local-client/ceremony-plan.mjs`(`KNOWLEDGE_STORE_CAS_VERBS` 声明);`ceremony.mjs`(`readKnowledgeMarker` + 按动词族选 CAS 头源 + 真写后自动 rebase + 回读扁平化扩展);`S160/baseline.md`;`S160/notes.md` |
| 验证命令 | 五链 rebase 后 `knowledge-list` 经 MCP 只读面全部 `KNOWLEDGE_LIST_READY`;连做两次真写,写后知识面可读 |
| 收口动作 | 五链知识面全部可读;落后量 ≤1 次写(自动 rebase 使写后即读不再失配) |
| 生效证据命令 | 经 MCP 只读面对五链各跑一次 `knowledge-list`;真写回执含 `knowledgeRebase` 字段 |

## 关键发现与实现

### 发现:knowledge-* 写动词的 CAS 是 store marker,不是链版本
- 引擎 knowledge-core 五处(`create`/`promote`/`retire`/`rebase`/`reverify`)全部
  `scan.marker.version !== input.expectedVersion → KNOWLEDGE_CAS_MISMATCH`。
- 仪式原本对一切动词从链 head 供给 `--expected-version` —— 对 knowledge 族是错的。
- 修法:`KNOWLEDGE_STORE_CAS_VERBS` 声明 + `readKnowledgeMarker(workspace)`(SSH 只读
  `<workspace>/.tcrn-workflow/knowledge/store.json`,读控制树文件、不写,符合「看可以,存不行」)。
  ceremony 按动词族选 CAS 头源:knowledge 族读 marker,其余读链 head。
- 声明列表的失效模式是响的:新 knowledge 动词未登记 → 用链版本 → 引擎 `KNOWLEDGE_CAS_MISMATCH` 可见红。

### 实现 1:自动 rebase 挂进写路径
- `runCeremony` 真写成功且批内无显式 `knowledge-rebase` 时,自动补一次 `knowledge-rebase`
  (best-effort 但记入回执 `knowledgeRebase` 字段);dry-run 与失败批不跑。
- 实测:两次真写(close 160 + dispatch 163;dispatch 164),每次回执 `knowledgeRebase` 均
  `KNOWLEDGE_STORE_REBASED`,写后 `knowledge-list` 均 `KNOWLEDGE_LIST_READY`。

### 实现 2:回读扁平化扩展
- ceremony 回读原来只认 `record`/`advisory` 形状(work-show)。`knowledge-list`/`knowledge-freshness`
  是顶层 `total`/`records` 形状。现扩展:有 `record`/`advisory` 走原扁平化,否则以整体为观测记录。

## 实测记录

### 160.1 现状定量
- 基线见 `S160/baseline.md`:三链拒读(AOS marker 18 / cross 1 / Joi 1),DS/TMS 可读(DS 空、TMS 默认 selection 空)。
- 修正后五链 `KNOWLEDGE_LIST_READY`。

### 160.3 一次性补齐(五链,经写面仪式)
- AOS marker 18→21、cross 1→2、Joi 1→2、DS 0→1、TMS 5→6,全部 `CEREMONY_COMPLETED_AND_READ_BACK`,
  回读 `READBACK_MATCHES_FULL_VALUE`。输出存 `S160/outputs/`。

### 160.5 红绿实测
- 绿侧:五链 rebase 后知识面可读(上)。
- 红侧:rebase 前 AOS/cross/Joi 均 `KNOWLEDGE_HIGH_WATER_MISMATCH`(基线表)。
- 门的红绿侧(160.4)并入 STORY-166 的统一巡检门(简报:避免又造一个孤门)——见 166.3。

## 已提交
- 本单代码(ceremony-plan/ceremony 改动)待提交;随 STORY-163 批或独立提交。
