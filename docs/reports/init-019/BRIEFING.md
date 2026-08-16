# TCRN-CROSS-INIT-019 派工执行简报 —— 唯一数据平面与真正注入

签发:审查层 `agent:fable` · 2026-08-05 · 依据 Owner 本日口头方向与 `TCRN-CROSS-MIN-060`(CONF-057)。
**本文是 subtask 的唯一载体**。遵 `TCRN-CROSS-MIN-053` 两层制:链上记录到 **Story 级**为止,subtask 不建链记录、由本文承载。

**本 INIT 的一句话**:把「散文里反复申明的架构原则」变成「机器按得住的接口与门」,并把「建成」与「生效」之间那道无人认领的缝补上。

---

## 零、给执行者的总纲(先读这一节)

### 0.1 五要素:本 INIT 起,派工模板加一条

每个 subtask 都写全五项,缺一不派、缺一不收:

| 要素 | 含义 |
| --- | --- |
| 红线边界 | 绝对不许碰什么 |
| 文件指针 | 改哪些文件(仓相对路径) |
| 验证命令 | 怎么证明它**做对了** |
| 收口动作 | 怎么算这张单结束 |
| **生效证据命令**(新) | 怎么证明它**在部署位上活着**——不是「测试绿」,是「在它将来真正运行的那个世界里跑得通」 |

第五项是本 INIT 的核心方法论产出。它直接封死 INIT-018 暴露的整类缺陷:产物建成、测试全绿、而从未在真实位置生效(排程从未成功跑过一次;hook 因 cwd 从未启动;知识 store 标记锁死;emitter 零调用方)。
判据取自 `TCRN-CROSS-MIN-059` 已裁的「生效证据 ∈ {已证, 未证},默认未证」,本 INIT 把它从「约束编目」推广到**一切交付物**。

### 0.2 全局红线(对所有 subtask 生效)

1. **不许 SSH 直驱引擎 CLI**。读走 MCP 只读面(`mcp__tcrn-workflow-aos-read__*`),写走仪式。SSH 仅在 break-glass 场景使用,且必须在收口记录里说明理由。**这条正是本 INIT 要立的规矩,执行期就要先自己守住。**
2. **不许用文件写入工具碰任何控制树**(`.tcrn-workflow/`、`.tcrn-workspace/`)。只有引擎能写。
3. **不许把宿主家目录路径写进任何仓内文件**(公开仓:`tcrn-workflow` / `TCRN-Design-System` / `TCRN-TMS`)。举例一律用 `<local-home>` 形态。
4. **不许合 `main`、不许推送、不许发布**。发布是本 INIT 唯一必停点,归 Owner。
5. **不许自己造恒绿门**。任何新判据必须当场实测到红,且红侧要**喂真实输入**(不许靠删判据制造红)。
6. **卡住就写 `BLOCKED.md`**,写清卡在哪一步、试过什么、需要谁裁定——不要自行扩大范围。

### 0.3 工程纪律速查(平台已付学费,按这些判你)

- 判据两侧必须能够不同:写完门先问「什么会让它变红」,并真做一次。
- 不在 `verify`/`test`/CI 名册里的门,寿命等于写它那天。
- 探针会骗人:要退出码就别用管道(单独一句 `echo exit=$?`);变量引用一律加双引号;落文件时别接 `tail`;**对存在性/可见性下结论前先问「我用什么身份在问」**。
- 报缺陷前先怀疑自己的探针:先用「已知好的输入」校准它。
- 后台负载:回收写在起手同一处。

---

## 一、方向决策清单(D1–D8)

全部九项均已定案,**执行期不得重开**。D1–D4 由 Owner 本日直接裁定(`TCRN-CROSS-MIN-060`);D5–D9 经 Owner 确认「建议全部同意」升格为裁定(`TCRN-CROSS-MIN-061`,2026-08-05,指令原文逐字入档)。

| # | 决策 | 状态 |
| --- | --- | --- |
| **D1** | 接入 AOS 之后,**AOS 是唯一数据平面**;更新与读取第一时间走 AOS MCP。SSH 直驱引擎 CLI 是错误做法。 | Owner 已裁(MIN-060) |
| **D2** | 知识层的读与写同样经 MCP;由 webhook/hook 提醒 agent 按 prompt 检索并注入。 | Owner 已裁(MIN-060) |
| **D3** | 知识索引(store 高水位)缺陷必须修复。 | Owner 已裁(MIN-060) |
| **D4** | 只有**本地模式**才写本地文件;已接入 AOS 的分区,数据全部在 AOS 侧。 | Owner 已裁(MIN-060) |
| **D5** | MCP 写面形状 = **单一 `ceremony` 工具**,不逐动词转发 42 个 mutating 动词。理由:仪式纪律(批+回读+回执+`expected-version` 由拓扑自供)是一个整体,逐动词转发会把这些纪律推给调用方,等于把已经封好的口重新打开。 | **Owner 已确认(MIN-061)** |
| **D6** | 分两阶段:**阶段一**本机 MCP server 包裹现有 `ceremony.mjs`(立即统一接口);**阶段二**座舱在 VM 原生供 MCP 端点、投影与渲染上移,笔记本退为纯客户端。 | **Owner 已确认(MIN-061)** |
| **D7** | 知识内容灌入范围 = **三源策展**(自动记忆索引 / 链上 scope 与注解 / `docs/reports` 教训),首批目标 ≥20 卡,每卡 `evidence` ≥1。 | **Owner 已确认(MIN-061)** |
| **D8** | 拆单模板加第五要素「生效证据命令」,并对 `TCRN-CROSS-INC-041` 承载的四件代办**补票**(逐件补一条生效证据命令)。 | **Owner 已确认(MIN-061)** |
| **D9** | SSH 按残余适用性**条件化保留两类**(主机 MCP 面不可达的 break-glass;按设计绕开服务层的逐字节比对),其余退役。 | **Owner 已确认(MIN-061)** |

**开工状态:尚未开工。** 本简报与十五张 Story 全部就绪(planned),派工时点由 Owner 另行指令;届时按第二节建议顺序派发,STORY-159 的 D6 前提已满足、随批待派。

**残余适用性分析(D1 要求)**:SSH 直驱不是全面删除,而是**条件化保留**。仍然成立的场景两类——①主机 MCP 面不可达时的 break-glass;②按设计就要绕开服务层的逐字节比对(`pnpm --dir TCRN-AOS engine-host:verify`)。其余场景一律退役。故 STORY-158 做的是「降格 + 白名单」,不是「删除」。

---

## 二、Epic / Story 全景

| Epic | 主题 | Story | 颗粒度 |
| --- | --- | --- | --- |
| EPIC-047 | AOS 唯一数据平面(接口正门) | STORY-156…159 | 156/157 高(6/5 子任务) |
| EPIC-048 | 知识层:从零到注入 | STORY-160…163 | 160/161/162 高(5/6/6 子任务) |
| EPIC-049 | 访问路径合规门 | STORY-164…165 | 中 |
| EPIC-050 | 运行时健康与待办可见 | STORY-166…168 | 166 高(5 子任务) |
| EPIC-051 | 生效证据纪律 | STORY-169…170 | 中 |

建议派工顺序(依赖优先):**156 → 157/158 → 160 → 163 → 161 → 162 → 164 → 166 → 167/168 → 169 → 170 → 165 → 159**。
其中 165(enforce 晋级)必须等观察窗积累够;159(阶段二)待 D6 确认。

---

## 三、EPIC-047 AOS 唯一数据平面

> Epic 收口判据:平台任一文档里的复核命令都不再教人 SSH 直驱;一次治理写可以只靠 MCP 工具完成;`doc-topology:proof` 能对「访问形态」判红。

### STORY-156 —— MCP 写面:单一 `ceremony` 工具 【高颗粒度】

**为什么是它**:今天写路径是「本地脚本 + SSH 命令行拼接」。代理要么照抄一长串 SSH,要么走偏。给它一个工具,正门就只有一扇。

- **156.1 契约定稿(判断型,先出规格再动手)**
  - 红线:规格里**不得**允许调用方指名 `--workspace` / `--attest-dir` / `--expected-version`(自选的哨兵冻结不了任何东西);不得允许绕过回读。
  - 文件:`TCRN-AOS/deploy/aos-mcp-write/SPEC.md`(新建)
  - 验证:规格里逐条列出输入字段、输出字段、拒绝面(≥4 类)、以及每类拒绝的 reason code。
  - 收口:规格文件存在且被 156.2 引用。
  - 生效证据:`grep -c "expected-version" TCRN-AOS/deploy/aos-mcp-write/SPEC.md` ≥1 且上下文是「禁止调用方指名」。
- **156.2 server 实现(包裹,不重写)**
  - 红线:**不得重写仪式逻辑**;必须调用现有 `TCRN-AOS/deploy/aos-local-client/ceremony.mjs`,一切纪律沿用它。
  - 文件:`TCRN-AOS/deploy/aos-mcp-write/server.mjs`(新建)
  - 验证:`node TCRN-AOS/deploy/aos-mcp-write/server.mjs --self-test ; echo exit=$?` → 0
  - 收口:工具能对一份真实载荷做 dry-run 并返回 `CEREMONY_PLANNED_ONLY`。
  - 生效证据:经 MCP 客户端(而非直接 node)调用该工具跑一次 dry-run,回执里 `partition` 与 `chainBefore.version` 与只读面当刻一致。
- **156.3 拒绝面**
  - 红线:拒绝必须 reason-coded,**不许静默放行**,也不许把拒绝理由合并成一个码。
  - 文件:同上
  - 验证:四条红侧各跑一次——①载荷指名 `expected-version`;②载荷无 `readback`;③动词不在主机 catalogue;④一次性供权动词族。四者 reason code 互不相同。
  - 收口:四条红全部实测,输出存 `TCRN-AOS/docs/reports/init-019/S156/outputs/`。
  - 生效证据:同上四条经 MCP 客户端复跑一次。
- **156.4 回执与 dry-run 直通**
  - 红线:回执落盘路径由工具决定,**不得**让调用方指定任意路径。
  - 文件:同上
  - 验证:一次 dry-run + 一次真写(选一个无害的注解目标),回执文件存在且含 `chainBefore`/`chainAfter`。
  - 收口:回执路径出现在工具返回值里。
  - 生效证据:回执里的 `chainAfter.version` 与只读面 `status` 一致。
- **156.5 红绿测试挂进列车**
  - 红线:测试必须能红;不许用「删判据」制造红。
  - 文件:`TCRN-AOS/deploy/aos-mcp-write/server.test.mjs`(新建)+ `TCRN-AOS/package.json`(test 名册)
  - 验证:`node --test TCRN-AOS/deploy/aos-mcp-write/server.test.mjs ; echo exit=$?` → 0
  - 收口:新测试出现在 `package.json` 的 test 名册字符串里。
  - 生效证据:`pnpm --dir TCRN-AOS test` 全绿,且输出里能搜到本测试的用例名。
- **156.6 接线与名册对等**
  - 红线:**不许**改用户级配置(`~/.claude`、`~/.codex`);平台 `.mcp.json` 属审查层批准范围,改动需在收口记录里点名。
  - 文件:平台根 `.mcp.json`;`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`(锚名册)
  - 验证:`pnpm --dir TCRN-AOS parity:proof ; echo exit=$?` → 0
  - 收口:新服务器进入锚名册,伪漂移必红。
  - 生效证据:**新开一个会话**,确认该 MCP 工具在工具列表里出现并可调用(工具注册是会话启动快照,老会话看不到)。

### STORY-157 —— 文档改写:复核命令全面 MCP 化 【高颗粒度】

**为什么是它**:今晚的实证——我整场会话的复核几乎全走 SSH,因为**平台文档教的就是 SSH**。文档是代理的肌肉记忆,不改文档,原则就永远靠人复述。

- **157.1 盘点**
  - 红线:只盘点、不改写;盘点结果要**可机器复现**(给命令,不给手抄清单)。
  - 文件:`TCRN-AOS/docs/reports/init-019/S157/inventory.md`(新建)
  - 验证:给出一条命令,能列出全平台文档里所有 SSH 直驱引擎的命令行及其所在文件与行号。
  - 收口:清单含总数与分布。
  - 生效证据:该命令由第二人原样重跑,数目一致。
- **157.2 改写**
  - 红线:**不得改写**平台根 `CLAUDE.md` 第三节那张「真值地址」表的**地址列**(那是被 `doc-topology:proof` 机器核对的声明);只改「复核命令」列的形态。
  - 文件:平台根 `CLAUDE.md`;`TCRN-AOS/CLAUDE.md`;`tcrn-workflow/CLAUDE.md`;`.claude/skills/tcrn-workflow-helper/references/*.md`
  - 验证:改写后每条命令自己跑一遍,退出码与原 SSH 形态一致。
  - 收口:157.1 的清单数目降到白名单允许的残量。
  - 生效证据:`pnpm --dir TCRN-AOS doc-topology:proof ; echo exit=$?` → 0
- **157.3 判据扩展:核访问形态,不只核地址**
  - 红线:白名单必须**带日期与理由**(照 parity 白名单的既有形状);不许无理由豁免。
  - 文件:`TCRN-AOS/deploy/aos-local-client/doc-topology-proof.mjs`
  - 验证:门对「文档里出现 SSH 直驱引擎命令且不在白名单」判红并点名文件与行号。
  - 收口:判据进 `pnpm --dir TCRN-AOS verify` 链(它已在,确认不掉队)。
  - 生效证据:`pnpm --dir TCRN-AOS doc-topology:proof` 在**干净工作树**上 exit 0。
- **157.4 红侧实测**
  - 红线:红侧改动必须**当场还原**,并在收口记录里给出还原后的复验退出码。
  - 文件:任选一份被守护文档(临时)
  - 验证:注入一条 SSH 直驱复核命令 → 门 exit 1 点名该文件;还原 → exit 0。
  - 收口:两侧输出存 `S157/outputs/`。
  - 生效证据:还原后 `git status --short` 对该文件无残留改动。
- **157.5 收口**
  - 红线:不得把「文档改完」当作生效;必须有门。
  - 文件:`TCRN-AOS/docs/reports/init-019/S157/notes.md`
  - 验证:157.2–157.4 的命令逐条重跑。
  - 收口:notes 写明白名单残量与理由。
  - 生效证据:`pnpm --dir TCRN-AOS verify` 中 doc-topology 一步 exit 0。

### STORY-158 —— SSH 降格为 break-glass

- **158.1 白名单定义**
  - 红线:白名单只收**两类**(主机 MCP 不可达的 fallback;按设计绕开服务层的逐字节比对);每条带日期与理由。
  - 文件:`TCRN-AOS/deploy/aos-local-client/ssh-breakglass-allowlist.json`(新建)
  - 验证:`node -e` 读取并断言每条都有 `reason` 与 `since`。
  - 收口:白名单被 157.3 与 164.2 共同引用(**一份名单,两处消费**,防止漂移)。
  - 生效证据:两处引用的是同一个文件路径(`grep -c` 各 ≥1)。
- **158.2 使用即留痕**(与 STORY-164 共用机器,此处只提需求)
  - 红线:不得在本单里改观察器语料——那是 164 的文件,避免并发冲突。
  - 文件:仅在 `S158/notes.md` 写明对 164 的需求。
  - 验证:164 收口后回读本条。
  - 收口:需求被 164 实现。
  - 生效证据:一条 SSH 直驱引擎的命令经观察器判 HIT。
- **158.3 文档声明**
  - 红线:声明须写明「这是降格不是删除」及残余适用性两类。
  - 文件:平台根 `CLAUDE.md` 第三节
  - 验证:`doc-topology:proof` exit 0。
  - 收口:声明落地。
  - 生效证据:新会话里读到该段(文档即代理入口)。

### STORY-159 —— 座舱原生 MCP + 渲染上移(阶段二)

> D6 已确认(MIN-061)。本单与其余各单一样待 Owner 派工指令;派工后先出 159.1 设计再动手。

- **159.1 端点设计**:座舱服务内原生供 MCP;沿用现有 loopback + SSH 隧道可达面(`CONF-007` D7 的绑定不动)。产出 `TCRN-AOS/docs/reports/init-019/S159/design.md`。
- **159.2 投影与渲染上移**:把 `cockpit:data` + web 装配从笔记本搬到 VM,消除「视图新鲜度取决于笔记本醒着」这一耦合。
- **159.3 本机退为纯客户端**:扩 `local-purity:proof`,把「本机不承担渲染」也纳入判据。
- **159.4 迁移与回滚**:一次可回退的切换计划;**不得**用逐字节拷贝制造第二个权威。

---

## 四、EPIC-048 知识层:从零到注入

> Epic 收口判据:一条真实 prompt 进来,代理**不需要想起来**去查知识,相关卡片的元数据已经在上下文里;且知识面读写都不经 SSH。

### STORY-160 —— 标记纪律:每写必 rebase 【高颗粒度】

**现状事实(执行前不必重测)**:`cross-project` 与 `TCRN-AOS` 两条活链的知识面整面拒读 `KNOWLEDGE_HIGH_WATER_MISMATCH`——store 标记停在 v1,链在 v1728。store 是 `disposable` 物化索引,迁 VM 后从未 rebase,且**每次链写都会再拉开一次差距**。

- **160.1 现状定量**
  - 红线:只读,不修。
  - 文件:`TCRN-AOS/docs/reports/init-019/S160/baseline.md`
  - 验证:五个分区各记录 {store 标记, 链版本, 差值, 知识面能否读}。
  - 收口:基线表成文。
  - 生效证据:表里每行都给出取数命令(经 MCP 只读面)。
- **160.2 rebase 挂进写路径**
  - 红线:**不得**让 rebase 变成人工步骤;必须挂在写路径上(仪式收尾步,或 156 的 MCP 写工具内)。
  - 文件:`TCRN-AOS/deploy/aos-local-client/ceremony.mjs` 或 `deploy/aos-mcp-write/server.mjs`(择一,在 notes 说明理由)
  - 验证:做一次真写,写后立刻读知识面,不再 `HIGH_WATER_MISMATCH`。
  - 收口:落后量 ≤1 次写。
  - 生效证据:连做两次真写,两次写后知识面都可读。
- **160.3 一次性补齐**
  - 红线:rebase 是 mutating 动词,**必须经仪式**,不许 SSH 直驱。
  - 文件:载荷 `TCRN-AOS/deploy/aos-local-client/payloads/cross-init019-knowledge-rebase.json`
  - 验证:五链逐个 rebase 后 `knowledge-list` 可读。
  - 收口:五链知识面全部可读。
  - 生效证据:经 **MCP 只读面**(非 SSH)对五链各跑一次 `knowledge-list`,全部 `KNOWLEDGE_LIST_READY`。
- **160.4 门:标记差纳入巡检**
  - 红线:阈值要有理由,不许拍脑袋;门必须能红。
  - 文件:与 STORY-166 的巡检同一处(避免又造一个孤门)
  - 验证:人为放旧一个分区的标记 → 门红点名。
  - 收口:门进 `verify` 链。
  - 生效证据:巡检跑一次,五链全绿。
- **160.5 红绿实测与收口**:两侧输出存 `S160/outputs/`;生效证据 = `pnpm --dir TCRN-AOS verify` 相关步 exit 0。

### STORY-161 —— 内容灌入:三源策展 【高颗粒度】

**现状事实**:链上没有真正的知识事件;VM store 的 `bodies/` 与 `metadata/` 双零;本机归档同样为零;AOS 座舱生产库 `domain.db` 里连知识表都不存在(kr01–06 的 schema+FTS+种子建在代码与测试里,从未部署)。**所以这不是「迁移丢了」,是「从未灌入」。**

- **161.1 源清点与去重规则**
  - 红线:不得把「记忆文件原文」直接搬进来当卡——卡要有主张、有 evidence,不是日记。
  - 文件:`TCRN-AOS/docs/reports/init-019/S161/sources.md`
  - 验证:三源各列出候选条目数与去重规则。
  - 收口:清单成文。
  - 生效证据:清单里每条候选都能指回一个 evidence(链上记录 / 报告文件 / 提交)。
- **161.2 卡片模板与 evidence 绑定**
  - 红线:`promote` 需 `evidence` ≥1,`source` 与 `accountable-owner` 齐备,否则 `KNOWLEDGE_PROVENANCE_INVALID`;evidence id 只验形状不验存在,**因此人要保证它真的存在**。
  - 文件:`TCRN-AOS/docs/reports/init-019/S161/card-template.md`
  - 验证:用模板写一张样卡并走通 create→promote。
  - 收口:模板成文。
  - 生效证据:样卡在链上可读。
- **161.3 首批策展(≥20 卡)**
  - 红线:每卡必须**可被证伪**——写清「什么情况下这条不再成立」。
  - 文件:`TCRN-AOS/docs/reports/init-019/S161/batch-1/`
  - 验证:逐卡自检模板齐备。
  - 收口:≥20 卡草稿完成。
  - 生效证据:卡片数量与目标一致(`ls | wc -l`)。
- **161.4 经 MCP 写面落卡**
  - 红线:**不许 SSH**;`knowledge-*` 写动词全部经仪式(即 156 的工具)。
  - 文件:载荷目录 `TCRN-AOS/deploy/aos-local-client/payloads/`
  - 验证:落卡后经 MCP 只读面 `knowledge-list` 数目一致。
  - 收口:首批全部在链上。
  - 生效证据:`knowledge-list` 经 MCP 返回 ≥20 条。
- **161.5 检索质量抽检**
  - 红线:抽检 prompt 必须**先选定再检索**,不许挑对自己有利的。
  - 文件:`TCRN-AOS/docs/reports/init-019/S161/retrieval-check.md`
  - 验证:5 个真实 prompt,记录 `knowledge-candidates` 的命中与否及排序。
  - 收口:命中率成文(**如实记录,低了也照写**)。
  - 生效证据:抽检可由第二人原样重跑。
- **161.6 收口**:notes 写明首批范围与未覆盖面。

### STORY-162 —— 注入触发:hook 按 prompt 检索 【高颗粒度】

**这是 D2 里「webhook 提醒 agent」在 Claude Code 上的落法**:宿主侧对应物是 **hook**。

- **162.1 触发点选型**
  - 红线:不得每轮无条件全量注入(上下文预算是硬约束)。
  - 文件:`TCRN-AOS/docs/reports/init-019/S162/design.md`
  - 验证:设计里写明 SessionStart(保底一次)与 UserPromptSubmit(按关键词/主题)各自触发条件。
  - 收口:设计成文。
  - 生效证据:设计里给出「什么 prompt 会触发、什么不会」各一例。
- **162.2 检索链实现**
  - 红线:relevance 选择归 `knowledge-candidates`,预算/新鲜度/权限归 `context-route`——**不许自己另写一套相关性或预算**(那台机器已经建成,现在零调用方)。
  - 文件:`tcrn-workflow/scripts/knowledge-inject.mjs`(新建)或 AOS 侧等价位置(在 notes 说明选择理由)
  - 验证:给定一个 prompt,链路跑通并输出注入体。
  - 收口:输出为**元数据级**摘要,非全文 body。
  - 生效证据:注入体字节数 ≤ 预算上限,且来源可追到卡 id。
- **162.3 注入体量预算**
  - 红线:上限要写死并可配置,不许「看着办」。
  - 文件:同上
  - 验证:构造超量场景,确认被裁到上限且**明说裁了**。
  - 收口:上限与裁剪策略成文。
  - 生效证据:超量场景实测输出仍 ≤ 上限。
- **162.4 hook 注册(照 INC-040 教训)**
  - 红线:注册命令**必须用 `${CLAUDE_PROJECT_DIR}` 形态**,不许裸相对路径(INC-040 的第二条死因就是这个),也不许写死家目录路径。
  - 文件:平台根 `.claude/settings.json`(仅 hooks 块;**deny 规则一个字不许动**)
  - 验证:从平台根、从任一子仓、从无关目录三种 cwd 各起一次,均能启动。
  - 收口:注册落地。
  - 生效证据:**新开会话**实测注入真的发生(能在上下文里看到卡片元数据)。
- **162.5 活性门(照 INC-040 范式)**
  - 红线:门必须**执行注册字符串本身**——读 settings、按宿主方式替换变量、起真进程;不许在进程内直调函数冒充。
  - 文件:`tcrn-workflow/scripts/knowledge-inject.mjs`(`--verify-channel` 模式)
  - 验证:绿=注入通道活;红三条=注册缺失 / 命令起不来 / 检索链无返回,各自 reason code。
  - 收口:门进 CI 或 `verify` 链。
  - 生效证据:门在**三种 cwd** 下均绿。
- **162.6 红绿实测与收口**:输出存 `S162/outputs/`。

### STORY-163 —— 知识面读写全走 MCP

- **163.1 读面核对**:`knowledge-list` / `-candidates` / `-snippet` / `-body` / `-freshness` 在 MCP 只读面逐个可用;不可用的列出来。产出 `S163/readface.md`。生效证据:五个动词各经 MCP 调一次。
- **163.2 写面经仪式**:`knowledge-create/promote/retire/rebase` 全部经 156 的工具。红线:**store marker 版本 ≠ 链版本**,CAS 用的是 marker(`store.json` 的 `version`),别传错。生效证据:一次 create 经 MCP 工具完成并读回。
- **163.3 文档与生效证据**:helper `references/on-demand-context.md` 里的命令改为 MCP 形态。生效证据:`doc-topology:proof` exit 0。

---

## 五、EPIC-049 访问路径合规门

### STORY-164 —— S2 语料扩面:SSH 直驱引擎判 HIT

- **164.1 语料扩充**
  - 红线:**只准加不准弱化**——96 条既有样例是 INC-037 付过学费的资产,任何 `classify` 判据的削弱都要在收口记录里点名并给理由。
  - 文件:`tcrn-workflow/scripts/ssh-write-observer.mjs`
  - 验证:`node tcrn-workflow/scripts/ssh-write-observer.mjs --self-test ; echo exit=$?` → 0
  - 收口:读动词(`status`/`work-list`/`work-show` 经 ssh)也判 HIT。
  - 生效证据:喂一条真实 SSH 读命令,落盘可读回。
- **164.2 白名单接线**:消费 158.1 那**同一份**文件。生效证据:白名单内命令判 PASS,白名单外判 HIT。
- **164.3 自检与红侧**:红侧喂真实输入。输出存 `S164/outputs/`。
- **164.4 生效证据**:`pnpm --dir tcrn-workflow verify:observe-channel` exit 0,且新语料在 CI lessons job 里跑到。

### STORY-165 —— enforce 晋级(等观察窗)

- **165.1 晋级判据成文**
  - 红线:**必须排除 `probe:true` 记录**(门自身流量);「空日志」只有在活性门同时为绿时才可读作「零命中」。
  - 文件:`TCRN-AOS/docs/reports/init-019/S165/criteria.md`
  - 验证:判据写明观察窗时长、零误报的可证形态、探针排除规则。
  - 收口:判据成文待 Owner 确认。
  - 生效证据:按判据对当前观察窗跑一次评估,输出结论(**够不够都照写**)。
- **165.2 切换与回退**:enforce 开关 + 一条回退路径。生效证据:切换后拦截一次真实误用并可回退。
- **165.3 收口**:观察窗自 2026-08-05 重置起算,不得引用重置前的数据。

---

## 六、EPIC-050 运行时健康与待办可见

### STORY-166 —— 投影新鲜度通则 + 统一巡检 【高颗粒度】

**根因**:平台所有物化侧车(网页投影、知识 store、codegraph、记忆索引)都会按各自节奏变陈旧,却各有各的新鲜度故事。INC-040 与知识高水位是同一类病的两次发作。

- **166.1 通则成文**:凡物化侧车须声明 {真源版本, 自身版本, 最大龄}。文件 `docs/projection-freshness-convention.md`(平台级)。生效证据:被 166.2 的注册表引用。
- **166.2 注册表**:四个侧车逐个登记。红线:登记项必须**可机器取数**,不许写「大约几小时」。生效证据:注册表里每项都能跑出数。
- **166.3 统一巡检门**:一处判全部。红线:**不得**为此新造第五个孤门——要把 160.4 也并进来。生效证据:一条命令输出四行状态。
- **166.4 红绿实测**:人为放旧一个侧车 → 门红点名该侧车。
- **166.5 生效证据**:巡检进 `verify` 链且在 168 的运行者里被定时跑到。

### STORY-167 —— 待 Owner 队列

- **167.1 数据源**:链上 `owner_intent_required` 门 + 交付中扣下项 + 待批机械动作(如 S4.2 配置应用)。
- **167.2 渲染**:一条命令或座舱一页。红线:**不许**把队列写成散文——必须从链和仓里取数。
- **167.3 判据**:队列非空且超期即提醒(不是静默)。
- **167.4 生效证据**:当前队列跑一次,能列出至少 INC-041 的四件代办与发布必停点。

### STORY-168 —— 统一运行者

- **168.1 一个 timer 跑全部门**:取代散落的 launchd 任务。红线:**回收与失败通知写在起手同一处**;失败不许静默(INC-032 的教训:三个任务共用错误 PATH,每次 exit 127 而无人知)。
- **168.2 失败即通知**:退出码非零必须留痕且可见。
- **168.3 生效证据**:**真触发一次**(不是手跑)并确认末次退出码为 0——「修好」只有真触发 exit 0 才算。

---

## 七、EPIC-051 生效证据纪律

### STORY-169 —— 五要素模板 + 公约修订

- **169.1** 修订 `docs/dispatch-readiness-convention.md`:四要素 → 五要素。
- **169.2** 把 `MIN-059` 的「生效证据 ∈ {已证, 未证},默认未证」从约束编目推广到一切交付物,落在 `docs/harness-constraint-convention.md`。
- **169.3** 派工模板更新(本文即首个样例)。
- **169.4 生效证据**:下一张派出的单**按五要素成文**,且 169.1 的公约文本被它引用。

### STORY-170 —— 存量补票:INC-041 四代办

红线:**本单只补票,不执行那四件事**——补票即为每件写清「生效证据命令」,让它们从散文变成可验收的单。

- **170.1** S4.2 Codex 配置应用 → 生效证据 = 三个 MCP 服务器在 Codex 侧 `status` 实测可用 + `parity:proof` 白名单收缩后仍绿。
- **170.2** STORY-144 enforce 切换 → 与 STORY-165 合流,生效证据同 165.2。
- **170.3** S154 archify 安装 → 生效证据 = 安装后重算 sha256 与钉扎一致,且在 skills 名册里可见。
- **170.4** otel-spans 接线 → 生效证据 = 引擎跑一次真动词后 sink 里出现 verb span,且隐私门对该 sink exit 0。

---

## 八、收口与发布

- 每张 Story 收口须带**生效证据命令的实跑输出**,存 `TCRN-AOS/docs/reports/init-019/<S###>/outputs/`。
- Epic 收口顺序:Story 全部终态 → Epic 走满 `ready → active → done` 三跳 → 最后 INIT(引擎 WSA-3 禁止在活子项下收 INIT)。
- **发布仍是本 INIT 唯一必停点**,归 Owner。开发期推整合分支不是对外发布,不触发必停。
- 已知前置:`TCRN-CROSS-INC-042`(证据树宿主路径清洗)未收口前,`docs/reports/` 整棵树不得提交——本 INIT 的证据同受此限,先落盘、随 INC-042 一起入库。
