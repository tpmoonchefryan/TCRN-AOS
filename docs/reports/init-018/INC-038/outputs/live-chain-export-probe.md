# INC-038 · 活链 `export` 实测（只读面，2026-08-05T07:5x Z）

复核走 **只读 MCP 面** `tcrn-workflow-aos-read`（该门面自陈「No mutating or authority-bearing
verb is forwarded」），逐分区调 `export` / `status` / `validate` / `work-list`。
不经 `ceremony.mjs`，不经任何 ssh 写动词，链版本前后不变。

复现方式（Claude Code 会话内）：

```
mcp__tcrn-workflow-aos-read__tcrn_remote_read_status   { "partition": "<分区>" }
mcp__tcrn-workflow-aos-read__tcrn_remote_read_export   { "partition": "<分区>" }
mcp__tcrn-workflow-aos-read__tcrn_remote_read_validate { "partition": "<分区>" }
mcp__tcrn-workflow-aos-read__tcrn_remote_read_work_list{ "partition": "<分区>", "limit": 1 }
```

## 一、四条链的 `export` 判决（红三绿一 —— 判据两侧确实不同）

| 分区 | `status` version（事件数） | `status` work（work 记录数） | `export` |
| --- | --- | --- | --- |
| `cross-project` | 1661 | **256** | **INPUT_OVERSIZED** |
| `TCRN-AOS` | 1047 | **156** | **INPUT_OVERSIZED** |
| `TCRN-Design-System` | 983 | **166** | **INPUT_OVERSIZED** |
| `TCRN-TMS` | 228 | **39** | **ok**（canonical ≈ 296,231 字符） |

原始应答（逐字）：

```
export cross-project        -> {"ok":false,"command":"export","partition":"cross-project","host":"tcrn-platform-dev","reasonCode":"INPUT_OVERSIZED","exitCode":1,"error":"{\"ok\":false,\"reasonCode\":\"INPUT_OVERSIZED\",\"error\":\"Canonical input exceeds one MiB\"}"}
export TCRN-AOS             -> {"ok":false,...,"reasonCode":"INPUT_OVERSIZED","exitCode":1,...}
export TCRN-Design-System   -> {"ok":false,...,"reasonCode":"INPUT_OVERSIZED","exitCode":1,...}
export TCRN-TMS             -> ok（结果过大被门面落盘；jq 复核：version=228, works=39, events=228, projects=1, canonical≈296231 字符）

status cross-project        -> {"ok":true,...,"projects":1,"reasonCode":"WORKSPACE_COMMAND_COMPLETED","version":1661,"work":256,...}
status TCRN-AOS             -> {"ok":true,...,"version":1047,"work":156,...}
status TCRN-Design-System   -> {"ok":true,...,"version":983,"work":166,...}
```

## 二、同一条链上 `validate` / `work-list` 绿而 `export` 红（两条路径不是同一道上限）

```
validate  cross-project -> {"ok":true,...,"reasonCode":"WORKSPACE_COMMAND_COMPLETED","version":1661,"work":256,...}
work-list cross-project -> {"ok":true,...,"reasonCode":"WORKSPACE_LIST_READY","total":256,"truncated":true,"version":1661,...}
export    cross-project -> INPUT_OVERSIZED
```

## 三、读数

1. `export` 在 **256 / 156 / 166 条 work 记录**处即被拒——远低于 S12 notes 所称的
   「~3200–3350 条 work 记录」。所以 `export` 的天花板**不由 work 记录数决定**。
2. 同一条 `cross-project`（1661 事件 / 256 work）上 `validate`、`work-list` 均绿——它们走
   `rebuildWorkspaceViews` 的 `index.json`（`projects + activeWork`，workspace.ts:1643），
   那条路径**才**是 work-记录数敏感的（S12 的 3157 vs 3353 边界在此成立）。
   `export`（workspace.ts:3272-3295）自行 canonical 化并把 **`events: state.events` 全量** 打进去，
   故它是**事件字节**敏感的。S12 把两条路径合并叙述成一道上限，是失真的来源。
3. 与 `docs/releases/0.8.0.md`（第 13-15、20-25 行）当日实测**同形**：那张表也是
   cross/AOS/DS 三红、TMS 一绿。今天 DS 的事件数（983）与 0.8.0 表中记的 983 完全一致。
   故此事**不是本次基准的新发现**，`event-list` 分页是当时给出的缓解。
