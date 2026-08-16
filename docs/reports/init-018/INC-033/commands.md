# INC-033 修复证据 — 可原样重跑

工作目录:`<local-platform-root>/TCRN-AOS`
平台根(下文 `$P`):`<local-platform-root>`

```
P="<local-platform-root>"
cd "$P/TCRN-AOS"
OUT=docs/reports/init-018/INC-033/outputs
```

## 改了什么

| 文件 | 动作 |
| --- | --- |
| `$P/.claude/settings.json` | **新建**。26 条 `Write/Edit` deny 规则,覆盖平台根 `.tcrn-workspace/` 容器与 `~/.tcrn-workflow`,用**绝对形式**(`//`)为主。 |
| `TCRN-AOS/scripts/control-tree-guard-proof.mjs` | **新建**。判据脚本。 |
| `TCRN-AOS/package.json` | 只加一条 `control-tree:proof`。 |

`$P/.claude/settings.local.json` **未动**(sha256 `1d4bb644…2d79e`,mtime 仍是 2026-07-16)。
五仓 `.claude/settings.json` **未动**——它们对仓内路径仍是纵深防御,按单要求保留。

## 根因复现(先确认诊断,再确认修复)

事故的判据是「每一棵真实控制树都被某条 deny 规则覆盖」。用探针入口把设置来源换成
**修复前那五份**,判据在同一份磁盘观测上判红,21 棵控制树无一被覆盖:

```
CONTROL_TREE_GUARD_SETTINGS="$P/TCRN-TMS/.claude/settings.json:$P/TCRN-Design-System/.claude/settings.json:$P/TCRN-AOS/.claude/settings.json:$P/tcrn-workflow/.claude/settings.json:$P/tcrn-workflow-helper/.claude/settings.json" \
  node scripts/control-tree-guard-proof.mjs; echo exit=$?
# → CONTROL_TREE_DENY_COVERAGE_FAILED (CONTROL_TREE_DENY_COVERAGE_INCOMPLETE) / exit 1
# 存档:$OUT/red-1-pre-fix-five-repos.txt
```

## 绿侧

```
pnpm --dir "$P/TCRN-AOS" control-tree:proof; echo exit=$?
node scripts/control-tree-guard-proof.mjs --json > "$OUT/green.json"
# → CONTROL_TREE_DENY_COVERAGE_COMPLETE / exit 0
# 21 棵控制树,Write 与 Edit 两侧均 strict 覆盖
# 存档:$OUT/green.txt、$OUT/green.json
```

## 红侧二:逐规则敏感(不是「整体绿/整体红」的开关)

从**活的** `$P/.claude/settings.json` 现场派生一份删掉「家目录树」那一族规则的副本
(12/26 条),其余 20 棵树仍绿,只有 `~/.tcrn-workflow` 一棵翻红:

```
node -e '
const {readFileSync,writeFileSync}=require("node:fs");
const [src,dst]=process.argv.slice(1); const home=process.env.HOME;
const j=JSON.parse(readFileSync(src,"utf8"));
const drop=(r)=>{const m=/^[A-Za-z]+\((.*)\)$/s.exec(r); if(!m) return false;
  const p=m[1]; return p.startsWith("~/.tcrn-workflow")||p.startsWith("/"+home+"/.tcrn-workflow");};
const before=j.permissions.deny.length;
j.permissions.deny=j.permissions.deny.filter(r=>!drop(r));
writeFileSync(dst, JSON.stringify(j,null,2)+"\n");
console.log("dropped "+(before-j.permissions.deny.length)+" of "+before+" rules");
' "$P/.claude/settings.json" "$OUT/mutant-settings-home-rules-removed.json"

CONTROL_TREE_GUARD_SETTINGS="$OUT/mutant-settings-home-rules-removed.json" \
  node scripts/control-tree-guard-proof.mjs; echo exit=$?
# → FAIL 只有 <local-home>/.tcrn-workflow 一行 / exit 1
# 存档:$OUT/red-2-home-tree-rule-removed.txt
```

## 红侧三:名册那一侧也会动(不是只有规则那一侧)

往名册里追加一个**真实存在、但规则够不着**的目录,同一份规则立刻判红:

```
CONTROL_TREE_GUARD_EXTRA_TREES="$P/governance-archive" \
  node scripts/control-tree-guard-proof.mjs; echo exit=$?
# → FAIL …/governance-archive [probe:extra-trees] Write=UNCOVERED Edit=UNCOVERED / exit 1
# 存档:$OUT/red-3-uncovered-tree-injected.txt
```

## 红侧四:残余——仓内起的会话仍然裸着

`--all-session-roots` 把每一个可能的会话根**各自独立**判一次(不是取并集;并集只会越判越绿,
第一版正是这么写的,于是这个开关恒绿,已改)。平台根 0/21 未覆盖,五个仓根各 21/21 未覆盖:

```
node scripts/control-tree-guard-proof.mjs --all-session-roots; echo exit=$?
# → 平台根 0 uncovered;TCRN-AOS / TCRN-Design-System / TCRN-TMS /
#   tcrn-workflow / tcrn-workflow-helper 各 21 uncovered / exit 1
# 存档:$OUT/red-4-repo-rooted-sessions.txt
```

这一条不是缺陷,是**如实报出来的残余**:修 它需要改五仓的 settings.json,不在本单的文件集内。

## 红侧五:空名册不许判绿

「每一棵控制树都被覆盖」在空集上是恒真的。把平台根与家目录都指到不存在的地方,判据必须
判红而不是「没找到东西所以通过」:

```
CONTROL_TREE_GUARD_PLATFORM_ROOT=/tmp/nonexistent-platform CONTROL_TREE_GUARD_HOME=/tmp/nonexistent-home \
  node scripts/control-tree-guard-proof.mjs; echo exit=$?
# → NO_CONTROL_TREES_FOUND, NO_SETTINGS_SOURCES, NO_FILE_DENY_RULES_FOUND / exit 1
# 存档:$OUT/red-5-empty-world-not-vacuously-green.txt
```

## 判据自身的自检

匹配器是本脚本自己编译的(宿主的匹配器在脚本里够不着),所以它先跑 24 条对抗样本,任何一条
不符就整轮拒绝。**第一次跑就抓到我自己写错的期望**:`/a/**/.*/**` 对 `/a/.hidden/c.json`,
我断言不匹配,实际匹配(`**/` 可以跨零个分量)。样本已按实际行为改正并保留了注释。

```
node scripts/control-tree-guard-proof.mjs --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s).matcherSelfTest,null,2)))'
# → {"samples":24,"failures":[]}
```

## 未打破既有行为

```
node -e 'const p=require("./package.json");console.log(Object.keys(p.scripts).length)'   # 78,JSON 合法
node deploy/aos-local-client/local-purity-proof.mjs > /dev/null; echo exit=$?            # 0
node --test scripts/lib/verify-self-sufficiency.test.mjs                                 # pass 6 fail 0
```

`git diff -- package.json` 里除 `control-tree:proof` 一行外的差异是本次会话开始前就存在的
他人未提交改动(`test` 名单、`scheduler:health`、`parity:proof`、文件末换行),我没有碰。

## 两件必须说清楚的事

### 1. 这是静态覆盖证明,不是宿主真拦的证明

permissions 在会话启动时快照,所以**在本会话内无法**演示宿主真的拒绝一次写;而要演示,就得
把一次真实写指向一棵真实控制树——那正是本单不许做的事。所以这里证的是:磁盘上每一棵控制树的
真实字节,都落在某条已落盘的 deny 规则的匹配集里。活证据属于**下一个在平台根起的会话**。

### 2. 一次现场语义探针,以及它没能回答的部分

本会话的项目根是 `$P/tcrn-workflow`,该仓 settings.json 里已经装着
`Write(**/.tcrn-workspace/**)`。用 Write 工具写向 scratchpad 下一个形如
`…/probe/.tcrn-workspace/probe.txt` 的路径,**没有被拦**。这与「规则按项目根锚定」一致,
也与「该 settings 根本没被本会话加载」一致——两者无法在会话内区分,因为能落在活规则匹配集里的
路径要么属于别的 agent 的文件集,要么会在仓内造出一个 workspace 形状的游离目录(`local-purity`
扫描会把它判成 stray)。

因此修复以**绝对形式 `//` 为主**:它不依赖锚定,两种解释下都成立。另外,规则同时按
**严格(`*`/`**` 不跨点开头分量,picomatch 默认)** 与 **宽松(gitignore 本身的行为,也是
Claude Code 权限文档自称遵循的规范)** 两套语义写全,判据**要求严格侧过**。
猜错时多几条冗余规则,比猜错时漏掉 `~/.tcrn-workflow/tcrn-workflow/.git/**` 这类最深路径便宜。
