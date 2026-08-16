# INC-037 · 复跑清单（ssh-write-observer 判据四缺陷）

全部命令从 **tcrn-workflow 仓根**执行。一条命令重放全部证据：

```sh
sh docs/reports/init-018/INC-037/rerun.sh      # 重建 outputs/ 下全部产物
```

本单**不写治理链**：未调用 `ceremony.mjs`，未执行任何 ssh 写动词，未触碰
`.tcrn-workflow/` 与 `.tcrn-workspace/`。所有 ssh 命令串只作为**字符串样例**进入判据，
一次也没有真的连过主机。

各步退出码统一收在 `outputs/exit-codes.txt`（**不**追加到 `.json` 产物里——仓内
format 门会把每个 `.json` 重新序列化，尾巴上多一行 `exit=0` 会让本证据目录自己变成红门；
第一版就是这么翻的车，已改）。

## 1. 绿：语料自检（96 样例，54 HIT + 42 PASS）

```sh
node scripts/ssh-write-observer.mjs --self-test; echo $?   # → ok:true, exit 0
```

产物 `outputs/self-test-green.json`。样例同时断言 **verdict 与 reason**——只断言 verdict
的语料无法区分「放行」与「因为哪一道检查而放行」，那正是缺陷 4 的温床。

## 2. 绿：分支覆盖证明（每个分支/清单项一条会变红的样例）

```sh
node --test scripts/ssh-write-observer.test.mjs; echo $?   # → 85/85 pass, exit 0
```

产物 `outputs/branch-proof-green.txt`。测试逐条取 `MUTATIONS` 表里的锚点文本，
断言它在源码中**恰好出现一次**（防止重构后证明悄悄失效），改在一份**临时副本**上，
再用语料重跑，断言**声明的那条样例转红**。仓内源文件全程只读。

## 3. 红：同一套证明打在「只有原 21 条样例」的副本上

这一步直接复现缺陷 4，并证明本证明机构**能够变红**：

```sh
node docs/reports/init-018/INC-037/make-weakened-copy.mjs "${TMPDIR:-/tmp}/inc037-weakened.mjs"
INC037_SOURCE="${TMPDIR:-/tmp}/inc037-weakened.mjs" node --test scripts/ssh-write-observer.test.mjs; echo $?
```

实测 **85 项中 65 项失败**，其中 40 余项的失败原文就是
`changed no verdict or reason — the branch is inert`。产物
`outputs/branch-proof-red-weakened-corpus.txt`。

## 4. 红：手工删掉一条判定分支，自检转红

```sh
cp scripts/ssh-write-observer.mjs "${TMPDIR:-/tmp}/inc037-single-branch.mjs"
# 把写原语扫描从「ssh 远端命令串」改回「整行」（即缺陷 3 的原状）
node -e 'const fs=require("node:fs");const p=process.argv[1];const f="      const units = remoteWriteUnits(transport.remote);";const t=fs.readFileSync(p,"utf8");if(!t.includes(f))process.exit(9);fs.writeFileSync(p,t.replace(f,"      const units = remoteWriteUnits(command);"))' "${TMPDIR:-/tmp}/inc037-single-branch.mjs"
node "${TMPDIR:-/tmp}/inc037-single-branch.mjs" --self-test; echo $?   # → 大批 mismatch, exit 1
```

产物 `outputs/red-single-branch-selftest.txt`。

## 5. 修前实现判本单语料（四缺陷的实证）

`pre-fix/ssh-write-observer.mjs` 是改动前的**逐字节副本**
（sha256 `84f2bca39dfc8401e5b532e217bc6f871482f205259c7454e0ef19b73f319403`）。

```sh
node docs/reports/init-018/INC-037/compare-pre-fix.mjs; echo $?
```

实测 96 条里 **45 条判错**：**23 条该记未记**（漏判）+ **22 条不该记却记**（误报）。
产物 `outputs/pre-fix-comparison.json`。该脚本在「修前实现全对」时**退出非零**——
那种情况意味着语料什么也没证明。

## 6. 验收样例（单据点名的两条）

```sh
node scripts/ssh-write-observer.mjs --classify 'env X=1 ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs export --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace | tee /srv/tcrn/governance/x"'
# → {"verdict":"HIT","reason":"ssh-write"}
node scripts/ssh-write-observer.mjs --classify 'ssh tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs status --workspace /srv/tcrn/governance/tcrn-workspace/cross-project/workspace" 2>&1'
# → {"verdict":"PASS","reason":"no-write-primitive"}
```

产物 `outputs/acceptance.txt`。

## 7. hook 输入格式不变（Claude Code 仍可正常调用）

```sh
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"env X=1 ssh tcrn-platform-dev \"rm /srv/tcrn/governance/tcrn-workspace/cross-project/workspace/index.json\""}}' \
  | S2_OBSERVE_LOG=/tmp/s2.log node scripts/ssh-write-observer.mjs; echo $?   # → 0，日志追加一行
```

四类输入（HIT / PASS / 非 Bash 工具 / 非法 JSON）**一律 exit 0**，只有 HIT 落一行日志。
产物 `outputs/hook-contract.txt`；同一契约另有 `node --test` 里的
`hook mode holds its input contract` 一项守着。

## 8. 红：本次顺手修掉的一处静默恒绿（入口守卫）

改动前的 `process.argv[1] === fileURLToPath(import.meta.url)` 在路径经过 symlink 时为假
（macOS 的 `/tmp` → `<local-private-tmp>` 即是），于是 `--self-test` **一条样例都不跑就 exit 0**。

```sh
sh docs/reports/init-018/INC-037/rerun.sh    # 第 8 步；或见 outputs/silent-green-entrypoint.txt
```

产物 `outputs/silent-green-entrypoint.txt`：修前副本经 symlink 调用 → 无输出、exit 0；
修后同样调用 → 92 条样例真跑、`ok:true`。

## 9. 仓内既有门（本单未打破的与本单未负责的）

```sh
node scripts/task.mjs lint            # → LINT_VERIFIED（113 模块，含本单新增文件）
node scripts/task.mjs format-check    # → 红：40 个文件，本单文件 0 个（既有红）
node scripts/task.mjs source          # → 红，既有；见下方遗留项
pnpm test                             # 仓测试套：819 项，818 绿 / 1 红（既有）
```

产物 `outputs/repo-gates.txt`、`outputs/repo-suite.txt`。核对方法（不要靠肉眼扫那 40 个名字）：

```sh
node -e 'const t=require("node:fs").readFileSync("docs/reports/init-018/INC-037/outputs/repo-gates.txt","utf8");
const l=t.split("\n").find(x=>x.includes("FORMAT_MISMATCH"));
const f=JSON.parse(l).error.split(",");
console.log("flagged:",f.length," of which INC-037:",f.filter(p=>p.includes("INC-037")).length)'
# → flagged: 40  of which INC-037: 0
```

`pnpm test` 唯一的红项是 `proof-artifact-generator` 在 **`.claude/settings.json`** 上报
`PROOF_ARTIFACT_UNAPPROVED_SOURCE`——同一个 allowlist 缺项，本单未触碰该文件；
该红在本单动手前的基线里已存在（基线 `source` 输出同样以 `.claude/settings.json` 打头）。

注意：`scripts/task.mjs` 的这几道门与 `pnpm test` **共用一把输出会话锁**，并发跑会得到
`OUTPUT_SESSION_RECOVERY_OWNER_LIVE` 而不是真结果——第一次跑本清单第 9 步就是这么拿到
三个假红的，必须串行。

## 遗留（不属本单文件集，交给名册/依赖负责人）

1. `scripts/policy/source-allowlist.json` 未收录 `scripts/ssh-write-observer.mjs`（S2 时即如此）、
   也未收录本单新增的 `scripts/ssh-write-observer.test.mjs` 与本证据目录。`node scripts/task.mjs source`
   因此继续红——该红在本单动手**之前**就已存在（同一名单里还有 S1.1～S17 的几乎全部证据文件）。
   本单被禁止修改 `scripts/policy/*`，故未处理。
2. 仓测试套只发现 `tests/*.test.mjs`，因此 `scripts/ssh-write-observer.test.mjs`
   **不会**被 `pnpm test` 跑到；它可独立运行（`node --test scripts/ssh-write-observer.test.mjs`）。
   要让它进套，需把文件移入 `tests/` 并补名单项，或在 `package.json` 加一条脚本——两者都在
   本单文件集之外。
