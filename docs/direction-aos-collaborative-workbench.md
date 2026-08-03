# AOS 协作工作台方向题：人类与 AI 同队共事（可读可写）

> **材料性质**：AOS 分区方向题的上链前正式文本。拟作为会议 `TCRN-AOS-CONF-013`（type `strategy`，outcome-class `role_decision`）的事实基础，承载 Initiative 拟为 `TCRN-AOS-INIT-004`。
>
> **依据公约**：《方向与轨道取舍公约》（`TCRN-CROSS-INIT-012` / P7，附录 A 结构）；《审议采用三步公约》（`TCRN-AOS-INIT-001` / `TCRN-AOS-STORY-013`）。
>
> **事实截至**：2026-08-03 实测。AOS 链 version 895（head `3747c2f1…`，自 2026-07-30 无新活动）；project `project:899d30df2e67bc6e98a4f50e`（TCRN-AOS-PRODUCT）；链上现有受治会议 12 场（CONF-001..012，全部 `closed`）；现有 Initiative 三条（INIT-001/002/003，全部 `done`）。
>
> **复核命令**：AOS 链状态 `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace"`。

## 0. 定位：为什么这是一份方向材料

Owner 于 2026-08-03 提出主张：**AOS 未来的发展方向是可读可写——人类与 AI 像一个团队一样共事**，当前"唯一写源 + 无 LAN 读面"偏离了 AOS 工作台的初衷（这也是 AOS 前端做 Jira & Confluence-like 的原因）。

本材料论证：这一主张与当前实现之间的差异**不是一行配置，是一族裁定**。按《方向与轨道取舍公约》触发阈值，它是方向题（状态与真值落点 / 会封死替代架构 / 涉及外部消费者三格皆中），须在动手前先行裁定，不得留给执行期撞见。

## 1. 现状（可复核事实，截至 08-03）

| 维度 | 当前实现 | 证据 |
| --- | --- | --- |
| 真值 | 链在 VM `/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace`，version 895 | `status` 实测 |
| 写面 | 座舱绑 `127.0.0.1:4318`，仅 SSH 隧道可达，无环境变量可移 | `apps/cockpit-service/src/service.ts`，`CONF-007 D7` |
| 权威 | authority pins 在 VM 永不离机；actor 唯一（`agent:fable`，无默认值，缺失拒启 `STORY-112`） | `deploy/aos-resident-cockpit/manifest.mjs` |
| 读面 | LAN 上无任何可达面；`aos.tcrn.lan` 已退役无人认领，Traefik 回 404 | `deploy/aos-mirror-retirement/`，`MIN-012` 裁定 7 |
| 使用者 | 实际仅 Owner 设备 + agent 宿主经 SSH 隧道 | 隧道实测 |

**一句话现状**：AOS 今天是一个单人工作区——单人能写（经 SSH），单人能读（经 SSH），LAN 上任何人无 SSH 都到不了，**连 Owner 自己的手机都算 off-device 而被排除**。

## 2. 初衷与偏差

### 2.1 初衷在域模型里（建成时就在）

AOS 的域模型从第一天起就是为**人类与 AI 协作**设计的，证据在代码：

- `packages/domain/src/types.ts`：
  - `StructuredComment` 的 `CommentType` 六种中四种是人机语义：`human_intent` / `agent_observation` / `agent_proposal` / `agent_decision` —— "AI 提议、人类定夺"的协作回路；
  - `ActorIdentity = {employeeId, role, threadId, sessionId}` —— **多身份**模型，不是单 actor；
  - `DecisionHistoryEntry.decisionClass` 含 `owner_intent_required` / `role_decision` —— 决策权分级；
  - `SubTask.ownerRole` —— 按角色分派。
- `apps/web` 前端 = Jira + Confluence 翻版（`deploy/aos-resident-cockpit/manifest.mjs` 的 11 模块）：`my-work` / `inbox` / `dashboard` / `projects` / `work-items` / `board` / `release-trains`（Jira 面）+ `deliberations` / `knowledge` / `audit` / `snapshots`（Confluence 面）。
- `packages/projection/src/domain-store.ts`：`blocks/depends_on/reviews/verifies…` 12 种 relation、assignee/priority/labels 注解 —— 协作工作台原语。

### 2.2 偏差在运行时（部署层把协作压成了单写者）

| 域模型设计的 | 运行时实际落的 |
| --- | --- |
| 多身份 `ActorIdentity` | 唯一 `actor=agent:fable`，硬编码无默认 |
| 人机对话 `human_intent / agent_*` | 写面仅 4 动词（transition/annotate/work/enrol），人无写路径 |
| 工作台给团队看 | 读面与持 pins 写进程同体，锁进 `127.0.0.1`，LAN 无可达面 |
| 决策回路 `owner_intent_required` | Owner 想"看当前在做什么"都得先开 SSH 隧道 |

**关键事实**：当初的会议包 `evidence/conf-007-package.md`（T3 归因前置）已预挂此洞："cockpit-service 默认 actor 固定 `agent:fable`——**写面扩容前须裁逐请求归因来源**"。这是挂了号的待裁项，本方向正对着它。

## 3. 方向主张（Owner 已定，本材料据此展开）

> AOS 是可读可写的**协作工作台**：人类与 AI 像同一个团队一样共事。链是唯一真值；每一次写都归属到一个人或一个 agent；AI 可提议、可执行、可被审，决策权在人。

据此，当前"唯一写源 + 无 LAN 读面"**偏离初衷**，需要修。修的方向不是"放宽写面安全"，而是"把读面从写进程中拆出来、把归因模型从单写者扩成双类"——写面安全一条不松。

## 4. Q1 触发判定

对照《方向与轨道取舍公约》触发阈值：

- **状态与真值的落点选择**（第四行，2026-07-30 新增）：链住哪台机器、由谁常驻服务、谁可写——本次要动"写权归属"与"读面可达性"。
- **会封死替代架构**：D7 的"authority 永不离机 + 唯一 actor"模型若为多人放宽，认证、备份、actor 归因全部重新设计；做完一条路另一条代价陡增。
- **涉及外部消费者**：若有团队成员，他们是外部消费者，会建在访问模型之上。

**触发。** 且无既有裁定支撑（D7 只裁"写面永不出 loopback"；"读面可否出 loopback"是空白格，被同进程连坐）。归道见 §10。

## 5. Q2 备选轨道与被拒方案

第一层（产品定位：单人还是团队工作台）已由 Owner 定——**团队工作台**。故本材料聚焦第二层（如何实现），单主轨 + 三个被拒：

- **轨道 A（推荐，分期推进）**：分进程读面 + 归因扩展 + 人写路径。
  - A1 读面从持 pins 的写进程**架构性拆出**，读面放 LAN 供人直连查看，写面维持 `127.0.0.1` + SSH，pins 永不出网；
  - A2 actor 从单值扩展为 `person:<id>` / `agent:<model>` 双类，禁匿名写；
  - A3 每个 `person:<id>` 经各自 SSH 身份进入写面，人获得写路径；
  - A4 协作动词（comment/relation/annotate）在 UI 落地，AI 提议、人定夺。
- **被拒 B：只加只读 LAN 面，不碰归因（人只能看不能写）**——理由：不满足"可读**可写**"方向；且退役文档已点破，LAN 只读镜像的残留读者恰好是 D7 禁的形态，只开读不开写比没有更误导。
- **被拒 C：一步到位开放 LAN 写面（多身份认证，推翻 `0.0.0.0` 绑定）**——理由：等于推翻 D7 却披着配置外衣，是 D7 升级条款列的外部发布级停点；归因模型先做在 A 上即可达成协作，不必动写面绑定。
- **被拒 D：维持现状**——理由：Owner 已明判偏离初衷；读面与写面同进程是设计选择而非安全必然，可以拆。

## 6. Q3 每条保留轨道三件事

主轨 A 一条（A1–A4 是同轨分期，非并行轨道）。

| 轨道 | 适用性谓词（具名受益者） | 运营成本归属 | 日落或复审条件 |
| --- | --- | --- | --- |
| A（协作工作台） | 至少一位非 agent 的人类成员（Owner 本人起步，可扩展）需要**读**与**写**工作台；且 AI 的写需要可归属、可审 | AOS 仓 / Owner（读面新进程运维、身份管理、归因审计） | 复审日期（每季）重答谓词；谓词不成立（无人类读者/写者）即收缩回只读或单写 |

## 7. Q4 接缝方案

- **读/写分离接缝**：两条不变量——**读面进程永不持有 pins、写面永不出 loopback**；不可交。读面只放行只读路由（UI + `/api/domain/*`），写路由（`/api/chain/*`）不在读面。
- **归因扩展接缝**：actor 从单值到双类的数据迁移路径——链事件只增不改，旧事件保持原 actor，新写带新归因；靠追加更正而非改写。
- **人写路径接缝**：每 `person:<id>` 独立 SSH 身份，可独立撤销；匿名写禁止。
- **回滚路径**：读面退役有现成 `retire.mjs`（幂等）；person 可逐个撤销；每期结束写面安全不变。

## 8. 分期（每期可回退，写面安全逐期不变）

| 期 | 内容 | 可回退性 |
| --- | --- | --- |
| 一期 | 方向裁定 + A1 读面拆出（人先能看） | 读面退役零成本（`retire.mjs`） |
| 二期 | A2 归因上链 + A3 person 身份与人的写路径 | 每 person 独立撤销，写面未弱化 |
| 三期 | A4 协作动词在 UI 落地（comment/relation/board） | 纯功能增量 |

## 9. 验收不变量（"打牢"的判据）

1. **每条链写归属到一个 person 或 agent**——零匿名写。
2. **读与写架构可分**——读面进程永不持有 pins。
3. **决策权在人**——AI 可提议不可拍板；`owner_intent_required` 门归人。
4. **链是唯一真值**——comment/annotation/relation 是键到记录的座舱主张，不伪造链权威（域模型已按此设计）。

## 10. 决策清单归道

| 触发项 | 归道 | 依据 |
| --- | --- | --- |
| 读面可否出 loopback（补 D7 空白格） | **OWNER-NOW** | 无既有裁定支撑；D7 只裁写面，读面被同进程连坐 |
| 归因扩展（actor `person/agent` 双类） | **OWNER-NOW** | 无既有裁定支撑；消解 conf-007 T3 预挂待裁项 |
| person 身份与人的写路径 | **CONDITIONAL** | 依赖前两项闭合；闭合后升级 OWNER-NOW |
| 协作动词 UI 落地 | **AGENT** | 路由已建（comment/relation/annotate），有既有支撑 |

## 11. 上链形态

### 11.1 会议参数（拟）

- 会议：`TCRN-AOS-CONF-013`，type `strategy`，outcome-class `role_decision`，project `project:899d30df2e67bc6e98a4f50e`
- 承载：`TCRN-AOS-INIT-004`（方向承载 Initiative，`planned`），与会议同批创建
- 参与者：`owner:governance`（裁定者）+ 若干 persona 视角（如 `profile:tcrn-minerva-v1` 运营 / `profile:tcrn-verity-v1` 验证）
- 执行形态：**`synthesis-only`**，理由："方向差异不在信息而在 Owner 的价值判断（AOS 服务谁），材料已由主线程综合；分头产出会得到同构答案。"
- 落链通路：本机 `deploy/aos-local-client/ceremony.mjs`（文件载荷 + 回读，写前读头作 CAS）

### 11.2 立场草稿（position ≤ 2048B，会议开场，综合执笔）

> 执行形态 `synthesis-only`——方向差异不在信息而在 Owner 的价值判断（AOS 服务谁），材料由主线程综合，分头产出会得到同构答案。
>
> AOS 的域模型从建成起就为人类与 AI 同队共事设计：`StructuredComment` 的 `human_intent / agent_proposal / agent_decision`、多身份 `ActorIdentity`、`owner_intent_required` 决策门、Jira/Confluence 式工作台（work-items / board / deliberations / knowledge）。但运行时把这一切压成了单写者：唯一 actor=`agent:fable`、读面与持 pins 的写面同进程锁进 `127.0.0.1`、LAN 无可达面、人连查看当前工作都需 SSH 隧道。
>
> 方向主张：AOS 是可读可写的协作工作台，人类与 AI 作为同队共事；链是唯一真值，每次写归属到 `person` 或 `agent`。
>
> 实现路径：① 读面从持 pins 的写进程架构性拆出，读面放 LAN 供人直连查看，写面维持 `127.0.0.1`+SSH，pins 永不出网；② actor 从单值扩展为 `person/agent` 双类，禁匿名写，消解 conf-007 预挂的归因待裁项；③ person 身份经各自 SSH 进入写面，人获得写路径；④ 协作动词（comment/relation/annotate）在 UI 落地，AI 提议、人定夺。
>
> 建议分期推进，每期写面安全不变。请 Owner 裁：读面可否出 loopback、归因模型是否采纳、承载 INIT-004。

---

*本材料为 `TCRN-AOS-CONF-013` 的事实基础；立场落链时以上述 §11.2 为开场立场全文，事件 actor 为执笔者（`agent:<model>`），立场 `actor-id` 为所论证的 persona 视角。*
