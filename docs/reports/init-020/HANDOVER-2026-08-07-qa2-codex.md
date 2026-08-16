# INIT-020 二轮验收交接文档 — Codex/GPT 执行批

> **写给谁**:接手 TCRN-CROSS-INIT-020 余量执行的 **Codex 宿主(GPT)会话**,以及 Owner。
> **本文角色**:二轮验收(2026-08-07)后的执行交接书。**取代** 同目录 `HANDOVER.md` 的「截至/硬性状态」段(该段声称的 v2122/S185 done/closeout 通过已被两轮验收证伪);`HANDOVER.md` 的 §3 方向轨道、§5 红线、§6 键号速查、§8 收口模板**仍有效**,本文不重复处引用之。
> **截至(实测@2026-08-07,链 v2164/`11ea8537…`)**。本文所有时点断言都会过期——每条附复核命令,按命令走,别信散文。
> **链上对应记录**:INIT-020 主单 v2164 注记(二轮验收结论·更正·交接);新五单立于 v2154..2163。

---

## 0. 三十秒了解你要干什么

1. 完成 **INC-074..089 + STORY-191/192** 共 18 张单(13 张一轮 QA 单 + 3 张二轮补单 + 2 张 adapter 同步 Story),按「强化先行、修复在后」原则与各单 scope 里的**可检查前置**执行。
2. **第一件事就是 STORY-192:给 Codex 宿主接入 MCP 读写面**(Owner 2026-08-07 改序,S192 序次改裁注记已落链 v2165):「补全能力应该是codex首先要做的事情,能力补齐了,后续才能按我们的约束完成工作」「除了原生不支持的功能,codex应与claude code有同样的能力」。能力补齐前,你读写链只有一条合法通路(见 §2 bootstrap 规则);补齐后,你与 Claude 侧走同一对受治 MCP 面、同一套判据。
3. 全部绿后:S187 余项 → S190 收口 → 备齐发布材料 → **停在推送必停点交 Owner**(现裁定:暂缓推送,达推条件见 §7)。

二轮验收结论一句话:**工程代码大半写了(质量可),但链上 0/13 核销、引擎侧修复未构建未发版未部署、两道新门假绿、一处收口注记引用了不存在的门(已更正)。**「完成」的定义在本平台=链上有记录+生效证据两侧实录+真回执,自报不算——本 INIT 已两次栽在这一条上,你是第三棒。

## 1. 每个会话开工前(必做)

```bash
node ~/.tcrn-workflow/trusted-bootstrap.mjs verify-installed-copy --installed-dir "<平台根>/.claude/skills/tcrn-workflow-helper" --provenance ~/.tcrn-workflow/complete-skill-archive.provenance.json --state ~/.tcrn-workflow/state.json
```
期望 `INSTALLED_COPY_VALIDATED`。它验的是 skill 副本不是引擎;指错对象会得 `ARCHIVE_LIMIT_EXCEEDED`,那是你量错了东西。

**仪器名册核对(开工即响,不静默降级)**——Codex 侧现状(实测@08-07):
| 仪器 | Codex 侧 | 备注 |
| --- | --- | --- |
| tcrn-workflow MCP(本机引擎) | ✅ 已接 | |
| codegraph(TMS) | ✅ 已接 | |
| codegraph-ds / codegraph-aos | ❌ 缺 | S192 交付;且 aos 索引停 2026-08-06T07:07、deploy/ 门面层不在索引(INC-086⑤),重建前 grep 更诚实 |
| **tcrn-workflow-aos-read(链 MCP 读面)** | ❌ 缺 | S192 交付;此前用 §2 的 dry-run 读法 |
| **aos-mcp-write(链 MCP 写面)** | ❌ 缺 | S192 交付;此前写走 ceremony.mjs CLI(同配方) |
| 引擎仓 codegraph | 无(设计内) | 该仓仪器=commands 名录+测试套件 |

**本表全部缺口的消除就是你的第一张单(S192,波 0)——缺口是开工日要清的债,不是长期状态。**

## 2. 通道铁律(Codex 版,违者即事故)

1. **写链唯一通路**:`node deploy/aos-local-client/ceremony.mjs --payload <file.json> --partition <分区>`(TCRN-AOS 仓内运行)。它已被二轮验收实测证实**走门面写 PG**(INC-082 的核心修复,本 INIT 唯一实证修复)。
2. **读链头(S192 落地前)**:构造只含读回的载荷跑 `--dry-run`,取回执 `chainBefore`(version+headEventHash 全 64 位)。
3. **⚠ 已知未修缺陷,当作禁令遵守**:ceremony 的 SSH fallback 会在任意异常时触发,并拿 PG 读数当 expected-version 写**文件后端**——哨兵未落地时这会当场再造分叉(二轮验收实测)。**门面不可达=停下记录,绝不让 fallback 真写**;修掉它是 INC-082 残余的第一件事。
4. ceremony **默认分区是 TCRN-AOS**——写 cross 必须 `--partition cross-project`,判据=dry-run 的 `chainBefore.version` 对上目标链。
5. 载荷禁名 `workspace`/`attest-dir`/`expected-version`;读回必须带 `expect`/`recordFields` 真比对(裸 work-list 会被具名拒 `READBACK_NOTHING_COMPARED`——这是门面在工作,不是坏了)。
6. **严禁**:裸 SSH 直驱引擎 CLI(break-glass 白名单外零容忍,白名单在 `deploy/aos-local-client/ssh-breakglass-allowlist.json`);任何工具编辑 `.tcrn-workspace/**` 或 VM 控制树;`psql` 手写 chain schema。
7. work id 派生律(实测 5/5):`work:` + sha256(`"work\0"` + 大写外键) 前 24 位 hex。`work-show` 只收内部 id。
8. 引用链版本 **2122 必须带 hash**:弃轨头=2122/`ad2a7c9b…`,权威 PG 链自己也有 v2122(INC-081 创建事件)。数字撞车,裸数字会谈错对象。
9. **本节 1-8 是 bootstrap 期规则(S192 应用前)**。S192 应用并双侧实测一致后,读写改走与 Claude 侧相同的两个 MCP 面(`tcrn-workflow-aos-read`/`aos-mcp-write`——两面均无 SSH 回落、fail-closed,已经验);ceremony CLI 退回与 Claude 侧相同的次要角色,§2.3 的 fallback 暴露窗随之关闭大半。

## 3. 现状快照(实测@2026-08-07;每条带复核命令)

| 事实 | 读数 | 复核命令 |
| --- | --- | --- |
| cross 链头 | v2164/`11ea8537…` | ceremony dry-run(§2.2) |
| 单一真值(读写通路) | **已恢复**:dry-run==读面==2153 时代实测全值同 | 同上,对照 tip:proof |
| tip 门(INC-075) | **红** `TIP_TRUTH_DIVERGED`:file 弃轨仍持 2122/`ad2a7c9b`,**五链全 unsealed** | `pnpm tip:proof` |
| validate | **4/5 红** `WORKSPACE_VIEW_STALE`(AOS/DS/TMS/Joi;cross 绿) | 读面 validate ×5(S192 前经 dry-run 载荷带 validate 步) |
| cross 迁移核验 | **EACCES** `events/000033.json`(弃轨不可取证) | 读面 migration_verify |
| 引擎版本 | 受治副本==VM==**0.11.3 纯净**(453/453);**全部引擎侧修复只在开发树未提交** | `pnpm engine-host:verify`;`git -C ../tcrn-workflow status` |
| 两仓工作树 | WF 24 脏路径@`5649ce2`;AOS 214+ 脏路径@`33af858`;**零新提交** | `git status --short` |
| helper candidate | 钉 **v0.10.2**(落后四版) | `~/.tcrn-workflow/complete-skill-archive.provenance.json` |
| AOS `pnpm test` | 预存 **4 红**(apps/api/readback-facade、packages/db/kr01、kr05、packages/mcp-server/kr02)——实测非本批引入,但挡 `pnpm verify` | `pnpm test` |
| WF `pnpm test` | 绿 67 文件,但 **PG 用例执行数=0**(未接线) | `pnpm test`;`pnpm pg:test` |
| WF `pg:test` | **红**:并行 7/14 fail(测试互清生产名 schema);串行仍 1 确定性 fail(=INC-088 那条真缺陷) | `pnpm pg:test` |

## 4. 单子名册(18 张;id 均可由派生律重算)

| 键号 | id 后 8 位 | 状态 | 一句话 | 可检查前置 |
| --- | --- | --- | --- | --- |
| INC-074 存储归属哨兵 | `297561f9` | planned | 引擎侧 storage-home.ts 已写好;**缺**:CLI 读哨兵 `.catch(()=>null)` fail-open 要修、`executeMigration` 不取 lease 可无阻撤哨兵、发版部署、**五链落哨兵脚本(缺失)** | — |
| INC-075 tip 门 | `2db33050` | planned | 门已建进 verify 且诚实红;**缺**:file 轨读不到时 fail-open(`sealed !== false`)要改 fail-closed;A/B 两路同源近恒真要注明 | — |
| INC-076 通路名册 | `b6fb18cd` | planned | 门真实有效;**缺**:surface 自报未核——projection-freshness/fallback-cli 登记 facade 实为 SSH+file,须探测或改造 | — |
| INC-077 冻结红腿义务 | `c75a431f` | planned | closeout-verify redLeg 形状校验已写;**缺**:`windowed` 自报无强制;公约条目未落 docs | — |
| INC-078 ADR 对账 | `dd2088bb` | planned | 单向对账已接;**缺**:反向(ADR 正文→JSON 全覆盖)与「门真测判据」——9.4 指向的 store-equivalence **无 view 比较**、9.2 指向的文件覆盖不足 | — |
| INC-079 测试接线门 | `59703779` | planned | AOS 侧门弱(字符串提及≠执行)、**WF 侧空门**(owner 自陈,改垃圾仍绿——实测);CI verify-pg 无 `container:` 却拨 `postgres:5432` 必红 | — |
| INC-080 回执卫生门 | `ccad21c1` | planned | 门在,红腿在;**缺**:只查键存在,手编回执过门——补 hash 形态校验+(可达时)权威链锚定;`ORPHAN_SCOPE_PREFIX="init-020/"` 写死 | — |
| INC-081 分叉处置 | `5b3b1a15` | planned | 重录动作已落链(2134-2152)但在 **0/4 前置**下执行;核销待:前置齐+tip 绿+收口注记落自身 | 074,075,082,080 |
| INC-082 写路径统一 | `60f7c74c` | planned | **核心已实证修复**;残余:SSH fallback 收紧(§2.3)、隧道回收(`reclaimFacadeTunnels` 定义了无人调用)、`readChainHead` 门面失败静默转 SSH、`readKnowledgeMarker` SSH 路径仍读文件、未知工作区默认 TCRN-AOS | 074,076 |
| INC-083 归档封死取证 | `f38e64d7` | planned | 全部待做:000033.json 属主修复(VM)、五链哨兵封印、弃轨 2106..2122 只读导出留档 | 074 |
| INC-084 门面加固 | `d4cd58ac` | planned | 已闭:绑定正向规则、pgSchemas 启动校验、回执入 try;**缺**:health `backends` 说谎(不看 pgConnection——门面自测环境即反例)、actor 白名单死配置、幂等键三重失效(CLI 不发/进程内 Set/失败反 409) | 074,078 |
| INC-085 迁移判据 | `0ef225ed` | planned | 已闭:view 入 snapshot/compare/execute、段限缓存;**缺**:mapPgError 吞 StorageError(缺触发器报 EVENT_CORRUPT——同提交新造同类病)、prefix-resume 死代码、四链补 view 实操、发版部署 | 078,079 |
| INC-086 小修批 | `349a551a` | planned | 已闭:gate-list 可判别、snapshot 绑 FileBackend、恒真测试改判别式(**改对了并红出真缺陷→INC-088**);**缺**:PG 测试 schema 隔离(**禁用生产名 chain_cross/chain_aos!**)、codegraph 重建、描述刷新、口令入 env、写面 marker 现读(三次复现 92:93) | 079 |
| **INC-087 记录与回执补正** | `2b8704e3` | planned | S185 done 补证据;手编回执换真件(真件在 `evidence/mcp-ceremony-write/receipts/` 2026-08-06T18:07-08Z 批);INC-081 收口落自身 | 080 |
| **INC-088 PG 路径解耦** | `417fd7f7` | planned | **二轮 P0**:PG 装配下 `materializeWorkspace` 仍要求文件树在场(ENOENT 崩);「在场」改=哨兵+PG;判别腿转绿 | 与 074 同批发版 |
| **INC-089 卫生门扩面** | `b45fc2b5` | planned | `.txt` 盲区补(已提交 `33af858` 里 14 处本机路径泄漏,门绿放行);33af858 推前清洗;未跟踪报告树过扩面门再定提交 | — |
| **STORY-191 adapter 双家族同步** | `301b05b5` | planned | 引擎 adapter_* vs claude_adapter_* 能力等价矩阵+补齐+等价测试(红腿:同输入 reason code 偏差必红);不对称处残余适用性分析 | 079 |
| **STORY-192 Codex MCP 读写面** | `d6be7ed8` | planned·**执行序首位** | config.toml 增量 diff(读面/写面/两 codegraph,复用同一脚本零分叉,并入 S187.3 codegraph 段)→Owner 过目→应用→双侧全值一致实测→parity:proof 扩面并**清零豁免** | INC-082 已实证核心**已满足**;其残余不阻塞(v2165 改裁注记) |

周边:S185 **done**(证据待 INC-087 补)、S189/S190 **active**、S187 planned(parity diff 已生成待 Owner、helper 文本待备)、INC-072/073 done、INIT-020/EPIC-056/057 planned。

## 5. 推荐执行序(六波;波 0 为 Owner 改序钦定的首位)

0. **能力波(首位,Owner 2026-08-07 改序,链 v2165)**:STORY-192——生成合并 diff(读面/写面/两 codegraph 四个服务器条目)→ 交 Owner 过目 → 应用 `~/.codex/config.toml` → 实测:Codex 会话经 MCP 读五分区 status + 写面 dry-run ceremony,与 Claude 侧全值一致 → parity:proof 扩面、日期豁免清零(清零后注入伪漂移仍必红)。**此后所有波次的链读写走 MCP 两面。**理由:仪器纪律「供给对等/开工即响」;并把 ceremony CLI 的 SSH fallback(§2.3)暴露窗压到最小。
1. **引擎波**(一次集中,不挤牙膏):INC-088 解耦 + 074 残余(fail-open 修+落哨兵脚本)+ 085 残余(mapPgError/StorageError)+ 086 残余(**PG 测试改专用 schema 前缀**)+ 079(WF 空门补真判据:owner 必须对账到 ci.yml/task.mjs 真实执行面;CI job 补 `container:` 或改 localhost)→ 全套件+pg:test 14/14 绿 → **v0.11.4**:发布文+CHANGELOG+五 manifest+受治副本更新+VM 部署 → `engine-host:verify` 绿且版本=0.11.4。
2. **VM 波**:五链落哨兵(此后文件后端拒写=红腿实录留档)→ 000033.json 属主修复 → 弃轨 2106..2122 只读导出留档 → 四链补 view → validate 5/5 绿 → `tip:proof` 转绿(**总正腿**)。
3. **AOS 波**:INC-082 残余(fallback fail-closed+隧道回收+marker)→ 084 残余 → 080 强化(hash 形态)→ 076 surface 探测 → 075 fail-open 修 → 089 扩面+33af858 清洗 → 087 记录补正。
4. **核销波**:逐单收口(注记落**该单自身**+transition 到 done+引擎产真回执归档+生效证据两侧实录);closeout manifest 覆盖 **074..089** 带 redLeg;AOS `pnpm verify` 全绿(先处置预存 4 红:修或带日期豁免并立单)。
5. **收尾波**:STORY-191(引擎 adapter 双家族同步——留在此波:它是引擎级对称性工程,不是按约束工作的前提)→ S187 余项 → S190(tip 复量协议成文,以本次分叉为第一案例;发布材料)→ **停:推送裁定交 Owner**。

## 6. 二轮验收未在单内点名的杂项(执行时顺手核)

- 写面 knowledge-rebase 的 marker 陈旧缓存(92:93 三次复现)→ INC-086⑨。
- `snapshot-manifest` 对 pg-homed 工作区现在自洽描述**陈旧归档**且无标识(不再自相矛盾,但读者会误当活链)。
- 读面工具描述文本仍称 "forwarded over SSH"(S185 后陈旧)。
- 两仓 `package.json` 丢尾换行;读面 unit 用 B64、写面 unit 用转义 JSON(两侧不一致,功能均正常)。
- 引擎 `output-session` 锁曾被并行会话持有(`OUTPUT_SESSION_RECOVERY_OWNER_LIVE`)——多会话并行跑引擎测试前先看锁。

## 7. 推送(=对外发布,唯一必停点):现裁定**暂缓**,达推条件

**要推的对象**(两仓 main 均与远端持平,推送=发布特性分支+tags):WF `feat/cross-init018-prose-to-gates`(28 提交)+ tags v0.11.0..3(将来加 v0.11.4);AOS `feat/cross-init019-single-data-plane`(35 提交,含 init018)。

**四硬阻(全部清除前不推)**:①修复批零提交,不在候选内;②`localtestpassword123` 已提交 7 文件(推=首公开;改参数化或 Owner 明示接受 fixture 口令公开);③WF 将**首次**公开 VM 主机名+`/srv` 布局+SSH 用户名(**待 Owner 裁定**是否接受——AOS 属既有暴露类,WF 是新类);④`33af858` 含已提交本机路径泄漏(INC-089 清洗;该提交未推可重写)。

**推送执行手册**:提交按 Initiative 分批成形 → 隐私扫描(扩面后的卫生门+email 检查)→ **逐 ref 指名推,严禁 `git push --all`/`--mirror`**(本地存在两条前改写世系分支,各 93 提交携带真实个人邮箱;公开史 0 命中,一手滑=INIT-012 的 281 提交改写全白做)→ 先推 WF 分支+tags → `gh run watch` 盯 CI 绿(AOS 无 CI,更要在本地把门跑齐)→ 再推 AOS → 红即停。helper candidate 重钉(v0.10.2→与引擎新版对齐)随必停点一起交 Owner。

## 8. 第三轮验收会量什么(你的完成判定)

1. `tip:proof` 五分区绿(单一真值,总正腿)且其 fixture 红腿仍红;2. `validate` 5/5 绿;3. `engine-host:verify` 绿且两侧=v0.11.4;4. `migration_verify`(cross)不再 EACCES(答 FUTURE 属设计内);5. WF `pnpm test` 含 PG 用例执行数>0 且 `pg:test` 14/14;CI 真跑绿;6. 强化后卫生门/接线门/对账门各自红腿实录在案(含对旧假绿样本必红);7. 链上 18 单全核销:每单收口注记在**自身**、生效证据两侧、真回执、closeout manifest(074..089)带 redLeg;8. 两轮验收发现的每条 P0/P1 在某单收口注记里有指名处置。验收方法与前两轮同:多路独立事实代理+主线程复核,自报不采信。

## 9. 陷阱速查(本平台已付学费,别再付)

门跑早了(四连败史,最后一败就在 INC-081)/量具由被量者提供(test-wiring owner 自陈=第 4 例)/判据两侧必须能够不同(恒真测试第 3 例)/没人读回来的写不算已证/本地全绿≠CI 绿/验证到没到别处必须问那个别处本身/knowledge 动词 CAS 吃 store marker 版本非链版本/列表型旗标半角逗号切分,条目内用顿号/zsh 里 `=word` 触发展开,引号护住/引用 2122 带 hash/审议要声明执行形态/凭据不是实现的前置。
