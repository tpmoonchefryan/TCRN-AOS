# INC-038 commands — 七项叙述/记录失真的文档订正

核验层 · 2026-08-05。本单**只改文档**（`.md`），不改任何可执行代码或数据文件；
`init018-attribution.json`、`bench-*.json`、`pinned-digest.json`、各 `*.receipt.json`
一个字节未动——它们正是证据。不写治理链、不碰 `.tcrn-workflow/` 与 `.tcrn-workspace/`。

## 一键复核（可原样重跑）

```bash
bash "<local-platform-root>/tcrn-workflow/docs/reports/init-018/INC-038/recheck.sh"
```

存档**两份**运行，都是 exit 0：

| 文件 | 何时跑的 |
| --- | --- |
| `INC-038/outputs/recheck-before-correction.txt` | 订正**写入前**（2026-08-05T07:55Z 起）——这份是缺陷本身的现场 |
| `INC-038/outputs/recheck-after-correction.txt` | 订正**写入后**——判据行与前者逐行一致，只有一处节标题措辞不同 |

两份都留，是因为本单订正的是文档，而复核脚本要读的也是同一批文档：
**只留一份就分不清「判据仍成立」和「判据被我刚写的订正文本喂饱了」**。
所以脚本对被订正文档一律**内容锚定**（`grep` 定语句、`awk` 划节、并显式排除以 `>` 开头的订正块），
不用会随订正块插入而移位的行号；两份输出的判据行相同，即证明订正没有污染判据。

脚本自带绝对路径，cwd 任意；只读，唯一写动作是在 `$TMPDIR` 下造一份 scratch 配置做 patch 红绿演示。

## 二、每项订正的判据（脚本节号 ↔ 订正项）

| 脚本节 | 订正项 | 红侧（判据成立时看到什么） | 绿侧（判据不成立时看到什么） |
| --- | --- | --- | --- |
| 1a | export 的上限由事件字节决定 | `workspace.ts:3272-3295` 自行 `canonicalJson({… events: state.events})` | 对照 `workspace.ts:1643` 的 `index.json` 只含 `projects + activeWork` |
| 1b | S12 notes:40 自相矛盾 | `bench-3000.json` `.verbs.export.allOk = false / INPUT_OVERSIZED` | 同文件 `validate`/`work-list` `allOk = true` |
| 1c | 非新发现 | `docs/releases/0.8.0.md:13-15,20-25` 已公布同一张表 | — |
| 2 | cache_creation 非全 0 | 逐模型行合计 **5,840,169** | `byLayer` 三层的键里**没有** `cacheCreation` |
| 3 | readback 未被本单实测 | dry-run 于 `ceremony.mjs:237-239` `continue`，emit 在 `:274` | 默认 sink 现有 3 条 readback（收口**之后**的真实仪式所留） |
| 4 | `otel-spans.ts` 是死代码 | `otel-spans`/`emitVerbSpan`/`engineSinkPath` 调用方 **0 条** | 对照 `ceremony-spans.mjs` 有调用方 `ceremony.mjs:45` |
| 5 | 三档不分割 35 项 | 编目 A6+B11+C4+D14 = 35；三档 15+1+4 = 20；B10 零命中 | 「仍在」那行自己列了 29 项（与表头 15 亦不符） |
| 6 | S4 diff 不可直接应用 | `patch -p1` **exit 0**，`<local-home> 原样落盘 | `patch -p1 -F0` **exit 1**，`1 out of 1 hunks failed` + `.rej` |
| 7 | archify 未安装 | 两个 skills 目录名册无它、全平台 find 零命中、只在 `/tmp/archify-trial` | 对照 `<平台根>/.claude/skills/tcrn-workflow-helper` 是真安装物 |
| 8 | 激活异常已被推翻 | S9 close `after=1627` **==** S10 close `before=1627`（S16 1639 == S17 1639） | 33 份回执的版本账处处相接；缺 `activate.receipt.json` 的只有 S10/S17 两家 |

**判据两侧确实不同**——第 6 节是最直接的一对：**同一份 diff、同一个目标文件**，
默认 fuzz 走绿（exit 0，静默装进坏配置），`-F0` 走红（exit 1，落 `.rej`）。
第 1 节次之：**同一条 `cross-project` 链**上 `export` 红而 `validate`/`work-list` 绿，
且 `export` 在 `TCRN-TMS` 上是绿的——不是一道恒红的判据。

## 三、活链只读实测（不可经 shell 原样重跑，故单列存档）

走**只读 MCP 面** `tcrn-workflow-aos-read`（该门面自陈不转发任何 mutating 或
authority-bearing 动词），不经 `ceremony.mjs`，不经任何 ssh 写动词：

```
mcp__tcrn-workflow-aos-read__tcrn_remote_read_status    { "partition": "cross-project" }
mcp__tcrn-workflow-aos-read__tcrn_remote_read_export    { "partition": "cross-project" }
mcp__tcrn-workflow-aos-read__tcrn_remote_read_validate  { "partition": "cross-project" }
mcp__tcrn-workflow-aos-read__tcrn_remote_read_work_list { "partition": "cross-project", "limit": 1 }
# 同法跑 TCRN-AOS / TCRN-Design-System / TCRN-TMS
```

逐字应答与读数：`INC-038/outputs/live-chain-export-probe.md`。

## 四、本单改动的文件

| 文件 | 改了什么 |
| --- | --- |
| `S12/notes.md` | 「核心发现」节后加五条订正（机制归因、活链实测表、notes:40 自相矛盾、非新发现）；「S12.3 判定草案」与「范围外观察」各就地加订正 |
| `S11/report.md` | 第 4 条读数后加订正块（5,840,169、逐层数、丢失发生在 `byLayer` 手工归并） |
| `S11/notes.md` | 「缺口如实标注」对应条目加订正 |
| `S10/notes.md` | 四点 span 那条加订正（实测三点、readback 未触达、收口后补测如实记入）；引擎 emitter 那条加「死代码/未接线」加注；「异常观察」整条订正为已推翻 |
| `S10/commands.md` | 重跑配方处加订正（该配方证不出 readback，附代码行号） |
| `S16/catalog.md` | S16.2 三档后加订正（35 项配平表、B10 归「仍在」的理由） |
| `S16/notes.md` | 三档那行加订正 |
| `S4/notes.md` | 新增「⚠ 订正：归档态 diff 不可直接 `patch -p1`」整节（红绿实测 + 6 处占位符替换清单 + 处置三条） |
| `S17/notes.md` | 「digest 钉扎纳入」节加订正（未安装的实测 + 安装四步）；结论句加订正 |
| `SUMMARY.md` | 七行加 ⚠ 指针；范围外发现第 2 条改为「已被推翻的结论」并保留原文；文末新增「订正」§ 八条 |

**未改**（刻意）：`init018-attribution.json`、`bench-3000.json`、`bench-10k-ceiling.json`、
`pinned-digest.json`、所有 `payloads/*.json`、所有 `.mjs` / `.ts`。

## 五、纪律

- **订正是追加式的**：原判断一律保留可见，订正以「订正（2026-08-05，核验层）：…」标注——
  这是本平台「事件只增不改」在文档侧的对应物。
- **每处订正都写了据以订正的命令或文件行号**；引用实例处按「举例即断言」纪律注明实测日期。
  凡引本目录内会随订正移位的行号，已在订正写入**之后**重新核对过一次并改正
  （例：S12 那句「本次基准最重要的产出」订正前在第 50 行，订正后在第 96 行，引用已改）。
- **本单未修的既有红**：`pnpm verify:source` 报 `SOURCE_NOT_ALLOWLISTED`。
  这是**先于本单存在**的状态——把 `INC-038/` 整个移开后重跑，它照红
  （整批 INIT-018 交付：`docs/reports/init-018/**` 全部、8 个新 `scripts/`、
  新 `tests/`、`packages/cli/src/otel-spans.ts`、`.claude/settings.json` 都不在
  `scripts/policy/source-allowlist.json` 里）。本单被明确禁止改 `scripts/policy/*`，
  故只报不修：**这批交付合入前必须由名册负责人补齐 allowlist 条目**，否则 `verify:p1` 进不去。
