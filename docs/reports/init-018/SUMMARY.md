# INIT-018 执行层交接 · SUMMARY

签发：执行层 agent:deepseek-v4-flash · 2026-08-05。依据简报 v4（全量 19 张 Story，零 Owner 等待，MIN-053/054/055/056/057/058）。
**18 张执行层 Story 全部 done**（STORY-155 为审查层专属未派）；每任务一行。链上进度为实时真值（各单收口回执见各自 payloads/）。

| Story | 状态 | 证据包 | 一句话结果 |
| --- | --- | --- | --- |
| TCRN-CROSS-STORY-137（R1） | done | `TCRN-AOS/docs/reports/init-018/R1/` | freshness 默认窗口 48→9h + `--max-age-hours`；活面绿 + 红绿夹具；6/6 测试 |
| TCRN-CROSS-STORY-138（R2） | done | `TCRN-AOS/docs/reports/init-018/R2/` | ship-web.mjs 装配+船运+双向账本；实跑 TRANSFER_LEDGERS_EQUAL（14 文件）；9/9 测试 |
| TCRN-CROSS-STORY-139（S1） | done | `tcrn-workflow/docs/reports/init-018/S1.1…S1.4/` | 盘点+五仓 deny 规则+五归档 chflags uchg+解锁配方；S1.3 红测待审查层 |
| TCRN-CROSS-STORY-140（S5） | done | `tcrn-workflow/docs/reports/init-018/S5.1…S5.3/` | promptfoo@0.121.20 钉版+离线 smoke+护栏+run-metrics.json |
| TCRN-CROSS-STORY-141（S7） | done | `tcrn-workflow/docs/reports/init-018/S7/` | adapter-generate/persona-render golden+node --test 3/3+红测存档 |
| TCRN-CROSS-STORY-142（S12） | done | `tcrn-workflow/docs/reports/init-018/S12/` | 合成器+bench；3k 链只读动词 363–401ms 全 <2s；**核心发现：引擎 1MiB canonical 上限使链不可超 ~3200 条 work 记录** ⚠**已订正**，见下「订正」§第 1 条 |
| TCRN-CROSS-STORY-143（S15） | done | `tcrn-workflow/docs/reports/init-018/S15/` | 字节计量脚本+首份基线（62479 bytes）+复测口径 |
| TCRN-CROSS-STORY-147（S6） | done | `tcrn-workflow/docs/reports/init-018/S6/` | 六条教训场景库：spec（判断型起草）+promptfoo 实现（绿 6/6 + 红证明 0/6） |
| TCRN-CROSS-STORY-148（S8） | done | `tcrn-workflow/docs/reports/init-018/S8/` | 确定性子集挂 CI（verify-s6）+ 全量挂 release 门（eval-s6-full）+ 红测 |
| TCRN-CROSS-STORY-144（S2） | done | `tcrn-workflow/docs/reports/init-018/S2/` | SSH 写启发式：spec+observe matcher+settings 接线+21 样例+红测；enforce 归审查层 |
| TCRN-CROSS-STORY-145（S3） | done | `tcrn-workflow/docs/reports/init-018/S3/` | parity:proof（Claude/Codex 名册对等）+白名单绿起步+伪漂移必红；CLAUDE.md workflow-MCP 句修正 |
| TCRN-CROSS-STORY-146（S4） | done | `tcrn-workflow/docs/reports/init-018/S4/` | S4.1 生成 Codex config diff（codegraph-ds/aos）；**待门**：S4.2 应用归审查层 ⚠**归档态 diff 不可直接 `patch -p1`**，见下「订正」§第 6 条 |
| TCRN-CROSS-STORY-149（S9） | done | `tcrn-workflow/docs/reports/init-018/S9/` | 观测选型 spike：运营成本决定性 → 选 OTel Collector+轻 sink+座舱渲染；PoC 清单 |
| TCRN-CROSS-STORY-150（S10） | done | `tcrn-workflow/docs/reports/init-018/S10/` | ceremony 四点 span（start/end/readback/refused 全实测）+ 引擎 verb emitter + 隐私自查 ⚠**「全实测」不成立、emitter 未接线**，见下「订正」§第 3、4 条 |
| TCRN-CROSS-STORY-151（S11） | done | `tcrn-workflow/docs/reports/init-018/S11/` | host 会话 JSONL token 解析器+关联规则+首份报表（三层成本，cache_read 主导） ⚠**报表 cache_creation 断言有误**，见下「订正」§第 2 条 |
| TCRN-CROSS-STORY-152（S13/14） | done | `tcrn-workflow/docs/reports/init-018/S13-14/` | 条件未触发（S12 只读动词 363–440ms <2s）+链长 revisit 阈值（~3200 条） |
| TCRN-CROSS-STORY-153（S16） | done | `tcrn-workflow/docs/reports/init-018/S16/` | 全平台约束/门/hook/公约 35 项编目+三档起草（仍在 15/已消失 1/条件化 4）；**待门**：S16.3 终稿归审查层 ⚠**三档不分割 35 项、B10 掉队**，见下「订正」§第 5 条 |
| TCRN-CROSS-STORY-154（S17） | done | `tcrn-workflow/docs/reports/init-018/S17/` | archify 四道审查全过→digest 钉扎+试用画三层流水线架构图（9/9 checks） ⚠**已核验+已钉 digest 但尚未安装**，见下「订正」§第 7 条 |
| TCRN-CROSS-STORY-155（S18） | ready | — | 审查层专属，未派 |

## 报审查层的范围外发现与代办点

1. **引擎 `maxCanonicalBytes`=1MiB 协议上限**（STORY-142）：链 >~3200 条 work 记录即 INPUT_OVERSIZED——建议评估提高上限或增量物化。
   ⚠**已订正**：这条把两道成因不同的上限并成了一道，且 `export` 那一半**不是新发现**。见下「订正」§第 1 条。
2. ~~**STORY-150 / STORY-154 激活异常**（各一次）~~ → **已被推翻的结论**。
   原文（保留）：「激活仪式报 CEREMONY_COMPLETED_AND_READ_BACK 但 `activate.receipt.json` 未落盘、链上状态停在 `ready`，首个收口在 transition 步被拒（ready:done）——改两段收口（ready→active→done）后成功。其余 16 张无此现象。疑似一次性异常，审查层可查链上激活事件。」
   **真相（2026-08-05，核验层 · INC-038）**：那两次激活仪式**从未成功执行过**，引擎与仪式无辜——见下「订正」§第 8 条。
3. **代办点**（MIN-058 零等待，审查层续办）：STORY-146 S4.2 配置应用（+三服务器 status 实测+parity 白名单收缩）；STORY-153 S16.3 终稿即采；STORY-152 ADR 审议（条件未触发无需）；STORY-155 整单；STORY-144 enforce 切换。
   ⚠追加：**STORY-154 的安装**（archify 只钉了 digest，未装进任何 skills 目录）也是一个代办点——见「订正」§第 7 条。

---

## 订正（2026-08-05，核验层 · TCRN-CROSS-INC-038）

七项叙述/记录失真，全部经实测确证。**上文原判断一律保留可见**（本平台「事件只增不改」的文档侧对应物）；
以下为如实表述。复核脚本可原样重跑：`docs/reports/init-018/INC-038/recheck.sh`
（输出存档两份：`INC-038/outputs/recheck-before-correction.txt` 与
`…-after-correction.txt`，判据行逐行一致；活链只读实测
`INC-038/outputs/live-chain-export-probe.md`；总述与纪律 `INC-038/commands.md`）。

1. **S12「核心发现」三处错**（`S12/notes.md`；订正块在该文件内）
   - 1 MiB canonical 上限对 `export` 而言由**事件字节**决定，不由 work 记录数决定：
     `exportWorkspace`（`packages/core/src/workspace.ts:3272-3295`）自行 canonical 化并打进
     `events: state.events` 全量事件，既不经 `validateWorkspace` 也不经物化视图。
     原文归因的 `workspace.ts:1643` 的 `index.json`（`projects + activeWork`）是
     `validate`/`work-list` 的路径——**那条**才是 work-记录数敏感的。
   - 故 `export` **今日已在三条活链上被拒**，不是「链逼近 ~3200 条时」才会撞顶：
     2026-08-05 只读面实测 `cross-project`（1661 事件 / **256** work）、`TCRN-AOS`（1047 / **156**）、
     `TCRN-Design-System`（983 / **166**）全部 `INPUT_OVERSIZED`；`TCRN-TMS`（228 / 39）仍绿。
     同一条 `cross-project` 上 `validate` 与 `work-list` 均绿——两条路径不是同一道上限。
   - `S12/notes.md:40`「3157 条 work（3k 链）validate/**export**/work-list 通过」与同文件实测表
     （第 19 行记 `export … FAILED INPUT_OVERSIZED`）、`bench-3000.json`（`allOk=false`）
     及核验层独立重跑（exit 1 `INPUT_OVERSIZED`）三方矛盾——`export` 在 3157 处**即已失败**。
   - **此事非新发现**：`docs/releases/0.8.0.md`（第 13-15、20-25 行）早已按同一口径实测公布，
     并明确 `export` 是 all-or-nothing、超 1 MiB 即拒；当时给出的缓解是新增分页只读动词 **`event-list`**
     （0.8.0「Added」节，并声明「It does not make `export` paginated」）。
     今日实测与那张表同形（DS 事件数 983 逐字相同）。本单的贡献是**重新量到它**并给出
     `validate`/`work-list` 那条 work-记录数边界（3157 绿 / 3353 红），不是发现它。

2. **S11 报表自相矛盾**（`S11/report.md:26`、`S11/notes.md:19`）
   两处断言「cache_creation 本样本全 0（如实记录非静默补零）」，而同目录早 **18.2 秒**落盘的
   `init018-attribution.json` 自记 **5,840,169** 个非零 cache-creation token
   （执行层 `deepseek-v4-flash` = 0；审查层 `claude-fable-5` = 5,731,295；核验层 `claude-opus-5` = 108,874）。
   **是哪一步丢的**：不是解析器——`scripts/token-attribution.mjs` 全程携带该字段（:17/:79/:85/:91/:142/:153），
   逐会话 `byModel` 行里值也都在。丢在**报表侧手工归并的 `byLayer`**：解析器不产出 `byLayer`
   （`grep -c byLayer` = 0），本单按层归并时只搬了 `input/output/cacheRead/msgs/sessions` 五个键，
   漏了 `cacheCreation`；第二节的三层成本表因此缺一列，两处结论是**读那张缺列的表**写出来的，
   把「执行层为 0」泛化成了「本样本全 0」。**正确表述**：全 0 只对执行层成立。

3. **S10「四点 span 全实测」不成立**（`S10/notes.md`、本文档 S10 行）
   本单实测覆盖 `start` / `end`（dry-run 路径）与 `refused`（无效载荷路径）**三点**；
   `ceremony.readback` **未被本单任何归档路径触达**：span 采集跑（`S10/commands.md:19`）带 `--dry-run`，
   而 `ceremony.mjs:237-239` 在 readback 循环里 `if (dryRun) { …; continue; }`，
   readback span 的 emit 在同一循环末尾 `ceremony.mjs:274`；无效载荷那条走 `refused`，同样到不了。
   `S10/commands.md:9/10` 的 §5 链上仪式两条都不设 `TCRN_OTEL_SINK`，且第 10 行那次 activate
   从未执行过（见第 8 条），当时默认 sink 目录也尚未创建。收口时默认 sink
   （`<平台根>/var/tcrn-otel/ceremony-spans.jsonl`）只有 2 条 dry-run 记录（start + end），零条 readback。
   （如实补记：该 sink 在本单收口**之后**由真实仪式补上了 3 条 `ceremony.readback`，
   时点 `2026-08-05T04:31:09.970Z` / `04:31:10.482Z` / `05:10:12.872Z`——该点现已被观测到，
   但那不是本单的证据，也不能由本单配方复现。）

4. **引擎侧 `otel-spans.ts` 是死代码**（本文档 S10 行原写「+ 引擎 verb emitter」）
   `packages/cli/src/otel-spans.ts` 目前**零调用方**：全仓（`packages/` + `scripts/` + `tests/`）
   对 `otel-spans` / `emitVerbSpan` / `engineSinkPath` 的引用数为 0，亦无测试覆盖
   （对照：ceremony 侧 `ceremony-spans.mjs` 有调用方 `ceremony.mjs:45`）。
   应像 S4 / S16 那样标注 **「待门 / 未接线」**（接线 + 重建 + 发布归审查层，v0.11.0 列车），
   不得与 ceremony 侧「已接线」并列陈述。

5. **S16 三档不分割 35 项**（`S16/catalog.md`、`S16/notes.md`）
   编目 A6 + B11 + C4 + D14 = **35**；原三档 15 + 1 + 4 = **20**，差 15 项。
   且「仍在（15）」的表头与它自己的列表矛盾（`catalog.md:65` 实际列了 **29** 项）。
   **B10**（S7 黄金样本 + S6 lessons 的 CI 确定性子集，`catalog.md:31`）**未入任何一档**。
   **订正为：仍在 30（含 B10）/ 已消失 1（D13）/ 条件化 4（B5、B6、B9、C2），和 = 35。**
   B10 归「仍在」：其成立条件「每 push CI」今天仍成立，被守护对象仍在仓内且仍挂 CI；
   它与 B5 相邻但不同——B5 的**内容**随场景库演进故列条件化，B10 是承载它们的 CI 子集本身。

6. **S4 归档态 diff 不可直接应用**（`S4/notes.md`）
   `codex-config-incremental.diff` 的 `+` 行里有 **6 个 `<local-home> 字面占位符**
   （其中 2 个是 `command` 的 pnpm 路径，文件系统上不存在），上下文行里另有 2 个。
   `patch -p1` 以**默认 fuzz** 吞掉不匹配的上下文，**静默接受**：实测 exit 0、无告警，
   而落盘的正是 `command = "<local-home>/.nvm/.../pnpm"` 这样的坏配置；
   同一份 diff 加 `-F0` 则 exit 1、`1 out of 1 hunks failed` 并落 `.rej`。
   S4.2 应用前必须替换的 6 处占位符清单、以及「要么手工粘贴、要么必须 `-F0`」的处置，
   见 `S4/notes.md` 的订正块。

7. **S17「钉扎纳入」钉的是未安装物**（`S17/notes.md`、本文档 S17 行）
   `archify` **不在本平台任何 skills 目录**：`<平台根>/.claude/skills/` 与 `~/.claude/skills/`
   名册均无它，全平台 `find -iname 'archify*'`（排除 `node_modules`）零命中；
   它只存在于 **`/tmp/archify-trial`**，第三节的试用即跑在那个 OS 临时目录里。
   **如实改写为：已核验（四道审查全过）+ 已钉 digest，尚未安装。**
   安装是后续动作（选安装位置 → 从钉扎 HEAD `19213e10…` 取件 → 装后重新核对 sha256 →
   审查层裁定采纳与重钉责任），详见 `S17/notes.md` 的订正块。

8. **「STORY-150 / STORY-154 激活异常」这条结论已被推翻——那两次激活仪式从未成功执行过**
   判据是回执算术，不需要上链查：
   `S9/payloads/close.receipt.json` 的 `chainAfter.version = 1627`
   **等于** `S10/payloads/close.receipt.json` 的 `chainBefore.version = 1627`
   ⇒ 两者之间链上**零事件**。若 STORY-150 的激活真的跑过并报了 `eventsAppended = 1`，
   链必已推进到 1628。S17 同形：`S16` close 的 `chainAfter = 1639` **等于** `S17` close 的
   `chainBefore = 1639`。全部 33 份回执按 `startedAt` 排序后 `chainAfter → 下一条 chainBefore`
   处处相接（唯一缺口 1579→1609 属另一会话的其它链上活动），账里没有这两次激活事件可容身。
   **缺失的 `activate.receipt.json` 就是那个 tell**：16 个带 payloads 的故事目录里，
   **只有 S10 与 S17 缺它，也恰好只有这两个「状态停在 ready」并需要 `close2` 两段收口**。
   回执没落盘不是「引擎报成功但文件没写出来」，而是**那条命令从未被执行**；链上状态自然还是 `ready`，
   首个收口在 `ready:done` 被拒是引擎**正确**执行了状态机（`planned → ready → active → done`）。
   **引擎与仪式在此事上无过失。** 教训：**回执文件缺失应先读作「命令没跑」，而不是「跑了但没落盘」**——
   后一种读法凭空给引擎安了一个不存在的缺陷，并让一次可归因的操作遗漏躲过复盘。

9. **本文档表格里有一批证据路径指向一个不存在的目录**
   （承载单：**TCRN-CROSS-INC-041**，`work:30f973e55782de0ee3465fec`，截至 2026-08-05 实测
   `status=planned`，链版本 1718；其 scope 第 ④ 条逐字承载本条：
   「④F5(低):SUMMARY.md 十六处 tcrn-workflow/docs/reports/ 系死路径,文件内订正区补第 9 条…」。
   来源判据：`TCRN-AOS/docs/reports/init-018/QA/report.md` §F5。
   上面这三处点名（单号、内部 id、状态）都是对**当下状态**下的判断，无机构维护，故按本平台
   「文档里的举例就是断言」纪律给出复核命令——`cross-project` 分区的真值在 VM 上：

   ```bash
   ssh tcrn-platform-dev 'node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs \
     work-show --id work:30f973e55782de0ee3465fec \
     --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace'
   ```

   ⚠**本条自身的第一版指错了单**：初版写「追记于 TCRN-CROSS-INC-039」。**INC-039 是另一桩且已 done**
   （截至 2026-08-05 实测 `work:da0368de5136d1a0d35ec162`、`status=done`——内容是「被提交的 CLAUDE.md
   仍断言 `home=local`，而 `doc-topology:proof` 读工作树故恒绿」），与本条毫无关系。
   本条要根治的正是「举例即断言、指针指向不相干的东西」这一类缺陷，而它自己犯了同一类——
   交接文档是**离线阅读物**，读者手里未必有链，顺着这个唯一的溯源指针只会落到一桩无关的已关闭事故上。
   订正指针即本条第一项内容，原错文一并留在这里可见（事件只增不改）。

   `INC-034` 把 INIT-018 证据包整体迁到 `TCRN-AOS/docs/reports/init-018/` 之后，
   `tcrn-workflow` 仓**没有** `docs/reports/` 这个目录（截至 2026-08-05 实测：
   `test -d tcrn-workflow/docs/reports` 退出码 1；该仓 `docs/` 下 12 个条目里没有 `reports`）。
   于是表格「证据包」列里那批 `tcrn-workflow/docs/reports/init-018/…` 形式的地址，对读者是死路径。
   - **真实条数与分布（截至 2026-08-05 实测）**：共 **16 处**，落在 **16 个不同的行**，
     且**全部集中在第一节的表格里**——本文档第 10–25 行，即 STORY-139(S1) 到 STORY-154(S17)
     连续 16 行，每行 1 处。**在本条追加之前，表格以外为 0 处**：「报审查层的范围外发现与
     代办点」一节 0 处，订正区第 1–8 条 0 处（本条第 9 条自身为了陈述该规则而引用了这个
     字符串，故复核命令只数表格行，见下）。
     QA 报告（`QA/report.md`，其 sha256 已钉在链上，本单一字不动）
     把它记作「表格与 §3 中……共 16 处」：**条数 16 与实测一致**，
     但「§3 中」这半句若指表格以外的任何一节，则在分布上**不成立**，此处如实并记。
   - **同一张表里已有两行用的是新址**：第 8、9 行（R1/R2）写的就是
     `TCRN-AOS/docs/reports/init-018/`。所以本文档自身是新旧混写的，
     这也是它读起来「多数路径打不开、少数打得开」的原因，不是随机损坏。
   - **映射规则（一对一，只换仓前缀）**：
     `tcrn-workflow/docs/reports/init-018/<X>` → `TCRN-AOS/docs/reports/init-018/<X>`，
     `<X>` 及包内相对结构一字不变。表格里两处省略号写法（`S1.1…S1.4/`、`S5.1…S5.3/`）
     展开后，这 16 个单元格共指 **21 个具体目录**：
     `S1.1 S1.2 S1.3 S1.4 S2 S3 S4 S5.1 S5.2 S5.3 S6 S7 S8 S9 S10 S11 S12 S13-14 S15 S16 S17`。
     截至 2026-08-05 逐个 `test -d` 实测：**21/21 在新址下存在，21/21 在旧址下不存在**，
     没有出现「新旧两址都找不到」的第三种情况——即这 16 处全部是纯粹的前缀失效，
     不掺杂证据丢失。
   - **为什么不直接改表格**：本平台「事件只增不改」在文档侧的对应物是**原判断一律保留可见**。
     把单元格就地改成新址，会顺手抹掉「执行层当时确实把这些证据写进了 `tcrn-workflow` 仓」
     这个事实——而那正是 INC-034 的成因，也是那一环 CI 首门变红的由来。抹掉之后，
     后来人看到的是一份从头就正确的表格，看不到那次入错仓，于是这次迁移在文档侧无迹可寻。
     所以订正走追加：表格原文与前八条订正一字节不动，本条只给读法。
   - **链上已有 INC-034 的路径更正注解，但那不替代本文件如实。**
     交接文档是被离线阅读的物件，读它的人手里未必有链、未必有引擎；
     一个只活在链上的更正，对拿着这份 Markdown 的人等于不存在。
   - **复核命令**（在平台根执行；全绿打印 `F5_RECHECK_OK` 且退出码 0，
     任一条判据不成立即打印对应 `RED …` 行并退出码 1）。

     ⚠**本条自身的第一版给的是一道区分不了两个世界的门**，一并订正：那一版一侧只数
     `tcrn-workflow/docs/reports/init-018/` 在表格行里的**出现次数**，另一侧对一份**写死在命令里的
     21 个目录名**逐个 `test -d`——**两半之间没有任何联系**。于是上面那几条核心声明
     （一对一只换仓前缀 / 这 16 个单元格恰好共指这 21 个目录 / 新址真有证据 / 没有第三种情况）
     被改坏时，门照样打印 `F5_RECHECK_OK` 并 exit 0。

     **新旧两门在同一棵合成树上逐项对拍（2026-08-05 实测，每次只注一种漂移）**：

     | 注入 | 旧门 | 新门 |
     | --- | --- | --- |
     | 21 个新址目录**全部清空**（保留空目录） | exit **0**，`F5_RECHECK_OK` | exit 1，`RED 新址目录为空 …/S1.1` |
     | `S1.1…S1.4/` 改宽成 `S1.1…S1.6/` | exit **0**，`F5_RECHECK_OK` | exit 1，`RED 新址缺目录 …/S1.5` |
     | 一处单元格改指不存在的包 `…/S6/` → `…/S99/` | exit **0**，`F5_RECHECK_OK` | exit 1，`RED 新址缺目录 …/S99` |
     | 一处单元格改成第三种前缀 `TCRN-TMS/…` | exit 1，`RED 计数漂移 n=15` | exit 1，`RED 第三种写法…` |

     前三行是旧门的盲区：只数字符串出现次数，就看不见**那个字符串指向了哪里**；只 `test -d`，
     **空目录恒等于绿**——正是本平台刚在 INC-040 上栽过的那一课。
     （第四行如实记：旧门在这一种上并不盲。本条初稿曾把它一并写进盲区，实测后改正——
     「先怀疑自己的探针」这条纪律对写订正的人同样适用。）

     下面这一版**从表格里实际解析**出证据包单元格（以 `|` 分栏取第 4 栏、就地展开省略号），
     再拿解析结果去验新址**存在且非空**、旧址不存在，并把「16 处 / 21 目录 / 2 处新址 / 19 行」
     这几个声明本身钉成判据——两半从此是同一条数据流的上下游，任一半被改坏，另一半立刻对不上。

（下面这段**故意顶格**，不随上文缩进：它是 here-doc，结束标记 `F5RECHECK` 与 `CELLS`
必须在行首，缩进过的副本粘进终端会永远读不到结束标记。原样整段复制即可。）

```bash
bash <<'F5RECHECK'
set -u
S=TCRN-AOS/docs/reports/init-018
OLD=tcrn-workflow/docs/reports/init-018
SUM="$S/SUMMARY.md"
ok=1
red() { echo "RED $*"; ok=0; }
[ -f "$SUM" ] || { echo "RED 未在平台根执行：找不到 $SUM"; exit 1; }

# ① 只认表格行（本订正区自己引用的字符串进不了解析，判据不自指）
cells=$(awk -F'|' '
  /^\| TCRN-CROSS-STORY-/ {
    c = $4; gsub(/`/, "", c); gsub(/^[ \t]+|[ \t]+$/, "", c); sub(/\/+$/, "", c)
    print (c == "" ? "<EMPTY>" : c)
  }' "$SUM")
rows=0; nold=0; nnew=0; ndash=0; old_dirs=0; new_dirs=0

# ② 每个解析结果都必须落到一个新址目录上：存在，且非空
check_dir() {
  d=$1; src=$2
  [ -d "$S/$d" ] || { red "新址缺目录 $S/$d（由 $src 单元格解析所得）"; return 1; }
  [ -n "$(ls -A "$S/$d" 2>/dev/null)" ] || { red "新址目录为空 $S/$d（由 $src 单元格解析所得）"; return 1; }
  [ -e "$OLD/$d" ] && { red "旧址仍存在 $OLD/$d（本条前提是纯前缀失效，不是两址并存）"; return 1; }
  return 0
}

while IFS= read -r c; do
  [ -n "$c" ] || continue
  rows=$((rows + 1))
  case "$c" in
    "$OLD"/*) nold=$((nold + 1)); t=${c#"$OLD"/}; src=旧址 ;;
    "$S"/*)   nnew=$((nnew + 1)); t=${c#"$S"/};   src=新址 ;;
    —)        ndash=$((ndash + 1)); continue ;;
    *)        red "第三种写法：无法归类的证据包单元格 [$c]"; continue ;;
  esac
  case "$t" in
    *…*)  # 省略号从字面量推导展开，不查表：S1.1…S1.4 → S1.1 S1.2 S1.3 S1.4
      lo=${t%%…*}; hi=${t##*…}; a=${lo##*.}; b=${hi##*.}
      case "$a$b" in ''|*[!0-9]*) red "省略号两端不是数字后缀：$t"; continue ;; esac
      [ "${lo%.*}" = "${hi%.*}" ] || { red "省略号两端前缀不一致：$t"; continue; }
      [ "$a" -le "$b" ] || { red "省略号区间逆序：$t"; continue; }
      i=$a
      while [ "$i" -le "$b" ]; do
        if [ "$src" = 旧址 ]; then old_dirs=$((old_dirs + 1)); else new_dirs=$((new_dirs + 1)); fi
        check_dir "${lo%.*}.$i" "$src"; i=$((i + 1))
      done ;;
    *)
      if [ "$src" = 旧址 ]; then old_dirs=$((old_dirs + 1)); else new_dirs=$((new_dirs + 1)); fi
      check_dir "$t" "$src" ;;
  esac
done <<CELLS
$cells
CELLS

# ③ 声明本身也被钉住：改了表格就必须来改本条
[ "$rows" = 19 ]     || red "表格行数漂移 rows=$rows（应为 19）"
[ "$nold" = 16 ]     || red "旧址单元格数漂移 nold=$nold（应为 16）"
[ "$nnew" = 2 ]      || red "新址单元格数漂移 nnew=$nnew（应为 2：R1/R2）"
[ "$ndash" = 1 ]     || red "无证据包的行数漂移 ndash=$ndash（应为 1：S18）"
[ "$old_dirs" = 21 ] || red "旧址单元格展开后的目录数漂移 old_dirs=$old_dirs（应为 21）"
[ "$new_dirs" = 2 ]  || red "新址单元格展开后的目录数漂移 new_dirs=$new_dirs（应为 2）"
[ $((nold + nnew + ndash)) = "$rows" ] || red "有表格行未被归类：$nold+$nnew+$ndash ≠ $rows"
[ -d tcrn-workflow/docs/reports ] && red "旧址父目录 tcrn-workflow/docs/reports 已出现，本条前提失效"

if [ "$ok" = 1 ]; then
  echo "F5_RECHECK_OK 表格 $rows 行 → 旧址 $nold 处展开 $old_dirs 目录、新址 $nnew 处展开 $new_dirs 目录；全部在新址存在且非空，旧址全部不存在"
  exit 0
fi
exit 1
F5RECHECK
```

   **红侧当场实测（2026-08-05）**：跑的**不是这段文字的副本**，而是用
   `awk '/^bash <<.F5RECHECK.$/{f=1} f{print} /^F5RECHECK$/{if(f) exit}' SUMMARY.md`
   从**本文件里抽出来**的那 70 行——否则被证的只是我手边那份，不是读者手边这份。
   在 scratchpad 的一份合成树（新 `SUMMARY.md` + 23 个各含一个文件的目录）上逐次注入六种漂移，
   每次只注一种、注完即还原，退出码单独取：

   | # | 注入 | 打印 | 退出码 |
   | --- | --- | --- | --- |
   | 1 | 删空 `S12/` 的内容、保留空目录 | `RED 新址目录为空 …/S12` | 1 |
   | 2 | 把 `S1.1…S1.4/` 改宽成 `S1.1…S1.6/` | `RED 新址缺目录 …/S1.5`、`…/S1.6`、`RED 旧址单元格展开后的目录数漂移 old_dirs=23` | 1 |
   | 3 | 造出 `tcrn-workflow/docs/reports/init-018/S9` | `RED 旧址仍存在 …/S9`、`RED 旧址父目录…已出现` | 1 |
   | 4 | 把 S6 行改指 `TCRN-TMS/…` 前缀 | `RED 第三种写法…`、`nold=15`、`old_dirs=20`、`RED 有表格行未被归类：15+2+1 ≠ 19` | 1 |
   | 5 | 把 S3 行就地改写成新址 | `nold=15`、`nnew=3`、`old_dirs=20`、`new_dirs=3` | 1 |
   | 6 | 删掉 `S17/` | `RED 新址缺目录 …/S17` | 1 |

   六次还原后合成树复绿，同日同一段命令在真实工作树上打印 `F5_RECHECK_OK` 并以退出码 0 结束。
   **第 1、2 两侧是新加的**：旧版命令对这两种漂移**照样打印 `F5_RECHECK_OK` 并 exit 0**——
   第 1 种它只 `test -d`，第 2 种它两半互不相干。
   - **它把什么钉住了**：`nold=16` / `old_dirs=21` / `nnew=2` / `ndash=1` / `rows=19`
     以及那条「三者相加等于行数」的等式，钉的是「本文档表格现存这个分布、且按上面的规则解读」
     这个声明本身；`check_dir` 那三行钉的是「每一处解析结果在新址真有非空证据、在旧址真没有」。
     将来若经裁定真去改写表格（那需要另一份订正说明为什么可以覆写原判断），这些判据会变红——
     **那是它该做的事**，红了就来改本条，而不是把它调绿。
   - **范围与代码侧残余枚举**：本条的判据只覆盖**本文档内**的旧址引用。
     但「范围之外的事归它自己的单」不等于「不必点清有哪些」——上一版这里只点名了
     `ssh-write-observer.mjs` **一处**，而同一次 INC-034 迁移在代码侧留下的活引用不止一处。
     **截至 2026-08-05 实测**（在平台根跑
     `grep -rn "docs/reports" --include="*.mjs" --include="*.sh" tcrn-workflow/scripts TCRN-AOS/docs/reports/init-018/INC-038`）：

     | # | 位置 | 形态 | 状态（2026-08-05 实测） |
     | --- | --- | --- | --- |
     | a | `tcrn-workflow/scripts/ssh-write-observer.mjs` `DEFAULT_LOG` | 日志落点曾指旧址，ENOENT 被空 catch 吞 | **已修**：sink 已迁到平台根 `var/tcrn-observe/ssh-write-hits.jsonl` 并加活性判据（INC-040） |
     | b | `tcrn-workflow/scripts/bench/bench-replay.mjs:29` | `--out-dir` 默认值 `REPO_ROOT/docs/reports/init-018/S12`，:94 `mkdirSync(recursive)` | **未修**：跑一次就把旧址**造回来** |
     | c | `tcrn-workflow/scripts/bench/measure-context-bytes.mjs:32` | 同上，默认 `…/S15`，:65 `mkdirSync(recursive)` | **未修**：同上；另 :17 注释引旧址 |
     | d | `TCRN-AOS/docs/reports/init-018/INC-038/recheck.sh` | 整份脚本的 `R` 锚在旧址 | **本单已修**：见该文件头部「订正追记（TCRN-CROSS-INC-041 · QA §F5）」 |
     | e | `tcrn-workflow/scripts/ssh-write-observer.mjs:621` | 分类器**样例语料** `D11` 里的重定向目标含旧址串 | **不改**：那是喂给判据的输入样例，不是活路径；登记以免下次扫描误判 |

     b、c 两处不只是死文本，它们与本条的第三条判据**直接冲突**：任一脚本按默认参数跑一次，
     `tcrn-workflow/docs/reports/` 就会被 `mkdirSync` 造回来，上面那段复核命令当场变红
     （`RED 旧址父目录 … 已出现，本条前提失效`）。这正是「迁移必须扫代码引用」那条协议修正
     （QA 报告 §复盘①）要防的形态。b、c 的修改不在本单授权范围（改的是引擎仓脚本），
     **登记为 TCRN-CROSS-INC-041 项下代办**。
   - **未接自动化列车**：上面这段是复核命令，不是 CI 门——本单只被授权改动本文件与 d，
     把它挂进 `pnpm verify` 需要改 `TCRN-AOS/package.json`，归审查层。
     按本平台「不在 verify 名册里的门，寿命等于写它那天」，此点如实登记为代办。
