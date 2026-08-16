# INC-037 · ssh-write-observer 判据四缺陷 — 修复说明

> 执行层记录 · 2026-08-05 · 文件集：`scripts/ssh-write-observer.mjs`（重写判据）、
> `scripts/ssh-write-observer.test.mjs`（新增，分支覆盖证明）、本证据目录。
> **observe 语义未变**：只记日志、恒 exit 0、源码内不出现 `permissionDecision`
> （有一条测试守着这句）。切 enforce 仍归审查层（MIN-058，D2 门）。

## 一句话

判据从「对整行做正则」改成「像 shell 那样切词，从**程序位**认出传输，只在
**ssh 交给远端 shell 的那串命令**里找写原语」；豁免改为**锚定的程序匹配**并**移到
危险判定之后**；语料从 21 条扩到 92 条，并由一套**变异测试**逐条证明「删掉这个分支，
恰好有样例转红」。

## 四缺陷各自的修法与红侧证据

| # | 原状 | 修法 | 红侧样例 |
| --- | --- | --- | --- |
| 1 | 豁免清单按**无锚定子串**匹配，且在治理/写原语检查**之前**求值 | 豁免只匹配**写单元的程序位**（basename 或绝对路径整体），并放在 host→治理路径→写原语**三道之后** | B01–B05：命令里出现 `ceremony.mjs` / `paired-backup.mjs` / `ship-web.mjs` / `engine-host:verify` / `tcrn-workflow.mjs` 字样但实为危险写，修前全部 PASS，现全部 HIT |
| 2 | `ssh` 之前有任何 token 即漏判 | 先跳过前导 `NAME=value`，再逐层剥包装命令（12 个，含各自的取参旗标与 `timeout` 的时长操作数），找到真正的程序位 | C01–C15：`env` / `time` / `sudo -u root` / `nohup` / `command` / `timeout 30` / `nice -n` / `ionice -c` / `stdbuf -oL` / `exec` / `setsid` / `doas` / 裸赋值 / 多层嵌套 / `$( )`，修前全部 PASS，现全部 HIT |
| 3 | 写原语对**整行**匹配 | 词法阶段就把重定向从 argv 里**摘出来**；ssh 的远端命令串按 ssh 自己的语义取（目的地之后的参数以空格拼接），写原语只在这串里找 | D01–D12：`2>&1`、`> /tmp/x`、`\| tee /tmp/x`、`rm -rf /tmp/x && ssh …`、`ssh … && rm -rf /tmp/x`，修前全部 HIT（误报），现全部 PASS |
| 4 | 21 条样例留下惰性分支 | 96 条样例，**同时断言 verdict 与 reason**；`ssh-write-observer.test.mjs` 用 78 条变异逐分支/逐清单项证明可红 | 把同一套证明打在「只有原 21 条」的副本上：85 项中 65 项失败，40 余项直接报 `the branch is inert` |

## 新判据的形状

```
classify(command)
  → 切词分段（引号/转义/# 注释/; && || | & 换行/子 shell/反引号；重定向摘入 redirects）
  → 每段：跳过前导赋值与包装命令 → 程序位
      ssh   → 跳过 ssh 自己的选项（取参与不取参分表）→ 目的地（去 user@）→ 远端命令串
              host 不匹配 → PASS(no-host-transport)
              远端串不含治理路径 → PASS(no-governance-path)
              远端串无写原语 → PASS(no-write-primitive)
              全部写单元命中豁免 → PASS(exemption:<id>)
              否则 → HIT(ssh-write)
      rsync
      scp   → 扫 argv 找 `[user@]host:path` 形态的 token；host 锚定整名且 path 落在治理树 → HIT
```

PASS 的 reason 取**走得最远的那一段**（rank 1<2<3），不是最后一段——D12 就是为这条排序而设。

## 两侧刻意不同（防恒真）

- **认不出传输/目的地 → PASS。** 观察器不认领它看不见的写；信息缺失倒向不记，
  observe 模式下更绝不倒向拦截。
- **已经认出 ssh→本主机、点名治理树、且带写原语，但写目标无法证明落在树外 → HIT。**
  此时举证责任已翻面。相对路径目标（`cd … && rm index.json`、`> export.json`）因远端 cwd
  不可知，一律按 HIT 处理（F08、F13）。
- 解析器自身抛异常 → `PASS/parse-error`（有测试注入 throw 验证这条真的兜住）。

## 豁免清单：为什么原来五条退成两条（残余适用性分析）

原五条（`ceremony.mjs`、`paired-backup.mjs`、`engine-host:verify`、aos-read verify、`ship-web.mjs`）
全是**本机 node 脚本**，程序位永远不是 `ssh`/`rsync`/`scp`，因而在新判据下**永远走不到豁免那一步**——
留着就是又一个惰性分支（缺陷 4 的病）。它们的旧成立条件已被更精确的危险判据**吸收**：
语料 A11–A14、A19 五条仍然 PASS，只是 reason 变成 `no-host-transport`，即「压根不是远端传输」。
留在册上的两条都是**可达且可杀**的：

- `host-engine`：远端写单元的程序是**该主机上已安装的引擎**
  （锚定 `/srv/tcrn/engine/**/tcrn-workflow.mjs`，直接执行或经 `node` 执行）。依据是平台
  CLAUDE.md §三.2「远端链的写必须由那台机器上的引擎执行」。杀它 → F02 转红。
- `scratch-target`：写目标全部落在 `/tmp/`、`/var/tmp/`、`/run/`、`/dev/null`。杀它 → F04 转红。

两条都**再过一道共同守卫**：写目标必须是**绝对路径且不在治理树内**，且目标列表**不得为空**
（空数组的 `.every()` 恒真——E17 `… | tee` 无操作数就是为这条恒真陷阱设的样例）。
所以 F03（引擎把输出重定向**进**治理树）判 HIT，豁免不生效。

**已知保守面（留给审查层）**：远端在**非 scratch 的绝对路径**上做写，而程序不是引擎时，
一律 HIT（F07、F09）。observe 期这只值一行日志；切 enforce 前应看 `observed-hits.log` 里
这一类的真实占比。rsync/scp 仍**双向皆记**（E09、E11 为 pull 方向），与 S2 spec 第 2 条一致，
方向收窄仍归审查层。

## 顺手补上的一个真漏判：远端再套一层 shell

写完判据后按「什么会让它漏」自查，发现 `ssh tcrn-platform-dev "bash -c 'rm /srv/tcrn/governance/…'"`
判 PASS——远端命令串的程序位是 `bash`，写原语藏在 `-c` 的那个参数里。已补：远端段若程序是
`sh/bash/zsh/dash/ksh` 且带 `-c`（含 `-lc` 这类组合旗标），把它携带的脚本**再解析一层**
（深度上限 4，纯属病态输入的护栏，不作为判定分支主张覆盖）。样例 G01/G03 命中、G04 仍放行；
变异 `remote-shell-c` / `remote-shell-set` / `remote-shell-flag` 各有会转红的样例。

顺带确认了远端 `sudo rm …` **原本就命中**（远端段同样走剥包装命令那条路径），G02 把这条
既有行为钉住，变异 `remote-wrapper-strip` 证明它不是恒真。

## 顺手修掉的一处静默恒绿（同一文件内）

入口守卫原本是 `process.argv[1] === fileURLToPath(import.meta.url)`。路径只要经过 symlink
就不相等（macOS `/tmp` → `<local-private-tmp>`），于是 `--self-test` **一条样例都不跑就 exit 0**——
一个会假装通过的自检。改成比较 `realpathSync` 后的路径，并补了一条经 symlink 调用的测试。
证据 `outputs/silent-green-entrypoint.txt`。这处不是单据点名的四缺陷之一，但属同一病灶，
且就在本单文件内。

## 证明机构自己会不会恒绿

三道自检：①**控制变异**（只改注释）必须**不**让任何样例转红，证明 harness 不是对谁都红；
②每条变异的锚点文本必须在源码里**恰好出现一次**，重构后证明会当场失效而不是悄悄失效；
③把整套证明打在弱化语料副本上必须**大面积转红**（实测 61/81 失败）。

## 仓内既有门（本单跑过的）

`lint` 绿（113 模块）。`format-check` 红 40 个文件、**本单文件 0 个**（核对命令见 commands.md，
不靠肉眼）。`pnpm test` 819 项 818 绿，唯一红项是 proof-artifact 生成器在 `.claude/settings.json`
上报 `PROOF_ARTIFACT_UNAPPROVED_SOURCE`——allowlist 缺项，本单未碰该文件，基线即红。

一个自伤教训：证据目录第一版把 `exit=0` 追加在 `.json` 产物末尾，`format-check` 会把每个
`.json` 重新序列化，于是**证据目录自己把仓内的门弄红了**（还表现为 `TASK_INTERNAL_ERROR`，
掩盖了原本那份既有红名单）。退出码已改收在 `outputs/exit-codes.txt`。

## 边界（本单没做也不该做的）

- 未切 enforce，未改 `.claude/settings.json` 接线，未动 `scripts/policy/*` 与 `package.json`。
- 未连过主机，未写任何链；ssh 命令串只作为字符串进入判据。
- 判据仍是**命令级**的：不展开脚本内部（`node deploy/.../ceremony.mjs` 不解析它自己发出的 ssh），
  也不解析 ssh 配置里的别名（`Host vm` → tcrn-platform-dev 这类别名会漏判，属信息缺失倒向不记）。
