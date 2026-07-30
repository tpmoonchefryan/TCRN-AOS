<!-- 本文件为 CONF-007 会议包定稿副本(工作树,未提交)。侦察与对抗校验原始 JSON 见 evidence/conf-007-recon/;其中含本机绝对路径,如需入库须先脱敏。收据: evidence/conf-007-execution-receipts.json -->

# 迁移裁定会会议包 v3(对抗校验后定稿)

依据: MIN-002「切换段全部参数待迁移裁定时另会」「只裁方向不排期」;CONF-002 裁定三「届时专机或专卷+备份 SLA+访问收紧与迁移同门裁定」(position:4a51d78b,seq 66);MIN-003 切换段修正;CONF-001 分解裁定;六路侦察(recon/)+三路对抗校验(verify/)全部 24 条发现已折入。

## A. 落链对象(可更正不可抹除——纠错=追加更正记录或 tombstone,键号一经写入永久消耗;呈报形态=已执行待驳回,驳回的实际形态是 tombstone+更正注解,非撤销)

执行时序(硬约束,循 CONF-005/006 先例「先分头产出后转写」):
① 先跑四个互不可见 persona 子代理取立场全文 → 落收据文件 TCRN-AOS/evidence/conf-007-execution-receipts.json(含各立场 outputDigest、子代理标识、freshContext)→ 立场文本自此冻结;
② 再落链: INIT-002 → CONF-007 open → 逐条追加立场(开场最先,引用收据文件 sha256)。

1. `TCRN-AOS-INIT-002`(Initiative,parentless,planned)
   - scope: 承载 AOS 分区切换段(两段式真值拓扑,MIN-002 方向已裁)。**若 CONF-007 把切换范围裁为超出 AOS 分区,跨分区承载另立 cross INIT,本 INIT 收敛为 AOS 侧执行分册——承载分区本身是 T1 显式待裁项**。分解待 CONF-007 裁定后;INIT 保持 planned 待启动令(CONF-001 先例)。
   - decided-by: minutes:3a0d27be789cadb0ccb353c1
   - ⚠ 活风险: 在 T-INC-034 的候选排除修复落地前,运行 mirror-acceptance-proof.mjs 会把本记录(链上唯一非终态)当迁移对候选推出 planned——修复前勿跑该门。
2. `TCRN-AOS-CONF-007`(type=architecture,--work-ids=INIT-002)
   - participants(六方): owner:governance、profile:tcrn-arturo-v1、profile:tcrn-minerva-v1、profile:tcrn-verity-v1、profile:tcrn-sable-v1、profile:tcrn-mara-v1
   - 立场键(公约「键号带轮次」+链上 C005/C006 会议限定先例,30 候选已全量派生核查 free): POS-C007-ARTURO-1(开场,主线程综合)→ POS-C007-MINERVA-1 → POS-C007-VERITY-1 → POS-C007-SABLE-1 → POS-C007-MARA-1;拆片键 POS-C007-<AGENT>-1-2,正文标 1/2、2/2,逐字拼回
   - 开场立场首行(定稿模板): 「执行形态 multi-agent-deliberative——仅覆盖 POS-C007-{MINERVA,VERITY,SABLE,MARA}-1(四 persona 立场由互不可见的独立子代理上下文分头产出;绑定收据 evidence/conf-007-execution-receipts.json,sha256=<64hex>);本立场为主线程综合执笔(执笔 agent:fable,署名 arturo),不在绑定集。绑定证一致性非真实性,可信采集方未建成。」
   - 四条被绑定立场末行各加: 「绑定收据: evidence/conf-007-execution-receipts.json(摘要值因自指省略,见开场立场)」
3. `TCRN-CROSS-INC-026`(Incident,parent=TCRN-CROSS-EPIC-032 work:15404191b1b63e28774a0706[done,引擎放行],planned)
   - scope: conference-open 与 conference-append-position 需要一条能写 extensions 的受治通路,使 core 已建成的 fail-closed 执行溯源判据(conference-execution.ts)可达。依据: MIN-002 未决项明令;deliberation-adoption-convention.md 对 v0.7.0(HEAD 2e6cfe3)复核缺口仍成立。
   - cross 写纪律: --actor 必带、不带 --attest-dir(cross 未采纳时间见证)、actor=agent:fable

## B. 议题清单 T1-T12(全部=真待裁)+轻量待裁一件

### T1 切换范围与承载
- 范围: 切换覆盖哪些分区(cross/DS/TMS/AOS)。纪要未明示——须裁。推荐全分区一体,最强链上支撑=Owner 原话「workflow 只应选一种模式工作,等 AOS 通过验收就进行数据迁移和切换,workflow 负责框架,AOS 负责数据治理」(position:518eb02a,seq 65)——拒绝双权威并存。
- 承载 INIT 分区: 本包已在 AOS 分区立 INIT-002(收窄 scope);若裁全分区,跨分区承载另立 cross INIT——显式待裁。
- 逐分区参数表(若裁全分区,矩阵与锚须按此实例化): AOS{attestation 启用+attest-dir 330 收据+域库有(配对锚)+events 972,017B 贴线};cross{attestation 启用+无 sidecar+无域库(纯链锚)+events 1,814,703B **已越 1MiB**};DS{同 cross+events 1,134,152B **已越**};TMS{**attestation 从未启用**(矩阵 R5 行预声明 not-applicable 并留理由)+events 273,557B}。cross/DS 的逐事件摘要序列/分块路径是硬前置非备选。
- 「权威 local-first 保留」(MIN-002 决议五)残余适用性: 切换终结其成立状态。须裁: 对 fallback 回退期等场景条件化保留,还是随 CONF-007 纪要显式退役并记理由(harness-constraint 公约 6-8)。

### T2 容器形态
- 推荐 **O1 部署位面切换**(链文件逐字节迁 VM 本地盘、受治引擎随迁、AOS 服务端经既有 ChainClient→MCP 门面调引擎;五件套零格式变化);**O3 已验证行镜像**作矩阵仪器随行(权威始终文件+引擎,行镜像明确不备);**O2(SQLite 承载)延后**,复审条件=W 引擎经自己的 Initiative 开出存储端口(appendEvent 全内联 workspace.ts:2239-2327,AOS 单方面做=会漂移的第二实现)。
- 读法披露(须 Owner 认可): 立场原文「AOS **库**承接存储与运营面」——O1 读作「AOS **管辖宿主**承接存储」;「库承接」的字面读法是 O2,已论证延后。
- 硬前置①(owner): pins 落点——现行裁定 pins 只住操作者本机、写面仅回环(service.ts:24-30,107-109);切换段必然在 AOS 宿主出现写面与供权驻留。
- 硬前置②: VM 链目录必须落引擎钉死本地文件系统集合(workspace.ts:198-207;ext4/xfs 可,NFS/virtiofs 拒),仪式内实测 statfs。
- 本机角色: Mac 切换后=镜像消费端+仪式终端之一;治理仪式写经何通路达 VM(SSH 受治会话 or 本机远拨)——须裁。
- VM 引擎信任: verify-installed-copy 在 VM 的等价物(受信 bootstrap+机器信任态)——迁移仪式一项。

### T3 写面分工表(引擎 39 mutating 动词,其中 2 个 fixture-only 列于 snapshot-recovery 行内、不构成可达写面)
| 家族 | 处置 | 复审条件 | 据 |
|---|---|---|---|
| work-create/transition/annotate(+入列) | 进 AOS 安全写面 | — | CONF-001 已裁;SafeWriteSurface 已建成,HTTP 只活流转——接线债 |
| work-delete | 不进 | 无(AOS 自列 CEREMONIAL_WRITES) | write-surface.ts:157 |
| conference×4 / gate×3 / knowledge×7 / project×3 | 留 CLI/MCP 显式仪式 | 每 INIT 收官复盘可提请 | CONF-001「治理写显式仪式」;gate 自建自删=稀释停顿预算 |
| snapshot-recovery×5 | 不进 | **T2 pins 落点裁定后复审** | 修复动词进服务=掩盖损坏的自愈 |
| adapter-operator×11 | 不进 | **T2 pins 落点裁定后复审**(原据 pins 不旅行将被 T2 有条件推翻,据空则结论重证) | 宿主生命周期/供权机构 |
| init / attestation-enable | 不进 | 无 | 一次性奠基仪式 |
- 双轨三件套(direction-and-tracks 公约 4): 安全写面轨{适用谓词=高频工作图写、成本=AOS 维护、复审=每 INIT 收官};仪式轨{适用谓词=改变停顿预算或信任结构的写、成本=操作者时间、复审=写面事故或 Owner 提请}。
- 被拒形状(公约 3,一句理由落链): 「conference/gate 写面进 AOS」拒于治理写显式仪式已裁;「探针记录方案(路 A)」拒于键号污染与闭合破坏。
- 归因前置: cockpit-service 默认 actor 固定 agent:fable(service.ts:72)——写面扩容前须裁逐请求归因来源。
- head 哨兵只许 work 图写;仪式动词须显式绑版本,不复用 SafeWriteSurface.base()。
- 撞名警示: mcp-gateway 的 aos.gate.*/aos.conference.*/aos.knowledge.* 写 AOS 域库、dry-run,与引擎动词无关。
- 新约束登记(harness-constraint 公约 1/5): 「不进」各行=主权型+审计型约束,闭会纪要双落点登记。

### T4 一致性矩阵(五件套×四判据,逐分区实例化)
- 行=append-only/规范字节/哈希链/可回放/attestation(权威列举 position:4a51d78b;时间见证=工作区外 sidecar,挂 R5C4 不单列);列=字节等/规范形等/回放等价/摘要互指。
- 双跑程序: lockstep 检查先于取锚 → 冻结写面 → F 侧 validate+逐事件规范摘要序列+状态投影分段摘要+attestation setDigest → A 侧同锚同判据(判据函数唯一来源=受治引擎,禁双实现)→ 逐格 {verdict,全 64 位摘要,红码} → pair-manifest 式互指归档。
- 通过标准: 全部适用格 equal;每列红证在 scratch 实跑变红(未跑红证的列不计通过);not-applicable 须拆单时预声明(TMS R5 行);mismatch→fallback 对账不局部放行;双侧受测根先证非同 inode;矩阵通过≠切换授权(后接 owner 门)。
- 红证清单见 recon/five-pieces-matrix.json redProof(含 C3 无密钥哈希盲区/C4 补位成对红证、R5 独立性红证、R1 A 侧 UPDATE 拒绝试金石)。
- 缺口内建: cross/DS export 已越 1MiB→逐事件摘要+分段投影/canonical-exchange 分块为硬前置;MCP 门面 1MiB 行拒绝→矩阵取证走 CLI;R1/R3 A 侧格=MIN-003 所指两件建成的验收标准。

### T5 切换段访问边界与写面认证(CONF-002 裁定三「访问收紧与迁移同门裁定」——本会必裁)
- S019 现状=「LAN 信任+暂不建认证层」,其三前提全系镜像段专属(受众=Owner 设备;「认证层保护的是尚不存在的观众」;「供权永不上 VM 已结构性保证」)——切换段两前提俱失,S019 只可作镜像段先例引用。
- 须裁: ① VM 链写面对谁开放(仍绑 127.0.0.1 仅经 SSH 隧道 / LAN 内认证层(traefik 中间件,S019 原单曾列) / mTLS 等价);② S019 绊线条款(地址一出 Owner 设备即重开并按对外发布级处理)是否升格为写面级绊线;③ S019 单是否按自身前提失效而重开。

### T6 fallback 对账(含演练义务)
- 第 0 步(与矩阵同级写进验收): AOS 写路径必须产出可重放有序日志(单调序号+切换锚引用+规范化载荷)。
- 切换锚=仪式最后一笔文件侧动作: 配对快照互指(AOS 分区)/纯链锚(无域库分区),锚回执过 snapshot-verify;文件容器随即降为导出归档。
- 回退六步: 冻结→复原基座(SNAPSHOT_VERIFIED+validate+knowledge-validate)→枚举增量(映射不到引擎动词的记录=语义漂移,单列呈 Owner)→受治重放(逐笔经引擎动词,绝不直写控制树,带 provenance 注解)→对账矩阵反向→新锚+回退事实落链。
- 不可对账类预命名: 事件哈希(对账层级=记录内容摘要)/at 瞬刻(原始瞬刻活在 provenance)/时间见证收据(旁证归档不重放)。
- **演练义务**: 回退程序在切换 owner 门之前须在 scratch 副本完整演练一次(含增量枚举与受治重放至少一笔真载荷),证物随矩阵归档(裁定四先例「方案生效前须先做一次恢复演练」)。

### T7 切换段备份拓扑与 SLA(CONF-002 裁定三/四明令与迁移同门——本会必裁)
- 须裁: ① 发起端与调度落谁(VM 常开=调度天然归 VM,但 VM 须引擎+检出方能自证可恢复性——今天 farSideVerification 只证字节);② 异地方向与凭据(VM→本机 / VM→云;OneDrive 为本机挂载,VM 直写需新凭据——凭据放置题整体重问);③ 节律与 SLA(gate-close 快照公约切换后由谁触发;RPO;保留份数);④ 恢复演练前置在切换段重做。
- 期中附件(镜像段仍运行期间的 S020⑤): push(零新凭据/依赖本机在线/实现最小) vs pull(VM 持能读本机凭据从零变非零且内容=治理链全文/RPO 稳/须告警回传否则重演「交付一次再无人验证」×4 先例);Owner 六项勾选清单见 recon/ops-fallback-vm.json。两案不变量: VM 验证天花板=字节;manifest 不认证来源,要认证须另加签名,两案同价。

### T8 工作区外 sidecar 清单与 gate 身份权威落点
- 权威立场原文「时间见证**等**工作区外 sidecar 随迁」——「等」要求清单。实测容器层: attestations/(仅 AOS,330 收据)、**release-trust/gate-identity-authority.json**(gate-transition 必带的身份权威,GATE-002 以它关闭)、evidence-locator/(空)、transient/。
- 最要害: gate 身份权威落哪(随迁上 VM / 留本机经 SSH 仪式引用 / 归「供权材料永不上 VM」类)——与「切换 owner 门在哪执行」绑定裁;若链在 VM 而权威在本机且无通路,切换自己的 owner 门都开不了。

### T9 镜像段资产处置
- aos-mirror 三选一: 保留(改为真值同宿主只读投影面,构建移 VM)/退役(真值服务面直接承读)/降级本机快照;cockpit-data.generated 手动刷新链的替代(投影直读 or 调度化);S018「as-of/零写面」命名诚实边界在同宿主出现真值写面后的等价物。

### T10 专机复审+监控告警义务
- 引文校正: MIN-002 复审条件=「迁移切换裁定进入执行」,原裁定同句要求「与迁移同门裁定」——本会提前呈报三出口,正式裁定可留至切换 owner 门。
- 事实: 单节点 k3s 共置 TMS api/worker(持 JWT/DB 凭据)+AOS 镜像;今天 VM 安全故事=零写面+零凭据+LAN-only,切换砍前两条;容量有余(~525m/1.15Gi 请求),压力在故障域与凭据共置;备份若仍只回流本机,单点只是换位。
- 三出口: (a) 不专机,条件=ns 隔离+资源配额+AOS 真值独立 PV+**最小告警集**(链写错误/磁盘水位/备份到期未跑/lockstep 失守+回传通路——无答案即不可运维);(b) 不专机但真值盘独立;(c) 专机,原 VM 留 TMS 开发+只读镜像。
- 「真值在谁那里,告警义务就在谁那里」——告警面为切换段新增负担第④项,独立呈报。

### T11 W 侧立单呈报
- TCRN-CROSS-INC-026(A.3),已按 MIN-002 明令执行,呈报可驳回。

### T12 排期、启动令与入列
- MIN-002「只裁方向不排期」到期: 若 T1-T10 裁齐,请 Owner 下 INIT-002(或裁定后的 cross INIT)分解令。分解轴建议=仪式步序(写日志+行镜像仪器→矩阵建成+逐列红证→VM 引擎信任+访问边界→迁移演练+回退演练→owner 门→切换→降级归档);写面接线债(建卡/注解/入列三路由+归因裁定)可作先行 Epic(顺带解 INC-034 轻量件)。
- 入列勾选: INIT 入 SPRINT-00X(停点按列车语义批并)还是快车道(MIN-040/041)。
- 宿主对等入分解决策清单: 切换后 Claude Code 与 Codex 的链写/读通路各自形态;不对等期间按仪器纪律在 kickoff 名册记缺口。

### 轻量待裁(非议题,附 T3 接线 Epic): INC-034 残余处置
- 采纳路 B: 补建 /api/chain/annotate(仅缺路由);判据 4 改「迁移对为主,链全终态时回退注解对」。
- 修订细则(采对抗校验): ① 迁移对候选集排除治理骨架记录(至少排除 Initiative kind,或只对裁定指定探针执行);② 盖章记录=TCRN-AOS-INC-034,印记构造=读头部 scope 全文、逐字保留、前挂时间戳行后写回(scope 是整值替换语义 workspace.ts:896-904,裸时间戳会顶掉解决叙事);③ 拒绝半边判据绑定 reason 消息逐字「annotation does not change any advisory field」且写半边 revision+1、重放后 revision 不变(WORKSPACE_INPUT_INVALID 是几十条错误共用码,只判码=恒绿门);④ scratch 先跑红证。
- 不采纳路 A: 键号污染/墓碑永占/闭合破坏,无裁定支撑(理由落链为被拒形状)。

## C. 命令序(执行时展开;$W_A=".../.tcrn-workspace/TCRN-AOS/workspace",$W_C=".../cross-project/workspace",$ATT=".../.tcrn-workspace/TCRN-AOS/attestations",<T>=当刻 UTC RFC3339)
0. (落链前)四 persona 子代理跑毕→收据文件落盘并取 sha256
1. work-create --workspace "$W_A" --expected-version head --at <T> --project-id project:899d30df2e67bc6e98a4f50e --external-key TCRN-AOS-INIT-002 --kind Initiative --parent-id - --status planned --actor agent:fable --attest-dir "$ATT"
2. work-annotate --workspace "$W_A" --expected-version head --at <T> --id <record.id> --scope <A.1 文> --decided-by minutes:3a0d27be789cadb0ccb353c1 --actor agent:fable --attest-dir "$ATT"
3. conference-open --workspace "$W_A" --expected-version head --at <T> --external-key TCRN-AOS-CONF-007 --project-id project:899d30df2e67bc6e98a4f50e --type architecture --title <题 109B> --work-ids <INIT-002 id> --desired-outcome <文 ~430B> --participant-ids owner:governance,profile:tcrn-arturo-v1,profile:tcrn-minerva-v1,profile:tcrn-verity-v1,profile:tcrn-sable-v1,profile:tcrn-mara-v1 --actor agent:fable --attest-dir "$ATT"(回执扁平 recordId)
4. conference-append-position ×N --workspace "$W_A" --expected-version head --at <T> --conference-id <recordId> --external-key POS-C007-<AGENT>-1[-2] --actor-id profile:tcrn-<persona>-v1 --actor agent:fable --position <≤2048B> --risks <顿号内文> --recommendations <顿号内文> --evidence-ids - --attest-dir "$ATT"
5. work-create --workspace "$W_C" --expected-version head --at <T> --project-id project:e7da35c5aade8dd42c91cb0f --external-key TCRN-CROSS-INC-026 --kind Incident --parent-id work:15404191b1b63e28774a0706 --status planned --actor agent:fable
6. work-annotate --workspace "$W_C" --expected-version head --at <T> --id <record.id> --scope <A.3 文> --actor agent:fable
停在: CONF-007 不 close;不 push 远端;不改产品代码。

## D. 决策清单(呈报)
- 已执行待驳回(驳回形态=tombstone+更正注解): INIT-002 创建+注解 / CONF-007 开会+五立场 / INC-026 立单+注解 / evidence 收据文件(工作树,未提交)
- 真待裁(owner_intent_required): T1 范围+承载分区+local-first 处置 / T2 容器+「库」读法+pins 落点+本机角色 / T3 分工表+归因 / T4 矩阵标准+not-applicable 表 / T5 访问边界三问 / T6 写日志前置+回退+演练 / T7 备份拓扑 SLA(+期中 push/pull) / T8 sidecar 逐项落点+gate 权威 / T9 镜像处置 / T10 三出口(或(a)+四条件) / T12 分解令+入列
- 轻量待裁: INC-034 路 B 四细则
- 后续硬停点: CONF-007 close → 切换 owner 门 → 部署触网时对外发布类停点
