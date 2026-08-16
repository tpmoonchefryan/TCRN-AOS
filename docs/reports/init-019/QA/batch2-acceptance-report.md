# TCRN-CROSS-INIT-019 二次修复批(INC-052..060)验收报告

签发:执行层 agent:fable · 2026-08-06 · 依据 Owner 指令「已完成，进行验收」
执行形态:单上下文主审 + 2 个独立子代理(AOS 侧 5 提交与公约 / WF 侧 6 提交)。**本轮无交卷摘要,全部事实由主审自行发现**(问链、问服务器、对最终树重跑门),阻断级发现均由主审亲手复证。
观察窗零污染:sink 前后均 11 行 / sha256 `12280647…3048756` / mtime 未变(两代理各自独立声明 + 主审核对)。
代理原文:`agent-batch2-aos.md`、`agent-batch2-wf.md`(除宿主路径打码外未改动)。前两轮:`acceptance-report.md`、`re-acceptance-report.md`。

## 终判:**不通过**——两处 enforce 阻断项;上一轮的账已清,这一轮开了新账

九单链上全 done(cross v1868→**v1917**)。**上一轮的三处 tip 红与两处绕行确已闭合**(主审逐条实证),两个全量套件在最终树上首次同时全绿。但本批**自身**在同一天写下四份规则文本后,用自己的行为把其中三条各违反一次,并留下两处 enforce 前置未真正达成。

### 上一轮欠账清偿情况(主审实证,全绿)

| 上轮问题 | 现状 |
| --- | --- |
| A1 收口文档字面用户名 | ✅ 已占位符化;`git grep "Users/<用户名>" HEAD` 三仓零命中;hygiene 11/11 |
| A2 搬迁测试漏登 allowlist | ✅ 四脚本全登记;`proof-artifact` 11/11 |
| A3 投影落后回执 | ✅ 提交版投影 = cross **v1917** = 链头 = 最新回执 chainAfter |
| B1 跨段绕行 | ✅ 构造现判 `HIT/ssh-write` |
| B2 全行子串走私 | ✅ 构造现判 `HIT/ssh-engine-direct` |
| offline-boundary 单跑红 | ✅ 单跑 6/6(且守卫换空 stub 后变红——两侧实证) |
| 两条合法 break-glass 用途 | ✅ 两侧仍 PASS(未误伤) |

### 门/套件矩阵(主审对最终树重跑,退出码不经管道)

| 门 | 结果 |
| --- | --- |
| AOS 全量套件 | ✅ rc=0 |
| WF 全量套件 | ✅ `TESTS_VERIFIED`,63 文件,0 失败 |
| doc-topology / projection-freshness / parity / local-purity | ✅ 全 rc=0(doc-topology 7 条红证,含新增 `RED_PROOF_COUNT_FLOOR`) |
| observer self-test | ✅ 117/117 |
| hygiene | ✅ 11/11 |
| closeout-evidence-runner(重放 INC-043..051 九条) | ✅ rc=0 全绿 |
| closeout-verify(INC-060 核销) | ✅ 9/9;**红腿主审亲验**:删一条处置 → rc=1 并点名 |
| breakglass 一致性门 | ✅ 两侧 sha 相同 |
| `verify:isolated` | ⚠ rc=1(`ISOLATED_DEPENDENCY_MATERIALIZATION_REQUIRED`,需 CI 的 env)——**既有 P1 门,本批未触碰**,非本批引入 |

## 阻断项(enforce 前置未达成,两条)

### X1 · INC-057 段内走私仍全线放行(主审复证)
观察器把绕行边界从「整行」搬到「整段」,但段内仍是**无锚点子串匹配**(`breakglassAllows` 对 `ssh host "<整条远端命令>"` 做 `re.test`)。主审实测:

| 构造 | 判决 | 应为 |
| --- | --- | --- |
| `ssh h "…status… ; node …mjs work-list …"` | **PASS**/breakglass-allowlist | HIT |
| `ssh h "…status… && node …mjs export …"` | **PASS** | HIT |
| 对照:`work-list` 单独 | HIT/ssh-engine-direct(语料 A16 已断言) | ✔ |

**这不是攻击构造,是自然写法**——任何人顺手在 status 后面接一条读动词就会踩上。D1「读走 MCP 只读面」在段内被任意读动词穿透。写守卫排在白名单之前的次序是对的,所以**治理树写入没有被打开**(主审与代理各自尝试 `; rm`、嵌套 `bash -c`、变量拼路径,全部 HIT),缺口限于非写动词。

### X2 · INC-057 零证人:完全回退两处改动,117 条语料一条不红
代理以变异探针实证:回退 B1、回退 B2、两者同时回退、删段尾 PASS 分支——**四种变异语料全绿**。主审独立核对:观察器文件 diff 中 `id:"XNN"` 增删皆 **0**,测试文件 `git diff --stat` **为空**,corpus 117 与批前一致。
**这直接违反同批新立的公约 12**(`harness-constraint-convention.md:146` 第 1/2 条:绕行构造入册语料或测试、pass-path mutation 证人)与 INC-057 自己的收口动作。提交信息「Red-leg proved on all three constructions」描述的是一次**未落地的临时验证**。教训换了形状重演:上一轮是「没用自己修的门量最终树」,这一轮是**「量了,但没把量具留下」**。

## 四条新规则的自违(逐条)

| 规则 | 自违事实 |
| --- | --- |
| INC-052 收口须绑生效证据 | 批单证据命令是**手挑的**,不是从链上工单声明推导:五单的**两侧判据只重放了绿的一半**(INC-046 丢了「注入伪用户名→门变红」、INC-047 丢了变异测试、**INC-049 丢了「构造真陈旧→门变红」**);INC-048 换成了**另一个动词量另一个对象**(release artifacts ≠ installed skill copy);INC-043 那条是**写模式生成器**(边量边改)。runner 本身**不量 HEAD**——全文无一次 git 调用,量的是当时的工作树。红腿只有散文:提交 373ddc4 仅新增 60 行 JSON,树里无任何红侧运行产物,`CLOSEOUT_EVIDENCE_RED` 全仓零命中 |
| INC-053 对抗义务 | 紧接着的 INC-057 四条检查表**一条未满足**(X2);公约条文本身**无机器执行体**,也没有按公约 11 如实登记「现无机器门」 |
| INC-054 批单核销 | `retained` 只校 `typeof ticket === "string"`,**无任何链访问**:首次实战两条保留(`hygiene-plist-…`→INC-046、`throw-receipt-…`→INC-047)**都挂在已 done 的单上**;代理实证空串/垃圾串/不存在 id 全过。`items` 是 manifest 自报而非从工单 scope 推导,**原缺陷仍可用「两边同时删」重犯**。核销表里 `inc043-051-closeout-annotations → fixed` **与链矛盾**(那九单 revision 全为 5,advisory 只有派工原文)——工具只查「有没有处置」,不查「处置是否属实」 |
| INC-052 收口注记 | 公约第 3 条字面是**每单、done 之前**;实际 7/9 无注记,2/9 是 done **之后**的批级注记 |

## 其余发现(择要)

- **INC-058 codegraph 行**:去 sync 是真的且**实测只读**(status 前后侧车 mtime 逐一不变),但判据改成「`status` 报 pending **且** `git status --porcelain` 有非 `??` 行」——对干净树的仓库,**任何幅度的索引陈旧都不能让它红**(DS/TMS 现均为干净树);SIDECARS 仍声明 `truth: repo HEAD commit time / maxAge: 0`,与实现矛盾;**INC-049 自己声明的红腿「索引早于 HEAD → 门红」已死**。附带:无关的调度器输出(工作树两个 modified evidence json)现在成了新鲜度的输入。
- **INC-052 runner 判据软肋**:`expectedExit:"nonzero"` 时,`ENOENT`/`ETIMEDOUT` 这类字符串 `!== 0` 恒真 → **把「命令根本没跑起来」记成「命令如期失败」**。同批 AOS 侧 `platform-runner` 用 `expectExitIn.includes(code)` 判对了——**同批两个 runner,一个对一个错**。缓解:shipped 批单 8 条全是 `expectedExit: 0`,该分支暂无活消费者。
- **INC-055(本批质量最高)**:方向选对(白名单一份权威 + WF 内嵌镜像 + 一致性门),四世界判据两侧都真能不同,孤立布局 self-test 真 117/117。缺口:①门**无任何自动消费者**(CI 直接调脚本绕过 npm script,platform-runner 三 job 也不含它);②权威文件被删 → 静默判 `world:"isolated"` 转绿;③一致性门比**字节**,比不到**语义**,因此看不见 INC-057 同批引入的跨仓匹配语义漂移。
- **AOS doc 侧写守卫(F1)**:只闭合工单里那条字面写法。主审复证九种写法中 **六种绕过**(`rm -rf`/`cp -a`/`sed -i`/`>无空格`/`dd`/`:>|`),observer 九种全 HIT;白名单自述「同一条目两处判决一致」仍是假的。工单红线原写「doc 侧加写守卫**或复用同一判决函数**」,取了弱的那支并在首次接触即漂移。
- **doc-sync 证据再次过期**:`observedAt 01:33:18Z` 无 `RED_PROOF_COUNT_FLOOR`,而 `cc40a93`(01:45:36Z)加了该期望未再 emit——INC-052 规则 1 禁止的同一类,复发在收口 INC-052 的这一批里。
- **`RED_PROOF_COUNT_FLOOR` 松一格**:阈值 `>= 5` 而实际 6,容忍静默丢失恰好一条;红腿本身真实(全 local 名册 → 0 红证 → 门红)。
- **INC-060 三态实为两态**:`rows` 恒含 5 条 → exit 0 结构不可达;与 AOS 侧 `expectExitIn:[0,1]` 契约对齐 ✔。
- **deferred 无时机字段**(公约要求「理由与时机」,工具只校 reason 是字符串);其 reason 引用的 `INC-165` 键号不存在(应为 STORY-165)。
- **INC-059 是唯一无保留的 ✔**:守卫在→绿、换空 stub→红,两侧实证;仅注释归因写反(靠 live binding 而非 import 顺序)。

## 修复质量确认

| 单 | 判 | 一句话 |
| --- | --- | --- |
| INC-052 收口绑定生效证据 | △ | 协议文本清晰、runner 落地且红边可复现;但量工作树非 HEAD、两侧判据只重放绿半边、红腿无产物 |
| INC-053 对抗义务 | △ | 检查表四条具体可读;无机器执行体、无「现无机器门」登记;首个适用对象即未遵守 |
| INC-054 批单核销 | ✘ | 执行不了公约赋予它的两条规则;首次实战即含一条链上可证伪的假 fixed 与两条挂在已 done 单上的 retained |
| INC-055 跨仓依赖守卫 | ✔ | 本批最扎实;缺口在「无自动消费者」与「比字节比不到语义」 |
| INC-056 tip 三红 | ✔ | 三红实测全闭合;唯一尾巴是 doc-sync 证据五分钟后又过期 |
| INC-057 break-glass 绕行闭合 | ✘ | 跨段与外层走私确已闭合,**段内走私全线放行**;零语料零证人;doc 侧六种写法绕行 |
| INC-058 freshness 语义回正 | ✘(codegraph)/ ✔(其余) | web 行 unproven 与 memory 行诚实降级都对;codegraph 行与自身声明矛盾且杀死 INC-049 的红腿 |
| INC-059 offline-boundary | ✔ | 两侧实证,唯一无保留 |
| INC-060 P3 尾单 | △ | platform-runner 三态是本批最干净的修复(还顺手修掉一个反向 bug);但核销 manifest 含假 fixed、exit 0 不可达 |

## 亮点

写守卫**排在白名单之前**的次序经受住了压力测试——主审与两代理各自用尽办法(`; rm`、嵌套 `bash -c 'rm'`、远端变量拼路径)想让治理树写入搭白名单便车,**全部 HIT**;这把 X1 限制在非写动词范围内,没有变成写入通道。INC-055 的四世界判据、INC-059 的两侧实证、platform-runner 的三态契约、`RED_PROOF_COUNT_FLOOR` 的真红腿,都是「判据两侧能不同」的正面样本。`ssh-write-observer.mjs` 用 `EXIT_USAGE=64` 区分「门说不」与「门没被问」——这正是 INC-052 的 runner 该抄而没抄的那一课。

## 根因(第三次同源)

四把新尺子**都只量它作者交给它的那份材料**:批单的证据命令手挑而非从链上工单推导;核销的条目集自报而非从工单 scope 推导;doc 侧写守卫新写正则而非复用已过 117 条语料的判决函数;freshness 自检只比行数而非比「每行量的是不是它声明要量的东西」。这与前两轮同源,只是形状升级:第一轮「门跑早了」→ 第二轮「门量错了对象」→ 本轮「**量具本身由被量者提供**」。

## 处置优先级建议

1. **X2 先于 X1**:先补语料与 mutation 证人,否则改完匹配算法仍无证人保护(公约 12 第 2 条)。
2. **X1 与 doc 侧六种绕行同源**:一次改到「子段 + 两端锚定」并**复用同一判决函数**(工单红线原本就允许这支),可同时收口两侧并消除跨仓语义漂移。
3. INC-058 codegraph 行判据回正(恢复 INC-049 声明的红腿),是 STORY-165 判据第 4 条的前置。
4. INC-052 runner:量 HEAD(记 commit + 干净树检查)、`"nonzero"` 分支排除非数字退出码、证据命令**从链上工单声明推导**而非手挑。
5. INC-054:`retained` 要么真查链、要么把注释与错误消息降级措辞;`items` 从工单 scope 推导。
6. 收口注记口径(每单 vs 批级)需 Owner 定一句。

## UNVERIFIED
CI 是否以脚本名直接调用 `verify:observe-channel`/`verify:breakglass-consistency`(仓内 `task.mjs` 不含);AOS 侧对 `ssh -p 2222 …`/`ssh root@…` 的红侧判决为源码推算未实跑;主审两次全量套件跑在**工作树**(两个 modified evidence json 为 launchd 备份产物,非本批漏提交)而非干净 HEAD ——这正是本报告 INC-052 条目所述缺口,严格的「HEAD 绿」需干净树复跑。
