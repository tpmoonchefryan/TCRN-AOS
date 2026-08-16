# INIT-020 QA4 Owner 裁定与执行授权书

> **写给谁**:Codex/GPT 执行会话(QA4 批)。
> **依据**:Owner 2026-08-07 指令原文「按建议执行」,针对 QA4 预检报告(`qa4-preflight-readonly-codex.md`)提出的四问。
> **链上记录**:INIT-020 / INC-098 / STORY-191 三条裁定注记,链 v2257→**v2260**,head `fedff97fd96aa6284b95fd23b7fe24ddfc68d308f4b68cc5da3f8b284a8f7e62`;真回执 `docs/reports/init-020/owner-ruling-qa4.receipt.json`(引擎物化件,逐字节即权威)。
> **本文与链的关系**:链上注记是正本,本文是操作视图。冲突以链为准。

---

## 0. 预检报告评价(先说清楚,因为它影响后续节奏)

QA4 预检是四轮以来**第一份完全按纪律执行的报告**:署名 `agent:gpt-5-codex` 自签、未授权的写一笔未动、隧道失败留真见证并走 CLI 后备、弃轨导出这次**量对了对象**(文件轨原始事件字节 17 件 + 单字节负测红)、S192 正腿②真跑(五分区 MCP `status` + 写面 dry-run,cross 2257/`6558874b` 全值)、`receipt-hygiene` 十个存量问题诚实红着不覆盖不拼接。连续三轮同类 Owner 阻断后标 `blocked`,属停顿预算三类内的正当停法。

结论:强化批(INC-090..094)已在执行行为上生效。本授权书据此把闸门放到 A/B 两档。

## 1. 四问裁定

| # | 问题 | 裁定 | 理由(Owner 采纳) |
|---|---|---|---|
| **D1** | WF 公开仓拓扑是否公开 | **不公开,清洗** | 主机名 / `/srv` 布局 / SSH 用户名对引擎公共用户零价值,纯增攻击面;若反着走须给 INC-094 新扩的主机名模式开豁免 = 挖空刚建的门;源树已清洁,历史重写为口令本就必做,拓扑搭同班车边际成本≈零 |
| **D2** | fixture 口令处置 | **参数化 + 换值** | env 化并换一个**从未在任何历史出现过**的新值,随历史重写生效;发布史自此永久干净 |
| **D3** | 是否建 Codex stop-pact 对等物 | **建,但不挡本批** | 平台立论即「散文按不住」(MIN-051,56 分钟复发实证);Codex 已是常任执行者,run-to-completion 无停止契约执行面 = 真空。排期为 STORY-191 后续小单,前置 = 观察钩子复活取证;**不设为任何现单前置** |
| **D4** | 执行授权范围 | **分 A/B/C 三档**,见 §2 | — |

## 2. 授权范围

### A 档 — 现已授权,可立即执行

1. **四条链上注记**:`deploy/aos-local-client/payloads/cross-init020-inc096-redlegs-correction-codex.json`(INC-086/088 红腿、INC-083 更正、INC-096 正腿)。
   ⚠ **必须由 Codex 以 `agent:gpt-5-codex` 自签执行**,不得移植 `agent:fable` 署名(载荷现状正确,保持原样)。
2. **真实 knowledge-rebase**:追平 marker(现读 CAS 99),消 `KNOWLEDGE_HIGH_WATER_MISMATCH`。
3. **read face 重新部署**:`read-face:freshness` 红出远端已部署读面仍服务 `2026-08-06T12:20:28Z` / cross v2102(22.5h,门限 9h)——属部署面欠账,先例内,授权 ship/deploy 并复跑该门至绿。
4. **INC-097 引擎 0.11.8 发版与部署**:**必须经 INC-093 铸造门**——`verify:p8` 绿方可铸 tag(现 dirty worktree 报 `P1_EXCLUSIVE_SOURCE_BASIS_REQUIRED` 是**正确拒绝**,不是缺陷,先让树干净再跑);部署后 `engine-host:verify` 两侧一致。
5. **receipt-hygiene 十个存量问题分类处置**:按 INC-091 政策——历史件/null-head 标注为红证人、隧道失败见证归见证类、payload-as-receipt 三件以真物化件替换或明确降类;**不覆盖、不手工拼接**。

### B 档 — 随 D1/D2 裁定即时授权(不含推送)

6. **INC-098 候选分支历史重写 + tag 重铸**:
   - 清洗对象(D1):主机名 `tcrn-platform-dev`、`/srv/tcrn` 布局、`deploy@tcrn-platform-dev`、内网 IP `192.168.x`(`ssh-write-observer.mjs:665`)→ 全部占位化,不留真值;
   - 清洗对象(D2):`localtestpassword123` → env 化 + 换新值;
   - 手段:候选分支 squash/rebase 使 `verify:privacy` 归零(现存量在历史 git blobs,源树已清洁);
   - tag 重铸:v0.11.0..v0.11.7(若 0.11.8 已发则九个)在重写后历史上重铸,**注记形态恢复先例**(0.11.3 式说明文,不用裸串);
   - helper candidate 重钉方案备妥(应用随 C 档)。
   - 完成判据:`verify:privacy` 0 条 + `verify:p8` 绿(clean tree)+ INC-094 扩类门对重写后全历史绿。

### C 档 — 仍是必停点,单独请裁

7. **推送**。到位后按此顺序请裁:
   - **AOS(私有仓)**:tracked edits 收拢提交 + `cockpit-data.generated.ts` 三处本机路径清洗确认后,可**先**请裁;
   - **WF(公开仓)**:待 B 档完成并过第四轮复核(`verify:privacy` 0 条、`p8` 绿、**经 PR 触发 CI 绿**——分支直推不触发任何 CI)再请裁;
   - helper candidate 重钉随 WF 发布同批;
   - 推送手册不变:**逐 ref 指名,严禁 `--all`/`--mirror`**(本地两条前改写世系分支各含 93 个真实邮箱提交)。

## 3. 执行纪律(不变,重申三条最易犯的)

1. **署名**:签你自己的 persona,每批 intent 写明执行形态与宿主(QA4 预检已做对,保持)。
2. **回执**:归档回执 = 引擎/写面物化件的**逐字节拷贝**;手工组装、裁剪、改字段 = 违规。
3. **写失败**:先读链头判定落没落,再决定重试;**绝不因隧道故障转裸 SSH 驱动引擎**(QA4 预检已做对,保持)。

## 4. 第四轮验收判据(A+B 档完成后)

沿用 QA3 交接书 §5,新增两条:①`read-face:freshness` 与 `projection-freshness` 全绿(knowledge/codegraph 侧车一并追平);②`receipt-hygiene` 由分类处置转绿或余项各有具名归类记录。验收方法不变:多路独立事实代理 + 主线程复核,自报不采信。
