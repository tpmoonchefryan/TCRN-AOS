# INIT-018 QA 修复批 — 处置记录

Owner 于 2026-08-05 批复「同意全部修正」后执行。执笔:审查层 `agent:fable`(本批实际驱动模型 `claude-opus-5`,会话中途由 Owner 切换;链上 actor 沿用层身份不变)。
**执行形态声明:主上下文单线收口,四路修复与九次对抗核验由子代理并行产出**——多代理这一点由工作流的运行记录承载(`subagents/workflows/`),不由本文自称。

本文是 [`report.md`](report.md) 的后续。那份报告的 sha256 已钉在链上、**字节冻结**,因此处置记录另起一份而不是回改它——与本平台「事件只增不改」在文档侧的对应做法一致。

---

## 一、为什么这批修复做了两轮

第一轮按 QA 报告的七项发现修完,四路自检全绿,我自己也独立复跑了红绿两侧。**随后的对抗核验推翻了其中相当一部分**:六个核验者从四路修复里提出 29 条,含 **8 条 high**。

最要命的一条,是 INC-040 的修复**没有达成它自己的目的**:

- 新的 `--verify-channel` 门在进程内直接调 `hookMode()`,绕过了「宿主起进程 → 分派 → 读 stdin → 载荷契约」这一整段;而源码注释却写着它走的是 hook 的同一入口。
- 更实在的是注册形态:`tcrn-workflow/.claude/settings.json` 注册的命令是**裸相对路径** `node scripts/ssh-write-observer.mjs`,只有 cwd 恰为 `tcrn-workflow` 时才能启动。**本平台的会话 cwd 就是平台根**——我当场实测,从平台根与从 TCRN-AOS 调用各 exit 1、sink 一行不落,而门在同一刻报 `OBSERVE_CHANNEL_LIVE` exit 0。

也就是说观察通道有**两条独立的死因**,第一轮只堵了「目录不存在」那条;而我自己的端到端验证之所以通过,纯粹是因为我恰好在 `tcrn-workflow` 目录里跑的——**探针撞了大运**。

这一条本身就是 QA 报告主结论的实证:一个立意「把散文变成门」的批次,它自己交付的门里仍然有从未生效的。第二轮因此专门针对 8 条 high 重做。

## 二、期间自查到的另一类缺陷(F8 → 已立 TCRN-CROSS-INC-042,链 v1720)

提交前扫描待提交字节时发现:**证据树与配置文件携带宿主家目录路径,而守卫它的卫生门作用域看不到它们所在的位置**。

| 事实 | 实测值(2026-08-05) |
| --- | --- |
| 一次 `git add docs/reports` 会带进 | 225 个文件 |
| 其中被卫生门判为 offender | **42 个** |
| ├ 含真实宿主身份 | 28 个 / 442 处 |
| └ 仅散文里的家目录占位符(`<local-home>` 的未规范写法) | 14 个 / 46 处(修法不同,应统一改写为 `<local-home>`) |
| 五个仓的 `.claude/settings.json` | 各 26 条 deny,其中 **20 条**含真实宿主路径;五份**均未 tracked、均未 gitignore** |
| 仓可见性(认证探针定案,2026-08-05) | `tcrn-workflow`、`TCRN-Design-System`、`TCRN-TMS` **PUBLIC**;`TCRN-AOS` **存在且 PRIVATE**(pushed 2026-08-04T12:48Z) |

最后一行经历了一次**被 Owner 当场纠正的探针错误**,原样留档:本文初版只跑了匿名 API,得到 Not Found 就写下「TCRN-AOS 未认证请求 Not Found」并暗示仓可能不存在。Owner 指出这是知识漏洞——**GitHub 对私有仓的未认证请求刻意返回 404 以不泄露存在性**,所以匿名 404 是一支区分不了「私有」与「不存在」两个世界的探针;而本机 `gh` 登录态一直在,权威探针只有一条命令之遥。认证重测:仓存在,visibility=PRIVATE。原文中「今日不可公开读取」仍成立(private 蕴含之);平台记忆「AOS 全历史公开」(INIT-012,2026-07-26)作为**历史事件**成立(当时确实公开并重写了 281 个提交),作为**当下状态**已不成立——可见性此后被翻转为私有。复核命令(须认证身份):

```bash
gh repo view tpmoonchefryan/TCRN-AOS --json visibility,isPrivate,pushedAt
```

对 INC-042 处置的影响:AOS 侧文件的暴露面因私有而降低,但**处置不降级**——可见性是一个可被随时翻转的开关,且该仓历史曾经公开;写进历史即永久。tcrn-workflow / DS / TMS 三仓面向公开仓,风险维持原判。

**根因与 INC-040 同源**:`evidence-hygiene.mjs` 把清洗器与扫描器放在同一个文件里(为的是「清洗成的形状」永远不会与「扫描找的形状」漂移),但扫描面硬编码为 `git ls-files -- evidence`;而 INC-034 把证据包整体迁去了 `docs/reports/`。**门只保护它读过的字节;证据搬了家,门没跟着搬。**

已就地办掉的:

1. **门的作用域扩为「`evidence/` 工作树遍历 ∪ 全仓 tracked 的 `.json/.md`」**。今日绿(扫描面 334 文件、0 offender);模拟 `git add` 证据树后立刻红并点名 42 个文件。经实测确认 `git ls-files` 会列出 staged-未-commit 的文件,因此门在 `git add` 与 `commit` 之间触发——正好落在泄漏能够落地之前。选全仓而非「evidence/ + docs/reports/」名单,是因为写死目录名单正是本缺陷本身,而且今天两种作用域的 offender 数都是 0,代价为零。
2. 顺带修掉同一缺陷的第二例:pending 名单的闭合条件原先也只在 `evidence/` 下可证伪。
3. **本批新引入的三处泄漏就地修掉**:补门的代理在自己的新测试夹具里写了真实宿主路径(而且正好在它的门读不到的 `.mjs` 里),换成一个外来家目录形状并实测同规则同行等效;`measure-context-bytes.mjs` 的注释举例;QA 证据里一条 node 栈轨迹(用模块自身的清洗器处理成 `<local-home>` 形态,避免形状漂移)。

`.claude/settings.json` 的可移植化则做成了一次**两侧实验**,结论反直觉:

- 朴素改法(绝对路径 → `**/` 相对形式)**会丢覆盖**:判据点名 `.tcrn-workspace/cross-project/workspace/.tcrn-workflow/events/*.json` 未被覆盖(`**` 不跨点目录段),`CONTROL_TREE_DENY_COVERAGE_FAILED`。
- 可行改法:**只把家目录前缀换成 `~/`**、其余路径段一字不动 → `CONTROL_TREE_DENY_COVERAGE_COMPLETE` exit 0,且零真实宿主路径。

```bash
CONTROL_TREE_GUARD_SETTINGS="<候选文件>" node TCRN-AOS/scripts/control-tree-guard-proof.mjs; echo exit=$?
```

如果只靠推理而不过这道判据,朴素改法会**静默削弱一道安全控制**——这也是为什么该实验的对照组(已知好的输入)必须先跑一次:我第一次两侧都红,先怀疑的是自己的探针,校准后才确认红是真的。

## 三、提交范围:为什么不是全部

已提交到整合分支 `feat/cross-init018-prose-to-gates`(两仓,**未推送**)的是**实现字节**。**扣下未提交**的是:

- `docs/reports/init-018/` 整棵证据树(42 个 offender 待清洗,见 INC-042);
- 两仓的 `.claude/settings.json`(20 条含宿主路径的 deny 规则,修法已实测但归 INC-042 一并办,避免与本轮 hook 改动交叉);
- 两个 launchd plist(INC-032 的修复往 `EnvironmentVariables.PATH` 里写了一条以家目录开头的 nvm 绝对路径,是本批**新引入**的泄漏——origin/main 上原本是 0 处)。

`deploy/switchover/emit-switchover-proof.mjs` 那 1 处**已在 origin/main 的历史里**(该仓现为私有,即时暴露面有限,但历史一经写入即永久、可见性可翻转),处置(改写历史 vs 就地修正不追溯)是方向题,列入 INC-042 待 Owner 裁定。

合入 `main` 与发布 v0.11.0 是本 INIT 唯一的对外发布事件,按交付节奏公约是**必停点**,不在本批执行。

## 四、链上记录

| 记录 | 状态(截至链 v1728) | 承载什么 |
| --- | --- | --- |
| `TCRN-CROSS-INC-040` | **done** | S2 观察通道断裂。收口注解把「第一轮被证伪」这个事实一并入档,并记明观察窗自 2026-08-05 重置起算 |
| `TCRN-CROSS-INC-041` | **active** | 收官残余批 F2..F7(已修)+ 四件悬置代办的载体(未办):S4.2 Codex 配置、STORY-144 enforce 切换、S154 archify 安装、otel-spans 接线 |
| `TCRN-CROSS-INC-042` | planned | 本文第二节;v1720 立单,v1721 追加认证探针订正 |

第二轮的验收由我逐条重跑,不采信执行者自述:观察器自检 96 样例 0 失配;门绿=两个真实注册根 LIVE,红=无注册根 `settings-missing`、注册指向不存在脚本 `hook-launch-failed`,均 exit 1;未知旗标 exit 64;真 HIT 自平台根与 TCRN-AOS 两种 cwd 经注册命令落盘并读回;隐私门 450 条违规报文经管道 72,212 字节与直写逐字节相同且可解析;仪式在读端关闭下 exit 0 而同场景对照组 exit 1;`F5_RECHECK` 绿侧 exit 0、清空一个新址目录即 exit 1 点名;`recheck.sh` 缺目录 exit 1。

**套件里才暴露的一条**:两个新测试用 `stdio: ["ignore", fd, "pipe"]` 把自己打开的描述符交给子进程,被本仓测试控制器的子进程策略拒为 `TEST_CONTROLLER_INHERITED_STDIO_FORBIDDEN`。裸 `node --test` 不加载该策略所以单跑全绿,只有 `pnpm test` 才红——**「本地绿≠套件绿」的又一实例**。改为让 `sh` 自己打开文件做重定向(不交出任何描述符,而 stdout 仍是普通文件,测试语义不变),带策略与不带策略两种形态各 50/50 绿。

## 五、方法上的收获(比缺陷更耐用)

1. **对抗核验这一步是本批性价比最高的环节**。它推翻的不是边角,而是主结论——没有它,一道自称已修好、实则在部署形态下从未启动过的门就会被当作收口证据,并成为 enforce 晋级的依据。
2. **我自己的探针在本会话错了五次**,全是 shell 量具:管道吃退出码(第六次)、未加引号的 `$var` 被词分割(两次)、给后台命令加 `| tail` 导致之后 grep 那份制品只剩尾巴。已写进持久记忆。教训的形状很稳定:**判据两侧我只看了一侧**。
3. **验证一个门,要在它将要被评估的每一种世界里验**。cwd 就是这样一种世界维度,而我第一次只验了最顺手的那一个。
