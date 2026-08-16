#!/bin/bash
# INC-038 recheck — 七项文档失真的复核脚本（只读；不写治理树、不碰 .tcrn-workflow/）
# 用法：bash docs/reports/init-018/INC-038/recheck.sh   （cwd 任意；脚本自带绝对路径）
# 每节末尾打印 RED/GREEN 两侧，判据两侧必须能够不同。
#
# 引用被订正文档时一律【内容锚定】（grep 定语句 / awk 划节），不用会随订正块插入而移位的行号——
# 否则这份复核脚本会在它自己促成的那次编辑之后失效。
# 存档两份运行：outputs/recheck-before-correction.txt（订正写入前）
#              outputs/recheck-after-correction.txt （订正写入后；判据结论应完全一致）
#
# ─────────────────────────────────────────────────────────────────────────────
# 订正追记（2026-08-05，TCRN-CROSS-INC-041 · QA §F5；追加不覆写——上面的原说明与
# outputs/ 下那两份原始运行记录一字不动，本块只说明脚本机构改了什么、为什么）
#
# 【发现】本脚本自 INC-034 之后其实一直在读一棵不存在的树。`R` 原为
#   R="$W/docs/reports/init-018"（$W = tcrn-workflow 仓），而 INC-034 已把整个 INIT-018
#   证据包迁到 TCRN-AOS 仓，`tcrn-workflow/docs/reports/` 随之不复存在。于是第 1b、2、5、6、8
#   五节全部对着空气取证：`grep`/`jq`/`sed` 各自报 No such file 到 stderr，
#   而脚本**照样以退出码 0 结束**——第 8 节尤其干净，它的
#       [ -d "$R/$d/payloads" ] || continue
#   把 16 个目录**逐个静默跳过**，只打印两行表头、零行数据，读者看到的是「查过了，没问题」。
#   这正是本平台刚在 INC-040 上栽过的那一课：**空日志恒等于绿**。
#   （复现原状：git 里没有本文件的历史，取原状请看 outputs/ 下两份归档运行。）
#
# 【本次改了四处，都是机构，不是判断】
#   ① `R` 重锚到 TCRN-AOS 仓（原值保留在下方注释里）。这是 INC-034 的迁移应做而未做的那半。
#   ② `PLATFORM` 由脚本自身位置推导，不再写死绝对路径。原写死值把一个真实宿主家目录带进了
#      公开仓（另立 TCRN-CROSS-INC-042 全仓清扫），并且换台机器就跑不了。
#   ③ 新增「0b. 前提自检」：本脚本要读的每个目录/文件在此**逐个点名核对**，缺一即打印
#      `PRECHECK_MISSING …` 并置退出码非零。判据不能只在东西齐全时才有话说。
#   ④ 第 8 节的 `|| continue` 改为**报出来并记账**；脚本末尾 `exit "$RC"`。
#      另把两处 bash-only 写法（进程替换 `<(...)`、`${PIPESTATUS[0]}`）改成 sh 也能跑的形态，
#      因为它原本在 `sh recheck.sh` 下会在第 98 行语法错误直接死掉（实测 exit=2）。
#
# 【一处必须如实说明的数目变化】第 8 节的回执账，订正第 8 条写的是「全部 33 份回执」，
#   修好之后这里打印 **37 行**。差的 4 行是 R1/R2 各 2 份：R1/R2 的证据包**从一开始就在
#   TCRN-AOS 仓**（见 SUMMARY 表格第 8、9 行），旧的 `R` 锚在 tcrn-workflow 仓，`find` 根本
#   够不着它们。所以 33 是**当时那棵树里的全部**，37 是**今天这棵树里的全部**，两者都不假。
#   第 8 条赖以成立的那两个等式不受影响，本次运行里逐行可见：
#     S9 close after=1627 == S10 close before=1627；S16 close after=1639 == S17 close before=1639。
#   订正第 8 条原文一字不动（事件只增不改），此处只作读法说明。
#
# 【判据两侧】改完后：真实工作树上全绿、`INC038_RECHECK_OK`、退出码 0；
#   2026-08-05 在一份影子平台根上（tcrn-workflow / var / deploy 走符号链接，证据包整树拷贝）
#   当场注入三种漂移，每次退出码 1：
#     A 移走 `S13-14/payloads`      → PRECHECK_MISSING（旧版此处 `|| continue`，静默跳过，仍 exit 0）
#     B 移走 `S16/`、`S11/` 整目录  → 8 条 PRECHECK_MISSING
#     C 造出 `tcrn-workflow/docs/reports/init-018/` → PRECHECK_MISSING 旧址又出现了
#   对照基线：**改动前**的本脚本在真实工作树上 `bash recheck.sh` 退出码 **0**，第 8 节零行数据；
#   `sh recheck.sh` 退出码 **2**（第 98 行进程替换语法错误，第 7、8 两节根本没跑到）。
# ─────────────────────────────────────────────────────────────────────────────
set -u

# PLATFORM 由本脚本位置推导：<平台根>/TCRN-AOS/docs/reports/init-018/INC-038/recheck.sh
SELF_DIR=$(cd "$(dirname "$0")" && pwd)
PLATFORM=$(cd "$SELF_DIR/../../../../.." && pwd)
W="$PLATFORM/tcrn-workflow"
# 原值（INC-034 之前成立，今日是死路径，留作记录）：R="$W/docs/reports/init-018"
R="$PLATFORM/TCRN-AOS/docs/reports/init-018"
R_OLD="$W/docs/reports/init-018"
RC=0

hr() { printf '\n========== %s ==========\n' "$1"; }
miss() { echo "PRECHECK_MISSING $*"; RC=1; }   # 标记刻意与第 6 节那句 "MISSING: /Users/<you>/…" 区分开

hr "0. 复核时点（与挂钟无关的参照一并打印）"
date -u "+recheck at (UTC): %Y-%m-%dT%H:%M:%SZ"
stat -f "%Sm  %N" -t "%Y-%m-%dT%H:%M:%S%z" \
  "$R/S10/notes.md" "$R/S11/init018-attribution.json" "$R/S11/report.md" \
  "$R/S12/notes.md" "$R/SUMMARY.md" "$PLATFORM/var/tcrn-otel/ceremony-spans.jsonl" 2>&1

hr "0b. 前提自检（INC-041）：本脚本下面要读的东西，逐个点名核对——缺一即 MISSING + 非零"
echo "  平台根推导为：$PLATFORM"
echo "  证据包根（新址）：$R"
echo "  旧址（应当不存在）：$R_OLD"
[ -d "$R" ] || miss "证据包根不存在 $R（本脚本无从取证）"
if [ -d "$R_OLD" ]; then
  miss "旧址 $R_OLD 又出现了——INC-034 的迁移被某个默认 --out-dir 造了回来（见 SUMMARY 第 9 条 b/c 两项）"
else
  echo "  OK 旧址不存在（INC-034 迁移仍成立）"
fi
for f in \
  "$R/S10/notes.md" "$R/S10/commands.md" \
  "$R/S11/init018-attribution.json" "$R/S11/report.md" \
  "$R/S12/notes.md" "$R/S12/bench-3000.json" \
  "$R/S16/catalog.md" "$R/S4/codex-config-incremental.diff" \
  "$R/SUMMARY.md" \
  "$W/packages/core/src/workspace.ts" "$W/packages/protocol/src/index.ts" \
  "$W/docs/releases/0.8.0.md" "$W/scripts/token-attribution.mjs" \
  "$PLATFORM/TCRN-AOS/deploy/aos-local-client/ceremony.mjs" \
  "$PLATFORM/var/tcrn-otel/ceremony-spans.jsonl"
do
  [ -f "$f" ] || miss "取证对象不存在 $f"
done
# 第 8 节要遍历的 16 个故事目录：此处先点名，缺哪个当场说，不在循环里悄悄 continue
S8_DIRS="S1.2 S2 S3 S4 S5.1 S6 S7 S8 S9 S10 S11 S12 S13-14 S15 S16 S17"
for d in $S8_DIRS; do
  [ -d "$R/$d" ] || miss "第 8 节要读的故事目录不存在 $R/$d"
done
[ "$RC" = 0 ] && echo "  OK 前提自检全过（$RC）"

hr "1a. export 的 canonical 由事件字节决定（源码，不是记忆）"
grep -n "export async function exportWorkspace" "$W/packages/core/src/workspace.ts"
sed -n '3272,3296p' "$W/packages/core/src/workspace.ts"
echo "--- 对照：validate/work-list 走的物化视图 index.json（workspace.ts:1643）---"
sed -n '1641,1644p' "$W/packages/core/src/workspace.ts"
echo "--- 上限常量与判据 ---"
grep -n "maxCanonicalBytes" "$W/packages/protocol/src/index.ts"
sed -n '274,280p' "$W/packages/protocol/src/index.ts"

hr "1b. S12 notes 自相矛盾（实测表 vs 边界实测句 vs bench-3000.json）"
echo "--- 内容锚定（不用行号；订正块插入后仍成立）---"
grep -n '^| export | 421 |' "$R/S12/notes.md"
grep -n '^- 边界实测：' "$R/S12/notes.md"
echo "--- bench-3000.json 的 export 记录 ---"
jq -r '.verbs.export | "allOk=\(.allOk)  reasonCode=\(.reasonCode)  medianMs=\(.medianMs)"' "$R/S12/bench-3000.json"

hr "1c. 此事非新发现：0.8.0 早已实测公布（含 event-list 缓解）"
sed -n '13,15p;17,25p' "$W/docs/releases/0.8.0.md"
grep -n "event-list" "$W/docs/releases/0.8.0.md" | head -3

hr "2. S11 cache_creation：byLayer 丢了字段，逐模型行没丢"
echo "--- byLayer 各层携带的键（无 cacheCreation）---"
jq -r '.byLayer | to_entries[] | "\(.key): \(.value|keys|join(","))"' "$R/S11/init018-attribution.json"
echo "--- 同一份文件的逐会话/逐模型 cacheCreation ---"
jq -r '.sessions[] | .file as $f | (.byModel | to_entries[] | "\($f)\t\(.key)\tcacheCreation=\(.value.cacheCreation)")' "$R/S11/init018-attribution.json"
echo "--- 合计与分层合计 ---"
jq -r '[.sessions[].byModel | to_entries[] | .value.cacheCreation] | add | "TOTAL cacheCreation = \(.)"' "$R/S11/init018-attribution.json"
jq -r '
  (.sessions[] | .byModel | to_entries[] | {m:.key, c:.value.cacheCreation}) as $x | [$x] | .[]
  | "  \(.m): \(.c)"' "$R/S11/init018-attribution.json" | sort | awk -F': ' '{s[$1]+=$2} END {for (k in s) printf "%s total=%d\n", k, s[k]}'
echo "--- 解析器本身并未丢（scripts/token-attribution.mjs）---"
grep -n "cache_creation_input_tokens\|cacheCreation" "$W/scripts/token-attribution.mjs"
echo "--- 解析器不产出 byLayer（byLayer 是报表侧手工汇总）---"
grep -c "byLayer" "$W/scripts/token-attribution.mjs"

hr "3. S10 readback span：dry-run 在 emit 之前 continue"
grep -n "if (dryRun)" "$PLATFORM/TCRN-AOS/deploy/aos-local-client/ceremony.mjs"
sed -n '228,240p;272,276p' "$PLATFORM/TCRN-AOS/deploy/aos-local-client/ceremony.mjs"
echo "--- S10 自己的重跑配方只有 dry-run（内容锚定）---"
grep -n 'ceremony.mjs --payload' "$R/S10/commands.md"
echo "  读法："
echo "   · 第 19 行是「ceremony 四点 span」那一节唯一的 span 采集跑 —— 带 --dry-run，到不了 :274 的 emit。"
echo "   · 第 9/10 行属 §5 链上仪式（受治写），两条都不设 TCRN_OTEL_SINK；"
echo "     且第 10 行那次 activate 从未执行过（S10/payloads 无 activate.receipt.json，见第 8 节），"
echo "     而当时默认 sink 目录尚未创建（S10 notes「实现缺陷修复」），即便跑了 span 也会被吞。"
echo "   · 故本单归档路径中没有任何一条能产出 ceremony.readback。"
echo "--- 默认 sink 现况：按 span 类型计数 ---"
jq -r '.span' "$PLATFORM/var/tcrn-otel/ceremony-spans.jsonl" | sort | uniq -c
echo "--- readback 记录的时点（判断它们是否晚于 S10 收口）---"
jq -r 'select(.span=="ceremony.readback") | "\(.at)  \(.verb)"' "$PLATFORM/var/tcrn-otel/ceremony-spans.jsonl"

hr "4. 引擎侧 otel-spans.ts 是死代码（对照：ceremony-spans.mjs 有调用方）"
echo "--- RED 侧：otel-spans / emitVerbSpan 的调用方（应为空）---"
grep -rn "otel-spans\|emitVerbSpan\|engineSinkPath" "$W/packages" "$W/scripts" "$W/tests" 2>/dev/null | grep -v node_modules | grep -v "packages/cli/src/otel-spans.ts"
echo "(以上为空 = 无调用方 = 未接线)"
echo "--- GREEN 侧：ceremony-spans.mjs 确有调用方 ---"
grep -rn "ceremony-spans" "$PLATFORM/TCRN-AOS/deploy/aos-local-client/ceremony.mjs"

hr "5. S16 三档不分割 35 项"
echo "--- 编目总数（A+B+C+D 行数）---"
awk '/^\| A[0-9]+ \|/ {a++} /^\| B[0-9]+ \|/ {b++} /^\| C[0-9]+ \|/ {c++} /^\| D[0-9]+ \|/ {d++} END {printf "A=%d B=%d C=%d D=%d TOTAL=%d\n", a,b,c,d,a+b+c+d}' "$R/S16/catalog.md"
echo "--- 「仍在」那行自己列了哪些（内容锚定；数一遍）---"
grep -n '^A1–A6、B1–B4' "$R/S16/catalog.md"
echo "  A1-A6=6  B1-B4=4  B7,B8,B11=3  C1,C3,C4=3  D1-D12=12  D14=1  -> 29（表头写 15）"
echo "--- B10 是否出现在 S16.2 的三档【原文】里？（排除以 '>' 开头的订正块）---"
awk '/^## S16.2 三档起草/{f=1} /^## S16.3/{f=0} f && $0 !~ /^>/' "$R/S16/catalog.md" \
  | grep -n "B10" || echo "  B10 未出现在 S16.2 三档原文中（编目里它是存在的，见下）"
grep -n "^| B10 " "$R/S16/catalog.md"

hr "6. S4 归档态 diff 不可直接应用"
D="$R/S4/codex-config-incremental.diff"
echo "--- 占位符计数 ---"
printf "  ADDED(+) 行内 /Users/<you> 个数 = %s\n" "$(grep '^+' "$D" | grep -o '/Users/<you>' | wc -l | tr -d ' ')"
printf "  上下文行内 /Users/<you> 个数 = %s\n" "$(grep -v '^+' "$D" | grep -o '/Users/<you>' | wc -l | tr -d ' ')"
echo "--- 两条 pnpm 路径字面量是否存在 ---"
# INC-041：原为 grep -c … <(grep '^+' "$D") —— 进程替换是 bash-only，`sh recheck.sh`
# 会在这一行语法错误直接死掉（实测 exit=2，且死在第 6 节，后两节根本没跑）。改用临时文件。
ADDED="${TMPDIR:-/tmp}/inc038-s4-added.txt"
grep '^+' "$D" > "$ADDED"
grep -c 'command = "/Users/<you>/.nvm/versions/node/v24.16.0/bin/pnpm"' "$ADDED"
[ -e "/Users/<you>/.nvm/versions/node/v24.16.0/bin/pnpm" ] && echo "  EXISTS(!!)" || echo "  MISSING: /Users/<you>/.nvm/versions/node/v24.16.0/bin/pnpm"
ls -la "$HOME/.nvm/versions/node/v24.16.0/bin/pnpm" 2>&1 | sed 's/^/   真实路径: /'
echo "--- 红/绿两侧：默认 fuzz vs -F0 ---"
SP="${TMPDIR:-/tmp}/inc038-s4-recheck"
rm -rf "$SP"; mkdir -p "$SP/.codex"
python3 - "$SP/.codex/config.toml" <<'PY'
import os, sys
p = sys.argv[1]
# INC-041：这两行原本写死了取证当日那台机器的家目录，把一个真实宿主路径带进了公开仓
# （全仓清扫另立 TCRN-CROSS-INC-042）。改为从 $HOME 取——判据语义不变：本节要证的是
# 「上下文行与实际配置不一致时，默认 fuzz 仍静默接受」，只要这里的值 ≠ 归档 diff 里的
# 字面占位符 /Users/<you>/… 即可，任何真实家目录都满足。
home = os.path.expanduser("~")
lines = ["# scratch reproduction of ~/.codex/config.toml (structure only)\n"]
lines += [f"# filler line {i}\n" for i in range(1, 197)]
lines += [
  "[mcp_servers.codegraph]\n",
  f'command = "{home}/.nvm/versions/node/v24.16.0/bin/pnpm"\n',
  f'args = ["--dir", "{home}/Code/TCRN Platform/TCRN-TMS", "exec", "codegraph", "serve", "--mcp", "--no-watch"]\n',
  "startup_timeout_sec = 120.0\n", "\n",
  "[mcp_servers.node_repl]\n",
  'command = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl"\n',
  "startup_timeout_sec = 120.0\n",
]
open(p, "w").writelines(lines)
PY
cp "$SP/.codex/config.toml" "$SP/.codex/config.toml.orig"
# INC-041：原写法是 `patch … | sed …; echo exit=${PIPESTATUS[0]}` —— PIPESTATUS 是 bash-only，
# 在 sh 下静默变成空串（打印 "exit="），而退出码正是本节唯一的判据。改为先落文件再取 $?，
# 与本平台「要退出码就别用管道」的量具纪律一致。
PLOG="${TMPDIR:-/tmp}/inc038-s4-patch.log"
echo "  [A] patch -p1 （默认 fuzz）:"
( cd "$SP" && patch -p1 < "$D" > "$PLOG" 2>&1 ); pa=$?
sed 's/^/    /' "$PLOG"; echo "    exit=$pa"
echo "  [A] 落盘结果（注意 /Users/<you> 原样进了配置）:"
grep -n "codegraph-ds" -A2 "$SP/.codex/config.toml" | sed 's/^/    /'
cp "$SP/.codex/config.toml.orig" "$SP/.codex/config.toml"
echo "  [B] patch -p1 -F0 （关闭 fuzz）:"
( cd "$SP" && patch -p1 -F0 < "$D" > "$PLOG" 2>&1 ); pb=$?
sed 's/^/    /' "$PLOG"; echo "    exit=$pb"
[ "$pa" = 0 ] || miss "第 6 节前提变了：默认 fuzz 这次没有静默接受（exit=$pa）"
[ "$pb" = 0 ] && miss "第 6 节前提变了：-F0 这次居然接受了（exit=$pb）"

hr "7. S17 archify 未安装"
echo "--- 平台/用户 skills 目录名册 ---"
ls "$PLATFORM/.claude/skills" 2>&1 | sed 's/^/  platform: /'
ls "$HOME/.claude/skills" 2>&1 | sed 's/^/  user:     /'
echo "--- 全平台搜 archify（排除 node_modules）---"
find "$PLATFORM" -maxdepth 6 -iname "archify*" -not -path "*/node_modules/*" 2>/dev/null | sed 's/^/  /'
echo "  （以上为空 = 平台内无 archify）"
echo "--- 它实际在哪 ---"
ls -d /tmp/archify-trial /private/tmp/archify-trial 2>&1 | sed 's/^/  /'
ls "/tmp/archify-trial/archify/SKILL.md" 2>&1 | sed 's/^/  /'
echo "--- 对照（GREEN 侧）：真安装物长这样 ---"
ls -d "$PLATFORM/.claude/skills/tcrn-workflow-helper" 2>&1 | sed 's/^/  /'

hr "8. SUMMARY 的「激活异常」：回执算术推翻它"
echo "--- 哪些故事缺 activate.receipt.json ---"
# INC-041：原为 `[ -d "$R/$d/payloads" ] || continue` —— 在 INC-034 迁移之后 $R 整棵树都不存在，
# 这一行把 16 个目录逐个【静默】跳过，本节只打印两行表头、零行数据，而脚本仍 exit 0。
# 「空日志恒等于绿」。现在：目录不在就报出来并置 RC=1，让「查不到」与「查过没问题」不再同形。
seen=0
for d in $S8_DIRS; do
  if [ ! -d "$R/$d/payloads" ]; then
    miss "第 8 节：$R/$d/payloads 不存在——本节的回执账在这一格是空的，不是「没问题」"
    continue
  fi
  seen=$((seen + 1))
  a=$([ -f "$R/$d/payloads/activate.receipt.json" ] && echo YES || echo "NO ")
  printf "  %-8s activate.receipt=%s  files: %s\n" "$d" "$a" "$(ls "$R/$d/payloads" | tr '\n' ' ')"
done
echo "  （实际读到 $seen 个 payloads 目录；本节判据要求 >0，为 0 即本节没有取到任何证据）"
[ "$seen" -gt 0 ] || miss "第 8 节一个 payloads 目录都没读到——本节结论此刻无证据支撑"
echo "--- 全部回执按时间排序的链版本账（before/after 应处处相接）---"
# INC-041：原为 `find -print0 | while read -r -d '' …`（-d 是 bash-only），且账上零行时
# 只打印一行表头就过去了——同样是「空日志恒等于绿」。现在落文件后数行数，为 0 即报。
LP="${TMPDIR:-/tmp}/inc038-receipt-paths.txt"
LT="${TMPDIR:-/tmp}/inc038-receipt-ledger.tsv"
( cd "$R" && find . -path '*/payloads/*.receipt.json' -print ) > "$LP" 2>/dev/null
: > "$LT"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  rel=${f#./}
  jq -r --arg f "$rel" '[((.startedAt//"-")), $f, (.ok|tostring), (.reasonCode//"-"), ((.chainBefore.version//"-")|tostring), ((.chainAfter.version//"-")|tostring)] | @tsv' "$R/$rel" 2>/dev/null >> "$LT"
done < "$LP"
ledger_rows=$(wc -l < "$LT")
ledger_rows=$(echo "$ledger_rows" | tr -d ' ')
sort "$LT" | awk 'BEGIN{printf "  %-22s %-40s %-6s %-32s %6s %6s\n","startedAt","receipt","ok","reasonCode","before","after"} {printf "  %-22s %-40s %-6s %-32s %6s %6s\n",$1,$2,$3,$4,$5,$6}'
echo "  （账上 $ledger_rows 行回执）"
[ "$ledger_rows" -gt 0 ] || miss "第 8 节回执账为空——下面那两行结论此刻没有账目支撑"
echo
echo "  判据：S9 close.after=1627 == S10 close.before=1627  -> 其间零事件 -> STORY-150 激活从未执行"
echo "        S16 close.after=1639 == S17 close.before=1639 -> 其间零事件 -> STORY-154 激活从未执行"

hr "完"
if [ "$RC" = 0 ]; then
  echo "INC038_RECHECK_OK 全部取证对象在位（前提自检 + 第 8 节 $seen 个 payloads / $ledger_rows 行回执）"
else
  echo "INC038_RECHECK_INCOMPLETE 有取证对象缺失（见上面 PRECHECK_MISSING 行）——本次运行的结论不完整"
fi
exit "$RC"
