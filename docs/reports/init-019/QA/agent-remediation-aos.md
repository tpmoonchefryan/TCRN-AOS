# 代理原文 · 修复批复审(AOS 侧,general-purpose,只读)

收录:2026-08-06 · INIT-019 二次 QA · 评审范围 AOS `ca58925..HEAD`(10 修复提交)。
原文除宿主路径打码(`<平台根>`/`~`/`<本机用户名>`)外未改动。对应拆单:INC-056(F1/F2/F8)、INC-057(F6)、INC-058(F4/F5/F9)、INC-060(F7/F10/F11)。

---

**评审对象**:`<平台根>/TCRN-AOS` @ `feat/cross-init019-single-data-plane`,范围 `ca58925..HEAD`(10 提交,INC-043..051),连带 `tcrn-workflow` 侧 5 提交与平台根文档。全部结论基于:逐提交 diff 阅读、HEAD 全文阅读、活跑 doc-topology:proof(只读)、node --test 共 306 用例、scratchpad 变异实验(仓库零改动,`git diff` 复核为空)、观察器仅 `--self-test`/`--classify` 两种许可形态(sink 未触)。

## 一、编号发现

**F1 {P1, docs/reports/init-019/QA/qa-remediation-summary.md:14}** 修复批自己的收口总结把字面量 `<local-home> 写回了仓库,HEAD 上 `pnpm test` 因此是红的。
- 失败场景:6128b6a 提交的总结在「全仓 tracked .mjs/.plist 零 <local-home> 是卫生门扫描类型、该文件 tracked、不在 FIXTURE_EXCLUDED_FILES、pending 名单只有 `evidence/conf-007-recon` 且 pending 机制结构上拒收 tracked 文件——无任何豁免通路。
- 验证:实跑 `node --test scripts/lib/evidence-hygiene.test.mjs` → 10/11,唯一 offender 正是该文件 line 14(home-directory 规则)。门是好门,批是红批:INC-046 修完泄漏类,收口文档当场复发同类,且修复批收尾时没有复跑自己修的门。

**F2 {P1, apps/web/src/cockpit-data.generated.ts(HEAD 版)}** 已提交的投影停在 cross-project v1841,而同批提交的回执自证链已到 v1868——干净 clone 上 `pnpm verify` 会被 INC-049 自己的新判据判红。
- 失败场景:时间线实测:22:06 仪式 1820→1841;22:42 重建(v1841,被 314c232 提交);23:09:06 收口仪式 1841→1868(回执在 8ae7b8c 已提交);23:09:39 重建(v1868)**留在工作树未提交**。`checkWebProjection` 优先读 src `.ts`(projection-freshness.mjs:123-127),clone 拿到 1841、活链 ≥1868 → web 行 stale → 门红。本机绿(工作树是 1868,即 Owner 看到的那行输出)纯属工作树掩盖。
- 验证:`git show HEAD:apps/web/src/cockpit-data.generated.ts` 用门的正则提取=1841;工作树=1868;受治回执 `evidence/mcp-ceremony-write/receipts/2026-08-05T23-09-06-*.json` chainAfter=1868。HEAD 的记录自相矛盾(回执说 1868,投影说 1841)——正是本 Initiative 自己立的「树对≠记录对」(INC-039)那一类。

**F3 {P1, tcrn-workflow/scripts/ssh-write-observer.mjs:523-524 + tests/ssh-write-observer.test.mjs:34-39}** INC-051 把 WF 套件的绿系在兄弟仓 TCRN-AOS 的白名单文件上;孤立 clone(含 WF 自己的 CI checkout)套件必红。
- 失败场景:观察器默认白名单路径与测试的 env 钉扎都指向 `../../TCRN-AOS/deploy/aos-local-client/ssh-breakglass-allowlist.json`;文件不存在时 `readBreakglassAllowlist` 静默回 `[]`,语料里 8 条期望 `PASS/breakglass-allowlist` 的样本(A15/D01/D06/D07/D12/F12/F15/G05)全部落成 `HIT/ssh-engine-direct`。WF CI 的 `verify:p1` 序列含 `test`(task.mjs:2217-2239),推送后 CI 红。同一批里 INC-047 刚以「孤立 clone 能跑自己的套件」为由把测试迁仓,INC-051 反手在反方向重开了同类耦合。
- 验证:实证——把观察器单文件拷到 scratchpad(无兄弟仓可见)跑 `--self-test`:`ok:false, mismatches:8`,恰为上列 8 条。本机平台布局下 `--self-test` 117/117 绿(亦实跑)。

**F4 {P2, deploy/aos-local-client/projection-freshness.mjs:97-108}** codegraph 行「判定前先 sync」+「sync 后仍 pending 无条件改判 fresh」:门从测量退化为动作,且承诺的 note 是死字段。
- 分析:①**sync 失败红吗**——红:sync 抛出被外层 catch 接住 → `null` → "unreadable or no index (unproven)" → stale(但报因文案会误导为 status 不可读)。②**sync 成功但索引仍旧红吗**——**永不**:第 105-108 行把任何 post-sync pending 一律改判 `{pending:false, walkerDiscrepancy}`,代码没有任何手段区分「walker 多数了一个 indexer 故意跳过的文件」与「sync 退出 0 却没真正索引」。③「residual walker count is not a lag」放过的是**整个『sync 退出 0 但无效』类**,以及**常驻刷新管线的一切腐坏**(verify 每跑一次替它治好一次,病灶永不显形——正是平台 CLAUDE.md 拿 apply.mjs 训诫的那个形状:提问的动作抹掉你想知道的事)。④**什么真实陈旧还能让它红**:仅剩两类——codegraph status/sync 不可运行(二进制缺、TMS node_modules 清空、超时)或 sync 非零退出;「索引落后且 sync 能修」永不红(被就地治好),「索引落后且 sync 治不好但退出 0」也永不红。⑤`walkerDiscrepancy` 全仓唯一出现处就是赋值那一行(grep 实证),`checkCodegraph`(74-77 行)只读 `pending`/`detail`——commit message 的「surfaced as a note, not a hard red」**两半都不成立**:既不红,也无 note,门输出照说「all indexed repos report an up-to-date index」。⑥附带:verify 里的这道门现在会**写** `.codegraph` 侧车,「只读校验」性质变了,未见声明。
- 验证:静态(HEAD 全文 + grep);未活跑(跑即写侧车,受本次评审约束)。定性:不是恒绿门(工具坏仍红),但对「陈旧」本身已恒绿;是自愈与恒绿化的杂交,偏恒绿化一侧。

**F5 {P2, deploy/aos-local-client/projection-freshness.mjs:144-148}** web 行取不到活链版本时静默按「fresh」放行,违反同文件头(12-15 行)自己立的诚实规则与同批入册的公约。
- 失败场景:`liveChainVersion` 任何失败(VM 不可达、status 拒答、version 非整数)→ `null` → 跳过真值比较 → 只剩 7 天挂钟龄 → `fresh`,行输出不留任何「真值未核」痕迹。文件头明言「a row whose truth/self cannot be fetched reports unproven, never fresh」;公约明言「无法回答…判未证,永不读作新鲜」。缓解:VM 全不可达时 knowledge 行(58-63 行走同一 remoteEngine)会 unproven 拖红整门——但那是巧合性耦合,web 行本身在撒谎,且「status 答而 knowledge-freshness 不答」的半可达世界无人兜底。
- 其余确认:比较对象为**内嵌 cross-project chainVersion vs 引擎 status 实答 version**,阈值严格 `<`(落后 1 个版本即红,无宽限);正则对真实生成文件形状实测能取到值(HEAD/工作树均命中);读 src `.ts` 优先、dist 兜底,方向正确。**memory 行:一字未动**(164-184 行仍是最新 mtime 距今 ≤30 天,真源=自身),该缺陷在 QA 原文(agent-gates-docs.md 发现 7)与 INC-049 链上工单事实段都点了名,却既未修、也未进 INC-051 notes 的「已知保留」表——是掉缝,不是裁定保留。

**F6 {P2, deploy/aos-local-client/doc-topology-predicates.mjs:148-155}** 「白名单只豁免无写命令」纯在 WF 侧;AOS 文档门对「status+写」复合命令照样豁免,两消费者对同一字符串判决相反——而 INC-051 改后的白名单文件自述恰好声称「同一条目两处判决一致」。
- 失败场景(构造实证):同一字符串 `ssh tcrn-platform-dev "node …/tcrn-workflow.mjs status --workspace …cross-project/workspace && rm -rf …/.tcrn-workflow"`——观察器 `--classify` → `HIT/ssh-write`(写守卫先于白名单);AOS 侧 `findSshDirectEngineCommands`+`sshCommandAllowlisted` → `allowlisted:true`,零 finding。即:一份登记文档可以**教**一条搭 status 条目便车的写命令而 doc-topology 保持绿。且因 AOS 侧按**整行**匹配,行内任一处命中 status 条目就连带豁免同一行上的其它引擎命令。
- 兼答 pattern 质量:两条 entry 本身不过宽——条目 1 要求 CLI 路径后紧跟 `status\b`,裸写动词不中;条目 2 限 sha256sum/shasum/sha1sum 且锚定引擎路径前缀,均无写原语。宽的不是 pattern,是 AOS 侧少一道写守卫。两消费者的**输入**统一了(doc 侧 9283496 起交整行,与 observer 交完整命令对齐),**判决函数**没统一。schema 测试(class/pattern/reason/since、可编译、≥2 条)真实存在并绿;红证已改用 work-transition 避开 status 条目,live 实跑照红。

**F7 {P3, deploy/aos-local-client/doc-topology-proof.mjs:329-330, 462-468}** 六红证恒跑只对「名册里至少有一个 home:vm」成立;无「红证数量下限」期望,全 local 名册会重演原缺陷的镜像。
- 失败场景:`awayEntry === null`(某天全部迁回本机)时 `reds=[]`,零条 RED_ 期望、零 unmet——与 INC-045 修掉的静默跳过同构,只是方向翻面。
- 兼答核心问:红证的判定输入**仍是真机三项**——真文档字节(磁盘读)、真名册(topology.mjs import)、真观测(本机五地址活探针),变异仅是内存里对一份真文档的最小改写;测量红证按设计只合成一个观测字段。**不是**对合成数据自证。「注入漂移→红」的机制就是每次调用重跑的六个 in-memory 红证 + 2026-07-30 on-disk green→red→green 转录折入,活跑实证 6/6 wentRed、raisedExpectedCode、点名正确,门整体绿(18 文档)。

**F8 {P3, evidence/aos-topology-doc-sync.json(HEAD 版)}** `--emit` 确已刷新并在 644275b 提交(observedAt 2026-08-05T22:24:03Z、六红证、SSH 期望俱在)——但同批随后 6b64d50(注册表 13→18)与 9283496(判据改整行匹配)没有再 emit,已提交证据描述的是 13 文档的旧门形状。
- 验证:`git show HEAD:evidence/aos-topology-doc-sync.json` 解析 expected=13 vs live 实跑 18。

**F9 {P3, deploy/aos-local-client/projection-freshness.mjs:38-43}** SIDECARS 注册表里 codegraph 行的三数声明已成虚构:声明真源「repo HEAD commit time」/自身「index build time」/最大龄「0」,实现是 status+sync-once,与声明无一对应。公约的登记义务被同批实现自己违反。另:INC-049 工单收口动作里承诺的 `rows.length===SIDECARS.length` 自检未落(现状两侧同为硬编码 4,承诺未兑)。

**F10 {P3, scripts/lib/evidence-hygiene.mjs:53-60}** 三个 launchd plist 按名永久出圈:曾经泄漏过的 `com.tcrn.platform-runner.plist` 若回归 `<local-home> 字面量,门看不见。
- 失败场景:出圈是被 `platform-root-foreign-mount` detectOnly 规则(86-137 行,匹配平台根的尾段路径,不论前缀怎么拼(含 `$HOME/…` 构造))结构性逼出来的——plist 必须指名平台根,任何拼法都中检测。取舍诚实(检测器未软化、测试双向断言、注释写明),但测试注释等于承认:对这三个文件的改动**不**被捕。残余风险应留名。
- 兼答现状:扫描面 = `.json/.md/.plist` 三类 × (全仓 tracked + evidence/ 工作树全走),`.mjs` 经量测(20+ 源文件合法引用平台根)留在圈外由 scrub 处置;三 plist 现字节实测零用户名、PATH 与 exec 全 `$HOME` 构造。

**F11 {P3, deploy/aos-mcp-write/server.mjs:239-253}** throw 回执不含「已落几步」——`steps:[]`、`chainBefore/After:null`、`thrownBeforeReceipt:true`,即诚实的「未知」。原缺陷文本许愿的「能判断落了几步」严格说没实现(要实现须 ceremony.mjs 侧配合);回执存在、具名错误、错误文本过 scrub、单独落盘、isError 上抛,均实证。以「不知道就说不知道」论,可接受;以工单字面论,留一句残余。

## 二、修复质量确认

| 单 | 判 | 理由 |
| --- | --- | --- |
| INC-045 | ✔ | 六红证恒跑、判真输入、点名断言齐全,活跑 6/6 红、门绿 18 文档;证据已 emit 并提交。残余两 P3(F7/F8)。门没有改松——反而从「绿半边」补全为双向 |
| INC-046 | △ | 门的扩面与五文件 scrub 全部实证到位、出圈方式诚实(F10);但批自身在收口提交里复发同类泄漏,HEAD 上门红、套件红(F1) |
| INC-047 | ✔ | 三缺陷全修且全部经亲手变异实证:dry-run→真写、partition→错链两个变异分别被未改动的测试捕获;throw 回执落盘+scrub+测试;测试迁 WF(6/6 独立绿)、AOS 名册同步无悬引。残余 F11 |
| INC-049 | △ | web 行真值比较是真的且从 HEAD/回执/工作树三方可推证它确实抓到过 1841→1868 的真漂移;codegraph 行「问仪器」方向对。但 sync-once 把 codegraph 行对「陈旧本身」恒绿化且承诺的 note 是死字段(F4),web 行对「真值不可读」静默 fail-open(F5),memory 行未修未记 |
| INC-050 | ✔ | 平台 CLAUDE.md 逐项实读确认;公约两处前缀已补;DS/TMS cwd 注明且已各自提交(2b727e9c/ecf057d);DOC_REGISTRY 13→18,direction 文档入册且活地址字面量改指核对表;committed-claims 检查活跑绿 |
| INC-051(AOS 侧) | △ | 条目真实、schema 测试真实、doc 侧改交整行、红证避条目、观察器写守卫有变异证人且 117/117 自证绿;但「两消费者判决一致」被构造反例证伪(F6),且一份名单两处消费的代价是 WF 孤立 clone/CI 必红(F3) |

## 三、亮点

- **变异实验文化是真的**:dryRun/partition 直通、观察器写守卫(F06 证人)、hygiene 扩面,都配了「拆掉守卫必须红」的证人;重放的两个变异全部被未改动测试当场击落。
- **doc-topology 红证架构**:变异作用于真输入、红证要求点名、on-disk 转录要求 green→red→green 弧线并折入期望——「a section that vanishes when it does not run」的教训被认真机械化了。
- **卫生门首战告捷**:F1 恰恰证明门在工作——批里新引入的泄漏被它当场按住,无豁免通路可绕。
- 平台入口文档的订正逐字可跑(INC-050 是九单里修得最干净的一张)。

## 四、总体判词

**机制层面基本修对,收口层面三处翻车。** 九项里六项的核心机制经实证成立且多数配了证伪装置;但这批提交以 HEAD 状态交付时:套件红(F1)、干净 clone 的 verify 红(F2)、WF CI 推送即红(F3)——三个 P1 全是「修完没有用自己修的门再量一次自己」这一个动作缺失的产物,与本 Initiative 通篇训诫的缺陷类同构。唯一一处真正把门改松的是 codegraph 行的 sync-once 改判(F4)。建议:发布必停点前,F1/F2 一次提交可收;F3 需要决一个方向(corpus 对白名单缺席降级期望,或 WF 侧内嵌条目副本+一致性门);F4 至少把 walkerDiscrepancy 真实上浮为行内 note 并把「sync 后仍 pending」限定到具名文件清单。

**UNVERIFIED 清单**:WF 全量套件在平台布局下的绿(仅静态确认 allowlist 登记+单测 6/6);projection-freshness 门的活跑(其 sync 会写 `.codegraph` 侧车,受只读约束未执行,F4/F5 为全文静态分析);WF CI 红的预言(机制经 scratchpad 单文件 `--self-test` 实证 8 mismatches,完整 CI 未跑);「web 行曾对 1841→1868 判红」为三方物证推证,未重放。
