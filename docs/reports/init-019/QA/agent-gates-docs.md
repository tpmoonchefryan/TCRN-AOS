# 代理原文 · 门/运行者/跨仓文档一致性审(general-purpose,只读)

收录:2026-08-06 · INIT-019 验收 · 评审范围:AOS `24644aa..HEAD` 中 doc-topology*/parity/projection-freshness/platform-runner 与两仓 CLAUDE.md 提交、平台根 CLAUDE.md 与五份公约。
原文除宿主路径打码(`<平台根>`/`~`/`<本机用户名>`)与 HTML 实体还原外未改动。对应拆单:INC-045(发现 1、10)、INC-046(发现 2)、INC-050(发现 3、4、11 及命令清单)、INC-051(其余)。
按语:发现 2 的「公开仓」前提以 TCRN-CROSS-INC-042 advisory 的 Owner 订正为准——AOS 现为 PRIVATE(历史曾公开,清洗处置不降级)。

---

评审完成。以下为实证发现。所有结论均在本机验证过(只读操作:读文件、git diff/show/ls-remote、跑 node --test 与只读 proof 脚本;未改任何文件、未做任何 SSH 写)。

# 评审发现

## P1(必须在推送/收口前处理)

**1. {P1, <平台根>/TCRN-AOS/deploy/aos-local-client/doc-topology-proof.mjs:328,399}** 五个红证(含本 Story 新增的 SSH 访问形态红证)在当前全 VM 名册下被**静默跳过**,门自证可红的环节实际从未运行。
- 失败场景:`reds` 块的守卫条件是 `platform !== null && awayEntry !== null && localEntry !== null`,而 08-03 全迁后 `PARTITION_ROSTER` 五个分区全部 `home:"vm"`,`localEntry` 恒为 null → 五个 in-memory 红证全跳;第六个测量红证(`contradicted`)同样以 `localEntry` 为前提,也为 null。`expectations` 由 `allReds.map(...)` 生成,数组为空时**一条 RED_ 期望都不产生**,没有任何 unmet 记录这次跳过。文件自己的注释写着「a section that vanishes when it does not run is how "we proved that once" becomes unfalsifiable」——正是现状。STORY-157.3 的 `RED_SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED` 是在这个死块里新增的,即「建成未接线」。
- 验证:实跑 `node deploy/aos-local-client/doc-topology-proof.mjs`(只读),输出 `redCount: 0, redIds: []`,expectations 里无任何 `RED_*` 行,门仍 `ok:true / DOC_TOPOLOGY_IN_SYNC` 退出 0。纯测试(`doc-topology-predicates.test.mjs`,54/54 过)用的是含 local 行的合成名册,证明判官对数据是对的,但真机红弧已消失。

**2. {P1, <平台根>/TCRN-AOS/deploy/aos-resident-cockpit/com.tcrn.platform-runner.plist:21,22,27,34,36}** 提交物中硬编码本机用户名 `<local-home>/...` 共 5 处,且卫生门按扩展名看不见它。
- 失败场景:本仓曾为清洗家目录路径重写过 93 个提交;卫生门(`scripts/lib/evidence-hygiene.mjs:36` `SCANNED_EXTENSIONS = [".json",".md"]`)扫全部 tracked 文件但只认这两个扩展名,`.plist` 与 `.mjs` 全盲。同类前科已在公开面上:`deploy/switchover/emit-switchover-proof.mjs:161` 含 `~/.tcrn-workflow/...` 的绝对形态(含用户名),且经 `git ls-tree 36ed7f2` 证实**已在已推送的 main 上公开**。旧模板的做法是 `/bin/sh -lc` + `$HOME`(见 24644aa 的 paired-backup.plist),新 plist 破了这个惯例。
- 验证:`git grep "Users/<本机用户名>" HEAD` 命中恰这两个文件;`git ls-remote origin` 显示 `feat/cross-init019-single-data-plane` **尚未推送**(main 停在 36ed7f2),所以 plist 一处仍有修复窗口,.mjs 一处已公开。范围内其余提交物(含 evidence/mcp-ceremony-write/ 全部收据)仅含 `tcrn-platform-dev` 主机别名与 `/srv/tcrn/...` 路径——与既有公开面同类,未见 IP/凭据。

**3. {P1, <平台根>/CLAUDE.md:144}** 每个受治会话的第一条命令按字面跑不通:`node <平台>/.tcrn-workflow/trusted-bootstrap.mjs`,而平台根**不存在** `.tcrn-workflow/` 目录。
- 失败场景:照抄命令得到 MODULE_NOT_FOUND。真实文件在 `~/.tcrn-workflow/trusted-bootstrap.mjs`(同一命令块里 `--provenance ~/.tcrn-workflow/...` 用的就是 `~`,一块之内两种根)。这正是本 Initiative 自立的「文档命令须按字面可跑」纪律的反例,且该命令是「每个受治会话先验证已安装副本」的入口。
- 验证:`ls "<平台根>/.tcrn-workflow"` → No such file;`ls ~/.tcrn-workflow/trusted-bootstrap.mjs` → 存在。

**4. {P1, <平台根>/CLAUDE.md:166,169}** 仪式通路一节整段过时且自相矛盾:「(AOS 分区专用;本机四分区直接用本机引擎,无需仪式)」。
- 失败场景:与同文档第 0 小节(「五条链的真值现在全部在 VM」「本机不再持有任何活链」)直接冲突;照它对 cross/DS/TMS/Joi 用本机引擎写会得到 `WORKSPACE_RELOCATION_VACATED`。本 diff 自己的证据就是经 `ceremony.mjs --partition cross-project` 写的(evidence/mcp-ceremony-write/ 大量 cross-project 收据);DS/TMS CLAUDE.md 也教 `ceremony.mjs --partition TCRN-Design-System/TCRN-TMS`。另外第 169 行命令 `node deploy/aos-local-client/ceremony.mjs ...` 相对路径以 TCRN-AOS 为 cwd,从平台根照抄同样跑不通,且未提 `--partition`。这句散文正好落在收容规则的天花板外(无具体地址字面量),机器判据看不见。
- 验证:读 CLAUDE.md 原文;对照 `topology.mjs` 名册(五分区全 vm)、ceremony.mjs 的 `partition = "TCRN-AOS"` 默认值与 `--partition` 支持、DS/TMS 两仓 CLAUDE.md 文本。

## P2

**5. {P2, doc-topology-predicates.mjs:131}** 访问形态守卫的实现窄于其声明:`SSH_ENGINE_PATTERN` 只匹配 `ssh <单个无引号token的host> ["']node …tcrn-workflow.mjs` 这一种形态。
- 会红的漂移(判定函数实答):home 格与名册矛盾;地址格与名册矛盾;必带块被删;声明分区集不符;未知分区;复核命令列不含所声明地址;具体地址字面量出现在块外;引号形态的 SSH 直驱命令未进白名单;块格式坏;登记文档缺失;已提交声明块与工作树分叉;实测与名册矛盾。
- 不会红的漂移(逃逸面):`ssh -o BatchMode=yes tcrn-platform-dev "node …/tcrn-workflow.mjs …"`(带旗标,恰是 doc-topology-proof.mjs:154 自己用的真实形态)、不带引号的 `ssh host node /srv/.../tcrn-workflow.mjs`、`ssh host "cd /srv/tcrn/engine && node scripts/tcrn-workflow.mjs"`。平台 CLAUDE.md 宣称「白名单外**任何**文档出现 SSH 直驱引擎命令即红」,声明覆盖>实现覆盖。同平台的 ssh-write-observer(argv 级解析、递归 `-c`)证明更强判据是做得到的。
- 验证:对 regex 逐形态推演;对照 tcrn-workflow/scripts/ssh-write-observer.mjs:546-579 的 token 级实现。

**6. {P2, doc-topology-predicates.mjs:137 对 tcrn-workflow/scripts/ssh-write-observer.mjs:576}** 「一份名单、两处消费」在名单层成立,但两个消费者把 pattern 用在**不同的字符串**上:doc 侧拿 `match[0].slice(0,160)`(截止于 `tcrn-workflow.mjs`,动词与旗标不在内)去匹配,observer 侧拿完整命令行匹配。
- 失败场景:将来登记一条约束到动词的 break-glass 条目(如只放行 `status`/`--version`),observer 侧 PASS、doc 侧永远匹配不上 → 同一条目两处判决相反。今日 `entries:[]` 为空所以未爆发,属埋雷。
- 验证:读两处代码;确认两处都消费 `entries` 数组(classes 只是散文),`readSshBreakglassAllowlist`/`readBreakglassAllowlist` 均指向同一文件——「两处消费」本身属实。

**7. {P2, <平台根>/TCRN-AOS/deploy/aos-local-client/projection-freshness.mjs:101-139}** 四侧车中两个的新鲜度判据没有实现公约自己的定义(「自身版本 ≠ 真源版本且差值超最大龄」):web-projection 只比 `generatedAt` 距**挂钟现在**是否 ≤7 天,声明的真源「governed chain versions」从未被取数;memory-index 的真源与自身是同一物(最新 mtime 距今 ≤30 天),只能测「用户 30 天没干活」,不能测「索引落后真值」。
- 失败场景:链昨天写了 50 条、投影是 6 天前生成的 → web-projection 报 fresh;这违反平台仪器纪律第 4 条「不要拿会移动的挂钟当基准」。
- 侧车缺失/宿主不可达的方向倒是对的:web 无 dist → unproven→红;codegraph 无索引 → stale→红;VM 不可达 → `remoteEngine` 不 accepted → unproven→红(经 rehearsal-lib 的 `ssh -n`,无 BatchMode/ConnectTimeout,先挂到 TCP 超时才红——慢红,不假绿)。注册方式:`SIDECARS` 是冻结声明表,但四个检查函数是手接线、按下标拼行,加第五项 SIDECARS 不会自动被检查,也无 `rows.length === SIDECARS.length` 的自检。
- 验证:通读该文件;实跑(只读,含一次对 VM 的只读 knowledge-freshness):knowledge fresh / web fresh(2026-08-04)/ **codegraph stale(TCRN-AOS 索引旧于末次提交,真实陈旧被抓到)** / memory fresh,真实退出码 1(注意首测曾被 `|tail` 吃掉退出码,复测无管道确认)。

**8. {P2, <平台根>/TCRN-AOS/deploy/aos-resident-cockpit/platform-runner.mjs:9-10,36; 及 :4}** 头注声称「the child group is killed on exit」,实现里没有任何进程组回收:`spawnSync` 超时只 SIGTERM 直接子进程(job1 恰是 pnpm 包装链——CLAUDE.md 明写「杀直接子进程不等于杀干净」);手动跑超时后 `node projection-freshness`+挂起 ssh 可孤儿存活,launchd 下只是碰巧靠 AbandonProcessGroup 默认值兜底。另外第 4 行用法宣称 `[--if-due]`,全文件无一处解析该旗标(对照旧 paired-backup 走 `paired:backup-if-due` 的先例)。
- 验证:通读 65 行全文;`grep if-due` 仅命中用法行。
- 好的一面(为公平):INC-032 主教训已修——plist 显式钉 PATH 且直呼 nvm node,`which pnpm` 证实 pnpm 就在钉住的 `~/.nvm/versions/node/v24.16.0/bin/`;`launchctl list` 显示 com.tcrn.platform-runner 已加载、`~/Library/LaunchAgents` 安装副本与仓内 plist 逐字节相同;scheduler-health 的期望名册从 deploy/aos-resident-cockpit/*.plist 的 Label 自动派生,新 plist 落进模板目录即被 `pnpm scheduler:health` 覆盖(含 exit-127 的 INC-032 提示语);统一日志真实在写、每小时一轮,且 runner 正确把 projection-freshness 的红上抛为自身 exit 1(launchctl 可见 status 1)。残余小口:runner 丢弃 job stdout、stderr 截 200 字节,统一日志里失败原因断成「codegraph: s」(实测),要查全貌得去 out.log 或重跑;且没有任何东西定期跑 scheduler:health 本身。

**9. {P2, <平台根>/TCRN-AOS/deploy/aos-local-client/doc-topology-registry.mjs:40-112}** 名册天花板外的暗面在本轮**变大了而未登记**:2026-08-05 新写/改的 `docs/projection-freshness-convention.md`、`docs/dispatch-readiness-convention.md`、`docs/deliberation-adoption-convention.md`(及更早的 sourcing-and-vetting)都不在 DOC_REGISTRY;更要紧的是 `TCRN-AOS/docs/direction-aos-collaborative-workbench.md` **也不在册**,而它的复核命令句里带着活地址字面量 `/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace`——本 diff 刚改写过这一行,说明它被当作「会声称真值位置的文档」对待,却没按 CEILING 的「同一次改动要把它登记进来」入册,将来漂移无人看见。
- 验证:读 DOC_REGISTRY 全表(13 项);grep 四份未入册公约无 /srv/.tcrn-workspace 字面量(今日干净),direction 文档有。

**10. {P2, <平台根>/TCRN-AOS/evidence/aos-topology-doc-sync.json(HEAD)}** 已提交的门证据是 07-30 的旧世界:`observedAt 2026-07-30`、`reds:5`、无 SSH 守卫期望;门在本轮改了形状(新增两条期望、红弧实际归零)却未 `--emit` 刷新。一个专讲「物化侧车不得陈旧」的 Initiative,自己的门证据侧车落后了两版拓扑。
- 验证:`git show HEAD:evidence/aos-topology-doc-sync.json` 对比实跑输出。

**11. {P2, <平台根>/CLAUDE.md:80 与 docs/projection-freshness-convention.md:19,25}** 两处计数/路径断言失实:①「Claude Code 侧平台 .mcp.json **五者**齐备…仍缺**三个**」——实测 .mcp.json 现为**六**个服务器(本轮新增 aos-mcp-write,parity ANCHOR_ROSTER/ALLOWLIST 已同步为 6/4,门本身绿),散文没跟上;②新公约两处写注册表在 `deploy/aos-local-client/projection-freshness.mjs`,缺 `TCRN-AOS/` 前缀,从公约所在的平台根按字面找不到该文件。
- 验证:`node -e "Object.keys(require('./.mcp.json').mcpServers)"` 得 6 项;`pnpm --dir TCRN-AOS parity:proof` 实跑 `PARITY_VERIFIED`;`ls` 证路径。

## P3

**12. {P3, doc-topology-registry.mjs:43,62}** 注册表 `what` 散文过时:「四个分区现在不在同一台机器上」(现为五个)、DS 条「本仓分区本轮仍在本机」(现在 vm)。非执行字段,但这是一份专治陈旧散文的文件。

**13. {P3, doc-topology-predicates.mjs:303}** 复核命令列的检查只有 `includes(claim.address)`——MCP 工具名拼错(如 `tcrn_remote_status`)不红;整场「复核命令 MCP 化」的门不验 MCP 那一半的拼写(CEILING 只承认「不保证能跑通」,没承认连名字都不看)。实测当前 13 条 claim 的工具名 `tcrn_remote_read_status` 与真实服务器工具一致。

**14. {P3, TCRN-Design-System/CLAUDE.md:121; TCRN-TMS/CLAUDE.md:70}** `pnpm --dir TCRN-AOS doc-topology:proof` 仅从平台根可跑,在各自仓根按字面执行会因不存在 TCRN-AOS 子目录而失败;未注明 cwd。

**15. {P3, projection-freshness.mjs:92-99}** codegraph 自身版本取 `.codegraph` 下任意 `db|sqlite|json|bin` 文件的**最大** mtime——daemon 触碰的非索引 json 也能把陈旧索引撑成 fresh(与「陈旧索引自信撒谎」的平台教训同向的小口)。另 plist 把 node 钉死在 v24.16.0,nvm 清版本后 agent 静默断,直到有人手动跑 scheduler:health。

# 逐字面跑不通的文档命令清单(系统性核查结果)

核查了五份公约+平台 CLAUDE.md+AOS/DS/TMS/tcrn-workflow CLAUDE.md 中每条可执行命令(文件存在性、脚本名在对应 package.json、路径可达):

| # | 位置 | 命令 | 断点 |
| --- | --- | --- | --- |
| 1 | 平台 CLAUDE.md:144 | `node <平台>/.tcrn-workflow/trusted-bootstrap.mjs …` | 平台根无 `.tcrn-workflow/`;真身在 `~/.tcrn-workflow/` |
| 2 | 平台 CLAUDE.md:169 | `node deploy/aos-local-client/ceremony.mjs …` | 相对 TCRN-AOS 的路径,从平台根跑不通;且 166 行前提句已过时 |
| 3 | docs/projection-freshness-convention.md:19,25 | `deploy/aos-local-client/projection-freshness.mjs` | 缺 `TCRN-AOS/` 前缀 |
| 4 | DS CLAUDE.md:121 / TMS CLAUDE.md:70 | `pnpm --dir TCRN-AOS doc-topology:proof` | 仅平台根 cwd 可跑,未注明 |

其余全部核实**可跑**:`pnpm --dir TCRN-AOS doc-topology:proof / parity:proof / engine-host:verify / paired:backup / paired:backup-verify-offsite / local-purity:proof / projection-freshness:proof`(脚本与目标文件均在)、`node <平台>/tcrn-workflow/tools/stop-pact/cli.mjs`(存在)、ssh-write-observer.mjs(存在)、delivery-cadence 的 git 命令族、dispatch 的 `pnpm test`。

# 计数断言抽验(镜头 6)

- **「14 处 SSH 复核命令→0」:成立。** S157 盘点报告(TCRN-AOS/docs/reports/init-019/S157/inventory.md)载明 14 处 = 平台 CLAUDE.md 5 + delivery-cadence 5 + AOS/DS/TMS CLAUDE.md 各 1 + direction 文档 1;原样重跑其「机器可复现」grep,现得 **0 命中**(exit 1)。
- **「五链」:成立**(topology.mjs 名册 5 分区;doc-topology 实跑 counts.claims=13=5+5+1+1+1)。
- **「四侧车」:成立**(SIDECARS 恰 4 项,公约与 runner 头注一致;runner 三个 job 与其头注一致)。
- **「五者齐备」:已失实**(见发现 11,现为六者)。

# 跨仓一致性(镜头 5)

DS 9a42ca6 与 TMS 020358d5 均为单行改动:复核命令列 ssh→MCP,地址列不动;与平台 CLAUDE.md 第 0 小节表格、AOS CLAUDE.md 行、topology.mjs 名册**四方逐字一致**(分区名、vm、地址、`tcrn_remote_read_status(partition=…)` 工具名——工具名与 tcrn-workflow-aos-read 服务器真实工具吻合)。doc-topology-proof 对 13 份登记文档实跑绿即机器背书。仅 DS:111/TMS:60 的引导句「drives the VM engine over SSH」保留(描述仪式内部实现,不构成直驱命令,守卫判绿正确)。

# 亮点

1. **三项权威序设计(文档→名册→实测)真的两个方向都咬**:文档与名册互洽但机器不答会红(measurementRed 设计);committed-vs-tree 检查(INC-039)抓「只在作者磁盘上正确的声明」,这个门形状少见且动机来自真实事故;「复核命令列必须含所声明地址」使地址变更必然连坐改命令。14→0 的迁移本身有可复现盘点、且我重跑归零。
2. **「一份名单、两处消费」属实且两侧都 fail toward 红**:文件缺失/空时 doc 侧任何 SSH 直驱即红、observer 侧一律 HIT,不存在名单丢了反而放行的方向。
3. **STORY-168 的 launchd 接线是真的**:安装副本与仓内 plist 逐字节同、hourly 日志在写、scheduler-health 从模板目录自动派生名册故新单元零配置入监、且上线首日 runner 就把一个真实陈旧(codegraph 落后 HEAD)以 exit 1 上抛到 launchctl——「生效证据」链路端到端演示过一次真红。

# 总体判词

这批改动的机制骨架(三项权威、双向断言、名单单源、名册自动派生)是平台里成色最好的一类,且多数接线经我实测为真;但它恰好在本 Initiative 自己立的三条纪律上各摔了一跤:**门的可证伪性**(全 VM 名册让六个红证静默蒸发,门变成只会绿的那半个)、**文档按字面可跑**(受治会话第一命令与仪式通路整段在平台入口文档里跑不通/自相矛盾)、**提交物卫生**(卫生门的扩展名盲区放过了 plist 里五处用户名,同类已有一处在已推送的 main 上)。幸运的是分支未推送、平台 CLAUDE.md 不在任何仓里,四个 P1 全部还在本机可修的窗口内;建议红证跳过(发现 1)与 plist 用户名(发现 2)在推送前必须处理,144/166 两处文档在同一批订正。
