# STORY-157.1 盘点 —— 全平台文档里的 SSH 直驱引擎命令

签发:执行层 agent:fable · 2026-08-05

## 盘点命令(机器可复现)

```bash
cd "<平台根>" && grep -rnE 'ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow\.mjs' \
  CLAUDE.md docs/delivery-cadence-convention.md docs/direction-and-tracks-convention.md docs/harness-constraint-convention.md \
  TCRN-AOS/CLAUDE.md TCRN-AOS/AGENTS.md TCRN-Design-System/CLAUDE.md TCRN-TMS/CLAUDE.md \
  tcrn-workflow/CLAUDE.md tcrn-workflow/AGENTS.md AGENTS.md \
  TCRN-AOS/docs/direction-aos-collaborative-workbench.md \
  .claude/skills/tcrn-workflow-helper/references/*.md
```

判据:命中「SSH 直驱引擎 CLI」= 命令行以 `ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs`
开头(直驱引擎,而非经服务层/MCP)。

## 分布(2026-08-05 实测)

| 文件 | 行号 | 命令形态 | 处置 |
| --- | --- | --- | --- |
| `CLAUDE.md` | 117–121 | 五链复核命令列 `ssh … status` | 157.2 改写为 MCP 形态 |
| `docs/delivery-cadence-convention.md` | 61–65 | 五链复核命令列 `ssh … status` | 157.2 改写 |
| `TCRN-AOS/CLAUDE.md` | 19 | `ssh … status` | 157.2 改写 |
| `TCRN-Design-System/CLAUDE.md` | 117 | `ssh … status` | 157.2 改写 |
| `TCRN-TMS/CLAUDE.md` | 66 | `ssh … status` | 157.2 改写 |
| `TCRN-AOS/docs/direction-aos-collaborative-workbench.md` | 9 | `ssh … status` 复核命令 | 157.2 改写 |
| **合计** | **14 处** | 全部是只读 `status` 复核命令 | 无一处属 break-glass 两类 |

## 范围与天花板

- **活跃文档**即上表。`governance-archive/session-exports/`(会话转储)与
  `TCRN-AOS/docs/reports/init-018/`(证据报告)是**历史归档**,不是代理可读的「复核命令」入口;
  前者是会话日志、后者随 INC-042 一起入库,都不在本次改写范围,也不该被改写(它们记录的是当时发生过什么)。
- 判定「SSH 直驱」只看 `ssh tcrn-platform-dev "node …/tcrn-workflow.mjs` 这一形态;`ssh` 做别的
  (逐字节比对、查 socket、看 journal)不属于直驱引擎 CLI,不在本次盘点与白名单的语义内。

## 复现

第二人原样重跑上述命令,应得到 14 行,分布与上表一致。
