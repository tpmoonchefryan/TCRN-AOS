# HANDOVER — INIT-020 终局执行批（投产收口）

2026-08-08 · 交接方 `agent:fable`（Claude Code）→ 接收方 `agent:gpt-5-codex` · 本文取代 `HANDOVER-2026-08-07-qa4-codex.md` 的名册与执行序段。链上登记见 INIT-020 注记 rev9。

## 0. 一句话任务

按 INIT-020 注记 rev8/rev9 的终局 P0 执行到收口就绪：**五链回迁本地、量具先行、全单经新收口门核销**；收口验收 = Owner 必停。本批完成后平台即投产；随后的「AOS 整改 Initiative」（需求台账先行→开发→测试→Owner 验收→重新上线）是下一个 handover，**不在本批，不要提前动**。

## 1. 开工仪式（每个会话）

1. `verify-installed-copy` → 期望 `INSTALLED_COPY_VALIDATED`。注意：它验的是 skill 副本，现钉 v0.10.2 落后引擎 0.11.8 是**已知项**（INC-113 修），不要误报信任面红。
2. 读链上 INIT-020 当前注记（rev9）与本文。基线：cross ≥2412、AOS 1050——**以现读为准，谈链头必须带 hash**（两个 v2122 撞车的教训）。
3. 署名铁律：一切链写 `actor=agent:gpt-5-codex`，**严禁拷 agent:fable**（QA3 教训）；审议立场按 persona 公约两级署名。
4. 执行形态声明：单上下文即如实声明 synthesis-only。
5. 中断续命卡：会话中断后重读本文 §1+§5，进度以链上状态为准（work-list + 各单注记），勿凭记忆续跑。

## 2. 方向与轨道（必答背景）

- **本地模式 = 现行轨道**：五链回迁本机 file 后端，日常读写零 SSH。
- **AOS 协作模式 = 整改期暂停轨道**（rev7：回退原因 = AOS 未按 Owner 要求开发、现状不可用；不是无限期封存）。
- **发布轨 / 宿主对等轨 / SSH 观察轨 = 封存**；撤销册 43+1 张见 rev6 段。**cancelled 单严禁重开或"顺手执行"**——重启轨道时由 Owner 以当时状态重估重立。
- 写面鉴权 = deferred（Owner 裁）；备份通路已撤（宿主快照替代）；SSH 禁令长期有效（仅调试/环境搭建/逐次授权例外）。

## 3. 通道铁律

**S199 完成前**（链还在 VM/PG）：
- 链写 = `deploy/aos-local-client/ceremony.mjs --payload <f> --partition <分区>`，**dry-run 先行**并核 `chainBefore` 与读面全值一致。
- 链读 = MCP 读面；已知故障：会话级隧道死亡不自愈（症状 `MCP_REMOTE_NON_JSON_OUTPUT` / curl exit 7）。应对 = 自建隧道**仍走门面**：`ssh -M -S ~/.ssh/<短名>.sock -f -N -L <port>:127.0.0.1:4320 tcrn-platform-dev` 后 POST `/api/engine/<verb>`；用后 `-O exit` 回收并验证进程组空。socket 放长路径会报 `unix_listener ... too long`，必须用 `~/.ssh/` 短路径。
- **严禁 SSH 直驱引擎 CLI 读写链**（break-glass 仅限门面不可达且记录理由）。

**S199 完成后**（链在本地）：
- 该链读写 = 本地引擎 CLI（CLI 即引擎，不违「只有引擎写链」）或本地 MCP 面（写需既有 pinned grant）。
- ceremony/远端 MCP 面 = AOS 模式工具，封存，禁用于日常。

通用：事件只增不改；`work-annotate` 是**整段替换**——改注必须全文重发（原文自动留事件史）；对 VM 的迁移/停服务操作 = 环境搭建豁免，逐次在记录里写明用途。

## 4. 合规制度（INC-117，对你每一步生效）

- 每张单已带**【目的】段**（为谁改变什么 / 目的锚 / 符合性判据 + 判定人）。**实施前先读目的；预完成时回望目的**——这是 Owner 点名的缺口，别再犯。
- 收口注记必含**目的回验段**：引用该单【目的】原文 + 事实是否符合的结论 + 证据指针。
- **判定人 = Owner 的单**（092/093/097/100/105/108/111/113/117）：实施完成后注记标 `pending-owner-acceptance`，留在非终态；S190 时打包请 Owner 验收后统一 done。**判定人含执行方自证的单**（094/101/103/109/110）：红腿证据在案即可自转 done（回验段照写）。
- 六张 Story（190/196/197/199/200/201）已按**十区块硬模板**重写：按各自 Acceptance Criteria 的 GIVEN/WHEN/THEN 逐条取证。若确需新立 Story，必须带全十区块（可写「无——原因」，区块不可缺）。

## 5. 执行序（权威版，rev9）

| 波 | 内容 |
| --- | --- |
| **0 量具** | INC-108（收口门真量链 + 四结构判据）+ INC-117（dispatch-readiness 公约改文，与 108 同批）+ INC-109（在岗性与自检独立）→ INC-110（mode.mjs 判据表：未知模型名必 observe）、INC-105（Claude 侧用户级 Stop hook 接线——settings 须手写，**diff 供 Owner 过目**，取真实触发证据，顺手清 08-06 过期悬空契约） |
| **1 回迁** | S199：逐链五步（知识同步→pg→file 反向迁移+verify→relocation vacate/adopt→本地 validate+rebase→头全等核对+证据物）。迁移窗内暂停其他受治写 |
| **2 收敛** | S200：本地读写验证 / 两宿主名册收敛（**Codex config 只出 diff 请 Owner 确认，不代改**）/ VM 四服务 stop+disable / 重新上线手册底稿 |
| **3 文档门** | S201：真值表+roster 翻转 / local-purity 语义反转（本机恰五活树）/ doc-topology 绿 + 各一次红腿 |
| **4 记录卫生** | INC-100（回执锚定）/ 111（反转拼接件处置）/ 092（署名通道化）/ 094（隐私门类扩收尾） |
| **5 信任面** | INC-103（真仓 p8 绿；**dirty worktree 下 p8 拒绝是正确行为**，先清树）→ INC-097（铸 v0.11.8 annotated tag 经 093 门；A 档已授，门绿即行）→ INC-113（helper 重钉 + candidate 必升 + IDENTITY_MISMATCH 两义——**执行前 Owner 批准，必停**）→ INC-101（离仓工件登记） |
| **6 收口** | S196（实现七子探针聚合门 + 逐项红腿演练）→ S197（协议写入平台 CLAUDE.md 与 HANDOVER）→ S189 补 done → S190（全单经 108 门核销、INIT-009 补录 done、EPIC-052..058/056/057 依 WSA-3 关门、**请 Owner 收口验收**） |

## 6. 必停点（全部四类）

1. INC-113 helper 重钉执行批准（`HELPER_REPIN_OWNER_APPROVAL_REQUIRED`）。
2. INC-105/S200 的用户级配置与 Codex config diff——出 diff 请 Owner 过目后应用。
3. INIT-020 收口验收本身。
4. 任何 push——**本批不存在合法 push**；发现自己想 push 就是走歪了。
其余按「运行至完成」推进；Owner 可调参数（196 周检频率、197 阈值）用默认值，不必停。

## 6.1 投产后开发冻结与再开发协议（S197，记录日 2026-08-08）

协议写入平台级 `CLAUDE.md`，并在本 handover 留存同一份可执行文本。协议在 Owner 宣布 INIT-020 收口投产时生效：引擎、门面与 helper 的非紧急开发冻结；运行期常规读写只走本地 MCP 面与引擎 CLI，MCP 写沿用既有 pinned grant；引擎字节改动一律新立 Initiative；SSH 严禁日常化，只保留调试、环境搭建、逐次授权例外，并记录理由。AOS 整改 Initiative 是 Owner 直接下达的独立轨道，不受本触发器约束。

破冻仅限三类：**fail-closed 事故**、**数据完整性或备份失效**、**安全事件**。每次破冻必须先立 INC，并在同一批完成验收；非紧急引擎提交目前没有机器门，由 Owner 人工拦截并如实登记。

再开发由数据而非冲动触发，先到者触发：任一分区自投产累计 `100` 个新工作项、五分区合计 `300` 个新工作项、运行满 `12` 周、或 failure-pattern register 任一模式达到其晋升阈值。触发后建立「运行复盘 Initiative」，输入链上工作记录、knowledge candidates、失败模式计数、S196 周检注记与撤销登记册，产出带证据的继续冻结或新立开发裁定；Owner 调整 `100/300/12 周` 默认值时以注记落链。若触发而复盘未开，S196 周检注记必须标注欠账。

复核命令：`pnpm --dir TCRN-AOS prod:ready`；工作量与欠账以本机引擎 `status` / `work-list` 及 S196 注记为准，不以文档缓存替代活链。

## 7. 红线

- 严禁 push / `--all` / `--mirror`；严禁铸 v0.11.8 之外任何 tag。
- 严禁编辑器/文件工具碰任何 `.tcrn-workflow` 树；严禁 SSH 直驱引擎读写链。
- 门与被量对象不得同次提交由同一方共改；报绿须指明哪棵树（真仓/候选树/安装副本）；声明测试通过前在真仓跑一遍；不得把红移出扫描面。
- 写失败先读回执再决定重试（失败写零落链已实证，但以回执为准，勿盲重试）。
- 新工件不含本机绝对路径；fixture 口令一律占位符。

## 8. 坑速查（本批新增在前）

- 回执 grep 会被 scope 引文污染（INC-111 原文含 `READBACK_*` 字样）——判定回读一律**解析 readback 数组**，不数字符串。
- PreToolUse 钩子偶发超时（host client unreachable）——该次工具调用未执行，重试即可。
- work id 派生律：`"work:" + sha256("work\0" + 大写外键)[:24]`；**批量 id 一律派生勿手抄**（手抄 40 个抓出 1 错的实证）。
- 名册改版必做守恒检查：全集 = P0 ∪ 撤销 ∪ 已终态，无悬空。
- kind 枚举大写（`Incident/Story/Epic`）；`planned→cancelled/blocked/ready` 是豁免边；`planned→active` 须经 `ready`。
- ceremony 载荷禁自供 `workspace/attest-dir/expected-version`；readback 必带 `expect`/`recordFields`（裸 list 判 `NOTHING_COMPARED`）；MCP 写面载荷须内联对象不吃 `$file`。
- knowledge 动词族吃 **store marker 版本**非链版本（S199 的 rebase 步）。
- S199 四坑：authority 绝对路径 / control-manifest 规范字节勿重序列化 / views 文件全拷 / transient 与 evidence-locator 先建；拷链须 vacate 后（缺 hop 报 `NOT_PENDING`）。
- `|tail` 吞退出码；含 NUL 字节的文件 grep 失明须用 node 读；跨 OS 摘要比对加 `LC_ALL=C`。
- pnpm `file:` 依赖是硬拷贝——刷新须删 `node_modules/.pnpm-workspace-state-v1.json`。

## 9. 单 id 速查（cross 分区；判定人→收口方式见 §4）

| 键 | work id | 判定人 | 波 |
| --- | --- | --- | --- |
| INIT-020 | `work:4d0ecd9c1e6ea5292ef08330` | Owner | — |
| EPIC-056 / 057 / 058 | `65cf5f278a2ca1f50e7ba6d4` / `2b6a166e82ea80e6337cb669` / `137e60da653e95ae01158e09` | — | — |
| S189 / S190 | `8797455f66197645465abb73` / `f01d514e0ebf8e3d3328dcce` | Owner | 6 |
| S196 / S197 | `ecfba950a6fa5233d4b1f414` / `1377292f9925417bc80001ed` | Owner | 6 |
| S199 / S200 / S201 | `31d0b936ecdfe740a16dacc6` / `0bdfff94a4670a3e7e6ee3b1` / `9825ded62dee9fed708b49c4` | Owner | 1/2/3 |
| INC-092 | `4c6565e57256658822ebb16c` | Owner | 4 |
| INC-093 | `ff778709779d141bb7cf23cb` | Owner | 5 前置 |
| INC-094 | `67086511a3390c3a01c180df` | 自证 | 4 |
| INC-097 | `d0f8040719622ed2f7e97d19` | Owner | 5 |
| INC-100 | `5d1d923623c11dd972f23f83` | Owner | 4 |
| INC-101 | `afe6685ad56d990dfd4c0402` | 自证 | 5 |
| INC-103 | `1c3985e1b127c1ad275a1f24` | 自证+Owner | 5 |
| INC-105 | `b4b0ac5f23a9f2c74ca607c1` | Owner | 0 |
| INC-108 | `5878b0843a1ec4ec3f733c69` | Owner | 0 |
| INC-109 | `98b12ec3f2ee196502cb2fc6` | 自证 | 0 |
| INC-110 | `7a7fdcef43759814f47a175d` | 自证 | 0 |
| INC-111 | `9ab09144d1039018d0f510e5` | Owner | 4 |
| INC-113 | `e2c8187429fd5343347bade0` | Owner | 5 |
| INC-117 | `dadaafab78d0d0f20bac362e` | Owner | 0 |

## 10. 收口就绪自检（请 Owner 验收之前）

- [ ] STORY-196 门输出 `PRODUCTION_READY`，七项红腿演练记录在案
- [ ] `work-list` cross planned/active 仅剩待 Owner 验收之单；AOS 分区 0 开单
- [ ] 全部收口注记含目的回验段，证据物逐一真实存在（五轮教训：被点名的 11 个证据文件曾一个都不存在）
- [ ] 零 push、除 v0.11.8 外零新 tag（`git ls-remote` 问服务器取证，不用本地视角）
- [ ] doc-topology / local-purity / parity 三门绿 + 红腿各演练一次

## 11. 链上登记

本文由 INIT-020 注记 rev9 登记；rev9 同时更正 rev8 执行序漏列 117 的文字缺口（替换锚未命中，如实记录）。
