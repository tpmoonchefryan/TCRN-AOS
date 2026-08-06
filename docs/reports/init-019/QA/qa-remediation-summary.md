# TCRN-CROSS-INIT-019 QA 补漏与修复 —— 收口总结

签发:执行层 agent:fable · 2026-08-06 · 依据 Owner「按 QA 审核意见及审核后新单完成补漏和修复」

## 结论:9 张 P1/P2 单全部修复并链上 done(INC-043..051)

按 QA 验收报告(`docs/reports/init-019/QA/acceptance-report.md`)与四份代理原文逐单落地,每条带生效证据实跑。

| 单 | 修复 | 关键生效证据 |
| --- | --- | --- |
| **INC-043** WF 套件红 | 三个新脚本登记 source-allowlist + `.claude/settings.json` 入库 | `pnpm test` → `TESTS_VERIFIED`,generate:proof-artifacts 通过 |
| **INC-044** 注入宿主末跳 | additionalContext 数组→字符串;多词 OR 检索;self-test 判据对齐;去死 matcher | hook 输出 str(1126B);`判据+CAS+marker`→5 候选(原 0);self-test 零检索必红 |
| **INC-045** doc-topology 红证跳过 | 六红证改 away 名册目标、恒跑;门证据 `--emit` 刷新 | `red count: 6` 全 wentRed;observedAt 刷新;DOC_TOPOLOGY_IN_SYNC |
| **INC-046** 用户名泄漏 | 5 文件 scrub;卫生门 `.plist` 入册 + `.mjs` 量测后 source 留档 | 全仓 tracked `.mjs/.plist` 零 `<local-home>` 形态用户名路径;hygiene 11/11;非 pending 0 命中 |
| **INC-047** 写面三缺陷 | throw 落回执;dryRun/partition 证伪测试;跨仓测试迁仓 | 13/13 server 测试;throw→`CEREMONY_THREW_BEFORE_RECEIPT` 回执落盘;WF `tests/knowledge-inject` 6/6 |
| **INC-048** helper 漂移 | 改动搬回源;candidate.31 重钉/重锚/再生;安装副本重装 | `verify-installed-copy` → `INSTALLED_COPY_VALIDATED`;RELEASE_ARTIFACTS_VALIDATED;套件绿 |
| **INC-049** freshness 两判据 | codegraph 问 status(非 stat 文件);web 比链版本 | `projection-freshness:proof` 全绿;web 对链移动判红(v1841→链 v1868) |
| **INC-050** 平台文档失实 | bootstrap 路径、仪式通路段、五者→六者、cwd 注明;DOC_REGISTRY 扩面 5 文档 | doc-topology 18 文档绿;方向文档地址字面量改指核对表 |
| **INC-051** P2 批 | ★break-glass 条目落地+写守卫+两消费者统一+schema 测试;owner-queue 失败首类行;codegraph sync-once | observer 117/117、套件 92 绿;两消费者对 status-fallback 同判 PASS、对写同判 HIT;owner-queue 失败显式 `chain-read-failed` |

## 链上收口

- 九张单经写面 `work-transition` planned→ready→active→done(27 步 + 9 回读),cross 链 1841→1868,全部 `CEREMONY_COMPLETED_AND_READ_BACK`。

## 已知保留(收口批外,择办;见 `docs/reports/init-019/INC-051/notes.md`)

- **★ heredoc 误报归因口径**(enforce 前置):观察窗内 heredoc 引用 ssh 命令仍判 HIT,归因口径待 STORY-165 评审定(节点 2 ③)。
- safe-target 惰性守卫三条 mutation、仪式 auto-rebase SPEC 未载、RESERVED_FLAGS 漏 `--expected-revision`、read-face 超时悬挂、platform-runner 进程组回收/`--if-due` 幻影/stderr 截断、SSH_ENGINE_PATTERN 宽化、SessionStart source 过滤等,已逐条记录理由。
- AOS codegraph 索引有 1 个 walker 残余 pending(codegraph 侧问题),`projection-freshness` 以 sync-once 判据将其视为 fresh-with-note,不硬红。

## 落盘

- AOS `feat/cross-init019-single-data-plane`:INC-043..051 相关 commit(allowlist、doc-topology、写面、freshness、hygiene、registry、evidence)。
- tcrn-workflow:注入/观察器/owner-queue 修复 + 测试。
- tcrn-workflow-helper:candidate.31 重钉(源+锚+归档+checksums)。
- DS/TMS CLAUDE.md cwd 注明;平台根 CLAUDE.md/公约/`.claude/settings.json` 工作树生效。
- 未推送;`docs/reports/init-019/` 证据随 INC-042 一起入库。
