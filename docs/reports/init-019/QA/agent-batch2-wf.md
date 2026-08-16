# 代理原文 · 二次修复批复审(tcrn-workflow 侧,general-purpose,只读)

收录:2026-08-06 · INIT-019 二次修复批验收 · 范围 tcrn-workflow `4d8d6f0..HEAD` 六提交 + helper candidate.31。
原文除宿主路径打码(`<平台根>`/`<本机用户名>`)外未改动。主审已独立复证 F1(段内追加读动词判 PASS、同动词单独判 HIT)。

---

## 零污染声明

| | 行数 | sha256 |
| --- | --- | --- |
| 评审前 | **11** | `122806474ba7651092f9874499d377aaccd4eadaa6b8c451dfbf9a08f3048756` |
| 评审后 | **11** | `122806474ba7651092f9874499d377aaccd4eadaa6b8c451dfbf9a08f3048756` |

**观察窗零污染。** 先读源确认:`--classify` 走 `classify()`(纯函数)→ stdout → exit 0(`ssh-write-observer.mjs:1267-1270`);唯一写 sink 的是 `appendObservation`(:823),只被 `logHit`(hook 模式)与 `verifyChannel` 到达。全程只用 `--classify`/`--self-test`,**未跑 `--verify-channel`、未跑 hook 模式**。仓库工作树 `git status --porcelain` 空行,HEAD 仍 `173acc2`。

## 编号发现

### F1 — HIGH:INC-057 只把走私边界从「整行」搬到「整段」,段内仍可走私(三种构造,全部实证 PASS)

`scripts/ssh-write-observer.mjs:595-596`

```js
const segmentCommand = `ssh ${transport.host} "${transport.remote}"`;
if (breakglassAllows(segmentCommand, BREAKGLASS_ALLOWLIST)) {
```

`breakglassAllows` 是**无锚点** `re.test()`(:544),而 `transport.remote` 是**整条远端命令**。于是任何跟在合法前缀后面的东西都搭车,任何被当作散文塞进引号里的白名单样式也命中。实证(全部 `--classify`):

| 构造 | verdict | 应为 |
| --- | --- | --- |
| `ssh h "node …mjs status --workspace G ; node …mjs work-list --workspace G"` | **PASS**/breakglass-allowlist | HIT/ssh-engine-direct |
| `ssh h "…mjs status … && node …mjs event-list …"` | **PASS** | HIT |
| `ssh h "sha256sum /srv/tcrn/engine/… ; node …mjs work-show --id work:x …"` | **PASS** | HIT |
| `ssh h "echo ssh tcrn-platform-dev 'node …mjs status' ; node …mjs work-list …"` | **PASS** | HIT |
| 对照:`ssh h "node …mjs work-show --id work:x …"` 单独 | HIT/ssh-engine-direct | ✔(语料 A16) |

语料 A16/D03/D11 明确断言 `work-show`/`work-list` 经 SSH 直驱 = HIT,所以这三条是**对已断言策略的绕行**,不是口径分歧。D1「读走 MCP 只读面」在段内被任意读动词穿透。

**失败场景**:执行者写 `ssh tcrn-platform-dev "node …/tcrn-workflow.mjs status --workspace X && node …/tcrn-workflow.mjs export --workspace X"`,观察器判 PASS;enforce 切换后这条命令永不被拦。
**修法方向**:把 pattern 施加于**远端命令的每个子段**并**两端锚定**(`^…$` over 子段的规范形),而不是 `test()` 一个超串。

### F2 — HIGH:INC-057 无任何回归证人 —— 完全回退这两处修改,117 条语料全绿

`scripts/ssh-write-observer.mjs:595-624` / `tests/ssh-write-observer.test.mjs:67-263`(MUTATIONS)

机器实证(scratchpad 变异探针,五个变体各跑一次 shipped 语料):

| 变异 | 语料 | 结果 |
| --- | --- | --- |
| control(仅改注释) | 117 | 全绿 |
| **B2 回退**(`segmentCommand` → `command`) | 117 | **全绿** |
| **B1 回退**(`continue` → 立即 `return PASS`) | 117 | **全绿** |
| **B1+B2 同时回退**(等于 fc6421d 从未发生) | 117 | **全绿** |
| 删除段尾 `if (allowlistedEngine) return PASS` | 117 | **全绿** |

语料条目数 `4d8d6f0` = 117,HEAD = 117,`diff` 逐行**完全一致** —— **零新增样本**。MUTATIONS 表里 INC-051 的 `allowlist-write-guard`(证人 F06)有,INC-057 的三处逻辑**一处证人都没有**。

**这直接违反 INC-057 自己的收口动作**(「绕行语料 + pass-path mutation 证人入册」)。提交信息「Red-leg proved on all three constructions … self-test 117/117」——那三次红边证明是**临时的、没落地的**;`117/117` 是原有的 117,不是新增。**点名:只改了代码,没入语料,也没入证人表。**

### F3 — MEDIUM-HIGH:INC-052 把「门根本没被问」记成「门说了不」

`scripts/closeout-evidence-runner.mjs:38-42`

```js
const exit = result.status ?? (result.error ? String(result.error.code ?? "ERR") : "TIMEOUT");
const ok = (exit === expected) || (expected === "nonzero" && exit !== 0);
```

`expectedExit: "nonzero"` 时,`exit` 取到 `"ENOENT"`/`"ETIMEDOUT"`/`"ERR"` 这类**字符串**,`!== 0` 恒真 → **ok:true**。实证(scratchpad 批单):

| 探针 | 实得 | 判定 |
| --- | --- | --- |
| B:声明为红但实际 exit 0 | exit 0 | **RED** ✔ |
| C:实际 exit 3,声明 0 | exit 3 | **RED** ✔ |
| **D:二进制不存在,声明为红** | exit `ENOENT` | **ok** ✘ |
| **E:超时被杀,声明为红** | exit `ETIMEDOUT` | **ok** ✘ |
| F:实际 exit 1,声明为红 | exit 1 | ok ✔ |

runner 整体 exit 1 并点名 B/C,**红边可复现** ✔。但一条红边证据命令的脚本被改名/挪走后,它会**认证该 incident 已被证明**。这正是本仓自己在 observer 里用 `EXIT_USAGE=64` 区分过的失败形态(:1240-1244),同批次里没沿用。
对照:AOS 侧 `platform-runner.mjs:39` 用 `expectExitIn.includes(code)`,`"TIMEOUT"` 不在 `[0,1]` 里 → 正确判失败。**同批两个 runner,一个对一个错。**

缓解事实:shipped 批单 **8 条证据全是 `expectedExit: 0`**,全平台 grep `"nonzero"` 零命中 —— 错误分支目前没有活消费者。但反过来说,**红腿这条路径从未被真批单走过**。

### F4 — MEDIUM:INC-055 的一致性门没有任何自动消费者

`package.json:66` 把门链在 `verify:observe-channel` 之前;但 `.github/workflows/ci.yml:127` 跑的是 `node scripts/ssh-write-observer.mjs --verify-channel --project-dir .` —— **直接调脚本,绕过 npm script**。`verify:p1` 的构成里没有它;AOS 常驻 `platform-runner.mjs` 的三个 job 也没有。穷举 CI + runner + P1 后结论:**只有人手敲 `pnpm verify:observe-channel` 或 `verify:breakglass-consistency` 才会跑**。且即使接进 CI,CI 检出没有兄弟 `TCRN-AOS`,门只会走 isolated 分支恒绿 —— **漂移检测在任何自动通路上都不存在**。

### F5 — MEDIUM:INC-055 的「世界」信号就是被检文件本身,权威文件被删=静默降级为绿

`scripts/breakglass-consistency-check.mjs:48-58`

`if (!existsSync(AOS_AUTHORITY)) return { ok: true, reasonCode: "WF_MIRROR_SELF_CONSISTENT", world: "isolated" }`。注释声称「A missing authoritative file (**outside the platform working tree**) is reported, not silently skipped」,但代码分不清「不在平台树里」和「在平台树里但被删了」。
实证 W5:构造 `TCRN-AOS/deploy/aos-local-client/` **目录存在、权威文件被删**的平台布局 → `ok:true / world:"isolated" / exit 0`。删掉权威文件是让门变绿的最省事办法。
**修法**:世界判据应取 `TCRN-AOS` 目录(或平台 marker)的存在,而不是取被检文件的存在。

### F6 — MEDIUM:INC-057 让「一份名单、两处消费,判决一致」这句自述变成假的(跨仓语义漂移)

`scripts/policy/ssh-breakglass-allowlist.json` 的 `why` 自陈:「两处都把 pattern 用在**完整命令行**上…故同一条目两处判决一致。」
INC-057 之后 WF 侧施加于 `ssh ${host} "${remote}"` 这个**重建串**;AOS 侧 `doc-topology-predicates.mjs:338 → sshCommandAllowlisted(hit.command, …)` 仍施加于**完整命令行**。两者已可给出不同判决:

| 命令 | WF observer | AOS doc-topology(按 pattern 推算) |
| --- | --- | --- |
| `ssh root@tcrn-platform-dev "node …mjs status …"` | **PASS** | 不匹配 `ssh\s+tcrn-platform-dev\s+['"]` → **红** |
| `ssh -p 2222 tcrn-platform-dev "node …mjs status …"` | **PASS** | 同上 → **红** |

INC-055 的一致性门只比**文件摘要**,比不到**匹配语义**,所以它结构上看不见这类漂移 —— 而这恰是它被立单要管的类别。至少 JSON 里那段 `why` 已是过期断言(本平台「文档里的举例就是断言」纪律)。

### F7 — MEDIUM:INC-054 的 `retained` 只校字符串形状,不查链;文档与错误消息都超额声明

`scripts/closeout-verify.mjs:57-59` + 头部注释 :19。注释写 `retained REQUIRES a live chain work id`,错误消息写 `names no chain work ticket`,实现是 `typeof d.ticket !== "string"`。实证:

| 构造 | 结果 |
| --- | --- |
| R1 漏处置 / R2 未知条目 / R3 retained 无 ticket / R4 deferred 无理由 | 四条**全红 exit 1** ✔ |
| S1 `ticket: "not-a-ticket-at-all"` | **绿** ✘ |
| S2 `ticket: ""`(空串) | **绿** ✘ |
| S3 `ticket: "work:000…000"`(不存在的 id) | **绿** ✘ |

**能蒙混。** 指名一张已 done 的、不存在的、甚至空字符串的单都过。INC-054 要堵的「条目静默消失」可以改用「随手写个 ticket」重犯。

### F8 — LOW:INC-054 对 `null` 处置裸崩,stdout 无 JSON,exit 1 与「未核销」同码

`scripts/closeout-verify.mjs:50`。`dispositions[item] = null` → `d === undefined` 为假 → 读 `d.kind` 抛 TypeError,未捕获,stdout 空。实证 S4:`exit=1, ok=<no json>`。消费者解析 stdout 拿不到 `reasonCode`,且 `MANIFEST_UNREADABLE` 与 `CLOSEOUT_ITEMS_UNRECONCILED` 被同一个 1 压平。与本平台已记教训「隐私门 null 裸崩且 exit1 谎报」同类。

### F9 — LOW:INC-059 注释里的机制解释与 ESM 语义相反

`tests/offline-boundary.test.mjs:3-11`。注释称「Installing it here, **before any transport import**」。ESM 的 import 声明全部提升,`import net from "node:net"`(:19)在 `installNoNetworkGuard()`(:11)**之前**求值。实证:scratchpad 三行样例证明被导入模块先于第 2 行语句求值。它之所以仍然有效,是靠 `syncBuiltinESMExports()` + live binding 刷新已有绑定,**不是靠顺序**。第 128 行(`namedConnect === net.connect`)恰好守着真机制,所以不是活缺陷;但按本仓「注释即断言」的口径,这句归因是错的。

### F10 — LOW:INC-060 的「三态」实为两态,exit 0 结构上不可达

`scripts/owner-queue.mjs:87-94`。`rows` 恒含 4 条 `INC041_TODOS` + 1 条 `RELEASE_STOP` → `rows.length ≥ 5` 恒真 → `reminder` 恒真 → `ok` 恒假 → exit 恒为 1 或 2。声明的 `criterion: "exit 0 = empty · 1 = reminder · 2 = chain-read failed"` 里 exit 0 是死枝。非侵入佐证:`var/tcrn-observe/platform-runner.log` 全部历史条目均为 `owner-queue exit=1`。属本平台已记教训「判据两侧必须能够不同」。
**契约对齐 ✔**:`platform-runner.mjs:30` `expectExitIn: [0, 1]`,exit 2 判 job 失败 —— 与 WF 侧三态定义**一致**。

### F11 — INFO:两个既有/潜在面(非本批引入)

- **写原语词汇缺口(既有)**:`ssh h "python3 -c …"` 对治理树写入判 PASS/`no-write-primitive` —— 实证在**无白名单参与**时同样 PASS,故与 INC-057 无关,是 `WRITE_COMMANDS` 集合的既有边界。
- **heredoc 正文不归属远端(既有、已声明)**:`ssh h "bash -s" <<EOF … rm <治理树> … EOF` → PASS/`no-governance-path`;而 `<<<` 在远端引号内 → HIT ✔。行为与声明一致。
- **`entry.dir` 绝对路径会静默覆盖 platformRoot**(`closeout-evidence-runner.mjs:34`)—— **shipped 批单未踩**:8 条 dir 全是仓相对名,`grep <local-home> 零命中,卫生门不会抓。**不构成活缺陷。**
- **注入面**:runner 用 `spawnSync(program, args)` 无 `shell: true`,**无 shell 注入**;但 `entry.cmd.split(/\s+/u)` 是朴素空白切分,带引号参数与 `&&`/`|`/`>` 会被当字面 argv 传入,静默跑错命令。

## 修复质量确认

| 单号 | 判定 | 依据 |
| --- | --- | --- |
| **INC-052** | **△** | 红边可复现且点名、exit 1 ✔;但 ENOENT/TIMEOUT 在 `"nonzero"` 声明下被记为绿(F3);shipped 批单零红腿条目,该路径无活消费者 |
| **INC-054** | **△** | 四条规则红侧逐条实证全红 ✔;`retained` 只校形状,空串/垃圾/不存在 id 全过(F7);null 处置裸崩(F8) |
| **INC-055** | **△** | 四世界红侧全部按声明(一致/漂移红/孤立绿/镜像缺红)✔、孤立 self-test 真 117/117 ✔;但门无自动消费者(F4)、权威被删静默转绿(F5) |
| **INC-057** | **✘** | 跨段(a/b/e/f)与外层 echo 走私(c)确实闭合 ✔,但段内 tail-append 与段内引号走私仍全线 PASS(F1);且**零新语料、零 mutation 证人**,完全回退后语料仍全绿(F2);顺带引入跨仓语义漂移(F6) |
| **INC-059** | **✔** | 判据两侧实证:真守卫 exit **0**,把 `installNoNetworkGuard` 换成空 stub 后 exit **1**(`OFFLINE_NETWORK_ESCAPED:esm named connect` 等)。唯一问题是注释归因(F9,LOW) |
| **INC-060 WF 侧** | **△** | 与 AOS `expectExitIn:[0,1]` 契约对齐 ✔、exit 2 语义正确 ✔;但 exit 0 结构不可达,三态实为两态(F10) |

## 亮点

1. **INC-055 的世界分级门是本批最扎实的一件**。四个世界逐个用真实布局复刻并跑通,判决与声明**逐字吻合**;孤立布局的 observer self-test 真的 117/117。镜像与权威当前 sha256 **完全相同**。
2. **INC-051 的写前置守卫经受住了压力**。用尽办法想让写搭上白名单:同段 `; rm`、嵌套 `bash -c 'rm …'`、远端变量拼路径 —— **全部 HIT**。`if (writeHit) return HIT` 排在白名单之前这个次序是对的,F1 因此被限制在「非写动词」范围内,没有变成治理树写入的通道。
3. **INC-057 顺带修掉了两个假阳性**:`ssh -p 2222 host "…status…"` 与 `ssh user@host "…status…"` 现在 PASS(改前整行匹配不上,合法 break-glass 会被误报)。重建规范形这个思路是对的,错在重建之后仍用无锚点 `test`。
4. **`ssh-write-observer.mjs` 的自省注释质量极高**。`EXIT_USAGE=64` 区分「门说不」与「门没被问」—— 这正是 F3 应该抄的那一课。
5. **横切全绿**:`proof-artifact-generator` **11/11**;`pnpm test` **exit 0 / TESTS_VERIFIED / 63 个测试文件**;`git status --porcelain` 空;`.claude/settings.json` 已 tracked 且**无用户名、无绝对宿主路径**。

## 总体判词

**这一批是「六单里两单结实、三单半成、一单只做了一半还自称做完」。**

真正的问题是 INC-057。它把绕行边界从「整行」搬到「整段」,方向是对的;但段内仍是无锚点子串匹配,于是**同一族绕行换个写法就复活** —— 四条段内构造全部 PASS,其中 `status ; work-list` 这条几乎是任何人手敲命令时的自然写法,不需要任何攻击意图就会踩上。更严重的是 **F2**:把 fc6421d 的两处改动**完全回退**,117 条语料**一条都没红**。这意味着这次修复在仓库里**没有留下任何机制来保护它自己**。本平台反复记过的教训「没用自己修的门量最终树」,在这单上换了个形状重演:**用自己修的门量了,但没把量具留下**。

INC-052/054 是同一种「半成」:红边确实能红、四条规则确实逐条能红,但**判据的软肋都在「不知道」那一侧** —— runner 把「命令根本没跑起来」记成「命令如期失败」,verify 把「随手写个字符串」当成「链上有活单」。两者都是把 fail-open 藏在成功路径里。

INC-055 是本批质量最高的一件;但它的落点没有任何自动消费者会走到,而且它自己管不住 INC-057 同批引入的跨仓语义漂移(F6)—— 一致性门比的是字节,漂移发生在语义。

INC-059 干净利落,是唯一一件 ✔。

**处置优先级**:F2(补语料 + 补证人)必须先于 F1(改匹配算法);F1 与 F6 同源,一次改到「子段 + 两端锚定」可同时收口;F3/F5 各是一行判据修正;F7 需要决定 `retained` 到底是不是要查链;F10 需先回答「exit 0 在什么世界里可达」。

**UNVERIFIED**:F6 中 AOS 侧对 `ssh -p 2222 …`/`ssh root@…` 的红侧判决是按源码推算的,未实跑 `doc-topology:proof` 构造该文档 —— WF 侧的 PASS 是实证的,AOS 侧是推算的。
