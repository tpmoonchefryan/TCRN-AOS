# S1.1 盘点 — 控制树本机布局清单

执行层 agent:deepseek-v4-flash · 2026-08-05。只读 `ls`，未改动任何字节。

## `.tcrn-workspace/`（平台根下受治工作区容器）

| 目录 | 性质 | 内容 |
| --- | --- | --- |
| `TCRN-AOS/` | **归档**（S1.4 已锁） | `ARCHIVED.md` + `workspace/` + `attestations/`（612 收据）+ `evidence-locator/` + `transient/` |
| `cross-project/` | **归档**（S1.4 已锁） | `workspace/` + `authority/` + `evidence-locator/` + `transient/` |
| `TCRN-Design-System/` | **归档**（S1.4 已锁） | `workspace/` + `authority/` + `evidence-locator/` + `transient/` |
| `TCRN-TMS/` | **归档**（S1.4 已锁） | `workspace/` + `authority/` + `evidence-locator/` + `transient/` |
| `Joi-Button/` | **归档**（S1.4 已锁） | `workspace/` + `authority/` + `evidence-locator/` + `transient/` |
| `cross-project-shadow/` | 本机活链（fallback） | `workspace/` + `evidence-locator/` + `transient/` + `shadow-queue.json` |
| `TCRN-Design-System-shadow/` | 本机活链（fallback） | `workspace/` + `evidence-locator/` + `transient/` |
| `TCRN-TMS-shadow/` | 本机活链（fallback） | `workspace/` + `evidence-locator/` + `transient/` |
| `Joi-Button-shadow/` | 本机活链（fallback） | `workspace/` + `evidence-locator/` + `transient/` + `shadow-queue.json` |
| `release-trust/` | 容器级 sidecar | `gate-identity-authority.json` |

判定依据：`TCRN-AOS/deploy/aos-local-client/topology.mjs` 的 `PARTITION_ROSTER`（五分区 home 全 `vm`）
与 `SHADOW_ROSTER`（四个 `*-shadow` home `local`）。归档 = 迁置后 vacated 的只读留存；
shadow = 缓冲受治写的本机活链。

## `~/.tcrn-workflow/`（框架安装副本与档案）

| 条目 | 说明 |
| --- | --- |
| `tcrn-workflow/` | 已安装框架副本（57 项，2026-08-04 16:13） |
| `tcrn-workflow.bak-2026-08-04T08-12-30-999Z/` | 更新前备份 |
| `trusted-bootstrap.mjs` / `.bak-…` | 受信 bootstrap 与其备份 |
| `complete-skill-archive.provenance.json` / `.bak-…` | skill 完整归档证明 |
| `skill-archive.json` | skill 归档（176 KB） |
| `candidates/` | 候选 skill 目录 |
| `live/` | 安装状态目录 |
| `installed-copy-claude.json` / `installed-copy-codex.json` | 两宿主安装副本记录 |
| `state.json` / `.bak-…` | 状态与备份 |

## 结论

- 本机有 **5 个归档分区**（真值在 VM）+ **4 个 shadow 活链** + 1 个容器级 sidecar。
- S1.4 只锁 5 个归档；shadow 与 release-trust 保持可写（合法）。
