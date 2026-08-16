# 代理原文 · 二次修复批复审(AOS 侧 + 平台公约,general-purpose,只读)

收录:2026-08-06 · INIT-019 二次修复批验收 · 范围 AOS `314c232..HEAD` 五提交 + 平台根两份公约当日改动。
原文除宿主路径打码(`<平台根>`/`<本机用户名>`)外未改动。主审已独立复证 F1(九种写法六种绕行)、F8(假 fixed)。

---

观察窗零污染:`<平台根>/var/tcrn-observe/ssh-write-hits.jsonl` — **11 行 / sha256 `122806474ba7651092f9874499d377aaccd4eadaa6b8c451dfbf9a08f3048756` / mtime Aug 6 05:15,评审前中后一致**。观察器只经 `--self-test` 与纯导出函数 `classify()` 触碰;全部对抗字符串保存在 scratchpad 文件里,从不出现在 Bash 命令行上。

## Findings

**F1 · P0/P1 · `<平台根>/TCRN-AOS/deploy/aos-local-client/doc-topology-predicates.mjs:139-140`** — INC-057 B4 的写守卫只闭合了工单里那条字面例子;10 种治理写形态中 6 种仍绕行,而 observer 全部 HIT。
*失败场景*:一份登记文档可以教 `ssh tcrn-platform-dev "node …/tcrn-workflow.mjs status --workspace <ws> && rm -rf /srv/tcrn/governance/…"`,doc-topology **零 finding**(白名单 `status` 条目匹配整行、写守卫失配),observer 返回 `HIT/ssh-write`。根因:`\S*` 必须紧贴 `/srv/tcrn/governance`,动词与路径之间任何旗标都能破掉备选 1;`sed` 不在动词集(observer 有);备选 2 要求 `\s+`,故 `>path` 无空格失配。
*验证*:只读 harness 导入 shipped 的 `judgeDocTopology` + `classify`:

| 样本 | doc | observer |
|---|---|---|
| `rm <path>`(工单字面例) | RED | RED |
| `> <path>`(有空格)、`tee <path>`、`mv a b` | RED | RED |
| **`rm -rf <path>`** | **GREEN** | RED |
| **`cp -a src <path>`** | **GREEN** | RED |
| **`sed -i s/a/b/ <path>`** | **GREEN** | RED |
| **`><path>`(无空格)** | **GREEN** | RED |
| **`dd if=… of=<path>`** | **GREEN** | RED |
| **`: >| <path>`** | **GREEN** | RED |
| 两条合法白名单用途 | GREEN | GREEN |

INC-057 链上 scope 原写「doc 侧加写守卫**或复用同一判决函数**」「WF/AOS 判决函数统一」——取了弱的那支,首次接触即漂移。`ssh-breakglass-allowlist.json` 的自述(「一份名单、两处消费…同一条目两处判决一致」)仍是假的。

**F2 · P1 · 同文件,全仓无测试** — 新 PASS 路径零证人。`grep -rn "SSH_ENGINE_GOVERNANCE_WRITE_PATTERN\|SSH_DIRECT_ENGINE_WRITE_NOT_ALLOWLISTED"` 全 AOS 三处命中,**全在实现文件内**。`doc-topology-predicates.test.mjs`(33 测试全过)一处没有;`doc-topology-proof.mjs` 的六条红证覆盖 `SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED` 但不覆盖 WRITE 码。这违反 INC-053 公约 12 第 1/2/4 条(同一天上午写在 `<平台根>/docs/harness-constraint-convention.md:146`)与 INC-057 自己声明的生效证据。**F2 是 F1 存在的原因。**

**F3 · P1 · `<平台根>/TCRN-AOS/deploy/aos-local-client/projection-freshness.mjs:38-43 vs :105-113`** — codegraph 行的声明与判据现在互相矛盾,历史上被证实过的陈旧类不可达。
SIDECARS 仍声明 `truth: "repo HEAD commit time"`、`maxAge: "0 (index must be newer than the last commit)"`。实现从不与 HEAD 比较:只有当 `codegraph status` 报 "Pending Changes:" **且** `git status --porcelain` 有 ≥1 条非 `??` 行时才红。
*构造性回答「今天什么样的真实陈旧还能让它红」*:只有该仓存在未提交的 tracked 改动。实测:`TCRN-Design-System` 0 条、`TCRN-TMS` 0 条 —— 对这两仓**任何幅度的索引陈旧都不能让该行变红**。一个停在 2026-06-21 的索引对着干净的已提交树(本平台自己的实证事故,CLAUDE.md 一.3)被判为 `"no tracked source changes — walker residual, not real lag"` → 绿带注。INC-049 链上声明的红腿逐字是「构造真陈旧(**索引早于 HEAD**/投影落后链)门变红」——那条腿现在死了,而它的红线写着「修复不许把门改松成恒绿」。
*镜像缺陷*:`TCRN-AOS` 现有 2 个 modified `evidence/*.json`(调度器产物),于是该仓任何 codegraph pending 都会因与索引新鲜度无关的原因让该行变红。

**F4 · P1 · `<平台根>/TCRN-AOS/docs/reports/init-019/QA/closeout-batch.json`** — 所有声明为**两侧**的判据都只重放了绿的一半;一行还是写模式生成器。与链(`work-show`,cross-project,v1917)比对:

| 单 | 链上声明的生效证据命令 | 批单重放 | 判 |
|---|---|---|---|
| INC-043 | `pnpm --dir tcrn-workflow test` 全绿 **且 push-gate 通过** | `node scripts/generate-proof-artifacts.mjs` | 被替换 —— 且无 `--check` 即 `mode="write"`:它**重新生成**自己要证明的那些工件 |
| INC-046 | `git grep` 零命中 **且** 注入伪用户名 → hygiene 门变红 | `node --test scripts/lib/evidence-hygiene.test.mjs` | 红半边丢失 |
| INC-047 | 断连仪式留 error 回执并指明步进度;**变异版(dry-run 改真写)测试变红** | `node --test deploy/aos-mcp-write/server.test.mjs` | 红半边丢失 |
| INC-048 | `verify-installed-copy` → `INSTALLED_COPY_VALIDATED` | `verify-release.mjs …` → `RELEASE_ARTIFACTS_VALIDATED` | **另一个动词量另一个对象**(release artifacts ≠ installed skill copy,正是平台 CLAUDE.md 三.1 警告的混淆) |
| INC-049 | 门绿 **且** 构造真陈旧 → 门变红 | `node …/projection-freshness.mjs` | 红半边丢失 —— 这正是 F3 得以出厂未被发现的原因 |

INC-052 自己的链上 scope 预言了这一点:「INC-049 工单的生效证据命令(构造真陈旧→门变红)若在收口时实跑会当场抓住 sync-once 恒绿化」。它没有被跑。

**F5 · P2 · `<平台根>/tcrn-workflow/scripts/closeout-evidence-runner.mjs:36-45,48-72`** — runner 并不量 HEAD。它在活工作树里 spawn 每条命令;全文**没有一次 git 调用** —— 无干净树检查、输出里无 HEAD sha —— 而它自己的头注声称「against the FINAL HEAD」。*失败场景*:提交一个破坏,再用未提交的改动还原 → 绿,而 HEAD 是红的。叠加:INC-043 那行跑的是写模式生成器,于是 runner 在测量的同时**制造**树污。**直接回答评审提问:这道门量的是工作树不是 HEAD,而树当前是脏的。**

**F6 · P2 · `<平台根>/tcrn-workflow/scripts/closeout-verify.mjs:44-64`** — 公约赋予它的两条规则一条都没执行。`items` 是 manifest 自报的清单,不是从工单链上 scope 推导的,所以把一条原始条目从 `items` 与 `dispositions` 同时删掉仍然绿 —— 它为之而建的 INC-051 缺陷**仍可表达**。且 `retained` 只检查 `typeof ticket === "string"`,公约写的是「retained 无链上单即红」。*验证*:自造 manifest,一条自选条目 + `"ticket": "work:000000000000000000000000-does-not-exist"` → `CLOSEOUT_ITEMS_RECONCILED`,exit 0。

**F7 · P2 · `<平台根>/docs/dispatch-readiness-convention.md` 第三层规则 3** — 本批两次自违其新规。**我对字面的读法**:「链上 `work-transition done` **前**,以 `work-annotate` 把**该单的**生效证据命令与其在最终树上的输出挂到记录上」——该单 = 那一张单,前 = 转移之前。所以是**每单且 done 之前**,不是批级也不是事后。链上测量:27 步转移仪式(载荷 `2026-08-06T01-46-29-477Z-afd0b4`)携带 **annotate=0**;唯二收口注记是 01:48:29Z 与 01:49:00Z 两次独立仪式 —— 在 done **之后** —— 且只覆盖 INC-052 与 INC-056(均 revision 6)。INC-053/054/055/057/058/059/060 是 **revision 5**,只有建单 scope。故:7/9 完全缺失,2/9 事后补挂,两条都是批级而非每单。两款皆自违。

**F8 · P2 · `<平台根>/TCRN-AOS/docs/reports/init-019/QA/inc060-reconciliation.json`** — 处置 `"inc043-051-closeout-annotations": {"kind":"fixed", …}` 是**假的**。链上:INC-043、INC-046、INC-047、INC-048、INC-049 全部 **revision 5,单一 advisory = 建单 scope**。它引用的转移批(载荷 `2026-08-05T23-08-26-927Z-7f026a`)是 27 步 `work-transition`,**annotate=0**,之后也没有针对那九单的 annotate 载荷。一条被链证伪的 fixed 断言,出现在核销工具的首次实战里 —— 而 F6 意味着该工具**结构上看不见它**。

**F9 · P2 · `<平台根>/TCRN-AOS/evidence/aos-topology-doc-sync.json`** — HEAD 上已提交的门证据比末次代码提交更旧。`observedAt 2026-08-06T01:33:18Z`,18 条期望,**无 `RED_PROOF_COUNT_FLOOR`**。`cc40a93`(01:45:36Z)把该期望加进 `doc-topology-proof.mjs:465` 且未重新 emit。已提交证据描述的是一道不再存在的门 —— 与 INC-052 规则 1 禁止的「末次全量门早于末次提交」同类,复发在收口 INC-052 的这一批里。

**F10 · P2 · `closeout-batch.json` 范围** — 第二批从未对自己跑过该协议。批单只覆盖 INC-043..051;INC-052..060 各自带着声明的生效证据命令(INC-056:「pnpm --dir TCRN-AOS test 与 pnpm --dir tcrn-workflow test 对 HEAD 全绿」;INC-057:「三构造全红…绕行语料+mutation 证人入册」),一条都没重放。INC-056 的收口注记引用的是**第一批**的 `CLOSEOUT_EVIDENCE_GREEN` 作为自己的证据。

**F11 · P3 · verify 列车成员** — `closeout-evidence-runner.mjs`/`closeout-verify.mjs` 在 `source-allowlist.json:231-232` 里,但无 package.json 脚本、无测试文件、`scripts/task.mjs` 无引用;`verify:observe-channel` 与 `verify:breakglass-consistency` 作为脚本存在但 `task.mjs` 里无人调用(CI 是否按脚本名直调为 UNVERIFIED)。公约 11 要求进 verify 列车**或**如实登记「现无机器门」——新的第三层/批单核销两节两者皆无。

**F12 · P3 · `doc-topology-proof.mjs:465-468`** — `RED_PROOF_COUNT_FLOOR` 是 `allReds.length >= 5` 而真实计数为 6(5 条文档红证 + 1 条测量红证),故容忍恰好静默丢失一条。红腿本身是真的:全 local 名册下 `awayEntry === null` → `reds=[]`、`measurementRed=null` → 0 < 5 → 红;今日全 VM 名册下为 6 → 绿。

**F13 · P3 · `projection-freshness.mjs:223-225`** — 承诺的 `rows.length === SIDECARS.length` 自检落地了,但只比长度。它看不见重排(rows 按 `SIDECARS[0..3]` 取 `maxAge`)或 id 互换,更看不见 F3 的实质:某一行量的根本不是它 SIDECARS 条目声明要量的东西。单元测试倒是断言了 id 顺序,所以重排会红 `node --test` 但不会红这道门。

**F14 · P3 · `projection-freshness.mjs:44-50, 183-210, 226`** — memory 行:**诚实降级,且声明与实现一致**(`activityOnly: true`、`maxAge: "n/a — activity notice only"`、恒 `status: "activity"`、被排除在 `bad` 外)。推理是对的 —— 真值与自身是同一批字节,该行本来就不可能测「索引落后真值」。但它现在仍坐在 `rows` 里、与三条真判据打印在同一个四行块中,而 F13 的计数检查继续断言「四个侧车受护」,实际是三个。建议单列 `notices` 字段。

**F15 · P3 · `<平台根>/TCRN-AOS/scripts/lib/evidence-hygiene.mjs:54-60`** — 卫生门按名排除了三个最可能携带家目录路径的 `.plist`。登记是诚实的(retained→INC-046 带链上单号、就地注释),HEAD 也干净(实测五仓零 `Users/<用户名>` 命中,plist 正确使用 `$HOME`)—— 但那道唯一职责就是抓家目录泄漏的门,对它们是瞎的。

## 修复质量确认

| 单 | 判 | 理由 |
|---|---|---|
| INC-052 | △ | 协议文本清晰、runner 落地;但量工作树非 HEAD(F5)、输出不记 commit、批内第一条证据是写模式生成器(F4);自称的 red-leg 在树里没有任何产物,只有链上散文 — UNVERIFIED |
| INC-053 | △ | 检查表四条具体可读;但无机器执行体、无「现无机器门」如实登记(F11);紧接着的 INC-057 一条都没满足(F2) |
| INC-054 | ✘ | 工具执行不了公约赋予它的两条规则(F6);首次实战的 manifest 就含一条链上可证伪的假 fixed(F8) |
| INC-055 | ✔ | 方向正确(白名单权威在 AOS + WF 内嵌镜像 + 一致性门);observer self-test 117/117 实测绿;唯一缺口是不在任何 train(F11) |
| INC-056 | △ | A1 已占位符化(五仓 git grep 零命中,实测);A3 投影已到 v1917;但同批 doc-sync 证据 5 分钟后又过期(F9) |
| INC-057 | ✘ | B4 只闭合了工单里那一条字面写法,10 种写法 6 种仍绕行(F1);零语料/零 mutation 证人(F2);红线要求的「复用同一判决函数」未做 |
| INC-058 | ✘(codegraph)/ ✔(其余) | 去 sync 真实且**实测只读**(status 前后 `.codegraph/{db,-wal,-shm,daemon.pid}` mtime 逐一不变);web 行 unproven 是真收紧;memory 行诚实降级;**但 codegraph 行判据与自身声明矛盾并杀死 INC-049 声明的红腿**(F3) |
| INC-059 | UNVERIFIED | 五提交与两份公约都不含该改动(在 tcrn-workflow 仓,超出本次范围) |
| INC-060 | △ | runner 三态 ✔;红证下限 ✔ 有真红腿(F12 仅松一格);小尾实测已落;但核销 manifest 含假 fixed(F8) |

## 亮点

- **platform-runner 三态 job 是本批最干净的一处修复**,两个方向都改对了:`expectExitIn:[0,1]` 让 `owner-queue.mjs:120` 的 exit 2 成为 runner 失败,同时顺手修掉旧 `expectNonZero:true` 下「空队列 exit 0 反而算失败」的反向 bug;`code` 为 `"TIMEOUT"`/`"ERR"` 字符串时 `includes()` 正确判非预期。
- **去 sync 的只读性是实测过的**,不是声明:一次真实 `codegraph status` 调用前后侧车文件 mtime 逐字节不变。
- **白名单两条合法用途在两侧仍双绿** —— 写守卫没有误伤 break-glass 通路。
- **`RED_PROOF_COUNT_FLOOR` 有真红腿**,不是恒真门。
- **INC-055 的方向选对了**:数据做成一份权威 + 一份镜像 + 一致性门。可惜同一课没有应用到**代码**(判决函数)上,于是 F1 发生。
- **S162 注入活证是真转录**;`git grep "Users/<用户名>"` 五仓 HEAD 全零。

## 横切

- **新恒绿门**:F3(干净树仓的 codegraph 行)、F6(closeout-verify)、F13(长度自检)、F14(memory 行,设计如此),外加 F12 一格松动。
- **未 scrub 路径**:零。五仓 HEAD 无命中,三个 plist 用 `$HOME`。
- **跨仓耦合**:无新增;真正的债是**逻辑重复** —— doc 侧自写一套写守卫而非复用 observer 判决,首次接触即漂移。
- **工作树两个 modified evidence**:launchd 定时备份作业的产物,**不属于这五个提交,不是漏提交**。但双重影响:closeout runner 量的是这棵脏树(F5),而 codegraph 新鲜度行现在把 `git status --porcelain` 当判据(F3)—— 无关的调度器输出成了新鲜度的输入。

## 总体判词

**这一批把「规则漏洞」写成了四份好文本,却在同一天用自己的行为把四条规则各违反一次。** 四张强化单的诊断精准到令人印象深刻 —— INC-052 的工单原文甚至提前写出了「若在收口时实跑 INC-049 的红腿会当场抓住恒绿化」—— 然后收口时没有跑它,于是 INC-058 把那条红腿从代码里删掉了,而收口协议、对抗义务、批单核销三样工具全部在场,一样都没响。

机制上的共因很清楚:**四把新尺子都只量它作者交给它的那份材料**。closeout-batch.json 的证据命令是手挑的,不是从链上工单的声明推导的(F4);closeout-verify 的条目集是 manifest 自报的,不是从工单 scope 推导的(F6);doc 侧写守卫是新写的正则,不是复用已经过 117 条语料的判决函数(F1);freshness 的自检只比行数,不比每行量的是不是它声明要量的东西(F3/F13)。这正是本次要修的 tip 红的同一形状,只是从「门跑早了」升级成「门量错了对象」。

阻断性两条:**F1(六种写法绕行,enforce 前置未真正达成)**与 **F4/F3(收口证据被换成绿半边,并因此放过一处把门改松的回归)**。批次总结里「enforce 四前置全部达成」这句在 F1 面前不成立,08-12 的观察窗评估不应据此推进。

**UNVERIFIED**:INC-059(超出两个评审范围);CI 是否在 `scripts/task.mjs` 之外按脚本名直调 `verify:observe-channel`/`verify:breakglass-consistency`;两个全量测试套件(INC-043/INC-056 声明的真证据)未复跑 —— 这正是 F4 描述的缺口。
