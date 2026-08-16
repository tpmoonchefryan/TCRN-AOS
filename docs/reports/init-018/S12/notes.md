# S12 notes — STORY-142 · S12 回放基准

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- S12.1 合成链生成器 `scripts/bench/synthesize-chain.mjs`：仅经引擎公开 CLI（init/project-create/work-create/work-transition），每事件一次调用，`--expected-version` 链式 CAS；禁直写工作区文件。3k 链生成于 scratch（OS 临时目录）。
- S12.2 回放基准 `scripts/bench/bench-replay.mjs`：status/validate/export/work-list 各 5 次取中位墙钟，json+md；拒绝动词记 `FAILED <reasonCode>`（stderr 解析）。只跑合成链，禁对 VM 活链。
- S12.3 判定草案（见下），annotate 进 STORY-142。

## 实测数据

### 3k 链（3157 条 work 记录，3758 事件，生成 18.2 分钟）

| verb | median ms | verdict |
| --- | --- | --- |
| status | 363 | ok |
| validate | 397 | ok |
| export | 421 | **FAILED INPUT_OVERSIZED** |
| work-list | 401 | ok |

### 10k 尝试 → 撞引擎写上限（3353 条 work 记录）

`work-create` 在版本 3354 处报 `INPUT_OVERSIZED: Canonical input exceeds one MiB`。10k 事件工作区
**无法经引擎写动词构建**。对失败点前的部分链（3353 条 work）跑只读基准：

| verb | median ms | verdict |
| --- | --- | --- |
| status | 440 | ok |
| validate | 371 | **FAILED INPUT_OVERSIZED** |
| export | 386 | **FAILED INPUT_OVERSIZED** |
| work-list | 368 | **FAILED INPUT_OVERSIZED** |

## 核心发现：引擎的 canonical 物化上限 ~3200-3350 条 work 记录

- 触发点：`packages/protocol/src/index.ts:277`（`PROTOCOL_LIMITS.maxCanonicalBytes` = 1 MiB）。
  写路径与 `validate`/`export`/`work-list` 均把**全量物化状态**（projects + work）做 canonical 序列化
  （workspace.ts:1643 的 `index.json`），链超 ~3200-3350 条 work 记录即超限。
- `status` 走更轻路径，不受影响（3k 与 10k-ceiling 均绿）。
- 边界实测：3157 条 work（3k 链）validate/export/work-list 通过；3353 条 work（10k 部分链）三者全 FAILED。
- **含义**：引擎当前**无法构建或读取超过 ~3200 条 work 记录的链**。真实链（AOS ~1047、cross ~1560 事件）
  目前均在限内，但链增长会撞顶；这是对取证/归档/规模化场景的硬约束。

> ### 订正（2026-08-05，核验层 · TCRN-CROSS-INC-038）
>
> 上面这一节把**三条不同的路径**并成了一道上限，因而三处失真。原文保留可见，以下为订正。
> 复核脚本 `docs/reports/init-018/INC-038/recheck.sh` 第 1a/1b/1c 节，
> 活链实测 `docs/reports/init-018/INC-038/outputs/live-chain-export-probe.md`。
>
> **订正一 · `export` 的上限由「事件字节」决定，不由 work 记录数决定。**
> `exportWorkspace`（`packages/core/src/workspace.ts:3272-3295`）**自行**调 `canonicalJson`，
> 并把 `events: state.events`（全量事件数组）打进同一个 canonical 对象；它既不经
> `validateWorkspace` 也不经物化视图。所以它撞的是事件字节，不是 work 记录数。
>
> **订正二 · 归因写错了机制来源（本 notes 第 36-38 行）。**
> `workspace.ts:1643` 的 `index.json` 只序列化 `projects + activeWork`，那是
> `validate` / `work-list` 走的路径——**这条**才是 work-记录数敏感的，S12 实测的
> 3157 绿 / 3353 红边界只对它成立。原文把 `export` 一并归到这条路径上，是错的。
>
> **订正三 · 「链逼近 ~3200 条时才会撞顶」不成立；`export` 今日已在三条活链上被拒。**
> 2026-08-05 经只读面 `tcrn-workflow-aos-read` 实测：
>
> | 分区 | 事件数（version） | work 记录数 | `export` | `validate` / `work-list` |
> | --- | --- | --- | --- | --- |
> | `cross-project` | 1661 | 256 | **INPUT_OVERSIZED** | ok / ok |
> | `TCRN-AOS` | 1047 | 156 | **INPUT_OVERSIZED** | — |
> | `TCRN-Design-System` | 983 | 166 | **INPUT_OVERSIZED** | — |
> | `TCRN-TMS` | 228 | 39 | ok（≈296 KB） | — |
>
> 256 条 work 就已被拒，离 3200 差一个数量级；而**同一条** `cross-project` 上
> `validate` 与 `work-list` 仍绿。这既证伪了「~3200 条 work」这个数对 `export` 的适用性，
> 也证明两条路径不是同一道上限（判据两侧确实不同）。
>
> **订正四 · 本 notes 第 40 行与本文件自身的实测表、`bench-3000.json`、以及核验层的独立重跑三方矛盾。**
> 第 40 行写「3157 条 work（3k 链）validate/**export**/work-list 通过」；而同文件第 19 行的表格记
> `export … FAILED INPUT_OVERSIZED`，`bench-3000.json` 记 `.verbs.export.allOk = false /
> reasonCode = INPUT_OVERSIZED`，核验层独立重跑亦得 exit 1 `INPUT_OVERSIZED`。
> **正确表述**：3157 条 work 的 3k 链上 `validate` 与 `work-list` 通过，`export` 在此处**即已失败**。
>
> **订正五 · 此事不是本次基准的新发现，故「这是本次基准最重要的产出」应降级。**
> （该句在下文「S12.3 判定草案」节内，本次订正后位于第 96 行；那里另有一处就地订正。）
> `docs/releases/0.8.0.md` 第 13-15 行与第 20-25 行早已按同一口径实测公布过：
> `export` 「all-or-nothing and refuses any workspace whose canonical form exceeds one MiB」，
> 并列出 cross(1,274 事件)/AOS(683)/DS(983) 三红、TMS(228) 一绿——与今日实测**同形**
> （DS 的事件数 983 今天仍逐字相同）。当时给出的缓解就是新增分页只读动词 `event-list`
> （0.8.0「Added」节），并明确声明「It does not make `export` paginated」。
> 因此本单的贡献是**把这条已知上限重新量到并给出合成链侧的边界数**，
> 而不是发现它；报审查层时应引 0.8.0 而非作为新发现上报。

## S12.3 判定草案（对照阈值「常用只读动词 >2s 启动修复」）

- **启动修复（EPIC-044）**：实测只读动词中位全部 <500ms（363–440ms），**不触发** >2s 启动修复。
  EPIC-044 按既有 D3 裁定的条件自动决出 = 不启动。
- **export/validate/work-list 的 1 MiB 物化上限**：属「动词能力上限」而非「启动慢」，不在 2s 阈值的语义内。
  **单独上报审查层**：建议评估提高 `maxCanonicalBytes` 或让物化索引增量/分页，否则链无法超过 ~3200 条 work
  记录（写与读都受限）。这是本次基准最重要的产出。
  > **订正（2026-08-05，核验层 · INC-038）**：这一条要按上文「核心发现」的订正读——
  > `export` 与 `validate`/`work-list` 是两道成因不同的上限；「~3200 条 work」只对后者成立，
  > `export` 在 256 条 work 的活链上今日即被拒。且 `export` 这一条早见于 `docs/releases/0.8.0.md`，
  > 非本次新发现，「本次基准最重要的产出」应改读为「本次新增的是 `validate`/`work-list` 那条边界数」。

## 实现说明

- 初版 `at()` 分钟溢出（tick≥3600 → `00:60:00Z`），3k 首次运行于 transition 阶段失败；修复为小时级进位后成功。
- bench-replay 对拒绝动词的 reasonCode 从 stderr 解析（CLI 拒绝时 JSON 写 stderr）。
- 10k 链：尝试即撞引擎写上限，无法构建；以「失败点前部分链」的只读基准作为撞顶规模数据点。

## 范围外观察（报审查层，不动手）

- **`maxCanonicalBytes`=1MiB 协议上限**使引擎无法构建/读取 >~3200 条 work 记录的链——建议评估上限或增量物化。

> **订正（2026-08-05，核验层 · INC-038）**：这条要拆成两条，且不是新发现。
>
> 1. **`export` 的 1 MiB 上限（事件字节敏感）** —— 已在 `docs/releases/0.8.0.md` 公布，
>    缓解是 `event-list` 分页。今日 cross/AOS/DS 三条活链的 `export` 仍红（见上表）。
>    仍值得报的是：**归档/取证仍无整链单文件出口**（`event-list` 只解读，不解「一份可复现的整链产物」）。
> 2. **`validate` / `work-list` 的 work-记录数上限（~3200-3350 条）** —— 这一条**是**本单的新数据点，
>    合成链侧实测 3157 绿 / 3353 红；活链最大者 256 条，距该线尚远。
>
> 建议提高上限或增量物化的意见维持，但两条路径的成因不同，评估时不可合并处理。

## 证据包

- `commands.md`、`notes.md`、`bench-3000.json/.md`、`bench-10k-ceiling.json/.md`。
- scratchbase（OS 临时目录）：`synthesized-3000.json`、失败日志 `synthesized-10000.log`、工作区 `ws-3000`/`ws-10000`。
- 链上：TCRN-CROSS-STORY-142 收口含 S12.3 判定草案。
