# 代理原文 · 修复批复审(WF+helper 侧,general-purpose,只读)

收录:2026-08-06 · INIT-019 二次 QA · 评审范围 tcrn-workflow `cb6e13e..HEAD`(6 修复提交)+ tcrn-workflow-helper 6418b25(candidate.31)。
原文除宿主路径打码(`<平台根>`/`~`)与 HTML 实体还原外未改动。对应拆单:INC-056(F3/F4)、INC-057(F1/F2)、INC-060(F5/F6/F7/F8)。
主审按语:F1/F2 两条 HIGH 已由主审用 --classify 独立复证(跨段构造 PASS、子串走私构造 PASS、单独 rm 段对照 HIT)。

---

## 观察窗完整性声明(先行)

- **sink 前后均为 11 行**:`<平台根>/var/tcrn-observe/ssh-write-hits.jsonl` 评审前 11 行(2926 字节),评审后 11 行、同字节数、**mtime 未变**,11/11 条 `probe:true`,零新增记录。
- 对观察器的活体调用仅 `--self-test` 与 `--classify`;调用前已通读全文(1276 行)确认:`classify()`/`runSelfTest()` 纯函数,写 sink 的只有 hook 模式(stdin HIT)与 `--verify-channel`,两者均未触碰。`node --test tests/ssh-write-observer.test.mjs` 的 92 项全部经 `S2_OBSERVE_LOG` 指向临时 sink(12 处引用),实测真 sink 计数不动。知识注入 fixture 只经 MCP 只读面读知识链,与观察器无交集。

## 编号发现

**F1 {HIGH, scripts/ssh-write-observer.mjs:572-587}** breakglass PASS 在首个命中段**提前 return 整条命令**,写守卫只查当前段的 `transport.remote`,后续段的治理树写从不被检查。失败场景(均实测):`ssh tcrn-platform-dev "node <引擎> status --workspace <GOV>" && ssh tcrn-platform-dev "rm <GOV>/index.json"` → **PASS/breakglass-allowlist**;更坏的 `… status …" && rsync -av ./x tcrn-platform-dev:<GOV>/` → **PASS**(rsync 单独是 HIT,语料 A09)。此洞是**本批激活**的:cb6e13e 时白名单为空、该世界不可达。验证:`--classify` 活体探针 + 源码推演。修法:engine 分支的 PASS 改 `continue`(记 rank)或按段匹配白名单。

**F2 {HIGH, scripts/ssh-write-observer.mjs:535-540}** `breakglassAllows` 对**完整命令行**做子串正则,允许把白名单样式字符串放在任何位置(如 echo 参数)为非白名单动词买通行证。实测:`echo 'ssh … status"' && ssh tcrn-platform-dev "node <引擎> work-list --workspace <GOV>"` → **PASS/breakglass-allowlist**(work-list 单独是 HIT/ssh-engine-direct,语料 G06)。「两消费者统一到完整命令」对 doc-topology(扫文档行)是对的,对 observer(判复合 shell 行)是错的匹配对象。

**F3 {MAJOR, tcrn-workflow/tests/knowledge-inject.test.mjs ← scripts/policy/source-allowlist.json}** INC-047 的搬迁提交(84c61b5)新增测试文件**未登记 source allowlist**,proof-artifact 门在 HEAD 红:`PROOF_ARTIFACT_UNAPPROVED_SOURCE: tests/knowledge-inject.test.mjs`(实测 1 fail)。`pnpm test` 走磁盘 walk(task.mjs:420-422),必含此红 → 收口总结里 INC-043 的「`pnpm test` → TESTS_VERIFIED」在 HEAD **不成立**(只在 ec7d05c 时点成立;84c61b5 十八分钟后将其打破)。这正是 INC-043 修的同类缺陷被同批重新引入。本批新增文件仅两个:`.claude/settings.json`(已登记)与此文件(未登记),无其他漏网。

**F4 {MAJOR, TCRN-AOS/docs/reports/init-019/QA/qa-remediation-summary.md:14(AOS 提交 6128b6a)}** 引述的失败「no published artifact carries a path off this machine」**不是 WF 的测试**,是 AOS `scripts/lib/evidence-hygiene.test.mjs:37`;实测确红,offender 恰是**本补漏批自己的收口总结**:INC-046 行(宣称「零用户名」的那句)本身含字面本机用户名路径 → home-directory 规则命中。自指性泄漏,与 F3 是两处相互独立的红。

**F5 {MEDIUM, scripts/owner-queue.mjs:114 + TCRN-AOS/deploy/aos-resident-cockpit/platform-runner.mjs:30,38}** 取数失败现在落 `chain-read-failed` 首类行(rows 首位、stderr 首行),但 exit 仍恒 1(TODO 4 条+release-stop 恒在,队列永非空),而 runner 的 `expectNonZero:true` 把**该 job 的一切结局**(exit 1、崩溃、超时)都读作「expected reminder」——runner 判层永不红,信号只存活在日志行 200 字节 stderr 截断内(幸而失败行排首)。原 P1-1 点名「三层全读作正常」,修复只收了脚本输出层。

**F6 {MEDIUM, scripts/owner-queue.mjs:75}** 167.1 声明的 `owner_intent_required` 门(gate_list)数据源**没补**,仍只查 `work_list status:blocked`;INC041_TODOS 与 BRIEFING §7 的手工双写也仍无比对门。两者既未修**也未进 INC-051/notes.md 的保留清单**(grep 零命中)——同一张 P2-6 的两半被无声掉落。

**F7 {MINOR, scripts/knowledge-inject-hook.mjs:11}** 头注释仍写「or an empty array when nothing matches」,而代码已是空字符串——INC-044 要消灭的表述残留在自己文件头。

**F8 {MINOR, tcrn-workflow/.claude/settings.json:17-18,27-28}** deny 清单 `Write/Edit(~/.tcrn-workflow/**)` 重复两次;无害但欠整。另内容审:确无用户名/主机绝对路径,`~/` 与 `${CLAUDE_PROJECT_DIR}` 形态,hook 注册带锚(INC-041 教训已吸收)。

**F9 {MINOR, INC-044 收口证据}** 生效证据止于脚本层(hook 输出 string)+文档契约背书;原 P1-2 建议的「真会话注入回读」未做,「宿主实际接受」仍无直接见证(标 UNVERIFIED)。〔主审按语:本会话 SessionStart+UserPromptSubmit 双双实际注入,此项已由活证关闭,归档动作留 INC-060。〕

**F10 {INFO, 900470f 提交信息 + ssh-write-observer.mjs:542}** 提交说「only for write-free commands」,实现是「同一 ssh 段内无治理树写」——窄于措辞(实测 `status …&& rm /home/user/x` 同段反而 HIT,严;跨段则漏,见 F1)。另行 542 注释「empty today」已过时(条目现 2 条)。

## 修复质量确认

| 单 | 判 | 理由 |
| --- | --- | --- |
| INC-043 | △ | 三脚本+settings.json 登记与 regen 本身正确且孤立看绿;但同批 INC-047 再犯同类缺陷致 HEAD 上同一门红(F3),收口总结的 TESTS_VERIFIED 声明在 HEAD 失实 |
| INC-044 | ✔ | additionalContext 实测 string(非数组,无匹配时 "",契约「字符串或省略」满足);OR=逐词调引擎+按 id 去重+保引擎序,**未自写相关性**(红线守住);「判据 CAS marker」实测 5 候选(原 0);self-test 绿侧 exit 0、零检索红侧实测 exit 1(Joi-Button 分区 candidateCount:0)、链失败红侧 exit 1;死 matcher 已从平台 settings 移除(实查无 matcher)。仅 F7/F9 小尾 |
| INC-047-WF | △ | 六测试 1:1 保全(与 AOS 原文件 e5f80b1 逐名核对)、改同仓 import、AOS 侧旧文件已删(314c232)且零跨仓残留;但搬迁漏登记 allowlist 致门红(F3) |
| INC-048 | ✔ | 安装副本 references/on-demand-context.md 与 helper 仓源**逐字节同**(sha 212072f7…);EXPECTED_ARCHIVE_SHA256(2c2d52e2…)在仓 bootstrap、安装 bootstrap、candidate-manifest 三处一致;README 锚 d390313… 与两份 bootstrap 实算相符;`RELEASE_ARTIFACTS_VALIDATED` = `node scripts/verify-release.mjs …`(即 `pnpm verify`),复现 exit 0;verify-installed-copy 复现 INSTALLED_COPY_VALIDATED。helper 全套件绿为其自述,未复跑(UNVERIFIED) |
| INC-051-WF | △ | 写守卫真实(同段 status+rm → HIT/ssh-write,mutation 见证 allowlist-write-guard→F06 已入 harness);语料 116→117(+H17 为 HOST_ENGINE 锚 PASS 见证,钉严不放松),self-test 117/117、套件 92 绿;两消费者匹配对象已统一完整命令(AOS 9283496,predicates 30/30);owner-queue 失败首类行落地;heredoc 误报保留声明与代码一致(实测 heredoc 正文 HIT)。但 F1/F2 两洞为本批激活、F5 runner 层仍静默、F6 两半无声掉落 |

## 亮点

- 写守卫**先于**白名单的次序 + F06 mutation 见证,是正确的防搭车形态;同段构造全部实测拦住(含非治理绝对路径写)。
- H17 用 PASS 样本钉住 HOST_ENGINE 锚,语料纪律在改判 20 条的同时未失守;`TCRN_SSH_BREAKGLASS_ALLOWLIST` env 使 mutation harness 得以对真实白名单文件测试。
- INC-044 的 OR 合并刻意不重排、不打分,把 relevance 留给引擎——红线以最小机制守住;self-test 的新红腿(candidateCount===0)可被真实世界触发(Joi-Button 实测)。
- INC-048 证据链闭合:源=归档钉=安装副本三方独立重算一致,verify-release 的封闭 schema/逐字节 stat 双读防换,复现性好。

## 总体判词

六个修复提交中,INC-044 与 INC-048 达到「修复即证明」的水准,可直接采信;INC-051 的写守卫方向正确但**白名单激活同时打开了跨段与全行子串两类绕行**(F1/F2),属 enforce 切换前必须闭合的新缺口;批次以**两处自伤的红门**收尾——WF proof-artifact 门(F3)与 AOS 卫生门(F4,收口总结自己泄漏用户名)——两者都是本批修过的缺陷类在本批重演。建议四件事后再谈收口:①登记 `tests/knowledge-inject.test.mjs` 并 regen;②scrub `qa-remediation-summary.md:14`;③observer engine 分支 PASS 改 continue 或按段匹配;④gate_list/双写两残余补裁定或进保留清单。

**UNVERIFIED 汇总**:helper 全套件绿(其自述);宿主对 string additionalContext 的真会话接受(仅文档背书——主审按语:已由本会话活证关闭);owner_intent 门是否必然表现为 blocked 工作项(原 QA 亦未证)。
