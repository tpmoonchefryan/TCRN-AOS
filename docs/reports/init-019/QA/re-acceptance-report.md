# TCRN-CROSS-INIT-019 修复批复验报告(二次 QA)

签发:执行层 agent:fable · 2026-08-06 · 依据 Owner 指令「检查完成质量」+ 追加指令「分析规则漏洞、得出优化建议、先强化再修复拆单」
执行形态:单上下文主审 + 2 个独立子代理(AOS 修复批 / WF+helper 修复批)分头评审,主审对 HIGH/P1 逐条亲手复证。子代理只读、变异实验全在 scratchpad(仓库零改动经 git diff 复核)、观察器活体调用仅 --self-test/--classify;**观察窗零污染**(sink 前后均 11 行、11/11 probe:true,两代理独立声明+主审核对 mtime/字节数)。
代理原文:同目录 `agent-remediation-aos.md`、`agent-remediation-wf.md`(除宿主路径打码外未改动)。上一轮验收见 `acceptance-report.md`。

## 终判:机制层面基本修对,收口层面翻车——有条件通过,tip 状态不可交付

九单链上全 done(cross v1841→v1868,27 步 transition + 9 回读,实核)。其中 **INC-044/045/047/048/050 达到「修复即证明」水准**(经变异重放/逐字节比对/逐条可跑核验);**INC-043/046/049/051 部分达成**。但批次以三处红门收尾,三者同根:**修完没有用自己修的门对最终树再量一次**。

### 修复质量判定(九单)

| 单 | 判 | 一句话理由 |
| --- | --- | --- |
| INC-043 allowlist | △ | 登记与 regen 本身正确;同批 INC-047 的搬迁在 regen 之后又引入未登记文件,HEAD 上同一门红 |
| INC-044 注入末跳 | ✔ | additionalContext 实测字符串(空时 "")、OR=逐词调引擎+id 去重保引擎序(未自写相关性)、多词实测 5 候选、self-test 零检索红腿真实、死 matcher 已移除;**本会话双 hook 实际注入 8/14 卡=真会话活证** |
| INC-045 红证蒸发 | ✔ | 六红证恒跑且判真输入(真文档/真名册/真观测),活跑 6/6 wentRed、点名断言齐;证据已 emit 提交 |
| INC-046 用户名+卫生门 | △ | 门扩面(.json/.md/.plist)与五文件 scrub 实证到位;但收口总结自己复发同类泄漏,HEAD 门红 |
| INC-047 写面三缺 | ✔ | 变异重放全部击落(dry-run→真写、partition→错链各被未改动测试捕获);throw 回执落盘+scrub;测试迁 WF 六项 1:1 保全、AOS 名册无悬引 |
| INC-048 helper 重钉 | ✔ | candidate.31:源=归档钉=安装副本三方独立重算一致;verify-release/verify-installed-copy 均复现通过 |
| INC-049 freshness | △ | web 行真值比较为真(比链版本、严格<、曾实抓 1841→1868 漂移);但 codegraph 行 sync-once 恒绿化+web 行真值不可读静默 fresh+memory 行掉缝 |
| INC-050 入口文档 | ✔ | 九单里修得最干净:平台 CLAUDE.md 三处、公约前缀、DS/TMS cwd、DOC_REGISTRY 13→18 逐字可跑 |
| INC-051 P2 批 | △ | 写守卫真实(mutation 证人 F06)、语料 116→117 纪律未失守、owner-queue 首类行落地、两消费者输入统一;但白名单激活开三绕行、判决函数未统一、两半条目无声掉落 |

### 门/套件矩阵(主审对 HEAD 重跑,退出码无管道)

| 门 | 结果 |
| --- | --- |
| doc-topology:proof | ✅ rc=0,DOC_TOPOLOGY_IN_SYNC,18 文档,6 条 RED_ 期望恒跑 |
| projection-freshness:proof | ✅ rc=0(本机;**干净 clone 会红**,见 A3) |
| parity:proof | ✅ PARITY_VERIFIED |
| observer --self-test | ✅ 117/117(平台布局;**孤立布局 8 mismatches**,见 B3) |
| observer 套件 | ✅ 92/92 |
| 写面 server 测试 | ✅ 13/13(证伪测试经变异重放确认有牙) |
| WF 全量套件 | ❌ 966/967——唯一红 = PROOF_ARTIFACT_UNAPPROVED_SOURCE(A2) |
| AOS 全量套件 | ❌ 469/470——唯一红 = hygiene 拦收口总结(A1) |
| helper verify-installed-copy | ✅ INSTALLED_COPY_VALIDATED |
| offline-boundary | 套件内✅ / 单跑❌ 0/6(时序敏感异步 ECONNREFUSED→uncaughtException;文件本批未触碰,预存在) |

## 新发现(全部带复现)

### A 类:tip 三红(推送硬阻,机械修)
- **A1** `docs/reports/init-019/QA/qa-remediation-summary.md:14` 把成功判据写成字面本机用户名路径→hygiene 门红(它拦的正是本批自己的收口文档;无豁免通路,门是好门)。复现:`node --test scripts/lib/evidence-hygiene.test.mjs` → 10/11。
- **A2** `tcrn-workflow/tests/knowledge-inject.test.mjs`(84c61b5 搬入)未登 source-allowlist、且在 ec7d05c regen 之后→`PROOF_ARTIFACT_UNAPPROVED_SOURCE`。INC-043 修的缺陷类被 INC-047 的修复同批复刻。
- **A3** `apps/web/src/cockpit-data.generated.ts` 提交版停 cross v1841,而同批已提交回执 chainAfter=1868→干净 clone 上 INC-049 自己的新判据判 web 行 stale(本机绿纯靠工作树未提交的 v1868 重建掩盖)。「树对≠记录对」(INC-039)重演。连带:`evidence/aos-topology-doc-sync.json` 已 emit 版为 13 文档旧形状(注册表后扩到 18 未再 emit)。

### B 类:enforce 前置新缺口(白名单激活打开;observe 模式下后果=漏记不拦)
- **B1 跨段绕行**(HIGH):observer 首个命中白名单的段直接 return 整条命令,后段治理树写不再被查。复现(主审 --classify):`ssh <host> "…status…" && ssh <host> "rm <GOV>/index.json"` → PASS/breakglass-allowlist;单独 rm 段 → HIT/ssh-write。
- **B2 全行子串走私**(HIGH):白名单正则对完整命令行做子串匹配,`echo '…status 样式…' && ssh <host> "…work-list…"` → PASS(work-list 单独 HIT)。
- **B3 跨仓耦合**:observer 默认白名单路径指向兄弟仓 TCRN-AOS 文件;孤立 clone(含 WF 自己 CI)缺文件→静默 []→8 条 PASS 期望语料落 HIT→self-test 8 mismatches→**推送即 CI 红**(scratchpad 单文件布局实证)。「门须在每个评估世界可满足」知识卡的活反例。
- **B4** AOS doc-topology 侧无写守卫:同一「status+写」整行,observer 判 HIT、doc 门判 allowlisted(构造实证)——白名单文件自述「同一条目两处判决一致」失实。两消费者统一了**输入**没统一**判决函数**。

### C 类:门语义修松(INC-049 遗留)
- **C1** codegraph 行「判定前 sync 一次+sync 后仍 pending 无条件改 fresh」:对「陈旧本身」不可证伪(只有工具坏/sync 非零才红);commit 承诺的 walkerDiscrepancy note 是死字段(仅赋值无读取);verify 因此**写** .codegraph 侧车,只读性质未声明。「提问的动作抹掉你想知道的事」(apply.mjs 训诫)重现。
- **C2** web 行 liveChainVersion 取不到→静默按 7 天挂钟 fresh,违反同文件头「fetch 不到永不 fresh」与公约;半可达世界(status 答、knowledge 不答)无人兜底。
- **C3** memory 行(真源=自身)未修、未进保留清单——掉缝非裁定;SIDECARS 三数声明与实现脱节;承诺的 rows.length===SIDECARS.length 自检未兑现。

### D 类:记录/流程尾
- **D1** 27 步收口全 transition 无 annotate:九单 done 与生效证据零绑定;INC-049 的生效证据命令(「构造真陈旧→门变红」)若在收口时真跑,C1 会当场暴露。
- **D2** 批单核销缺口:gate_list 数据源+INC041 双写比对(原 P2-6 两半)未修**且不在保留清单**——无声掉落;保留九项只活在 notes 文件,链上无活单。
- **D3** runner 吞层未收:owner-queue 的 chain-read-failed 首类行落地,但 runner expectNonZero 仍把该 job 一切结局读作「expected reminder」——判层永不红(原 P1-1 的三层只收了一层)。
- **D4** INC-052(offline-boundary)当时未立;S162 真会话注入证据未归档(本会话即活证:SessionStart 8 卡+UserPromptSubmit 8/14 卡);收口总结的结果表为批次中段快照、在 HEAD 失实。
- **D5** 小尾:knowledge-inject-hook.mjs:11 头注仍写「empty array」;WF .claude/settings.json deny 重复两条;observer:542 注释「empty today」过时;hygiene 对三个 plist 按名永久出圈(结构性取舍,残余风险应留名);throw 回执 steps:[] = 诚实未知,工单字面「能判断落了几步」未实现。

## 根因分析:规则有没有漏洞?——有,四个结构性漏洞,外加两张既有知识卡未机器化

先给对照:**规则覆盖到的地方,修复质量是高的**——五要素齐的单(044/047/048/050)全部「修复即证明」,变异证人文化真实生效(我方重放全部被击落)。问题聚集在规则**没有覆盖**的四个位置:

1. **收口侧没有与派工侧对偶的义务(最大漏洞)**。五要素把「生效证据命令」立在派工端,但收口端:done 只是三段 transition,不要求附「该命令在最终树上的输出」。于是 A1/A2/A3 三红全部产生于「最后一次门运行早于最后一次提交」,而 C1 这种门改松,恰恰是它工单里写明的生效证据命令没被执行才存活的。这正是 INIT-019 立项时点名的根因③「收口判据止于建成不含生效」——当时修了交付物,没修工单生命周期本身。
2. **豁免面/门改动没有对抗义务**。判据两侧规则管「门要能红」,没人管「PASS 路径要经得起构造」。break-glass 白名单激活时写守卫配了 mutation 证人(所以同段搭车被拦住了),但跨段与子串两类绕行没有任何规则要求去构造;INC-049 把假红修掉时把判据修松,「修复不许改松」只是工单散文。
3. **批单没有逐项核销义务**。INC-051 十五项打包,收口时 notes 写了保留表,但两半条目(gate_list/双写)既不在已修也不在保留——多项单的条目集与处置集之间没有机器可 diff 的对账。
4. **跨仓运行时依赖没有守卫**。「门须在每个评估世界可满足」已经是知识卡,但没有孤立世界试验把它按住;INC-047 上午修掉一个方向的跨仓耦合,INC-051 下午在反方向开了一个新的。

另有两张**既有卡未机器化**:「本地全绿≠CI 绿」(结果表是中段快照)与「树对≠记录对」(A3 的形状)。知识注入现在活了(本会话即证),但卡片是上下文不是门——反复咬人的那几张应升格为机器判据。

## 优化建议 → 强化单映射(先强化再修复)

| 强化单 | 对应漏洞 | 核心机制 |
| --- | --- | --- |
| INC-052 收口绑定生效证据(tip 复量协议) | 漏洞 1 | 公约补收口协议:最后一次全量门必须晚于最后一次提交;结果表由命令对 HEAD 产出非手抄;done 须附生效证据注记;closeout runner 重放批内生效证据命令集,红则拒收口 |
| INC-053 豁免面/门改动的对抗义务 | 漏洞 2 | pass-path 类改动必须附绕行构造试验+pass-path mutation 证人+反问「什么会让它错误地绿」;修门必跑该门红腿 |
| INC-054 批单逐项核销 | 漏洞 3 | 批单收口逐项 fixed/retained/deferred,机器 diff 原单条目集;retained 必须指名链上活单 |
| INC-055 跨仓依赖守卫(每世界可满足机器化) | 漏洞 4 | 孤立布局试验进 verify;observer 白名单缺席世界语义先决方向(corpus 降级 vs 内嵌副本+一致性门) |

修复单 INC-056(tip 三红)/057(break-glass 三绕行,enforce 前置)/058(门语义回正,enforce 判据第 4 条前置)/059(offline-boundary)/060(P3 尾单)**全部声明依赖对应强化单先行**——让第一批按新协议收口的就是这批修复本身。

## UNVERIFIED 汇总
helper 全量套件绿(其自述;verify-release 已复现);宿主对 string additionalContext 的接受已由本会话注入**活证**(上轮 UNVERIFIED 就此关闭);WF CI 红为机制推证(scratchpad 布局 8 mismatches 实证,完整 CI 未跑);「web 行曾对 1841→1868 判红」为三方物证推证未重放。
