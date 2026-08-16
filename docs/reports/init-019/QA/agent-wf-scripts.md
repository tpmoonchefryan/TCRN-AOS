# 代理原文 · tcrn-workflow 脚本审(general-purpose,只读)

收录:2026-08-06 · INIT-019 验收 · 评审范围 `tcrn-workflow` 仓 `7aa9a98..HEAD`(knowledge-inject*/owner-queue/ssh-write-observer 及其测试)。
原文除宿主路径打码(`<平台根>`/`~`)与 HTML 实体还原外未改动。对应拆单:INC-044(P1-2/P2-3)、INC-051(其余)。

---

# 评审报告 — feat/cross-init018-prose-to-gates (`7aa9a98..HEAD`,三个 STORY 提交)

**观察窗完整性声明**:全程未对观察器做任何 hook 模式活体调用;实证手段为 `node --test`(全部 sink 走 tmp 覆盖,逐一核对过 runCli 所有调用点都传了 `sink`)、`--self-test`(纯 classify,读代码确认零写入)、以及 scratchpad 内进程内 import `classify()`(可疑命令串只存在于文件内容里,从不出现在我的 Bash 命令行上)。sink 评审前后均为 11 行、11/11 `probe:true`,零新增非 probe 记录。

## 发现列表

**P1-1** `tcrn-workflow/scripts/owner-queue.mjs:75-80` — **链上取数失败被静默吞掉,Owner 队列丢行无任何信号**。`if (blocked.ok)` 无 else 分支:read face 超时/拒绝/VM 不可达时 `blockedRows=[]`,输出 JSON 里没有任何字段记录这次失败(无 reasonCode、无占位行、stderr 无提示);因四条 INC-041 代办恒在,exit 仍是 1,而 `platform-runner.mjs:30` 已把 exit 1 标为 `expectNonZero: true`(恒预期)。后果:链上一条 blocked 的 owner_intent 项可以从队列里消失且三层(脚本、runner、日志)全都读作正常。验证:通读代码路径;实跑一次(9 行,含 4 条 chain-blocked)确认成功路径,失败路径由代码结构直接可判。这正是任务透镜 7 点名的 fail-open,应当响而未响。

**P1-2** `tcrn-workflow/scripts/knowledge-inject-hook.mjs:44-45,61` — **`additionalContext` 以数组形态输出,偏离 Claude Code hook 文档契约(字符串)**;无匹配时还输出空数组。实跑捕获输出:`{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":[]}}`。若宿主按文档 schema 校验,注入**从未落地**——恰是 INIT-018 F 系列「建成未接线」形态,且 `--verify-channel` 只证明检索链产出字节,不证明宿主接受(缺 INIT-019 自己立的「第五要素:生效证据命令」)。宿主对数组的实际处置 **UNVERIFIED**(本会话无法内窥宿主 schema 校验);与文档契约的偏离本身已实证。建议在真会话里做一次注入回读作为收口证据。

**P2-1** `tcrn-workflow/scripts/ssh-write-observer.mjs:572-579` + `TCRN-AOS/deploy/aos-local-client/ssh-breakglass-allowlist.json` — **STORY-164 的 breakglass PASS 分支是惰性分支:白名单 `entries:[]` 为空,无语料样本、无 mutation 覆盖**。实测:删除整个 PASS 分支,116 样本 red=0(用测试文件自己的手法量的)。`classes` 只是散文,`breakglassAllows` 只消费 `entries[].pattern`(实测 class 形条目放行为 false)。后果:两类已裁定的残余场景(MCP 不可达只读核查、手工逐字节比对——实测 `sha256sum <引擎路径>` 即 HIT)今天全是 HIT;将来 Owner 添条目时**没有任何测试证明观察器会认它**,条目 schema 写错则静默为空、enforce 下把 break-glass 本身拦死。这违反本文件自立的 INC-037 判据(每个分支须有见证),属 enforce 切换前必须补的门。

**P2-2** `ssh-write-observer.mjs:277-281`(newline 即 flushSegment,无 heredoc 意识)— **heredoc 正文里引用 ssh 命令行会被判为真实传输**。实测三例全 HIT:`cat > /tmp/notes.md <<'EOF'` 正文含治理写命令 → `ssh-write`;`git commit -F - <<'MSG'` 提交信息引用 → `ssh-write`;**写 breakglass runbook 本身**(正文引用引擎命令)→ `ssh-engine-direct`。语料 D10 只盖了带引号的 echo 形态。观察窗内(正在计数)任何 agent 用 heredoc 写文档/提交信息引用这类命令都会落一条非 probe HIT 污染「无误报」晋级判据;enforce 后则直接拦掉写文档。对照组:单引号 printf 与注释行均正确 PASS(实测)。

**P2-3** `tcrn-workflow/scripts/knowledge-inject.mjs:245-248` — **`--self-test` 在检索为零时仍绿(恒绿门)**。实跑:`candidateCount:0, injection:null` 而 `ok:true, injected:true`、exit 0。零的根因:`extractQueryTokens`(69-83 行)生成跨词界 CJK bigram(`没有生效`→`有生`)混入 AND-token FTS,拉到零——文件头自己警告过的失效形态。对照:`--verify-channel` 用干净单词 `hook` 查得 1 条、且正确以 `candidateCount===0` 为红(实跑 exit 0、238 字节)。self-test 谓词应与 verify-channel 对齐(要求 candidateCount>0)。

**P2-4** `knowledge-inject.mjs:117-123` 与 `owner-queue.mjs:53`(复制同构)— **read-face 超时后进程永不退出**:`poll` 无条件 `setTimeout(poll,20)` 重排,超时路径 resolve 后悬挂的 `await next()` 让定时器链永续,事件循环不空。hook 路径被包装器 `spawnSync timeout:25s`(knowledge-inject-hook.mjs:32)兜住;直跑 CLI / runner 路径只靠外层 JOB_TIMEOUT 120s 收尸。静态验证(机制无歧义);未活体复现(VM 0.7 秒即答,无法无侵入制造黑洞)。

**P2-5** `ssh-write-observer.mjs:151-153,507` — **host-engine 豁免删除后,`isSafeTarget` 及 exemptionFor 里的 safe-target 守卫变为惰性**:isScratchTarget ⊆ isSafeTarget(/tmp//var/tmp//run//dev/null 全是绝对路径且非治理树),守卫永不可能改变结果。实测三个 mutant(删守卫、删 absolute 半边、删 governance 半边)corpus red 均为 0。测试改动是把三条 mutation 证明**删掉**(`safe-target-absolute`/`safe-target-governance`/`exemption-target-guard`,见 -56 行)而不是删代码或补可区分的豁免——按本文件自己的教义,惰性分支应删除或重新武装。

**P2-6** `owner-queue.mjs:74-79` 对照 `TCRN-AOS/docs/reports/init-019/BRIEFING.md:350` — **实现的数据源与声明不符**:167.1 声明「链上 `owner_intent_required` 门」,实现只查 `work_list status:blocked`,从不读 `gate_list`;owner_intent 门是否必然表现为 blocked 工作项 UNVERIFIED。另 INC041_TODOS 四条(25-30 行)与 BRIEFING §7(170.1-170.4,已逐条比对文本一致)是手工双写、无比对门——「散文进门」Initiative 里新造了一处会漂移的散文双写。

**P3-1** `ssh-write-observer.mjs:115` — `RUNNERS` 成死常量(grep 全文件仅此一处;旧豁免删除后无消费者)。
**P3-2** 测试删除 `tok-amp-split`/`tok-amp-redirect`/`tok-fd-prefix` 三条 tokenizer 证明未补替:`&` 分段分支其实仍可区分(D04 的 reason 会由 no-write-primitive 变 no-host-transport),现在无人证明——覆盖回退而非惰性。
**P3-3** `remoteInvokesEngine`(546-555)token 级「出现即算调用」的宽度无任何样本钉住:实测把判定收窄到 argv 前两位,corpus red=0;语料里没有「引擎被读取而非执行」的样本(sha256sum/cat 引擎文件,实测今天 HIT)。若这是刻意过近似,应有样本声明它。
**P3-4** sink(`<平台根>/var/tcrn-observe/ssh-write-hits.jsonl`,`S2_OBSERVE_LOG` 可覆写)无上限无轮转,记录含完整命令文本(单条无长度截断);时钟为系统挂钟 UTC ISO-8601(`new Date().toISOString()`)。当前 11 行,量级无虞,enforce 长期运行前宜设界。
**P3-5** `BREAKGLASS_ALLOWLIST` 模块加载时读一次(543 行)——hook 每次新进程无碍;白名单 JSON 损坏时静默为 `[]`(向 HIT 收紧,方向安全但无声)。
**P3-6** 触发词在平台 `settings.json` matcher 与 `TRIGGER_KEYWORDS` 默认值双写(各 15 词,已逐词比对一致)且无 parity 证明;`includes` 子串匹配令 "ci"/"门" 在常见词里过触发——每条 prompt 多一次读面往返(实测暖态 0.7s,预算封顶,无害)。透镜 6 的答案:**matcher 被宿主忽略也正确**——`promptTriggers` 在任何网络动作前本地再过滤(实测无关键词 prompt 即刻返回空注入)。
**P3-7** `registeredHookCommands`(knowledge-inject.mjs:201-216)只读 `settings.json`,不读 `settings.local.json`(观察器的 `PROJECT_SETTINGS_FILES` 两个都读)——注册落在 local 会被误报 REGISTRATION_MISSING。
**P3-8** SessionStart 未按 `source` 过滤:resume/clear 同样触发 8 卡基线注入(实测基线注得出),恢复会话重复注入。
**P3-9** 已知逃逸(与声明的 fail-toward-PASS 一致,列出供 enforce 评审):`CMD=rm; ssh host "$CMD <治理路径>"` 实测 PASS/no-write-primitive——变量携带写程序不可静态判。

**透镜逐项交代**:①无 observe/enforce 开关——observe 是硬编码,exit 2 全文件不存在(grep 全部 process.exit:64/0/1;91 测试含「任何调用不 exit 2」全绿);坏输入全 fail-open(非 JSON→exit 1 非阻断、非 Bash/无 command→exit 0、classify 抛错→PASS/parse-error)。③probe 标记仅经 `S2_OBSERVE_PROBE` env+命令载 nonce 双条件(845-851),命令行单独不可伪造(有测试);`--self-test`/`--classify` 根本不写 sink;CI 的 verify-channel 写 probe 标记记录。⑧两个注册根均指向真实文件(平台根→`tcrn-workflow/scripts/…`✓;仓根→`scripts/…`✓);仓根 `.claude/` 未提交,CI 第 127 行那步在新 checkout 会红——**ci.yml 注释里明写这是刻意的**(「red until tracked」),不算新发现但提交前须知。⑨测试实跑 91/91 全绿 2.1s;新形态不恒绿(anchor 唯一性+witness 必红仍在),回退面即 P2-5/P3-2。

## 亮点

1. **INC-041 通道门是真门**:从 settings 文件读出注册串、按宿主方式替换占位符、从既非项目根也非仓根的 cwd 起真进程、逐根独立 nonce 回读、probe 自标记绑在 hook 自己的写路径上——每个红面都有独立 reason 且都有测试见证;「门绿而通道死」这个世界被系统性关掉了。
2. **mutation-witness 测试架构**(anchor 恰出现一次 + 删分支必红指定样本)让 116 样本语料机器化地保持诚实;我用同一手法反向探测,凡它声称覆盖的分支确实都有牙。
3. **fail-open 纪律贯穿且被证明**:坏 sink→exit 0 但 stderr 大声、无载荷→exit 1 与干净运行字节可分、usage 错→exit 64——三种世界互不冒充。

## 总体判词

观察器核心(分类器重写、通道门、测试架构)是这批改动里质量最高的部分,且 observe 模式的「绝不阻断」性质在代码与测试两侧都成立——本窗口期不存在被它拦住的风险。缺陷集中在三条新缝上:STORY-164 把 host-engine 豁免换成 breakglass 白名单,但换上去的那半边(白名单放行)是空转的惰性分支,零覆盖零可达,enforce 切换前必须先补样本与 fixture,否则第一次真 break-glass 就会撞门;STORY-167 的 Owner 队列会在取数失败时无声丢掉链上行,与它自己的「非空即响」宗旨相反;STORY-162 的注入链本地端到端能跑通(实测 8 卡注入、预算封顶、无 stdout 垃圾),但宿主侧契约(additionalContext 数组)未经文档背书也未经真会话回读证实,而 self-test 又恰好在检索为零时仍绿——这两条叠起来意味着「注入从未生效」这个世界目前无门可红。另外 heredoc 误报类在计数窗口内是现实概率事件,晋级评审时应预设遇到并有裁定口径。建议:enforce 切换(STORY-144/165 合流)以 P2-1、P2-2、P2-3 的修复加 breakglass 覆盖为前置;P1-2 用一次真会话注入回读收口。
