# S16 · 全平台约束/门/hook/公约 代际复审（编目 + 三档起草稿）

> 起草：执行层 agent:deepseek-v4-flash · 2026-08-05。S16.1 编目（来源列全）+ S16.2 逐条成立条件三档起草（仍在/已消失/条件化）。**S16.3 终稿与采纳归审查层**（MIN-058 终审即采，程序遵 harness-constraint 公约）。本单输出是**提案不是删除**。

## S16.1 编目

### A. 公约（docs/）

| # | 公约 | 来源 | 成立条件 |
| --- | --- | --- | --- |
| A1 | 约束分类与演化（替换须先残余适用性分析） | `docs/harness-constraint-convention.md` | 平台存在约束体系 |
| A2 | 方向题动手前决 | `docs/direction-and-tracks-convention.md` | 存在难以逆转/外部消费者/封死替代架构的方向选择 |
| A3 | 外采四道审查（许可证/供应链/防幻觉/运营成本） | `docs/sourcing-and-vetting-convention.md` | 引入外部依赖 |
| A4 | 停顿预算与发布节奏 | `docs/delivery-cadence-convention.md` | 存在交付/发布行为 |
| A5 | 审议执行形态声明 | `docs/deliberation-adoption-convention.md` | 开受治审议 |
| A6 | 派工可派性 | `docs/dispatch-readiness-convention.md` | 拆单/派工 |

### B. 门（机器）

| # | 门 | 来源 | 成立条件 |
| --- | --- | --- | --- |
| B1 | verify:p1（lint/test/架构/offline/governance 全序列） | `tcrn-workflow/scripts/task.mjs` + CI | tcrn-workflow 仓存在 |
| B2 | verify:p8（发布身份/可复现源归档） | `tcrn-workflow/scripts/task.mjs` | 发布 tcrn-workflow |
| B3 | push-gate（G-4 推送前） | `tcrn-workflow/scripts/push-gate.mjs` | 推送到 GitHub |
| B4 | guard-check（守卫注册） | `tcrn-workflow/scripts/guard-check.mjs` | 证明注册项仍咬合 |
| B5 | **verify-s6（教训场景库绿）** | `tcrn-workflow/scripts/verify-s6.mjs`（S8 新） | 每 push CI |
| B6 | **verify-otel-privacy（sink 无链内容）** | `tcrn-workflow/scripts/verify-otel-privacy.mjs`（S10 新） | 运行观测 sink |
| B7 | doc-topology:proof（文档真值位置↔名册↔引擎实测） | `TCRN-AOS/deploy/aos-local-client/doc-topology-proof.mjs` | 平台文档声明分区真值位置 |
| B8 | local-purity:proof（本机纯客户端） | `TCRN-AOS/deploy/aos-local-client/local-purity-proof.mjs` | 真值已迁 VM |
| B9 | **parity:proof（两侧名册对等）** | `TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`（S3 新） | 平台仪器名册存在 |
| B10 | S7 黄金样本 + S6 lessons（CI 确定性子集） | `tests/s7-behavior-surface.test.mjs` + `tests/promptfoo/s6-lessons/`（S7/S6 新） | 每 push CI |
| B11 | verify-release-trust（发布信任链） | `tcrn-workflow/scripts/verify-release-trust.mjs` | 发布 |

### C. hooks

| # | hook | 来源 | 成立条件 |
| --- | --- | --- | --- |
| C1 | stop-pact（User Stop hook，运行契约） | `tcrn-workflow/tools/stop-pact/`（INIT-016） | 「运行至完成」授权场景 |
| C2 | **SSH 写 observer（PreToolUse，observe）** | `tcrn-workflow/scripts/ssh-write-observer.mjs`（S2 新，项目 settings 接线） | 会话对 VM 治理树做 SSH 写 |
| C3 | host-evidence SessionStart（W adapter 观测） | `tcrn-workflow/scripts/host-evidence.mjs` | 会话激活观测 |
| C4 | tcrn-workflow-helper bootstrap（verify-installed-copy） | `.claude/skills/tcrn-workflow-helper/` | 受治会话首验 |

### D. 约束（平台 CLAUDE.md 规则）

| # | 约束 | 来源 | 成立条件 |
| --- | --- | --- | --- |
| D1 | 仪器供给对等 | CLAUDE.md §一.1 | 多宿主执行 |
| D2 | 索引工具先验新鲜度 | CLAUDE.md §一.3 | 用索引类工具 |
| D3 | 验证到达问权威源（ls-remote/全 sha） | CLAUDE.md §一.4 | 验证跨机到达 |
| D4 | 后台负载回收 | CLAUDE.md §一.5 | 启长驻负载 |
| D5 | 五分区真值在 VM（非本机） | CLAUDE.md §三.0 | 治理事件链 |
| D6 | 验证已安装副本 | CLAUDE.md §三.1 | 受治会话 |
| D7 | 只有引擎可写控制树（SSH 不是豁免） | CLAUDE.md §三.2 | 治理写 |
| D8 | 仪式通路（载荷+回读） | CLAUDE.md §三.3 | 本机对 VM 治理写 |
| D9 | 备份 PULL 方向（配对备份拉回本机） | CLAUDE.md §三.4 | 备份/镜像 |
| D10 | 记录纪律四则（用命令/只增/声明形态/举例即断言） | CLAUDE.md §三.5 | 落链记录 |
| D11 | 停顿预算三类必停 | CLAUDE.md §三.5 | 执行期 |
| D12 | stop-pact 运行至完成 | CLAUDE.md §三.6 | 「运行至完成」授权 |
| D13 | **workflow-MCP「两侧未接」句** | CLAUDE.md §一.6 | 已被 S3 修正 |
| D14 | codegraph 三仓复用 TMS 二进制（已知耦合） | CLAUDE.md §一.6 | DS/AOS 用图谱 |

## S16.2 三档起草

### 仍在（15）
A1–A6、B1–B4、B7、B8、B11、C1、C3、C4、D1–D12、D14——成立条件均仍满足。其中 D7（SSH 不是豁免）尤其仍活：正是 S2 的依据。

> ### 订正（2026-08-05，核验层 · TCRN-CROSS-INC-038）：三档不分割 35 项，且 B10 掉队
>
> 原文保留可见。复核：`docs/reports/init-018/INC-038/recheck.sh` 第 5 节。
>
> **缺陷一 · 三档之和 ≠ 编目总数。** S16.1 编目 A6 + B11 + C4 + D14 = **35** 项；
> 原三档为 15 + 1 + 4 = **20**，差 15 项。
>
> **缺陷二 · 「仍在（15）」的表头与它自己的列表矛盾。** 数一遍同一行列出的项：
> A1–A6(6) + B1–B4(4) + B7,B8,B11(3) + C1,C3,C4(3) + D1–D12(12) + D14(1) = **29**，不是 15。
> 也就是说 15 这个数既不等于列表长度，也不能让三档配平。
>
> **缺陷三 · B10 未入任何一档。** `B10`（S7 黄金样本 + S6 lessons，CI 确定性子集，见本文件编目表第 31 行）
> 在 S16.2 的三档里一次都没出现——它既不在「仍在」的列举中，也不在「已消失」「条件化」里。
>
> **订正后的三档**（编目项一一归档，和为 35）：
>
> | 档 | 数量 | 项 |
> | --- | --- | --- |
> | **仍在** | **30** | A1–A6、B1–B4、**B10**、B7、B8、B11、C1、C3、C4、D1–D12、D14 |
> | **已消失** | **1** | D13 |
> | **条件化** | **4** | B5、B6、B9、C2 |
> | 合计 | **35** | = 编目 A6 + B11 + C4 + D14 |
>
> **B10 归「仍在」的理由**（按 harness-constraint 公约的残余适用性口径）：它的成立条件是
> 「每 push CI」，该条件今天仍然成立，且其两个被守护对象（`tests/s7-behavior-surface.test.mjs`
> 的黄金样本、`tests/promptfoo/s6-lessons/` 的确定性子集）都仍在仓内、仍挂在 CI 上。
> 它与 B5（verify-s6）相邻但不同：B5 的**内容**随教训场景库演进故列条件化，
> B10 是承载它们的 CI 确定性子集本身，无外部前置，故列仍在。
>
> 「仍在 30」这个数是**列举出来的**（上表逐项列全），不是估的——凡表头数字与列表长度不一致，
> 以列表为准并当场改表头，这正是本次要订正的毛病本身。

### 已消失（1）
- **D13「workflow-MCP 两侧未接」**：成立条件已消失——2026-08-05 实测 `tcrn-workflow` MCP 两侧都已接（平台 `.mcp.json` + `~/.codex/config.toml` `[mcp_servers.tcrn-workflow]`）。已被 S3 修正为实测状态。**提案：确认删除该过时句的旧版本（S3 已改），无需保留。**
- （注：LAN 静态镜像句在 CLAUDE.md §三.4 已标「退役」，成立条件已消失但文本已同步，非待办。）

### 条件化（4）
- **B5 verify-s6**：随教训场景库演进；场景库新增教训时须同步 `s6-lessons.yaml`。条件：有教训场景库。
- **B6 verify-otel-privacy**：仅当观测 sink 存在/启用时适用（引擎侧 OTLP 导出待审查层接隧道后）。条件：有观测 sink。
- **B9 parity:proof 白名单**：`codegraph-ds`/`codegraph-aos`/`tcrn-workflow-aos-read` 三条豁免在 S4.2（审查层应用 Codex diff）后收缩。条件：Codex 名册补齐前。
- **C2 SSH 写 observer**：现为 observe（只记不拦）；审查层无误报后切 enforce（输出 deny 阻断）。条件：误报审计通过。

## S16.3 交接（归审查层）

终稿采纳（确认上述三档、D13 删除、条件化的切换时机）由审查层办。本单只出提案。

## 证据包

`docs/reports/init-018/S16/`：`catalog.md`（本文档）、`commands.md`、`notes.md`、`payloads/`。
