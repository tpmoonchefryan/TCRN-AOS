# AOS MCP 写面契约 —— 单一 `ceremony` 工具

> 签发：TCRN-CROSS-INIT-019 STORY-156.1。本文是 `deploy/aos-mcp-write/server.mjs` 的
> 契约，也是 156.2–156.6 的工作依据。逻辑权威在
> `deploy/aos-local-client/ceremony.mjs` 与 `ceremony-plan.mjs` —— 本文把它们的
> 纪律**陈述**成接口契约，不另造一套纪律。

## 一句话

AOS 接入之后，所有对链上五条治理分区的受治写，只经这一个工具进入；
本工具是现有 `ceremony.mjs` 的 **MCP 包裹**，不重写任何仪式逻辑。

## 输入字段

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `payload` | object | 是 | 仪式载荷：`{schemaVersion, story, intent, steps[], readback[]}`。载荷就是 ceremony-plan.mjs 的 `PAYLOAD_SCHEMA = "aos.local-client-ceremony.v1"` 那一批步骤。 |
| `dryRun` | boolean | 否（默认 `false`） | 为真时只规划、只回读**不发送**，返回 `CEREMONY_PLANNED_ONLY`。 |
| `partition` | string | 否（默认 `TCRN-AOS`） | 目标分区，枚举值来自 `deploy/aos-local-client/aos-partitions.mjs` 的 `AOS_PARTITIONS` 键集。分区背后的 workspace/attest-dir 由拓扑供给，调用方不得指名路径。 |

## 输出字段（工具返回的 JSON）

| 字段 | 含义 |
| --- | --- |
| `ok` | 整批仪式是否成功（含回读全部通过）。 |
| `reasonCode` | 成功/拒绝的稳定原因码（沿用引擎与仪式的码，见下）。 |
| `receipt` | 完整仪式回执（schema、steps、readback、chainBefore/chainAfter、payload 摘要等），即 `runCeremony()` 的返回值。 |
| `receiptPath` | **工具决定**的回执落盘路径（仓相对）。调用方不能指定。 |
| `payloadPath` | 工具决定的内联载荷物化路径（仓相对）。调用方不能指定。 |
| `host` | 目标主机。 |
| `partition` | 目标分区。 |

回执内容以 `ceremony.mjs` 的 `runCeremony()` 为准；本文不再逐字段复述，因为
回执的每一段都由仪式代码生成，列表会在 156.4 验证中实测。

## 拒绝面（≥4 类，各自 reason code）

每类拒绝都**有码**、**不静默放行**、**不合并成同一个码**。码的来源：`ceremony-plan.mjs`
的 `planStep`/`assertPayload`，以及 `ceremony.mjs` 的运行期拒绝。

| # | 拒绝类 | reason code | 何时触发 |
| --- | --- | --- | --- |
| 1 | **保留旗标被载荷指名** | `RESERVED_FLAG_IN_PAYLOAD` | 任一 `steps`/`readback` 的 `flags` 里出现 `workspace`、`attest-dir`、`expected-version`。三者属于拓扑与写前现读，载荷不许自选（自选的哨兵冻结不了任何东西）。 |
| 2 | **载荷形状非法** | `PAYLOAD_INVALID` | `schemaVersion` 不是 `aos.local-client-ceremony.v1`；`story`/`intent` 缺失或为空；`steps`/`readback` 不是数组；`steps` 为空；`readback` 为空（没人读回来的写不算已证）。 |
| 3 | **动词不在主机名录** | `VERB_NOT_IN_CATALOGUE` | `steps` 里的动词不在主机引擎自己 `commands` 输出里。判据是主机名录，不是本机清单。 |
| 4 | **一次性供权动词族** | `VERB_REQUIRES_OUT_OF_BAND_AUTHORITY` | 动词需要一个每次调用单独铸造、审批、一次性花掉的供权文件（判据是目录自身的形状：存在必填 `*-authority-digest` 旗标）。该族只做自己的仪式，永不由批量包裹驱动。 |
| 5 | **旗标未被动词定义** | `FLAG_NOT_DEFINED_BY_VERB` | `steps` 里的动词定义了 `--name` 之外本不存在的旗标。 |
| 6 | **头哨兵不可用** | `HEAD_SENTINEL_UNAVAILABLE` | 动词要求 `--expected-version`，但没有写前现读的链版本可供给。 |
| 7 | **必填旗标缺失** | `REQUIRED_FLAG_MISSING` | 动词声明的必填旗标在自动供给与载荷合并后仍然缺失。 |
| 8 | **回读不可执行/分歧** | `EXPECTATION_UNRESOLVABLE` / `READBACK_DIVERGENT` / `READBACK_REFUSED` | 回读的 `expectSameAs` 无法解析；回读值不等（全值比较，不是「读成功」）；回读被主机拒绝。 |
| 9 | **主机不可达/引擎拒收** | `HOST_CATALOGUE_UNAVAILABLE` / `STEP_REFUSED_BY_HOST_ENGINE` | 主机引擎不答 `commands`；或某个步骤被主机引擎拒绝（错误文本清洗后随回执返回）。 |
| 10 | **参数形状非法** | `MCP_ARGUMENT_*` / `MCP_PARTITION_UNKNOWN` / `MCP_INVALID_REQUEST` | 工具参数缺 `payload`、`payload` 不是对象、`partition` 不在枚举、或 JSON-RPC 帧非法。 |

成功码：`CEREMONY_PLANNED_ONLY`（dry-run）与 `CEREMONY_COMPLETED_AND_READ_BACK`（真写且全部回读通过）。

## 工具不得做的事

1. **不得**绕过回读。`readback` 为空即整批拒绝（拒绝面 #2）。没有「我先写，回读以后补」的形态。
2. **不得**让调用方指名 `--workspace` / `--attest-dir` / `--expected-version`（拒绝面 #1）。
3. **不得**让调用方指定回执或载荷的落盘路径 —— 两者都由工具决定并出现在返回值里。
4. **不得**驱动一次性供权动词族（拒绝面 #4）—— 该族只做自己的仪式。
5. **不得**重写仪式逻辑 —— 一切纪律沿 `ceremony.mjs` / `ceremony-plan.mjs`。

## 接线与名册

工具以 MCP 服务器 `aos-mcp-write` 注册在平台根 `.mcp.json`（审查层批准范围，
改动在收口记录里点名）；并进入 `parity-proof.mjs` 的锚名册（Claude 侧必须存在，
Codex 侧暂无对等服务器，以带日期理由的白名单豁免）。名册对等由 `pnpm parity:proof` 机器核对。

## 生效证据

见 156.2–156.6 各自「生效证据」：dry-run 经 MCP 客户端跑通且回执里 `partition` 与
`chainBefore.version` 与只读面当刻一致；四条红侧（拒绝面 #1–#4）经 MCP 客户端复跑，
reason code 互不相同；`pnpm --dir TCRN-AOS test` 全绿且能搜到本测试的用例名；
`pnpm --dir TCRN-AOS parity:proof` 绿。
