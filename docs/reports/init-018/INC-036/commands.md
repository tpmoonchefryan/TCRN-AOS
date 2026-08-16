# TCRN-AOS-INC-036 — parity:proof 的红证同义反复 + 白名单有洞：修复与红证

修复文件：`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`
新增测试：`TCRN-AOS/deploy/aos-local-client/parity-proof.test.mjs`

本目录的每条命令都可原样重跑（`AOS` 与 `INC` 两个变量先设一次）。所有原始输出在 `outputs/`。

```bash
AOS="$(git -C . rev-parse --show-toplevel 2>/dev/null || pwd)"   # 或直接：AOS=<平台根>/TCRN-AOS
INC="$AOS/docs/reports/init-018/INC-036"
```

---

## 0. 四项缺陷各自被什么修掉

| INC-036 缺陷 | 修法 | 判据现在住在哪 |
| --- | --- | --- |
| ① 红证同义反复（跑判据的副本） | 全文件只剩**一个**判定 `judgeParity()`；红侧一律「构造输入 → 调用它 → 读它的裁决」。`redProof()` 里没有任何判据，只有一次调用 | `parity-proof.mjs` → `judgeParity()` / `redProof()` |
| ② 豁免只按名字匹配，两侧同时消失即恒绿 | 白名单条目带 `missingFrom` 方向；豁免只对该方向生效，且**同时断言**该服务器仍在另一侧存在（`ALLOWLIST_ENTRY_VANISHED`） | `judgeParity()` 段 (b)(c) |
| ③ 名册是观测并集 | `ANCHOR_ROSTER` 声明最小集（平台 `.mcp.json` 宣称携带的五个服务器 + 各自必须出现的侧）；锚缺失即 `ANCHOR_SERVER_MISSING`，**与有没有缺口无关** | `judgeParity()` 段 (d) |
| ④ 从不校验 command/args | 两侧都解析成 `{command,args}` 并判：命令非空、args 是字符串数组、无占位符、绝对命令须存在、`--path`/`--dir` 须指向真实目录 | `judgeSpec()` |

白名单原有三条的**日期与理由逐字保留**，只加了 `missingFrom: "codex"`；单元测试 `the shipped allowlist keeps its three pre-INC-036 reasons and dates` 钉住这一点。

---

## 1. 绿：对当前真实状态仍给出正确判定

```bash
pnpm --dir "$AOS" parity:proof
```

`outputs/green-canonical.json`（全量）与 `outputs/green-canonical-summary.txt`（摘要）。

结果 `ok=true reasonCode=PARITY_VERIFIED`，退出码 0。现状被正确读出：Codex 侧缺 `codegraph-ds` / `codegraph-aos` / `tcrn-workflow-aos-read`，三者都在白名单内且方向正确（`missingFrom=codex`），故不计缺陷；`codegraph-tms`（Codex 侧名为 `codegraph`，归一后同名）与 `tcrn-workflow` 两侧同持。

摘要里两行是本次修复的核心：

```
IDENTITY CONTROL (must mirror the live verdict, i.e. must NOT be red here)
  wentRed=false reasonCode=PARITY_VERIFIED codes=-
```

`HARNESS_MIRRORS_LIVE_VERDICT` 是**恒红的反面**：不改任何输入时红侧机构必须复现活判定。它和七个红侧同时为真，才说明这套机构两侧都能动。

---

## 2. 红侧一：旧判据在这些世界里是绿的（同一输入，前后对照）

这是「红测是不是真的」的唯一硬证据——修复前的判据必须在**同一份输入**上判绿。
`old-predicate-replay.mjs` 把修复前的判定（原文件 96–114 行，逐条复刻在脚本注释下方）和 `judgeParity`
并排跑在同一批世界上。它只读真配置、只在内存里改，什么都不写。

```bash
node "$INC/old-predicate-replay.mjs"
```

`outputs/old-vs-new-replay.json`，退出码 0（每行都符合预期）。

| world | 对应缺陷 | 旧判据 | 新判据 | 新判据点名 |
| --- | --- | --- | --- | --- |
| `unmutated-control` | 对照组 | green | green | — |
| `real-drift` | 对照组：旧判据本来抓得住的漂移不得丢 | **red** | **red** | `UNALLOWLISTED_GAP:codegraph-xyz` |
| `allowlisted-vanished-both-sides` | ② | **green** | **red** | `ALLOWLIST_ENTRY_VANISHED` + `ANCHOR_SERVER_MISSING`：`codegraph-ds` |
| `allowlist-direction-flipped` | ② | **green** | **red** | `ALLOWLIST_DIRECTION_MISMATCH` + `ALLOWLIST_ENTRY_VANISHED` + `ANCHOR_SERVER_MISSING` |
| `anchor-lost-from-both-sides` | ③ | **green** | **red** | `ANCHOR_SERVER_MISSING:tcrn-workflow` |
| `placeholder-in-path` | ④ | **green** | **red** | `SPEC_PLACEHOLDER:codegraph-aos` |
| `dangling-path` | ④ | **green** | **red** | `SPEC_PATH_NOT_A_DIRECTORY:codegraph-aos` |

第二行是有意留的：修复不得以丢失旧覆盖为代价。

---

## 3. 红侧二：门自己内嵌的七个红侧（构造输入 → 真判据）

第 1 步那次绿跑里已经全部跑过，见 `outputs/green-canonical-summary.txt` 的 `RED CASES` 段。
每一个都是**输入变异**后调用 `judgeParity()`，没有判据副本：

| 红侧 id | 变的是什么输入 | 得到的 defect code |
| --- | --- | --- |
| `UNALLOWLISTED_DRIFT_MUST_RED` | Claude 侧多一个 `codegraph-xyz` | `UNALLOWLISTED_GAP` |
| `ALLOWLIST_ENTRY_DROPPED_MUST_RED` | 白名单去掉 `codegraph-ds` 条目 | `UNALLOWLISTED_GAP` |
| `ALLOWLISTED_SERVER_VANISHED_BOTH_SIDES_MUST_RED` | Claude 侧删掉 `codegraph-ds`（两侧同时消失） | `ALLOWLIST_ENTRY_VANISHED` + `ANCHOR_SERVER_MISSING` |
| `ALLOWLIST_DIRECTION_FLIPPED_MUST_RED` | `codegraph-ds` 改成只在 Codex 侧 | `ALLOWLIST_DIRECTION_MISMATCH` + `ALLOWLIST_ENTRY_VANISHED` + `ANCHOR_SERVER_MISSING` |
| `PLACEHOLDER_IN_SPEC_MUST_RED` | `codegraph-aos` 的 `--path` 换成 `<local-home>/…` | `SPEC_PLACEHOLDER` |
| `DANGLING_PATH_IN_SPEC_MUST_RED` | `codegraph-aos` 的 `--path` 指向不存在的目录 | `SPEC_PATH_NOT_A_DIRECTORY` |
| `CODEX_SIDE_SPEC_EMPTY_MUST_RED` | Codex 侧 `codegraph.command` 清空 | `SPEC_COMMAND_EMPTY`（归一后以 `codegraph-tms` 之名） |

---

## 4. 红侧三：端到端——真 CLI 读真文件路径，只是文件换成夹具

上面两步都在进程内。这一步走完整通路：文件 → 解析器 → `judgeParity` → 退出码。

夹具是**生成**的，不入库：committed 一份本机 `.mcp.json` 的拷贝会把宿主路径带进公开仓（INC-037 的原样重演），
而且冻结的拷贝会慢慢不再代表真文件。每个夹具与真文件**只差一项**，差的那项由生成器自己打印。

```bash
FIX="$(mktemp -d)"
node "$INC/make-fixtures.mjs" "$FIX"          # → outputs/fixtures-manifest.txt

run() { name="$1"; shift; node "$AOS/deploy/aos-local-client/parity-proof.mjs" "$@" \
  > "$INC/outputs/e2e-$name.json" 2>&1; echo "$name exit=$?"; }

run fixture-control        --claude-mcp "$FIX/mcp-control.json"
run fixture-drift          --claude-mcp "$FIX/mcp-drift.json"
run fixture-vanished       --claude-mcp "$FIX/mcp-vanished.json"
run fixture-placeholder    --claude-mcp "$FIX/mcp-placeholder.json"
run fixture-dangling       --claude-mcp "$FIX/mcp-dangling.json"
run fixture-codex-dangling --codex-config "$FIX/codex-dangling.toml"

# fixture 模式禁止落 evidence 收据
node "$AOS/deploy/aos-local-client/parity-proof.mjs" --emit --claude-mcp "$FIX/mcp-drift.json" \
  > /dev/null 2> "$INC/outputs/e2e-emit-refused.txt"; echo "emit exit=$?"
# 真值源读不到时的行为
node "$AOS/deploy/aos-local-client/parity-proof.mjs" --claude-mcp "$FIX/does-not-exist.json" \
  > "$INC/outputs/e2e-source-unreadable.json" 2>&1; echo "unreadable exit=$?"
rm -rf "$FIX"
```

判读方式（`ok`/`reasonCode` 在 fixture 模式下恒为 `false`/`PARITY_PROOF_FIXTURE_MODE`，**这是设计**——
见下方「夹具不能造绿」；要看判定本身，读 `.observation`）：

```bash
cd "$INC/outputs" && for f in e2e-fixture-*.json; do node -e '
const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
console.log(process.argv[1].padEnd(30),"proofOk="+o.ok,"| judgement="+o.observation.reasonCode,"|",
  (o.observation.defects.map(d=>d.code+":"+d.side+":"+d.server).join(", ")||"(no defects)"))' "$f"; done
```

实测：

```
e2e-fixture-control.json       proofOk=false | judgement=PARITY_VERIFIED         | (no defects)
e2e-fixture-drift.json         proofOk=false | judgement=PARITY_DRIFT_DETECTED   | UNALLOWLISTED_GAP:codex:codegraph-xyz
e2e-fixture-vanished.json      proofOk=false | judgement=PARITY_DRIFT_DETECTED   | ALLOWLIST_ENTRY_VANISHED:claude:codegraph-ds, ANCHOR_SERVER_MISSING:claude:codegraph-ds
e2e-fixture-placeholder.json   proofOk=false | judgement=PARITY_DRIFT_DETECTED   | SPEC_PLACEHOLDER:claude:codegraph-aos
e2e-fixture-dangling.json      proofOk=false | judgement=PARITY_DRIFT_DETECTED   | SPEC_PATH_NOT_A_DIRECTORY:claude:codegraph-aos
e2e-fixture-codex-dangling.json proofOk=false | judgement=PARITY_DRIFT_DETECTED  | SPEC_PATH_NOT_A_DIRECTORY:codex:codegraph-tms
```

第一行是对照组：**逐字节等于真文件的夹具，判定仍是 `PARITY_VERIFIED`**——所以后面五行的红来自那一项改动，
不是来自「走了夹具通路」。

`--emit` 在 fixture 模式被拒（`outputs/e2e-emit-refused.txt`，退出码 1）：
```
refusing --emit in fixture mode: the artifact would not describe this platform
```

**夹具不能造绿**：只要出现 `--claude-mcp` / `--codex-config`，`TRUTH_SOURCES_ARE_CANONICAL` 即不满足，
整份证明 `ok=false`、`reasonCode=PARITY_PROOF_FIXTURE_MODE`，且 `--emit` 被拒。这个缝只能把门变红，不能把门变绿。

（`e2e-fixture-vanished.json` 里 `RED_ALLOWLIST_ENTRY_DROPPED_MUST_RED` 未满足是**正确**的：那个世界里
`codegraph-ds` 已从 Claude 侧删除，去掉它的白名单条目自然不再产生缺口。红侧机构是对**当次基线**求值的，
不是写死的答案——这恰好是它没有被硬编码的又一处证据。）

---

## 5. 单元测试（27 例，全部对字面量，不读平台文件）

```bash
node --test "$AOS/deploy/aos-local-client/parity-proof.test.mjs"
```

`outputs/unit-tests.txt`，27/27 通过。首例是刻意放在最前的**绿对照**（`a balanced world with a correctly
directed exemption is green`）：只有红例的套件证明的是一道恒红的门。另外三例专钉 INC-036 缺陷 ①：

- `redProof reports the verdict of judgeParity, and can report a green one` — 红侧机构能报绿；
- `redProof's answer follows the inputs, so it is not a canned red` — **同一个变异 + 两份白名单 → 两个不同答案**；若 `redProof` 自带判据（原缺陷），豁免不可能改变结果；
- `redProof does not mutate the baseline it was handed` — 红侧之间互不污染。

## 6. 既有行为未破

```bash
node --test \
  "$AOS/deploy/aos-local-client/local-purity-predicates.test.mjs" \
  "$AOS/deploy/aos-local-client/doc-topology-predicates.test.mjs" \
  "$AOS/deploy/aos-local-client/key-occupancy.test.mjs" \
  "$AOS/deploy/aos-local-client/remote-read-mcp-predicates.test.mjs" \
  "$AOS/deploy/aos-local-client/fallback-cli.test.mjs" \
  "$AOS/scripts/lib/evidence-hygiene.test.mjs"
```

`outputs/neighbouring-tests.txt`：147/147 通过，退出码 0。
`parity-proof.mjs` 在本仓无其他导入者（`grep -rl "ALLOWLIST\|aos-instrument-parity"` 只命中它自己与它产出的收据）。

## 7. 遗留项（不在本单文件集内，未动）

1. `TCRN-AOS/package.json` 的 `test` 脚本未收录 `parity-proof.test.mjs`，`verify` 也未收录 `parity:proof`——
   package.json 由专人处理，本单未改。**未接入 `test` 的测试文件寿命等于写它那天**，建议随依赖/名册批次补上。
2. `TCRN-AOS/evidence/aos-instrument-parity.json` 仍是 `v1` schema 的旧收据（本单未跑 `--emit`，因为该文件不在本单文件集内）。
   重新落收据的命令是 `pnpm --dir "$AOS" parity:proof --emit`。
3. `ALLOWLIST_ENTRY_OBSOLETE` 是新加的收缩压力：STORY-146 S4.2 把 Codex 侧接上之后，若不同步删掉对应白名单条目，本门会红并点名要删哪条。这是有意的。
