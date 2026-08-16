# STORY-157 收口 —— 文档改写:复核命令全面 MCP 化

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 不改写平台根 CLAUDE.md 第三节那张表的**地址列**(被 doc-topology:proof 机器核对);只改复核命令列形态;白名单条目带日期与理由;红侧改动当场还原 |
| 文件指针 | `S157/inventory.md`(盘点);平台根 `CLAUDE.md`、`docs/delivery-cadence-convention.md`、`TCRN-AOS/CLAUDE.md`、`TCRN-Design-System/CLAUDE.md`、`TCRN-TMS/CLAUDE.md`、`TCRN-AOS/docs/direction-aos-collaborative-workbench.md`(改写);`TCRN-AOS/deploy/aos-local-client/doc-topology-{predicates,proof,registry}.mjs`(判据扩展);`ssh-breakglass-allowlist.json`(158.1,157.3 消费) |
| 验证命令 | 盘点命令(见 inventory.md)重跑数目一致;`node deploy/aos-local-client/doc-topology-proof.mjs ; echo exit=$?` → 0;五链经 MCP 只读面各跑一次 |
| 收口动作 | 盘点清单 14 处 → 改写后 0;判据扩展进 verify 链(doc-topology 已在链上,未掉队) |
| 生效证据命令 | `pnpm --dir TCRN-AOS doc-topology:proof` 在干净工作树上 exit 0(本单直跑 `node deploy/aos-local-client/doc-topology-proof.mjs` 验证 DOC_TOPOLOGY_IN_SYNC) |

## 实测记录

### 157.1 盘点
- 机器可复现命令(见 inventory.md)在活跃注册文档 + workbench 方向文档中共 **14 处** SSH 直驱引擎命令:
  CLAUDE.md×5、delivery-cadence×5、TCRN-AOS/CLAUDE.md×1、DS/CLAUDE.md×1、TMS/CLAUDE.md×1、workbench×1。
- 全部是只读 `status` 复核命令,无一处属 break-glass 两类。
- 范围天花板:governance-archive/ 会话转储与 docs/reports/init-018/ 证据报告是历史归档,不入改写范围(INC-042 前提)。

### 157.2 改写
- 复核命令列统一改为 MCP 只读面形态,地址列原样保留:
  `读走 MCP 只读面: tcrn_remote_read_status(partition=<P>) · 真值地址 <address>`。
- 六份文档改写完毕;盘点命令重跑 → **0**。
- 验证:五链经 `tcrn_remote_read_status` 各跑一次,全部 `WORKSPACE_COMMAND_COMPLETED`(AOS v1048 / cross v1782 / DS v983 / TMS v228 / Joi v586)。

### 157.3 判据扩展(核访问形态,不只核地址)
- `doc-topology-predicates.mjs` 新增 `SSH_ENGINE_PATTERN` / `findSshDirectEngineCommands` /
  `sshCommandAllowlisted`,并在 `judgeDocTopology` 中对每份登记文档扫描:SSH 直驱引擎命令且不在
  break-glass 白名单 → `SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED` 点名文件与行号。
- `doc-topology-proof.mjs` 读 `ssh-breakglass-allowlist.json`(158.1)传入 judge;新增
  `NO_NON_ALLOWLISTED_SSH_DIRECT_COMMANDS` 期望与一条红侧用例。
- `CEILING.recheckCommandNotExecuted` 更新说明访问形态判据已并入。
- 判据仍在 `pnpm verify` 链(doc-topology 一步),未掉队。
- 白名单(158.1)两分类;本单实测阶段 entries 为空。

### 157.4 红侧实测(当场还原)
- 向 `TCRN-AOS/CLAUDE.md` 注入一条 SSH 直驱复核命令 → `doc-topology:proof` exit 1,
  finding `SSH_DIRECT_ENGINE_COMMAND_NOT_ALLOWLISTED`,点名 **TCRN-AOS/CLAUDE.md:146**(连同
  `ADDRESS_STATED_OUTSIDE_A_CLAIM_BLOCK`,因命令含 away 地址——双重正确红)。
- `git checkout -- CLAUDE.md` 还原 → `git status --short` 对该文件干净。
- 复验:`doc-topology:proof` exit 0,`DOC_TOPOLOGY_IN_SYNC`,unmet 空。
- 两侧输出存 `S157/outputs/red-side-inject.json`。

### 157.5 收口
- notes 本文件。
- 白名单残量:**0**(14 处全部改写,无一属两类 break-glass)。
- 已提交:TCRN-AOS(判据+白名单+CLAUDE.md+workbench)、TCRN-Design-System/CLAUDE.md、TCRN-TMS/CLAUDE.md。
  平台根 CLAUDE.md 与 docs/delivery-cadence-convention.md 不在任何 git 仓,以工作树形态生效,
  committed-claims 判据按设计跳过(registry `tracked: false` 声明为天花板)。
- 生效证据:`node deploy/aos-local-client/doc-topology-proof.mjs` → `DOC_TOPOLOGY_IN_SYNC`。
