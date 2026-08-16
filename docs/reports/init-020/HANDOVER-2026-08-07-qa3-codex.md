# INIT-020 三轮验收交接文档 — Codex/GPT 执行批(QA3)

> **写给谁**:接手 QA3 补作业批的 **Codex 宿主(GPT)会话**,以及 Owner。
> **本文角色**:三轮验收(2026-08-07)后的执行交接书。**取代** `HANDOVER-2026-08-07-qa2-codex.md` 的单子名册与执行序段;其 §2 bootstrap 通道规则已因 S192 落地而**大部分退役**(见本文 §1)。
> **截至(实测@2026-08-07,链 v2256/`afaa8bf2…`)**;每条时点断言附复核命令,按命令走。
> **链上对应**:三轮结论+补单记录=INIT-020 v2256 注记;强化批 INC-090..094 立于 v2238..2247,修复批 INC-095..098 立于 v2248..2255。真回执:`docs/reports/init-020/qa3-{hardening,fixes}.receipt.json`(客户端物化件,逐字节即权威)。

---

## 0. 三十秒:三轮定局与你的任务

三轮验收结论:**工程面首次基本达标**——引擎 v0.11.7 真部署(468/468)、五门真绿(validate 5/5、tip 5/5、parity 零豁免、doc-topology --probe-vm、projection-freshness on PG)、PG 测试 18/18 隔离、AOS 521/521、你的 MCP 八服务器已接。**核销面不通过**——三单 done 判定过早(087/089/192)、两单缺义务红腿(086/088)、一单取证量错对象(083)、migration 主入口可绕哨兵(新 P1)、四 tag 铸于 p8 红时、72 收口事件署名 `agent:fable` 与「移交 Codex」冲突。

你的任务:**强化 5 单(INC-090..094)先行,修复 4 单(INC-095..098)在后**,然后第四轮验收→S187 余项→S190→推送裁定交 Owner。

**第一件事(开工日)**:补执行 S192 正腿②——在你的新会话里经 MCP 读面读五分区 `status`、经 `aos-mcp-write` 跑一次 dry-run ceremony,读数与本文 §头 的链头核对并留档。这既是能力自证,也是 INC-095 里 S192 补作业的一半。

## 1. 会话前置与通道纪律(S192 后版本)

1. `verify-installed-copy`(命令见 qa2 交接书 §1,期望 `INSTALLED_COPY_VALIDATED`)。
2. **读写主通路 = 你的两个 MCP 面**(`tcrn-workflow-aos-read` / `aos-mcp-write`)。ceremony.mjs CLI 是等价备用形态(每次调用自建隧道)。
3. **已知故障形态(本平台当天实测)**:MCP 面的**会话级隧道会死且不自愈**——症状=读面报 `MCP_REMOTE_NON_JSON_OUTPUT`(curl exit 7)、写面报 `CEREMONY_THREW_BEFORE_RECEIPT` 且 chainBefore/After 全 null。处置:①先本机诊断(4320/4321 无监听=隧道死,`ssh <vm> echo up` 探连通);②确认 VM SSH 通则改用 ceremony.mjs CLI(自建隧道)或重启会话;③写失败后**绝不盲重试**——先读链头与目标 id 判定落没落(本平台当天实测一次:抛前零落链);④**绝不因此转裸 SSH 驱动引擎**。
4. **署名纪律(INC-092 精神,落地前先自律执行)**:actor 签你自己的 persona(如 `agent:gpt-5-codex`),**严禁从模板拷 `agent:fable`**;每个收口批的 intent 写明执行形态(单上下文/多代理、宿主)。三轮 72 事件署名错位就是你要修的 A6。
5. **回执纪律(INC-091 精神)**:归档回执=引擎/写面物化件的**逐字节拷贝**,来源 `evidence/mcp-ceremony-write/receipts/` 或 ceremony `--receipt` 输出;手工组装、裁剪、改字段=违规,三轮已两次栽在这。
6. 写 cross 必带 `--partition cross-project` 并核 dry-run chainBefore;引用版本 2122 必带 hash(弃轨=`ad2a7c9b…`);id 派生律=`work:`+sha256(`"work\0"`+大写外键)前 24 位。

## 2. 九单名册与执行序

| 键号 | id 后 8 位 | 一句话 | 前置 |
| --- | --- | --- | --- |
| **INC-090** 核销门量链化 | `570e794c` | closeout-verify 增链背书:items 链派生+逐单链注记查红腿与指名证据物;红腿=造 done 无红腿必红 | — |
| **INC-091** 回执权威锚定 | `d685b677` | 在线锚链(version+hash 全值对 event 流)+null 头修+物化件逐字节政策+裁剪指纹具名 | — |
| **INC-092** 署名通道化 | `22ebb16c` | 写面回执增 channelHost 与 payload actor 并列;收口批执行形态申报义务;签名誓言 | — |
| **INC-093** 发布物铸造门 | `b7cf23cb` | 铸 tag 前置 p8 绿;tag↔p8 绿证据配对核查;release 提交形态断言(只动 manifest/文档) | — |
| **INC-094** 隐私门类扩 | `01c180df` | WF 增凭据 URL+私有主机名两类模式;AOS 门改按内容;两仓类名册对齐 | — |
| **INC-095** 三单重开收尾 | `d106394d` | 087:回执真件逐字节替换+S185 证据补挂;089:cockpit-data 三处路径清洗(门改归 094);192:MCP 回路补测+Owner 追认记录 | 090,091,092 |
| **INC-096** 红腿补挂+弃轨真导出 | `7d9e45fb` | 086/088 补红腿实录;break-glass 一次性导出弃轨 2106..2122 **文件轨字节**(现存导出量错对象=PG);083 追加更正注记 | 090 |
| **INC-097** 引擎 0.11.8 | `f7e97d19` | schema 必填+落哨兵后置断言;sealed 读携标识;epoch 租约;触发器认名;test-wiring owner 前缀洞;ADR 断言结构化 | 093,094 |
| **INC-098** WF 候选清洗重铸 | `6374e0f8` | 口令参数化换值;内网 IP 清除;拓扑两方案备妥待 Owner;历史重写清零 65 条;8 tag 重铸;helper 重钉方案 | 093,094 |

**执行序**:S192 回路补测(开工日)→ 090/091/092(记录面三门)→ 095 → 093/094 → 097(0.11.8,发版走新铸造门)→ 096(break-glass 取证须在记录里写明理由)→ 098(备妥,推送裁定交 Owner)→ 第四轮验收 → S187 余项 → S190 → ⛔推送必停点。

## 3. 三轮遗留缺陷速查(file:line 级,免考古)

- 回执衍生件:`docs/reports/init-020/story-185-closeout.receipt.json`(startedAt 同真批、19 步裁 4 步、story 字段改写);真件在 `evidence/mcp-ceremony-write/receipts/` 2026-08-06T18:07-08Z 批。
- cockpit-data 泄漏:`apps/web/src/cockpit-data.generated.ts:17547/17557/17567`(已跟踪,`4a564cd` 引入)。
- migration 哨兵可绕:`packages/core/src/workspace-migration.ts:680`(schema 条件式);18 绿测试从未走落哨兵路径(`migration.test.mjs:155` 的 options 形状不传 schema)。
- sealed 读无警示:引擎 status 输出无 storage-home 字段;`doc-topology --probe-vm` 对 cross 拿 2122 零标识。
- WF test-wiring 洞:`scripts/lib/test-wiring.mjs:71`(非 `github-action:` 前缀 owner 放行)。
- receipt-hygiene 洞:`deploy/aos-local-client/receipt-hygiene-proof.mjs:71`(null 头 continue)+全门无链锚定。
- 隐私门盲区:`scripts/lib/privacy.mjs`(无凭据 URL/主机名模式);`scripts/lib/evidence-hygiene.mjs:36`(后缀制)。
- WF 公开暴露源:口令 11 文件、`ssh-write-observer.mjs:665` 内网 IP、主机名×123、`deploy@`×1;65 条散 36 历史 blob——**清洗须重写候选分支并重铸 8 tag**。
- 弃轨真导出对象:VM sealed 文件轨 `events` 段中 2106..2122(**不是** PG 的同号段;现存 `inc083-archive-window-2106-2122.json` 导的是 PG,量错对象)。
- **Codex 钩子面现状(Owner 开工前发现,已落 S191 注记 v2257)**:UI「未找到钩子」=2026-07-25 有记录的**刻意撤下**(非丢失,与 S192 编辑无关)——旧 persona-bound 定义撤存于平台 `.codex/hooks.json.withdrawn-persona-bound-20260725`,完整旧接入在 `tmp/legacy-codex-pre-v050-20260724/`,详见平台 `.codex/README.md`;用户级 `[hooks.state]` 信任登记仍在(5 禁 1 启)。现状=Claude 侧有活跃治理钩子(stop-pact Stop hook、ssh-write-observer),**Codex 侧现役为零**;引擎 adapter 的 EPIC-024 observe-live 候选(persona-free 修正版)从未晋级。S191 执行时按注记裁两点(观察钩子经 adapter 动词族复活取证;stop-pact Codex 对等物→Owner 政策题③)。

## 4. Owner 政策题(两道,098 备妥双方案后交裁)

1. **WF(公开仓)拓扑公开与否**:`tcrn-platform-dev`/`/srv/tcrn` 布局/`deploy@` 用户名——已发布树目前零命中,这是首暴露决定。
2. **fixture 口令处置**:参数化+换值(推荐),或明示接受纯测试口令公开。
3. **stop-pact 的 Codex 对等物要不要建**:Codex 执行 run-to-completion 批次时现无停止契约执行面(stop-pact hook 是 Claude 用户级);若建,由 S191/adapter 动词族出方案再交裁。

**推送手册(不变)**:逐 ref 指名,**严禁 `--all`/`--mirror`**(本地两条旧世系分支各含 93 个真实邮箱提交);WF 分支直推不触发 CI,经 PR 推;AOS 零 CI,推前本地把门跑齐;AOS 可在 cockpit-data 清洗后先推(私有仓);WF 必须等 098 完成+p8/privacy 双绿+Owner 裁定。

## 5. 第四轮验收会量什么

1. 量链化 closeout-verify(INC-090 版)对 QA2 批 18 单+QA3 批 9 单全绿,且其红腿实录在案;2. 回执锚定门对存量全绿、对衍生件样本红;3. S192 回路留档(你的会话实测,非配置比对);4. 0.11.8 经铸造门发版(p8 绿在先);5. 弃轨字节导出清单与 `2122/ad2a7c9b` 咬合;6. 收口注记逐单含红腿+指名证据物+执行形态声明,actor=你的 persona;7. WF 候选重写后 verify:privacy 0 条;8. 每条本文 §3 缺陷在某单收口注记里有指名处置。方法与前三轮同:多路独立事实代理+主线程复核,自报不采信。

## 6. 陷阱速查(增补版)

隧道死亡症状与处置(§1.3)/写失败先读链再定重试/回执=物化件逐字节拷贝/把门修绿≠安全(主机名在模式表外)/2122 带 hash/量链不量 manifest/前置满足=链上状态非记录顺序/发版先过铸造门/break-glass 用一次记一次理由/逐 ref 推送/knowledge marker 常态落后/列表旗标半角逗号切分/zsh `=word` 展开。
