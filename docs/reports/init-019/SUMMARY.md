# TCRN-CROSS-INIT-019 收口总结 —— 唯一数据平面与真正注入

签发:执行层 agent:fable · 2026-08-05 · 依据 `TCRN-CROSS-INIT-019` 派工(/goal,遇硬阻断才停)

## 一句话

把「散文里反复申明的架构原则」变成「机器按得住的接口与门」——AOS 唯一数据平面、知识层从零到注入、
SSH 降格、生效证据纪律,全部落地并带**生效证据命令**实跑。

## 执行批次(按建议顺序 156→157/158→160→163→161→162→164→166→167/168→169→170→165→159)

| Story | 主题 | 状态 | 关键生效证据 |
| --- | --- | --- | --- |
| 156 | MCP 写面:单一 ceremony 工具 | ✅ done | dry-run + 四条红侧经 MCP 客户端,四 reason code 互不相同;真写 1047→1048 回读全值匹配;parity 绿 |
| 157 | 文档改写:复核命令 MCP 化 | ✅ done | 14 处 SSH 复核命令 → 0;`doc-topology:proof` 绿;五链经只读面 WORKSPACE_COMMAND_COMPLETED |
| 158 | SSH 降格 break-glass | ✅ done | 白名单两分类,doc-topology/observer 两处消费;平台 CLAUDE.md 声明段落 |
| 160 | 标记纪律:每写必 rebase | ✅ done | knowledge 写动词 CAS 用 marker(修复);写路径自动 rebase;两次真写后知识面可读 |
| 163 | 知识面读写全走 MCP | ✅ done | 五读动词经只读面;create→promote→body 读回;on-demand-context 改 MCP 形态 |
| 161 | 内容灌入:三源策展 | ✅ done | 20 卡建成并 promote;knowledge-list 默认 selection 20;抽检如实记录(raw 0/5,关键词 5/5) |
| 162 | 注入触发:hook 检索 | ✅ done | 检索链 + hook 注册(${CLAUDE_PROJECT_DIR});`--verify-channel` 三 cwd 绿;SessionStart/UserPromptSubmit 注入实测 |
| 164 | S2 语料扩面 | ✅ done | SSH 直驱引擎判 HIT(host-engine 豁免移除);语料 96→116;`verify:observe-channel` 绿 |
| 166 | 投影新鲜度 + 统一巡检 | ✅ done | 四侧车注册表;一条命令四行;160.4 并入;`projection-freshness:proof` 进 verify |
| 167 | 待 Owner 队列 | ✅ done | 队列 9 行(4 链 blocked + INC-041 四件 + 发布必停点),非空 exit 1 提醒 |
| 168 | 统一运行者 | ✅ done | platform-runner + launchd;**launchctl kickstart 真触发** failed:[] |
| 169 | 五要素模板 | ✅ done | dispatch-readiness 四→五要素;harness-constraint 生效证据推广 |
| 170 | INC-041 四代办补票 | ✅ done | 四件各补生效证据命令(只补票不执行) |
| **165** | enforce 晋级(等观察窗) | ⏳ active | 165.1 判据成文;观察窗 2026-08-05 起 7 天,165.2/165.3 待窗内数据 |
| **159** | 阶段二(座舱原生 MCP) | ⏳ active | 159.1 设计成文;159.2-159.4 为 VM 侧阶段二实施 |

## 关键产出

- **写面**:`TCRN-AOS/deploy/aos-mcp-write/{server.mjs, SPEC.md, server.test.mjs, drive.mjs}`——单一 `tcrn_ceremony` 工具,拒绝面 10 类 reason-coded。
- **知识层**:20 卡(三源策展,可证伪)+ 自动 rebase + 注入链(`tcrn-workflow/scripts/knowledge-inject*.mjs`)+ hooks。
- **合规门**:doc-topology 扩展核访问形态;observer 判 SSH 直驱 HIT;投影新鲜度统一巡检。
- **文档**:各仓 CLAUDE.md 复核命令列全面 MCP 化;两公约修订(五要素 + 生效证据推广)。

## 待 Owner

1. **发布必停点**(唯一):对外发布前须 Owner 批准。
2. **STORY-165 enforce 切换**:观察窗 2026-08-12 评估,够则切 enforce(判据见 S165/criteria.md)。
3. **STORY-159 阶段二实施**:设计已出,VM 侧部署待排。
4. **INC-041 四件代办**(170 已补票,各带生效证据命令)。

## 已提交分支

- `TCRN-AOS`: `feat/cross-init019-single-data-plane`(12 个 feat commit)。
- `tcrn-workflow`: `feat/cross-init018-prose-to-gates`(5 个 feat commit,注入/观察器/队列/运行者)。
- `TCRN-Design-System`/`TCRN-TMS`: CLAUDE.md 复核命令列(MCP 形态)各 1 commit。
- 平台根 `.mcp.json`(aos-mcp-write 注册)、`.claude/settings.json`(注入 hooks)、CLAUDE.md/公约/方向文档(工作树生效)。
- 未推送;`docs/reports/init-019/` 证据按 INC-042 前提随 INC-042 一起入库。
