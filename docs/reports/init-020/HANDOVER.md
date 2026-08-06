# INIT-020 交接文档(HANDOVER.md)

> **写给谁**:任何接手执行 TCRN-CROSS-INIT-020 的会话(含非旗舰档位)与 Owner。
> **本文角色**:AOS/VM 临时中断时的**本地权威副本**(与 PLAN.md 配对);恢复后以链为准逐单校对。
> **截至**:2026-08-06 切换窗技术切投完成,链 **v2122**。引擎 v0.11.2(段限修复)/v0.11.3(CLI PG 读)已发版部署;五链 file→pg 迁移+verify 绿;门面读写从 PG 服务;S185(两 MCP 面→门面)done;189.3 文件树只读归档;INC-073 done;closeout-verify 通过(INC-061..071 对账)。
> **硬性状态**:窗口执行中(S189/S190 active);唯一必停点=对外发布(引擎版本发布+helper candidate 重钉)。

---

## 0. 三十秒了解本 INIT

AOS 数据平面完备化:(a) AOS 成为引擎前的唯一读写门面(VM 常驻服务,本机 MCP 两面降为其客户端);(b) 引擎存储后端由规范字节文件树**单轨完整迁移**到 **Postgres**(VM 单实例,五链各一 chain schema,GRANT 机械化"只有引擎写链",为未来协作功能写入打地基)。方向 D1-D5 全部已裁(MIN-063 + MIN-064 改裁),**无待 Owner 确认的方向项**;唯一必停点=对外发布。

## 1. AOS 中断时的续命卡(本文存在的首要原因)

| 需要 | 中断时怎么办 |
| --- | --- |
| 查计划/拆单 | 读本目录 `PLAN.md`(全树+subtask)与本文;scope 逐字副本在 `deploy/aos-local-client/payloads/cross-init020-*.json` |
| 只读核查链状态 | break-glass 白名单仅两类(`deploy/aos-local-client/ssh-breakglass-allowlist.json`):①主机 MCP 面不可达的 status 只读核查;②`pnpm engine-host:verify` 逐字节比对。**使用须在记录里写明不可达理由** |
| 有写入意图 | **不得**绕道写链(SSH 写=与编辑器改控制树同罪)。走 fallback 影子队列捕捉意图:`deploy/aos-local-client/fallback-cli.mjs`(probe/write/replay),恢复后 replay 经正门重放 |
| 恢复后对账 | 以链为准:`tcrn_remote_read_status(partition=cross-project)` 看版本;对 PLAN.md 每单 `tcrn_remote_read_work_show(id=…)` 校对;影子队列逐条 replay 并回读 |

## 2. 开工前的信任面验证(每个受治会话必做)

```bash
node ~/.tcrn-workflow/trusted-bootstrap.mjs verify-installed-copy --installed-dir "<平台>/.claude/skills/tcrn-workflow-helper" --provenance ~/.tcrn-workflow/complete-skill-archive.provenance.json --state ~/.tcrn-workflow/state.json
```
期望 `INSTALLED_COPY_VALIDATED`(实测 v0.10.2)。写 VM 链前另跑:
```bash
pnpm --dir "<平台>/TCRN-AOS" engine-host:verify
```
期望 `AOS_HOST_ENGINE_MATCHES_GOVERNED_COPY`。

## 3. 方向与轨道必答段(公约 docs/direction-and-tracks-convention.md 附录 A)

**Q1 触发类方向选择**:①存储数据模型替换(文件树→PG schema);②真值落点与常驻服务(PG 单实例住 VM、谁常驻、备份从哪端发起);③会封死替代架构的单轨切换(旧文件轨退出生产)。三项均已前置裁定(MIN-063/MIN-064),未留执行期撞见。

**Q2 备选与被拒**:
- 保留:Postgres VM 单实例、schema 分域、GRANT 机械化(MIN-064 D3)。
- **被拒** SQLite 每分区一库——Owner 裁:不承载未来协作功能写入(MIN-064)。
- **被拒** 双轨过渡+日落条件表——Owner 裁:完整迁移(MIN-064 D4)。
- **被拒** 维持 SSH 转发常驻/门面建在本机——转发不是承接;真值在 VM(MIN-063,POS-C060-FABLE-1)。

**Q3 保留轨道三件套**:

| 轨道 | 适用性谓词(具名受益者) | 运营成本归属 | 日落或复审 |
| --- | --- | --- | --- |
| PG 生产轨(五受治链) | 全部受治分区读写方;未来协作功能 | VM 宿主运营(systemd/升级/备份)随本 INIT 移交平台运行者 | 复审=年度 PG 版本升级评估(ADR 171.1 定节奏) |
| 文件后端(本地模式轨) | 未接入 AOS 的工作区(bootstrap 期/独立宿主)、四条 fallback 影子链 | 引擎测试套件既有覆盖,零新增常驻 | 复审条件=MIN-060 D4 被改裁之日;影子链谓词=门面不可达场景仍存在 |
| 文件后端(迁移/验证仪器) | STORY-176 等价门、STORY-178 迁移动词、只读归档 forensics | 同上(测试面) | 五链迁毕后随收口复审仪器保留范围(STORY-190) |

**Q4 单轨替换三答**:迁移路径=EPIC-054 动词族(file→pg);回滚路径=同族反向(pg→file,同判据);旧轨移除时点=五链迁毕验证绿后当场(文件树转只读归档、SSH 读转发退役)。

## 4. 决策清单归道

- **OWNER-NOW**:无(方向全裁毕)。
- **必停点**:对外发布(引擎版本发布+helper candidate 重钉)——STORY-190 备齐材料后停。
- **报备点**:切换窗时点(STORY-188,方向已裁故非 owner_intent_required 门)。
- **CONDITIONAL(ADR 内定,STORY-171 裁毕)**:PG 大版本、schema 细部、抽象口粒度、租约形态、迁移台账额度。
- **AGENT 道**:CI 内 PG 供给方式(176)、窗内链序微调(189)、首个真实写目标链(184)。

## 5. 红线清单(执行任何一单前重读)

1. **控制树/链只许引擎写**;PG 后=只许引擎角色写(GRANT),任何旁路(SSH `cat >`、编辑器、psql 手写 chain schema)都是同一宗罪。
2. **写链必经仪式**(今=ceremony.mjs/aos-mcp-write;门面 GA 后=门面写面):批+至少一条**全值回读**;载荷不得指名 `workspace`/`attest-dir`/`expected-version`;knowledge 动词族 CAS 用 **store marker 版本**非链版本。
3. **ceremony 默认分区是 TCRN-AOS**——写 cross 必须 `--partition cross-project`,判据=dry-run 的 `chainBefore.version` 对上目标链。
4. 引擎测试必须经 `pnpm test` 调起;改门先问"什么会让它变红"(判据两侧必须能够不同);门必须晚于末次提交再跑(tip 复量)。
5. 列表型旗标按半角逗号切分——条目内只用顿号/全角标点;`-` 是空哨兵。
6. 证据不得携带宿主路径(scrub;门扫 tracked+evidence 树);本目录证据受 **INC-042** 约束:未收口前不入库(git commit)。
7. 本地全绿≠CI 绿:push 后 `gh run watch`。
8. subtask 不建链记录(MIN-053 两层制);链上颗粒度到 Story 止。
9. 静默降级禁止:门面/MCP 不可达时 fail-closed+break-glass 记录,**绝不静默转 SSH**。
10. 未推送提交的推送=发布动作,按 MIN-062 Q5 分批并留证据;发布是唯一必停点。

## 6. 键号速查(全 30 单)

- INIT-020 `work:4d0ecd9c1e6ea5292ef08330`;CONF-060/MIN-063 `minutes:f72e665a445e64950ab0488d`;CONF-061/MIN-064 `minutes:6b3a226012700f4322fd28ee`
- EPIC-052 `a3b94d6d202005f5fe229f0c`(S171 `491be6f960ecc1f73d5aabc2`/S172 `6767241b2a45cb5a81aecef8`/S173 `d1f2a24bb7ebd51b93bd071d`)
- EPIC-053 `ca7ba689328314c776bc29b8`(S174 `0d2a6d6f5ba7f61f8376b710`/S175 `033acb8e4af4020cdadf8761`/S176 `4b1af6c1f07a74ece0c475db`/S177 `49b369e168bf854f58e88835`)
- EPIC-054 `4a1304a35351ac46ff4c3a04`(S178 `e2e038dddfe4b0d5f64b11fc`/S179 `c38be8ca18a8d0f6dbea2e5e`/S180 `41cd58d7aec961fc483eb97d`)
- EPIC-055 `77801d322706b5241a45c79c`(S181 `5184834e16fb1f541afbdabd`/S182 `f259c5066ba7d9af72198e6b`/S183 `d8470bce54832e7e2e29f813`/S184 `6c7e52202d170a935a6a670f`)
- EPIC-056 `65cf5f278a2ca1f50e7ba6d4`(S185 `48970e7a57787d63bd4709fd`/S186 `960e88fa51ea3a5c4e9d0e7f`/S187 `f805208e3c9bd147f95cbc1c`)
- EPIC-057 `2b6a166e82ea80e6337cb669`(S188 `ba1b7255d0622a5d24eabe07`/S189 `8797455f66197645465abb73`/S190 `f01d514e0ebf8e3d3328dcce`)
(work id 派生律:`work:` + sha256("work\0" + 大写外键) 前 24 位;work-show 只收内部 id。)

## 7. 关键文件指针

- 仪式与拓扑:`deploy/aos-local-client/ceremony.mjs`(载荷格式)、`topology.mjs`(唯一拓扑源)、`aos-partitions.mjs`(分区→VM 地址)、`ssh-breakglass-allowlist.json`
- 本 INIT 档案:`deploy/aos-local-client/payloads/cross-init020-{a,b-confirm,c1-stories,c2-stories}.json` + 本目录四份 `*.receipt.json`
- 引擎存储现状(2026-08-06 勘察):`tcrn-workflow/packages/core/src/workspace.ts`(链树唯一写者,四私有 IO 助手)、`workspace-snapshot.ts`、`knowledge-core.ts`/`artifact-lifecycle.ts`(两店旁路)、`packages/protocol/src/index.ts`(规范字节与逐事件哈希)、`packages/cli/src/mcp.ts`(引擎自带 MCP 面,门面现成资产)、复杂度实证 `tcrn-workflow/docs/2026-07-17-p3-compaction-deferral-decision.md`
- 门面现成资产(AOS 侧):`apps/cockpit-service/src/service.ts`(多分区接缝 CockpitServiceOptions.workspaces;一处手写引擎路径待清欠)、`packages/projection/src/{write-surface,chain-client}.ts`、`deploy/aos-local-client/remote-read-mcp.mjs`(工具目录派生与两侧断言模式)
- 收口机器:`tcrn-workflow/scripts/closeout-evidence-runner.mjs`、`closeout-verify.mjs`

## 8. 链上收口动作模板(执行期用)

每单:开工 `work-transition`(planned→active)→ 完工先跑该单生效证据命令(两侧)→ `work-annotate` 挂生效证据输出 → `work-transition` done——全部经仪式(批+回读),dry-run 核 `chainBefore` 后再实跑。批收口:closeout runner 对最终 HEAD 重放批内全部生效证据命令 + closeout-verify 对核销清单 diff;红即拒收。

## 9. 交接时的未尽事项(如实)

- INC-061..071 的核销**清单尚未定稿**(那是 STORY-172 的活),PLAN.md 里的表是预判不是裁定。
- EPIC-025 仍 blocked;enforce 相关接缝按 MIN-062 Q2 单面裁流程,与本 INIT 并行不互锁。
- 本目录与 payloads 新增文件均**未 git commit**(INC-042 证据约束+发布纪律);入库随收口走。
- helper 引导文本、平台 CLAUDE.md 的门面化改写只在 STORY-187 备稿,发布随必停点。
