# TCRN-CROSS-INIT-019 落盘验收报告

签发:执行层 agent:fable · 2026-08-06 · 依据 Owner 指令「代码质量验收 + 四节点执行建议(先不执行)」
执行形态:**单上下文主审 + 4 个独立子代理**(写面 / WF 脚本 / 门与文档 / hooks 宿主契约)分头产出,主审对 P1 逐条抽验。子代理只读、变异实验全在 scratchpad、对观察器的活体调用只走 probe 模式(sink 前后 11 行不变,零污染)。
代理原文:同目录 `agent-write-face.md`、`agent-wf-scripts.md`、`agent-gates-docs.md`、`agent-hooks-contract.md`(除宿主路径打码为 `<平台根>`/`~` 外未改动)。

> **订正按语(先于一切「公开仓」表述)**:TCRN-AOS 仓现为 **PRIVATE**(TCRN-CROSS-INC-042 advisory,Owner 2026-08-05 当场订正;认证 gh 实测),历史曾公开、该单裁定**清洗处置不降级**;TCRN-TMS 为 PUBLIC。本报告与代理原文中「公开仓」措辞按此理解。

## 结论:有条件通过

机制骨架——单一 ceremony 写面、按引擎目录派生的拒绝面、三项权威(文档→名册→实测)双向断言、mutation-witness 测试架构、观察通道活性门——是平台迄今成色最高的一批。但恰以本 Initiative 自己立的三条纪律衡量(门可证伪 / 文档按字面可跑 / 生效证据),存在 **9 组 P1**,全部落在「发布必停点」之前的修复窗口内。红线全部守住(实证):未推送(`git ls-remote` 四仓为空)、观察窗零污染(11/11 全 probe)、写只经仪式、控制树未碰。

## 拆单索引(2026-08-06 落链,只立单不执行)

| 单 | 标题 | 对应发现 |
| --- | --- | --- |
| TCRN-CROSS-INC-043 | WF 套件红:三新脚本缺 source-allowlist 登记 | P1-1 |
| TCRN-CROSS-INC-044 | 知识注入宿主端末跳失效(additionalContext 形态 + AND 检索 + self-test 恒绿 + matcher 死配置) | P1-2 |
| TCRN-CROSS-INC-045 | doc-topology 红证在全 VM 名册下全部静默跳过 + 门证据未刷新 | P1-3 |
| TCRN-CROSS-INC-046 | 提交物用户名泄漏 + 卫生门扩展名盲区 | P1-4 |
| TCRN-CROSS-INC-047 | aos-mcp-write 写面:异常无回执 / dryRun+partition 无证伪测试 / 测试跨仓 import | P1-5 |
| TCRN-CROSS-INC-048 | helper 安装副本漂移 → IDENTITY_MISMATCH(candidate.31 重发重钉) | P1-6 |
| TCRN-CROSS-INC-049 | projection-freshness 两判据缺陷(codegraph 量错文件假红挡 verify;web 不比真值) | P1-7 |
| TCRN-CROSS-INC-050 | 平台入口文档失实(bootstrap 路径 + 仪式通路段)及连带订正 | P1-8 |
| TCRN-CROSS-INC-051 | 验收 P2 批(收口批应修,不挡发布;含 enforce 三前置) | P2/P3 |
| (注记)TCRN-CROSS-INC-042 | 追加待入库清单(P1-9 证据入库缺口) | P1-9 |
| (注记)TCRN-CROSS-STORY-165 | enforce 切换四前置 + 窗口现状 | — |
| (注记)TCRN-CROSS-INIT-019 | 验收结论 + 过时 advisory 追加更正 + 实测计数 | — |

## 一、事实核对(与所述落盘的出入)

| 声明 | 实测 |
| --- | --- |
| AOS 13 commit / SUMMARY 写 12 | 领先 origin/main **11**(init019 9 + init018 2) |
| tcrn-workflow 5 commit | 领先 **4**(init019 3 + init018 1),且骑在 `feat/cross-init018-prose-to-gates` 分支名下 |
| DS/TMS 各 1 commit | 各 **2** 个未推送(各含 1 个 INC-039 旧提交,推 main 时将随行) |
| 证据「入库」 | **尚未**:`docs/reports/init-019/` tracked 数为 **0**;init-018 证据树同样未入库;另有 4 个 ceremony payload、INC-032 的 2 个 plist 修复、2 个 evidence json 均未提交 |
| 链上 13 单 done、165/159 active | 属实(抽样 + active 列表核对)。**但 INIT-019 与 5 个 EPIC 全部仍 planned**,INIT advisory 还写着「本 INIT 尚未开工」——与链上既成事实矛盾 |
| 未推送 | 属实(问了服务器) |

## 二、P1(推送/发布前必须处理,共 9 组,全部实证)

1. **tcrn-workflow 套件当前是红的**:三个新脚本(knowledge-inject-hook / knowledge-inject / owner-queue)未登记 `scripts/policy/source-allowlist.json`,`PROOF_ARTIFACT_UNAPPROVED_SOURCE` 拦下(门是好门)。补登记 + `pnpm generate:proof-artifacts` + 复绿。附带:WF 的 ci.yml 有一步在新 checkout 会红,直到 `.claude/settings.json` 入库(注释自认,推送前须决)。→ INC-043
2. **知识注入的宿主端最后一跳从未生效**——本 INIT 标题「真正注入」尚未发生:`tcrn-workflow/scripts/knowledge-inject-hook.mjs:61` 输出 `additionalContext` 为**数组**,宿主契约要求**字符串**、schema 不合即整条丢弃(官方文档 + 本会话反证:平台根启动、含多个触发词,上下文零注入);且多触发词 AND 检索恒零(实测「判据+CAS+marker」→0 候选,单词「CAS」→1);`--self-test` 在零检索时仍绿(恒绿门);UserPromptSubmit 根本不支持 matcher(settings 里的正则是死配置,hook 每条 prompt 都跑)。修法:数组改拼接字符串 + 多词降级 OR/逐词合并 + self-test 判据对齐 verify-channel + **补一次真会话注入回读**(S162 自己定义的生效证据命令,当时没做)。→ INC-044
3. **doc-topology 的六个红证被静默跳过**:`TCRN-AOS/deploy/aos-local-client/doc-topology-proof.mjs:328` 红证块以 `localEntry !== null` 为前提,08-03 全迁后名册五分区全 `home:vm` → 红证从未运行、零 `RED_*` 期望、无 unmet(实跑 `redCount:0`)。S157.3 新增的 SSH 访问形态红证生在这个死块里——「建成未接线」。门只剩绿半边。→ INC-045
4. **提交物用户名泄漏**:`deploy/aos-resident-cockpit/com.tcrn.platform-runner.plist` 含 `<local-home> ×5(未推送,可修);`deploy/switchover/emit-switchover-proof.mjs:161` 一处**已在已推送的 main 上**;根因是卫生门只扫 `.json/.md`,对 `.plist/.mjs` 全盲。(AOS 现 private,处置按 INC-042 裁定不降级。)→ INC-046
5. **写面三缺陷**(均经变异实验实证):仪式**抛异常时不落回执**(孤儿载荷、无法判断落了几步——回执恰为此刻而生);`dryRun` 与 `partition` 直通**无可证伪测试**(把「dry-run 改真写、目标链改错」的变异版放入,11/11 测试仍绿);`deploy/aos-mcp-write/knowledge-inject.test.mjs:10` 跨仓 import 兄弟仓,本仓单独 clone 跑不了套件。→ INC-047
6. **helper 安装副本漂移 → 信任面红**:S163 直接改了**已安装副本**的 `references/on-demand-context.md`(08-05 22:40),helper 仓源文件停在 7 月 21 日、未发新 candidate、未重钉 → `verify-installed-copy` = `IDENTITY_MISMATCH`(按范式判定:是副本漂移,不是验证器陈旧)。修法:改动搬回 helper 仓源 → candidate.31 发布/重钉/重装。→ INC-048
7. **projection-freshness 门两处判据缺陷**:codegraph 行的正则漏掉 `-wal/-shm`(索引实际是新的、`codegraph status` 自证 up-to-date,门却假红——且该门已进 `pnpm verify`,现在 verify 因假因红);web-projection 行只看 7 天挂钟龄,**从不取它自己声明的真值「链版本」**(INC-032 那次一天停摆全程报 fresh)。修法:问仪器自己(status)/比链版本,别 stat 文件。→ INC-049
8. **平台入口文档两处失实**:CLAUDE.md 的 verify-installed-copy 命令指向不存在的 `<平台>/.tcrn-workflow/`(真身在 `~/.tcrn-workflow/`);仪式通路一节「本机四分区直接用本机引擎,无需仪式」与全 VM 现实直接矛盾(照做会得 `WORKSPACE_RELOCATION_VACATED`)。连带:「五者齐备」已为六者;projection-freshness 公约路径缺 `TCRN-AOS/` 前缀;DS/TMS 复核命令未注明 cwd。→ INC-050
9. **证据入库缺口**(第一节所列全部)+ 已提交的门证据 `evidence/aos-topology-doc-sync.json` 还是 07-30 旧世界形状,未 `--emit` 刷新。→ INC-042 注记

## 三、P2 摘要(收口批应修;★ = enforce 切换前置)→ INC-051

- ★ break-glass 白名单 `entries:[]` **空转**:两类已裁场景今日全被判 HIT(实测 `sha256sum <引擎路径>` 即 HIT);条目 schema 无任何测试;且 doc-topology 与 observer 两个消费者把 pattern 用在**不同的字符串**上,将来同一条目两处判决相反。
- ★ heredoc 误报类:正文引用 ssh 命令即 HIT(实测三例,含「写 break-glass runbook 本身」)——观察窗内的现实污染源,晋级评审须预设口径。
- ★ 观察器测试回退:safe-target 守卫已惰性、三条 mutation 证明被删未补。
- owner-queue 链上取数失败**静默输出空队列**(`tcrn-workflow/scripts/owner-queue.mjs:77` 无 else),Owner 事项可无声消失;且实现只查 `status=blocked`、从不读 gate_list,与 167.1 声明「owner_intent_required 门」不符;INC041 四代办与 BRIEFING §7 手工双写无比对门。
- 仪式 auto-rebase 是**载荷外的无回读变写**且 SPEC 未载;rebase 错误文本恒空串(读错字段);非 record 回读重开「读到自己的 200」套套逻辑;`actor`/`at` 可被载荷覆写(与文件头承诺矛盾);RESERVED_FLAGS 漏 `--expected-revision`。
- read-face 调用超时后进程悬挂(hook 靠 spawnSync 25s 兜住;CLI/runner 靠 120s 收尸)。
- platform-runner 无进程组回收(头注声称有)、`--if-due` 是幻影旗标、stderr 截 200 字节(统一日志里失败原因断头)。
- 名册暗面变大:三份新公约与 direction 文档(含活地址字面量)未入 DOC_REGISTRY;`SSH_ENGINE_PATTERN` 窄于「任何文档出现即红」的声明(带 `-o` 旗标等形态逃逸)。
- SessionStart 不按 source 过滤(resume/clear 重复注入);VM 不可达时每次会话启动 +25s 停顿。
- 链上层级未推进(INIT/EPIC planned + advisory 过时);CLAUDE.md「五者齐备」已是六者。

P3 二十余条(死常量/死参数、SPEC 四处漂移、1MiB 行杀进程、sink 无上限、触发词双写、`settings.local.json` 不读、DS/TMS 命令 cwd 未注明、node 钉死 24.16.0、变量携带写程序逃逸〔已声明 fail-toward-PASS〕等)见代理原文,随收口批择办。

## 四、实证为绿的部分(同样是验收结论)

拒绝面九种构造性走私全被具名拒绝、注入面在包装器与引擎两侧闭合;已提交的 45 收据+45 载荷扫描零泄漏(含一个真实的 READBACK_DIVERGENT 红样本);通道门系统性关掉了「门绿而通道死」的世界;三项权威双向咬合、「14 处 SSH 复核命令→0」可复现归零;DS/TMS/AOS/平台四方复核命令块逐字一致;S168 launchd 真接线且**上线首日就把一个真实陈旧以 exit 1 上抛**;observer 全文件无 exit 2、坏输入 fail-open 且三种世界可分辨;提交身份全部 noreply(隐私规则成立)。

## 五、四个待 Owner 节点的执行建议(先不执行)

### 节点 1:发布必停点
建议把「请求批准」放在如下序列之后,批准包才有效力:
**A 修 P1**(INC-043..050,均为小改)→ **B helper 重钉**(candidate.31,与 170.3 同批)→ **C 证据入库**(hygiene 复跑 0 offender → init-018+init-019 证据树、payloads、INC-032 plist 修复、`--emit` 刷新的门证据一起提交)→ **D 链收口仪式**(INIT/EPIC 按 planned→ready→active 补 transition、INIT advisory 追加更正、验收结论落链、SUMMARY 计数订正为实测值)→ **E 全量门**(`pnpm --dir TCRN-AOS verify` 端到端绿 + WF 套件绿 + `paired:backup` 一次)→ **F Owner 批准与推送**:AOS 分支→main、WF 分支(名承 018+019)→main + 是否发 v0.11.0、DS/TMS main 各 2 commits 直推;每步生效证据 = `git ls-remote` 全 sha 比对 + WF push-gate(AOS 无 CI)。唯一硬停是 F;A-E 属既定授权内执行。(注:D/E/F 未执行——本批只立单。)

### 节点 2:STORY-165 enforce 切换(评估点 2026-08-12)
今日窗口第 2 天:非 probe HIT = 0,活性门绿。**判据第 4 条(projection-freshness exit 0)现被 INC-049 的假红挡住,须在 08-12 前修掉**。切换前置(本轮验收新发现):①**enforce 开关本身还不存在**(observer 硬编码 observe;criteria/S170.2 表述超前)——165.2 第一步是实现开关(默认 observe、fail-open 保持、红绿测试);②break-glass `entries` 补真实条目+测试、统一两消费者匹配对象,否则切换后第一次合法 break-glass 即被拦;③heredoc 误报先定归因口径;④self-test 判据修正。流程:窗口期不动 → 08-12 按 `S165/criteria.md` 出评估文(够不够都照写)→ Owner 确认 → 切换 → 生效证据:实拦一条真 SSH 直驱(reason code 可见)+ 回退演练,双双留痕 `S165/outputs/`。不建议提前切。

### 节点 3:STORY-159 阶段二 VM 部署排期
建议排在发布必停点落地**之后**、作为独立派工批(159.2-159.4),并与 165 评估错峰(不在同一 VM/观察面上叠两个风险窗)。派工时先决一个方向题:MCP 传输形态(stdio vs streamable-HTTP,设计文档刻意留口)。变更窗口前置:`paired:backup` 先行、`engine-host:verify` 绿、端口并存+客户端回切的回滚路径照 design.md。**建议把 INC-049 的 web-projection「比链版本」修复并入 159.2**——投影上移 VM 后,真值比对正好是自然实现点。生效证据(链上已载):滞后降到分钟级、笔记本关机视图仍更新、local-purity 新判据绿、回滚后旧面可用。

### 节点 4:INC-041 四件(170 已补票,票的质量合格)
建议顺序 **170.1 → 170.3 → 170.4**,170.2 并入节点 2 不单独跑。
- **170.1** Codex 三服务器:Owner 批准后应用 diff 到 `~/.codex/config.toml` → 删 `parity-proof.mjs:108-116` 三条白名单(只许收缩)→ 生效证据:Codex 侧三服务器 status 实测可用 + `parity:proof` 仍 `PARITY_VERIFIED`(今日基线已实测绿,6 服务器/4 白名单)。
- **170.3** archify:与 candidate.31 重钉**同批**做(信任面先绿再装),sha256 对钉扎 + skills 名册可见;不要再直改安装副本。
- **170.4** otel-spans:ceremony-spans 测试今日绿;接线后生效证据 = 经仪式跑一真动词 → sink 现 span + 隐私门对该 sink exit 0。

## 附:验证清单与探针教训

实跑:doc-topology / local-purity / parity / projection-freshness 四门、AOS 五个新测试文件(91/91 绿)、tcrn-workflow 全量套件(红,定位见 INC-043)、`verify:observe-channel`(绿)、hook 三事件实测、MCP 只读面链核对 ×9、`git ls-remote` ×4。未跑:AOS 全量 `pnpm verify`/`pnpm test` 端到端。
探针教训:`| tail` 两次吃掉退出码(四门链、WF 套件)——复测均已无管道确认;`work-show` 只收内部 id(`work:` + sha256("work\0"+externalKey) 前 24 位)不收人类键号。
