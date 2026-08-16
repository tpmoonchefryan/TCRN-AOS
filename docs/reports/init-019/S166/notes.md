# STORY-166 收口 —— 投影新鲜度通则 + 统一巡检

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 登记项可机器取数;不得新造第五个孤门(160.4 并入本门) |
| 文件指针 | `docs/projection-freshness-convention.md`(平台级,新建);`TCRN-AOS/deploy/aos-local-client/projection-freshness.mjs`(巡检,新建);`TCRN-AOS/package.json`(接入 verify) |
| 验证命令 | `node deploy/aos-local-client/projection-freshness.mjs` → 四行状态,exit 0 |
| 收口动作 | 四侧车登记;一条命令输出四行;160.4 标记检查并入 |
| 生效证据命令 | 巡检进 verify 链;人为放旧一个侧车 → 门红点名该侧车 |

## 实测记录

### 166.1 通则成文
- `docs/projection-freshness-convention.md`:凡物化侧车须声明 {真源版本, 自身版本, 最大龄};无法回答自身版本判「未证」永不读作「新鲜」。

### 166.2 注册表(四侧车,可机器取数)
| 侧车 | 真源 | 自身 | 最大龄 | 取数方式 |
| --- | --- | --- | --- | --- |
| knowledge-store | cross-project 链 head | store marker 高水位 | 0 次写 | read face `knowledge-freshness` |
| web-projection | 链版本 | cockpit-data generatedAt | 7 天 | 本地 build 产物 stamp |
| codegraph | repo HEAD 提交时间 | 索引时间 | 0(须≥HEAD) | `.codegraph/` 索引 mtime vs `git log -1 --format=%ct` |
| memory-index | 记忆文件 | 最新记忆文件 mtime | 30 天 | `~/.claude/projects/…/memory` |

### 166.3 统一巡检门
- 一条命令(`projection-freshness.mjs`)输出四行状态;任一 stale/unproven 整门 exit 1。
- **160.4 并入此处**(未造第五个孤门):knowledge-store 行即标记差判据——HIGH_WATER_MISMATCH → stale。

### 166.4 红绿实测
- 红:codegraph 索引落后于 HEAD(实测 Aug 4 索引 vs Aug 5 HEAD)→ 门红点名 `codegraph`。
- 红:知识 store 未 rebase 时 `KNOWLEDGE_HIGH_WATER_MISMATCH` → knowledge-store 行红(160.3 前实测)。
- 绿:rebase + codegraph 重索引后,四行全 fresh,`PROJECTION_FRESHNESS_OK`。

### 166.5 生效证据
- `projection-freshness:proof` 进 `pnpm verify` 链(尾部);script 注册在 package.json。
- 168 的运行者将定时跑到本门(见 168)。

## 已提交
- 巡检脚本 + package.json(AOS 仓);公约在平台根 `docs/`(不在 git 仓,工作树生效)。
