# INIT-020 本地计划文本(PLAN.md)

> **本文角色**:TCRN-CROSS-INIT-020 拆单结果的**本地可用性副本**与 **subtask 承载层**(MIN-053 两层制:链上到 Story 级为止,subtask 不建链记录,由本文承载)。
> **真值声明**:链上记录是唯一权威(cross-project 链,截至 2026-08-06 切换窗技术切投完成时 v2122)。本文与链冲突时**以链为准**;AOS/VM 临时中断时以本文与 HANDOVER.md 续命,恢复后逐单 `work-show` 校对。
> **全文 scope 逐字副本**:`deploy/aos-local-client/payloads/cross-init020-{a,b-confirm,c1-stories,c2-stories}.json`(与链上全值回读逐字一致,回执在本目录 `*.receipt.json`)。
> **状态(2026-08-06 实况)**:窗口技术切投完成——引擎 v0.11.2/v0.11.3 已发版部署;五链 file→pg 迁移+verify 绿;门面读写从 PG 服务;S185 两 MCP 面→门面 done;189.3 文件树只读归档;INC-073 done;closeout-verify 通过(INC-061..071 对账)。S189/S190 active;唯一必停点=对外发布。

---

## 一、方向(已全定,无待确认项)

| 裁定 | 内容 | 出处 |
| --- | --- | --- |
| D1 | AOS 成为引擎前的唯一读写门面;与链同机常驻;本机 MCP 两面降为客户端;只有引擎写存储 | MIN-063(Owner 直裁) |
| D2 | 存储后端:规范字节文件树 → 数据库,经存储抽象层;六依赖面残余结论固化于 ADR | MIN-063(Owner 直裁) |
| D3′ | **Postgres** VM 单实例绑回环;五链各一 chain schema + domain + 未来协作 schema;chain schema 仅引擎角色可写,append-only 由 GRANT+触发器机械化;PG 不可达=fail-closed 不回退;SQLite 被拒(不承载协作写入) | MIN-064(Owner 裁) |
| D4′ | **单轨完整迁移**:五链一个迁移窗全切;文件树当场转只读归档;SSH 读转发同窗退役;回滚=迁移动词族反向迁移;末次文件形态配对备份永久留存;文件后端代码降格为迁移与验证仪器 | MIN-064(Owner 裁) |
| D5′ | **取消 INIT-019 顺序门**:立即开工;INC-061..071 在本 INIT 内逐单核销(superseded 指名承接处 / retained 独立执行) | MIN-064(Owner 裁) |

辖域澄清(入 ADR 轨道表):「文件后端降格为仪器」辖域=五条受治链的生产轨道;**本地模式(未接入 AOS 的工作区)、四条 fallback 影子链、迁移/验证仪器保留文件后端**;MIN-060 D4「只有本地模式才写本地文件」未被触动。

## 二、执行序与窗前四硬件

```
阶段一  STORY-171/172/173(EPIC-052 ADR+核销清单+判据)
阶段二  STORY-174→175→176、177(EPIC-053)   ∥  STORY-181→182→183→184(EPIC-055,先跑在文件后端上)
阶段三  STORY-178→179→180(EPIC-054)          ∥  STORY-186(白名单与拓扑清欠可先备)
切换窗  STORY-188 就绪 → STORY-189 五链全切+STORY-185/187 同窗 → STORY-190 收口
必停点  对外发布(引擎版本发布 + helper candidate 重钉)——唯一必停
```

**窗前四硬件**(全绿才开窗,STORY-188 机器核对):① STORY-176 等价门绿;② STORY-180 往返迁移实证;③ STORY-184 门面真实写通过;④ 末次文件形态配对备份已取并异地验证。

**回滚教条**:窗内任何一链异常 → STORY-178 `migration-rollback`(=pg→file 反向迁移,判据与正向同:逐事件字节等价+版本连续+两店 marker 一致)。不存在「切一半长期悬置」的合法状态:要么整窗成,要么按链回滚并记录。

## 三、工单树(30 单全键号与 id)

主单 `TCRN-CROSS-INIT-020` = `work:4d0ecd9c1e6ea5292ef08330`(planned)
会议:CONF-060→MIN-063(`minutes:f72e665a445e64950ab0488d`)、CONF-061→MIN-064(`minutes:6b3a226012700f4322fd28ee`)

### EPIC-052 替换残余分析与 ADR(PG 版) `work:a3b94d6d202005f5fe229f0c`

**STORY-171 ADR 主文** `work:491be6f960ecc1f73d5aabc2`
要义:tcrn-workflow/docs/adr/0004,九节齐备,每条判据写明"什么会让它变红";PG 版本、schema 细部、抽象口粒度、租约形态在本单裁毕。
subtasks:
- 171.1 实例拓扑与版本节:PG 大版本选定(以 VM 发行版可得 LTS 实测)、升级路径、systemd 单元草案、pg_hba(本地 peer + 角色);
- 171.2 schema 布局节:`chain_<partition>` ×5 命名、domain schema(domain.db 表结构映射)、协作 schema 占位与命名规约;
- 171.3 角色与权限节:引擎/domain/协作三角色、GRANT 矩阵、append-only 触发器 DDL(拒 UPDATE/DELETE)、GRANT 红腿测试清单;
- 171.4 事件表 DDL 节:规范字节列(BYTEA)+payload_hash/event_hash/prior_hash+序号连续约束;views 仍由引擎派生重建(维持"视图非权威");
- 171.5 租约与单写者节:advisory lock vs claim 表对照裁定、mutation claim 对应物、TTL 与 recovery 语义(processAlive 判定的 PG 形态);
- 171.6 六依赖面逐面结论节:规范字节+哈希链(存续)/attestation(存续,actor 绑事件载荷、time 绑 headEventHash)/fail-closed(存续)/snapshot·export(被绑对象重定义)/relocation 台账(controlManifestSha256 重述+四条天花板照录)/backup 与只读归档;
- 171.7 迁移台账与额度节(现 16 条按尝试消耗,沿用与否);
- 171.8 轨道表与辖域澄清节(见本文一节末);
- 171.9 等价性判据定义节(与 STORY-173 联动)。

**STORY-172 INC-061..071 核销清单** `work:6767241b2a45cb5a81aecef8`
要义:十一单逐单处置,closeout-verify 机器核形态;只出清单文本,链上处置注记留执行期。
预判(由本单定稿,逐单以 scope 原文重判):

| INC | 预判 | 承接处/理由 |
| --- | --- | --- |
| 061 仪式层收口闸门 | superseded 候选 | 门面写面收口闸门(STORY-182/190) |
| 062 收口规格从链上推导 | retained | 传输无关收口纪律,STORY-190 引用 |
| 063 门名册与可达性 | superseded 候选 | 门面统一通路 + STORY-187 |
| 064 PASS 证人覆盖+语料只增 | superseded 候选 | STORY-183 拒绝面证人义务(SSH observer 退役前维持现状) |
| 065 结果表与证据侧车机器化 | retained | STORY-190 引用 |
| 066 判据卫生三态退出 | retained | 通用判据纪律 |
| 067 干净树测量 | retained | 通用 |
| 068 对抗复核入环(待 Owner) | retained | 治理公约修订,独立于传输 |
| 069 段内走私+判决函数统一 | superseded 候选 | STORY-183 语料 + STORY-182 白名单判定 |
| 070 codegraph 判据回正 | retained | 与本 INIT 无关的门修复 |
| 071 P2/P3 尾单 | 逐条重判 | 混合 |

**STORY-173 等价性判据与红腿** `work:d1f2a24bb7ebd51b93bd071d`
要义:判据集(逐事件字节/reason code/head 哈希/视图与两店 marker)+每条一次注入式红腿实证;ADR 定稿。

### EPIC-053 存储抽象层与双后端等价(仪器化) `work:ca7ba689328314c776bc29b8`

**STORY-174 存储抽象口与文件后端收敛** `work:0d2a6d6f5ba7f61f8376b710`(前置 171)
要义:按 ADR 口粒度抽层,文件后端原样收敛,行为零变化(全套件绿+64 排列字节决定性)。
subtasks:
- 174.1 抽象口 TS 接口定义(候选口:元数据读写/段读/事件追加/视图写/租约族/claim 族——粒度按 ADR);
- 174.2 workspace.ts 四私有 IO 助手(boundDirectory/boundFile/ensureDirectory/atomicWrite)后移为文件后端实现;
- 174.3 workspace-snapshot 的刻意重复 IO 纪律:并入或显式豁免(保留注释说明原因);
- 174.4 resolveWorkspace/materializeWorkspace/appendEvent 改经抽象口;
- 174.5 全套件绿证明(p3-file-engine/backup-snapshot/protocol-v1,经 pnpm test)+字节决定性复跑;
- 174.6 红腿:抽象层注入一字节偏差,既有套件必红(证人)。

**STORY-175 Postgres 链后端** `work:033acb8e4af4020cdadf8761`(前置 171、174)
要义:chain schema DDL+租约对应物+GRANT/触发器+fail-closed;GRANT 面红腿(非引擎角色写必拒/UPDATE·DELETE 必拒/伪 prior_hash 必拒读)。
subtasks:
- 175.1 DDL 落地(事件表/元数据表;views 引擎侧派生);
- 175.2 PG 驱动选型过外采四审(许可证/供应链/防幻觉包名/运营成本),锁版本;
- 175.3 append 路径:事务内追加+durability 读回(对应 atomicWrite+readback 语义);
- 175.4 租约/mutation claim 对应物;
- 175.5 GRANT+触发器上线与红腿测试;
- 175.6 fail-closed 路径与 reason code 映射(连接不可达/校验不过)。

**STORY-176 双后端等价门+PG 测试基建** `work:4b1af6c1f07a74ece0c475db`(前置 174、175)【窗前硬件①】
要义:等价门(字节/reason code/head 哈希)+mutation 证人+临时 PG 实例测试基建(本地与 CI 同批,pnpm test 红线)。

**STORY-177 knowledge/artifact 两店 PG 化** `work:49b369e168bf854f58e88835`(前置 175)
要义:两店入 PG,marker/CAS 语义原样(knowledge CAS 用 store marker 版本),claim 协议按 ADR;高水位失配照旧拒读。
subtasks:
- 177.1 knowledge 店表设计(marker/metadata/bodies)+CAS;
- 177.2 artifact 店表设计(store/records/transient/archives);
- 177.3 两店 claim 协议对应物;
- 177.4 高水位 digest 绑定回归测试;
- 177.5 等价并入 176 门。

### EPIC-054 迁移动词族(双向)与备份重基 `work:4a1304a35351ac46ff4c3a04`

**STORY-178 迁移动词族** `work:e2e038dddfe4b0d5f64b11fc`(前置 176)
要义:migration-plan/execute/verify/rollback,双向同判据;旁路拷贝必拒(绑定不随字节走)。
subtasks:
- 178.1 migration-plan(盘点段文件/两店/台账,产计划书);
- 178.2 migration-execute(流式逐事件搬运+两店,claim 静默期内执行);
- 178.3 migration-verify(双向逐事件摘要比对+版本连续+marker 一致);
- 178.4 migration-rollback(=反向 execute+verify);
- 178.5 台账写入与额度消耗语义(按 ADR 171.7);
- 178.6 旁路拷贝拒读(工作区标识/根身份绑定的 PG 对应)。

**STORY-179 备份/快照/核对重基** `work:c38be8ca18a8d0f6dbea2e5e`(前置 175)
要义:paired backup→VM 侧 pg_dump 定制格式+摘要(PULL 不变);snapshot/export 被绑对象按 ADR ⑦;engine-host:verify 的 DB 等价物;备份注入一字节 verify 必红。

**STORY-180 scratch 往返迁移实证** `work:41cd58d7aec961fc483eb97d`(前置 178、179)【窗前硬件②】
要义:file→pg→file 完整往返 diff 为空+版本连续+marker 保持;中途注入差异被 verify 拦截;实证归档(INC-042 约束)。

### EPIC-055 AOS 门面服务(读写,PG 底座) `work:77801d322706b5241a45c79c`

**STORY-181 读面全集与部署形态** `work:5184834e16fb1f541afbdabd`(无前置,可先跑在文件后端上)
要义:VM 常驻(形态方案期定)、绑回环经隧道;读=引擎读动词全集,工具目录从 commands 派生,只读断言两侧派生;读进程不持 pins。
subtasks:
- 181.1 方案:进程形态(扩展座舱 vs 新 systemd 单元)+端口与隧道拓扑(自 manifest 导入,不手写);
- 181.2 工具目录派生器(host commands→门面工具表,60s TTL 复核,沿 remote-read-mcp 模式);
- 181.3 五分区 workspaces 扩面(CockpitServiceOptions.workspaces 既有接缝);
- 181.4 读转发与 reason code 保真;
- 181.5 只读断言独立源派生(readOnlyHint/destructiveHint),失一即拒答;
- 181.6 systemd 单元+部署脚本(沿 aos-engine-host/apply 模式,ledger 留痕)。

**STORY-182 写面仪式语义服务端化** `work:f259c5066ba7d9af72198e6b`(前置 181)
要义:批+全值回读、expected-version 服务端现读(knowledge 用 store marker)、动词白名单派生、供权族与 reserved flags 拒绝、收据物化+scrub+throw 收据;门面不写链。
subtasks:
- 182.1 仪式计划器移植(ceremony-plan 校验面整表);
- 182.2 服务端 head/marker 现读与 CAS 供给;
- 182.3 批执行器+逐步回执;
- 182.4 回读判决器(全值比对,NOTHING_COMPARED 不算比对);
- 182.5 收据物化+宿主路径清洗+throw 收据(INC-047);
- 182.6 审计 spans(沿 ceremony-spans 形态)。

**STORY-183 拒绝面语料与宕机演练** `work:d8470bce54832e7e2e29f813`(前置 182)
要义:拒绝语料集承接 INC-047/069 保护目标(随核销清单指名);移除任一规则对应语料必转 PASS 且被证人捕获;门面宕机→break-glass 只读+影子队列 replay 演练。

**STORY-184 门面真实写生效证据** `work:6c7e52202d170a935a6a670f`(前置 182、183)【窗前硬件③】
要义:本机经门面对真实链一次治理写+全值回读;红腿=批内注入白名单外动词整批拒且链版本不动;目标链取活跃度最低(派工时定)。

### EPIC-056 客户端与名册收敛(切换同窗) `work:65cf5f278a2ca1f50e7ba6d4`

**STORY-185 两 MCP 面改指门面** `work:48970e7a57787d63bd4709fd`(前置 181、182;执行=窗内)
要义:底层通道 SSH+CLI→门面客户端;工具名/参数/reason code/拒绝面零变化;fallback 触发判据改「门面不可达」;不可达=fail-closed+break-glass 指引,绝不静默转 SSH。
subtasks:185.1 读面客户端替换;185.2 写面 runCeremony 底层替换;185.3 形状回归(既有语料零改动跑通);185.4 fallback 判据与指引文本。

**STORY-186 白名单收缩与拓扑清欠** `work:960e88fa51ea3a5c4e9d0e7f`(前置 181,可先备)
要义:allowlist 两类更新(fallback 类改指门面不可达、byte-compare 类保留)+全表复审日期;topology 唯一源承载门面地址;清欠 cockpit-service 手写引擎路径。

**STORY-187 判据扩面与入口文档改写** `work:f805208e3c9bd147f95cbc1c`(前置 185、186;执行=窗内)
要义:doc-topology 核访问形态、local-purity PG 语义重述、parity Codex diff(应用须 Owner 批);入口文档复核命令列白名单外零 SSH;helper 文本只备不发布。
subtasks:187.1 doc-topology 访问形态判据;187.2 local-purity 重述;187.3 parity diff 生成器;187.4 平台/AOS CLAUDE.md 改写稿;187.5 helper 引导文本改写稿(备 candidate);187.6 七门全绿+伪漂移红腿。

### EPIC-057 五链切换窗与收口 `work:2b6a166e82ea80e6337cb669`

**STORY-188 窗前就绪** `work:ba1b7255d0622a5d24eabe07`(前置=四硬件相关单)【窗门】
要义:VM 生产 PG 开通(版本/角色/pg_hba/systemd/备份接线);末次文件备份+异地验证+永久留存;四硬件机器核对(先自证联合可满足);窗时点报备 Owner。

**STORY-189 五链切换窗执行** `work:8797455f66197645465abb73`(前置 188)
要义:窗内逐链迁移+verify(小链先行)、文件树转只读归档、SSH 读转发退役、185/187 同窗落地;异常即按链反向迁移回滚。
subtasks:189.1 窗排程与通告;189.2 逐链执行序+逐链回执;189.3 归档标记+只读验证;189.4 SSH 读转发退役(服务/名册/文档同步);189.5 客户端与判据切换落地;189.6 全窗审计汇总+五链终态核验(版本/marker/新后端备份首取)。

**STORY-190 收口与发布准备** `work:f01d514e0ebf8e3d3328dcce`(前置 189)
要义:tip 复量协议(末门晚于末提交、runner 产结果表、证据命令从链上推导)、核销清单核验 diff 为空、done 前逐单挂生效证据、发布材料备齐后**停**(唯一必停点)。

## 四、风险登记(随 POS-C060/C061 入链,此处速查)

1. PG 是信任链首个常驻有状态依赖:宕=五链不可写;对策=fail-closed+备份纪律,禁双轨兜底。
2. 单实例承载五链+域库:备份与恢复演练先于切换窗(STORY-179/188)。
3. 协作同库:GRANT 边界失守即打穿"只有引擎写链";对策=GRANT 红腿测试(175.5)。
4. 单窗全切放大爆炸半径:对策=窗前四硬件+按链回滚教条。
5. 等价门恒真风险:对策=mutation 证人(176),零证人即违公约 12。
6. 取消顺序门后 INIT-019 未清单蒸发风险:对策=STORY-172 核销清单+190 核验。
