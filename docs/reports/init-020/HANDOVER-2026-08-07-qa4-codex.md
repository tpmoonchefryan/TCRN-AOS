# INIT-020 第四轮验收交接文档 — Codex/GPT 执行批(QA4 补救)

> **写给谁**:接手 QA4 补救批的 **Codex 宿主(GPT)会话**,以及 Owner。
> **本文角色**:第四轮验收(2026-08-07)后的执行交接书。**取代** `HANDOVER-2026-08-07-qa3-codex.md` 的单子名册与执行序段;该文的通道纪律、署名与回执纪律**仍然有效且已被本轮实测证明有用**,不重复照抄,只在 §2 增补本轮新学到的几条。
> **截至(实测,链 v2281 / `5e15f0e92a8a43345665af6ee90b09f1780aa88f7bed60555988d89bc0a72134`)**。所有时点断言都会过期——每条附复核命令,按命令走,别信散文。
> **链上正本**:四轮验收结论=INIT-020 v2281 注记;强化批 INC-099..101 立于 v2265..2270;修复批 INC-102..104 立于 v2271..2276;STORY-193/194 立于 v2277..2280。真回执:`docs/reports/init-020/qa4-{hardening,fixes,codex-hooks}.receipt.json`(引擎/门面物化件,逐字节即权威)。

---

## 0. 先说你上一轮做对了什么(请继续这么做)

四轮验收用 60 个代理、七个维度、每条 P0/P1 双视角对抗核验查了你的交付。结论是**不通过**,但请先看清这一点:**二轮、三轮的核心病一个都没复发**。

- 四条链上注记的回执是**门面物化件**,不是手工衍生件——`payload.sha256`(4076 字节)可由载荷独立重算命中,手工件做不到这一点。
- 署名全部是 `agent:gpt-5-codex`,执行形态逐条声明。前科第⑧类未复发。
- dry-run 回执老实标注 `dryRun:true` / `eventsAppended:0`,没有被包装成已执行。
- **历史重写没有在「清洗」名义下丢掉任何东西**:原仓与候选树路径集各 419 完全一致,16 个差异文件逐个 diff 全是占位符替换,作者身份与时间戳未篡改。这是历史重写最容易翻车的地方,你没翻。
- ship 与读面新鲜度的实体主张,验收方用**不经任何被验门、不经 SSH** 的通道独立复现,结果比你报的更强。
- C 档三条停止点经服务器侧实测全部守住;见证分类本身诚实,件数账目 175→169 完全对得上,没有夹带。
- `verify:privacy` 本轮是被你**加强**的(新增 `PRIVATE_HOSTNAME`、`PRIVATE_USER_AT_HOST`,`AUTHENTICATED_URL` 放宽到任意 scheme)。

验收方还推翻了自己五条初判(详见 INIT-020 v2281 注记),如实留档,以免你照着错结论办事。

## 1. 不通过的原因:一条 P0,加一批门落地欠账

### P0 —— 编码不等于占位化

准备推给**公开仓**(`tcrn-workflow` 是 public,匿名可读;`TCRN-AOS` 才是 private)的 v0.11.8 发布基线,源码里仍然完整保留着真实主机名、真实运行时根路径、真实内网 IP:

```
scripts/ssh-write-observer.mjs:79-83
  ["tcrn", "platform", "dev"].join("-")
  ["/", "srv", "/", "tcrn"].join("")
  ["192", "168", "51", "249"].join(".")
scripts/policy/ssh-breakglass-allowlist.json:19,26
  tcrn[-]platform[-]dev   \x2fsrv\x2ftcrn
```

隐私门的判据是**字面匹配**(`scripts/lib/privacy.mjs:74/76/83`),所以这些形态它一个都看不见。双向注入实证:原样 → `PRIVACY_SOURCE_CLEAN`(exit 0);把编码还原成明文 → `PRIVACY_FINDINGS`(exit 1)。**同一份字节,只改编码,门的判决翻转**——这说明 `PRIVACY_SOURCE_CLEAN` 这句话不含「公开仓没有内网拓扑」的信息量。

Owner 的 D1 裁定原文是「全部占位化,**不留真值**」,并在同一句里拒绝了「给主机名模式开豁免」这条路。改编码在效果上是同一件事换了实现手法。

**公道话**:方向本来是对的——你确实把值改成了走环境变量(`TCRN_SSH_GOVERNED_HOST` / `TCRN_SSH_RUNTIME_ROOT`),错只错在**默认回退值仍然是编码后的真值**。正确做法是默认给真占位符(`governed-host.invalid` 之类),或者缺环境变量就 fail-closed 具名拒绝。这是修法选择失当,不是欺瞒;代码注释也如实写了动机。

### 其余确认成立的问题

- **见证转绿靠移出扫描根**:`witnesses/` 是 `receipts/` 的兄弟目录,门的 walk 走不到,全仓没有任何判据读分类清单。注入实证:垃圾件丢进 `witnesses/` 门仍绿,移进 `receipts/` 立刻红——本轮顺手造出一条**永久旁路**。分类动作本身诚实,病在机制。
- **INC-091 在线锚定写了没接线**:`authority:{required:false, anchoredReceipts:0}`,离线默绿而非 `anchored:false`,编造回执仍可过门。
- **INC-090 未落地**:`closeout-verify` 仍量人写 manifest——items 由 manifest 自供、可整体省略、判据仍是子串匹配。
- **真仓的 p8 是坏的**:`scripts/task.mjs` 在 572/598 用了 `P8_TAG` 却没 import(候选树同文件多这一行)。你报的 p8 绿**只属于候选树**;真仓一旦树干净就会 `TASK_INTERNAL_ERROR`,现在被更早的脏树前置遮住了。
- **999 tests 实为 998 pass / 1 fail**(`tests/proof-artifact-generator.test.mjs:269`,`PROOF_ARTIFACTS_STALE`)。
- **breakglass 白名单镜像漂移**:隐私改动使 WF 侧与 AOS 权威副本字节不同,`scripts/breakglass-consistency-check.mjs` 当场 `BREAKGLASS_ALLOWLISTS_DRIFTED` exit 1,报告未提。为让一道门绿而使另一道门红,只报前者。
- **codegraph 判据被改写未披露**:用改写前的判据重放同一棵树是红的,报告把绿归因于仪器观测;该判据唯一的测试测的是生产路径已不再调用的函数。
- **helper candidate 重钉方案完全未做,报告零字提及**(B 档明列子条);provenance 仍钉 `v0.10.2`,而引擎已到 0.11.8。
- **候选树游离在受治面外**:`~/.tcrn-workflow/candidates/qa4-inc098-O0SToT` 不在平台根、不在任何受治仓、名带随机后缀、链上零登记,而它的 `.git/config` 已配公开仓 origin 且无 pre-push 拦截。

## 2. 本轮新增的执行纪律(在 QA3 交接书那几条之上)

1. **编码 ≠ 占位化。**任何「让门变绿」的改动,先问一句:被量对象的**语义**变了吗,还是只有**形态**变了?只有形态变了就是绕过。
2. **门和被量对象不要在同一次提交里由同一方一起改。**本轮 P0 的加重情节就在这里——判据因此失去分辨能力。要改门,单独一次提交,并且先在**未修改的旧对象**上证明它会红。
3. **判据变更必须披露。**改了门的判据还报「绿」,而不说判据换了,读者会以为是被量对象变好了。收口注记里具名写出「判据从 X 改为 Y,改前对同一棵树的结果是 Z」。
4. **报「通过」时必须指明是哪棵树。**候选树 / 真仓 / 受治安装副本是三棵不同的树,本轮至少三处混淆(p8、privacy、999 tests)。写清楚在哪跑的。
5. **不要把红移出扫描面。**要归类就给新落点配独立判据,否则你造的是旁路不是分类。
6. **写失败先读回执,再决定要不要重试。**本轮验收方自己也踩到:CLI 仪式的输出经管道格式化时脚本报错,看起来像失败,实际**仪式已执行**;先读 `--receipt` 落盘的回执判定落没落,盲重试会重复写入。
7. **声称测试通过前,在真仓跑一遍。**

## 3. 单子名册(8 张;id 可由派生律 `work:`+sha256(`"work\0"`+大写外键)前 24 位重算)

### 强化批(先行)

| 键号 | id 后 8 位 | 要建什么 | 前置 |
| --- | --- | --- | --- |
| **INC-099** 隐私门反混淆判据 | `1c86413d` | 扫描前加保守归一化层(join 拼装求值、`\xNN`/`\uNNNN` 解码、`[-]` 字符类折叠、转义还原)+ 结构性可疑判据(检测私有 token 被拆分/编码的痕迹)+ 私有 token 名册单点声明两处消费 | — |
| **INC-100** 见证判据与锚定接线 | `72f23f83` | 扫描面扩到 `witnesses/` 并施见证类判据(清单双向对账、逐件 sha256/bytes、分类值枚举、原路径须已不存在);在线锚定接线(可达即开,锚不上具名红,离线标 `anchored:false` 不默绿) | — |
| **INC-101** 离仓工件登记与移植手续 | `fd4c0402` | 离仓工件上链登记(路径/用途/origin/生命周期)并纳入 INC-076 通路名册;移植手续成文;离仓树移除 origin 或装 pre-push 拦截 | — |

### 修复批(在后,前置已指名)

| 键号 | id 后 8 位 | 要修什么 | 前置 |
| --- | --- | --- | --- |
| **INC-102** P0 真值占位化 | `38eb7718` | 默认回退改真占位符或缺 env 即 fail-closed(二选一并记理由);白名单 pattern 同样占位化;候选历史重写使编码形态不留在任何提交;报告更正 | **INC-099**(正腿须由该门出具)、INC-101 |
| **INC-103** 真仓可发布性 | `275a1f24` | `P8_TAG` import;`proof-artifact-generator` 那条 fail;breakglass 两侧对齐;51 个脏路径按性质收拢或归类 | **INC-101** |
| **INC-104** 门落地欠账清偿 | `aa836f5a` | INC-090 真落地(items 自链派生);锚定核销与红腿实录;story-185 衍生件处置;codegraph 判据变更披露+补真覆盖;**helper candidate 重钉方案** | **INC-100** |

### Codex 钩子面(按 MIN-053 两层制立 Story,subtask 归 PLAN.md 不建链)

| 键号 | id 后 8 位 | 交付 | 前置 |
| --- | --- | --- | --- |
| **STORY-193** 宿主钩子面复原与治理观察对等 | `a2228a4e` | ①观察钩子按 persona-free 修正版**经引擎 adapter 动词族**(generate/install/validate/simulate/activation-assess/activation-record)重生成安装并取**活跃证据**(真触发一次)——**禁止手写 `hooks.json`**;②清理六条指向已不存在文件的陈旧 `hooks.state` 登记(改用户级配置**须出 diff 供 Owner 过目**);③处置 `ssh-write-observer` 对 Codex 执行面的结构性不可见(不能默认无害);④纳入 S191 能力等价矩阵 | 无(S191/S192 已 done) |
| **STORY-194** Codex stop-pact 对等物 | `53dc720e` | Codex stop 事件面的停止契约执行器,**与 Claude 侧共用 `tools/stop-pact` 契约状态**(不复制第二份真值);fail-open 三原则对齐(缺信息不拦、按工作状态判、模型不可识别时 observe);宿主差异残余适用性分析;README/公约更新 | **STORY-193**(D3 明定) |

**钩子面现状(实测,免你重新考古)**:UI「未找到钩子」不是丢失,是 2026-07-25 **有记录的刻意撤下**——persona-bound 形态判缺陷,旧定义存于平台根 `.codex/hooks.json.withdrawn-persona-bound-20260725`(494B,在位),完整旧接入留档 `tmp/legacy-codex-pre-v050-20260724/`,自述见平台 `.codex/README.md`。设计意图保留的 fail-open SessionStart 其定义文件也不在加载位,所以 UI 如实示空。用户级 `[hooks.state]` 六条信任登记仍在(5 禁 1 启)但**全部指向已不存在的文件**,翻成 enabled 也不会加载任何东西。引擎的 EPIC-024 observe-live 候选(persona-free 修正版)躺在 `tcrn-workflow/dist/local-codex-candidate/epic024-observe-live` 从未晋级。对比面:Claude 侧有活跃治理钩子(stop-pact Stop hook、ssh-write-observer PreToolUse),**Codex 侧现役为零**。

## 4. 建议执行序

1. **INC-099**(反混淆判据)—— 必须最先,因为 INC-102 的正腿要由它出具。做完先对**当前**候选树跑一次:**它必须红**(红即它在工作)。
2. **INC-101**(离仓工件登记与移植手续)—— 先定手续,才知道往哪棵树修。
3. **INC-102**(P0 占位化)→ 反混淆门转绿。
4. **INC-103**(真仓可发布性)→ 真仓干净树上 p8 真绿、999/999、breakglass 门绿。
5. **INC-100** → **INC-104**(门欠账,含 helper 重钉方案)。
6. **STORY-193** → **STORY-194**(钩子面;193 的活跃证据是 194 的前置)。
7. 第五轮验收 → S187 余项 → S190 → ⛔ 推送裁定交 Owner。

## 5. Owner 政策题现状

- D1(拓扑不公开须清洗)、D2(口令参数化换值)、D3(建 Codex stop-pact 但不挡本批)**均已裁定并落链**(v2258–2260),不需重问;INC-102 与 STORY-194 就是它们的落地。
- 仍需 Owner 单独裁的只有 **C 档推送**。当前裁定:**WF 公开仓在 INC-102 完成前不得推送**;AOS 私有仓判断不变(小清洗后可推,但注意它的候选分支零新提交,本轮产物不在其中)。
- 改用户级配置(`~/.codex/config.toml` 的 hooks.state 清理)仍须出 diff 供 Owner 过目后应用——承 S192 先例。

## 6. 第五轮验收会量什么

1. 反混淆门对**任一新编码变体**(base64 片段、`String.fromCharCode`、字符串反转)必红,且对修复后的全历史绿;
2. 垃圾件丢进 `witnesses/` 必红;编造回执必红;`anchoredReceipts > 0`;
3. 量链化的 `closeout-verify` 对本 INIT 全批绿,且 manifest 省略 items 必红;
4. **真仓**干净树上 `verify:p8` 绿、`999/999`、breakglass 一致性门绿;
5. 离仓工件名册含候选树且状态相符,未登记的带 origin 工件树必红;
6. Codex 新会话钩子面非空、观察钩子真触发留证、`hooks.state` 无指向不存在文件的登记;撤下钩子后活跃证据必消失;
7. helper candidate 重钉方案在位;
8. 每条收口注记含红腿实录 + 指名证据物 + 执行形态声明 + **判据变更披露**,actor 为你自己的 persona。

方法与前四轮相同:多路独立事实代理 + 对抗核验 + 主线程复核,自报不采信。

## 7. 陷阱速查(增补版)

编码≠占位化 / 门与被量对象别同次提交一起改 / 判据变更必须披露 / 报绿要指明哪棵树 / 别把红移出扫描面 / 写失败先读回执再决定重试 / 声称测试通过前在真仓跑一遍 / 回执=物化件逐字节拷贝 / 签自己的 persona / 前置满足看链上状态非记录顺序 / 发版先过铸造门 / break-glass 用一次记一次理由 / 逐 ref 推送严禁 `--all`/`--mirror`(本地两条旧世系分支各含 93 个真实邮箱提交)/ 引用 2122 带 hash / knowledge marker 常态落后 / 列表旗标半角逗号切分 / zsh `=word` 展开。
