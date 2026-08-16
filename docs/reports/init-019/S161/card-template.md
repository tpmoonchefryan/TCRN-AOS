# STORY-161.2 卡片模板与 evidence 绑定

签发:执行层 agent:fable · 2026-08-05

## 模板(与 `batch-1/cards.json` 的 `common` + 逐卡字段一致)

每张卡 = 一套「主张 + evidence + 证伪性」的 flags,经 `knowledge-create` 写入、`knowledge-promote` 提升:

| 字段 | 取值规则 |
| --- | --- |
| `external-key` | `tcrn-init019-cNN`(平台前缀-溯源) |
| `scope` | 枚举 `workspace|project|role`(实测:`role` + `role-scopes` + `project-id` 组合合法) |
| `category` / `kind` | 枚举:`domain|implementation|standards|testing|workflow|decision|evidence`;`fact|guide|decision|reference|summary` |
| `subject`/`summary`/`snippet` | 主张一句话 / 展开 / 检索摘要 |
| `accountable-owner-id` | **必须 `owner:` 前缀**(promote 的 `KNOWLEDGE_PROVENANCE_INVALID` 拦截;`agent:` 会拒) |
| `source-references` | ≥1,指仓内文档路径 |
| `source-digest` | sha256(source-references join),证据来源字节绑定 |
| `evidence-ids` | ≥1,`evidence:<…>` protocol 形状(只验形状不验存在,人保证真实) |
| `work-ids`/`decision-ids`/`gate-ids` | 空传 `["-"]`(空串不满足引擎 required) |
| `lifecycle`/`retrieval`/`freshness`/`export` | `active`/`default`/`fresh`/`metadata-only` |
| `stale-days` | 1..3650 |
| `body` | **主张 + 为什么 + 「此条不再成立当:…」**(证伪性,161.3 红线) |

## create → promote walkthrough(163 实测,已在 cross 链上 20 卡全走通)

1. **dry-run 先验形状**:`tcrn_ceremony(payload={…知识-create 步骤…}, dryRun=true)` → `CEREMONY_PLANNED_ONLY`,planned argv 的 `--expected-version` 是 **store marker 版本**(非链版本)。
2. **create**:经写面驱动,`KNOWLEDGE_UNIT_CREATED` 返回 `recordId`;回读 `knowledge-list`(selection all)按总数核对。
3. **promote**:id + `state=promoted` + `expected-revision=1`,`KNOWLEDGE_PROMOTION_UPDATED`;读回 `knowledge-body` 确认 bodySha256 一致。
4. **rebase**:每笔真写后仪式自动 rebase(160),知识面保持可读。

## 实测中挖出的三条硬约束

1. `knowledge-create` 的 `scope` 是枚举,不是自由串(传 `writeface-proof` 会被 `CLI_ARGUMENT_MALFORMED` 拒)。
2. promote 需要 `owner:` 前缀的 accountable-owner + ≥1 evidence(`KNOWLEDGE_PROVENANCE_INVALID` 拦截)。
3. 空 list 旗标传 `["-"]`,空串 `""` 会触发引擎 `CLI_ARGUMENT_MISSING`。
