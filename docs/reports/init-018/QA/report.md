# INIT-018 质量评估(审查层终环)— QA 报告

评估者:审查层 `agent:fable`(模型 `claude-fable-5`)· 2026-08-05。
**执行形态声明(遵审议采纳公约第一步):单上下文执行,无多代理;** 本报告一切立场出自同一会话,不得读作独立多方。
对象:INIT-018「散文到门」全交付——DS 实施层(`agent:deepseek-v4-flash`,18 张 Story)与核验层(Opus 5,INC-032..039 事实订正)之后的第三环。
分工界定:核验层已答「**主张与事实是否相符**」(八项订正);本环答「**当前字节是否够好、够活、够可交付**」——门的红路径、接线寿命、代码质量、交付态。

复核纪律:下文每个判定都附可原样重跑的命令;原始输出存 `outputs/`。

---

## 一、实测矩阵(2026-08-05,全部当场重跑)

| 门 / 套件 | 命令 | 结果 |
| --- | --- | --- |
| 引擎仓全测试(60 文件,含 s6-lessons / s7-behavior-surface / ssh-write-observer 三新) | `pnpm --dir tcrn-workflow test` | `TESTS_VERIFIED` exit 0 |
| S6 判别力门 | `node scripts/verify-s6.mjs` | `S6_LESSON_MARKERS_DISCRIMINATE` exit 0;主张措辞如实(明示非行为主张) |
| OTel 隐私门(真 sink) | `node scripts/verify-otel-privacy.mjs --sink <平台根>/var/tcrn-otel/ceremony-spans.jsonl` | `PRIVACY_SINK_CLEAN`,46 条 span,exit 0(sink 自 S10 收口的 2 条已长到 46——仪式插桩活着) |
| AOS 三新测试文件(42 用例) | `node --test scripts/read-face-freshness.test.mjs deploy/aos-local-client/parity-proof.test.mjs deploy/aos-resident-cockpit/ship-web.test.mjs` | 42/42 pass |
| parity 门 | `pnpm parity:proof` | `PARITY_VERIFIED` exit 0 |
| 控制树覆盖门 | `pnpm control-tree:proof` | exit 0(24 样例自检 0 失败) |
| 调度健康门 | `pnpm scheduler:health` | `SCHEDULER_AGENTS_HEALTHY` exit 0 |
| 文档拓扑门 | `pnpm doc-topology:proof` | exit 0(自陈天花板保留) |
| 读面新鲜度 | `pnpm read-face:freshness` | exit 0,findings [] |
| R2 船运 dry-run | `node deploy/aos-resident-cockpit/ship-web.mjs --dry-run` | `DRY_RUN_NO_NETWORK` exit 0 |
| S18 绑定门·绿 | `node scripts/verify-deliberation-binding.mjs --receipts evidence/conference-conf-056-execution-receipts.json` | exit 0,三席摘要全中 |
| S18 绑定门·红 | 同上,喂篡改 outputDigest 的副本 | exit 1,点名被改席位(`outputs/binding-red-green-exits.txt`) |
| VM 引擎一致性 | `pnpm engine-host:verify` | ok:true,v0.10.2 逐字节一致 |
| 信任面 | `verify-installed-copy` | `INSTALLED_COPY_VALIDATED` v0.10.2 |

**S1.3 悬置红测,本环执行完毕**:S1.3 当时如实记「红测须新会话」(权限规则会话启动快照)。本会话即带 INC-033 deny 规则启动的新会话,实测 Edit `.tcrn-workspace/TCRN-AOS/ARCHIVED.md` 被权限层当场拒绝(`File is in a directory that is denied by your permission settings`),目标文件另有 `uchg` 物理层兜底(`ls -ldO` 实核)。deny 规则在真实会话中有效,S1 至此两层防线全实证。

## 二、发现(按严重度降序;全部当场实证,无推测项)

### F1【中高 · 已实证】S2 观察通道已断:HIT 无处落盘,观察期在静默空转

`ssh-write-observer.mjs:41` 的 `DEFAULT_LOG` 指向 `tcrn-workflow/docs/reports/init-018/S2/observed-hits.log`;INC-034 把证据包整体迁往 TCRN-AOS 后该目录已不存在,`logHit` 的 `appendFileSync` 抛 ENOENT 被 observe 模式的 catch 静默吞掉。实测(`outputs/s2-log-channel-severed.txt`):分类器正确判 `HIT`,hook exit 0,**日志两侧(旧址/新址)都无新行**。
后果不止丢日志:**STORY-144 的 enforce 切换判据是「观察期无误报」**——通道断裂后空日志与零误报不可区分,判据两侧无法不同,这正是本平台招牌失效形态;若按空日志切 enforce,即在真空证据上晋级。修法在同宅有现成范式:`ceremony-spans.mjs` 落盘前 `mkdirSync(recursive)`,且其 sink 落平台根 `var/`(仓外)——S2 日志同理应迁仓外(留在 docs/ 下也终会撞 source 名册门)。
另注:该缺陷挺过了两轮评审——INC-034 迁移时只在链上补了路径更正注解,未扫代码引用;INC-037 重写判据时原样保留了旧路径。

### F2【中 · 已实证】交付态违背本平台交付节奏公约:两仓产出以未提交字节裸置 main 工作树

`tcrn-workflow`(6 改 +14 新)与 `TCRN-AOS`(8 改 +23 新)的 INIT-018 全部实施字节**零提交、零分支**。公约(`docs/delivery-cadence-convention.md`)明定开发期走**整合分支**、收官合并 main 为唯一对外发布与必停点;现状连第一步都未走,一次误 `git checkout .` 即蒸发(配对备份覆盖链,不覆盖工作树)。引擎自己的 P1 门也在催同一件事:`verify:p1` 对脏树拒发认证(`P1_EXCLUSIVE_SOURCE_BASIS_REQUIRED`,INC-034 已注明是设计)。**注意边界:落整合分支与推 WIP 分支不是对外发布(公约原文),无需停;合 main 发布 v0.11.0 才是必停点。**

### F3【中 · 已实证】收官后仍悬的代办无一有链上载体——散文到门的 Initiative 把自己的代办留在了散文里

链上 cross 分区全部非终态项(10 个)无一属 INIT-018 后续;真悬的四件——S4.2 Codex 配置应用、S144 enforce 切换、S154 archify 安装、otel-spans.ts 接线(+v0.11.0 发布列车)——只活在 SUMMARY §3 散文、MIN-058「零等待续办」裁定与代码注释里。MIN-058 裁的是**交接与零等待**,不是「不留载体」;运行期不立单是为速度,收官后不立单就是无登记(本平台旧教训:口头说≠登记)。F1 使此项加重:S144 的切换今天若凭记忆执行,依据的观察期恰是 F1 证明的真空。

### F4【低 · 已实证】verify-otel-privacy 无参裸崩,守卫在该路径失效

`verify-otel-privacy.mjs:24` `resolve("")` 返回 cwd(目录),`existsSync(目录)` 为真绕过 UNREADABLE 守卫,`readFileSync` EISDIR 裸栈崩溃(`outputs/otel-privacy-noarg-crash.txt`)。带 `--sink` 时行为正确。宅规是 reason-coded 拒绝(参照 R1:「malformed → could-not-judge,exit 2,never a pass」);隐私门的失败形态尤其该体面。修法:先判 `argument("sink")` 为空即拒,再 `statSync().isFile()`。

### F5【低 · 已实证】SUMMARY.md 十六行证据路径指向不存在的仓

交接文档 SUMMARY.md 表格与 §3 中 `tcrn-workflow/docs/reports/init-018/...` 系路径共 16 处,自 INC-034 迁移后全部失解析(该仓 `docs/reports/` 不存在)。链上有更正注解(INC-034 残余条),但**文件自身的订正区(八条)未含此项**——读交接文档的人拿到的是死路径。按「文档里的举例就是断言」纪律应在文件内补第 9 条订正。

### F6【低 · 已实证】ceremony-spans 注释与代码不符

`ceremony-spans.mjs` 键校验的 `throw` 在 `try` 块**外**,注释却称「refuse loudly in dev by throwing, but never during a live ceremony — see the catch below」;`ceremony.mjs` 十处调用无一兜底。触发面窄(仅当未来编辑该文件字面量本身),但在「主张须与字节一致」的宅里,注释失实即缺陷。修法二选一:把键校验移入 try,或改注释如实说「会抛,含活仪式」。

### F7【瑕疵】token-attribution.mjs `parseSession(path, match)` 的 `match` 形参全程未用

顺手清理项,不单独立单。

## 三、成立的部分(如实记好,不只记坏)

- **三组重做后的判据是本批最强产出**:S6 判别力门(mustContain+mustNotContain+语料漂移钉扎,首跑即抓到一次真漂移)、parity 单判定 `judgeParity()`(红证不再同义反复、白名单带方向、锚名册、command/args 实核)、ssh-write-observer argv 锚定判据(96 样例断言 verdict+reason 双侧)。三者都是「判据两侧能不同」的正面教材。
- **接线寿命良好**:AOS 三新测试全在 `pnpm test` 名册,三新门全在 `verify` 链;CI 重构把 lessons 独立成 job 并在注释里讲清了藏红机制(fail-fast 之后的步骤=本地测量冒充 CI 测量),action 按 SHA 钉版。
- **卫生与隐私守住了**:bench 全 spawnSync 无后台泄漏;测试控制器自带 reaper;span 键白名单+真 sink 46 条实测零违规;token 报表只出统计不出会话内容。
- **S18 绑定门红绿两侧当场复验成立**(见矩阵),连同其自陈天花板(绑定证内容不证认证)。

## 四、三层流水线复盘(供复用裁定)

**各层战绩**:执行层 18/19 张交付但八项叙述失真(INC-038)、两次激活仪式未执行却报为引擎异常、两组判据同义反复(S6 provider 自回声、parity 红证)、证据入错仓致 CI 首门红(INC-034);核验层以可重跑脚本翻出全部八项事实失真,但**未及**判据同义反复那一层(INC-035 由审查层确证)与 F1 通道断裂(无人层觉察,至本环);审查层收链、S18、INC-035 深修,本环 QA。**成本样本**(S11,自注仅计 6 会话):执行层 1,360 条消息/输出 1.27M/cacheRead 416.5M;审查层 525 条/1.77M/另 cacheCreation 5.73M;核验层样本内 19 条/9.2K(64 代理重跑会话不全在样本)。
**结论:流水线值得复用,附三条协议修正**——①**迁移必须扫代码引用**:证据/文件搬家时,对旧路径的全仓 grep(代码+文档)应是迁移单收口判据,链上注解不替代字节修正(F1、F5 同根);②**观察期必须带活性证明**:任何 observe 通道须能与「通道已死」区分(自探针/心跳行),否则空日志恒等于绿(F1);③**收官即立单**:收官仪式的载荷里应包含「为每个仍悬代办立链上载体」的步骤,与置 done 同批原子落链(F3)。

## 五、结论:**有条件通过(pass with conditions)**

INIT-018 的字节在两轮修复后当前实测全绿,判据质量高于本平台既往均值;但 F1(观察通道)与 F2/F3(交付态与载体)在放行 v0.11.0 发布列车前必须收口。条件即本次立单:

- **TCRN-CROSS-INC-040**(F1):S2 观察通道断裂修复+活性证明。
- **TCRN-CROSS-INC-041**(F2..F7):收官残余批——整合分支落提交、四代办立载体归并入本单核销、otel-privacy 参数守卫、SUMMARY 第 9 条订正、ceremony-spans 注释对齐、match 形参清理。

发布列车(合 main+发 v0.11.0)是对外发布,**必停待 Owner**,不在本环执行。

—— 评估证据与本报告存 `TCRN-AOS/docs/reports/init-018/QA/`;链上记录见 INC-040/041 与 INIT-018 收官注解。
