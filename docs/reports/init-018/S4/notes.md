# S4 notes — STORY-146 · Codex 名册缺口（代办点 S4.1）

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- **S4.1 已生成** `~/.codex/config.toml` 增量 diff：`docs/reports/init-018/S4/codex-config-incremental.diff`（统一格式，路径已 scrubbed 为 `<local-home>
- diff 只加两块：`[mcp_servers.codegraph-ds]` 与 `[mcp_servers.codegraph-aos]`，**复用 TMS 仓内 codegraph 二进制**，以 `--path` 指向 `TCRN-Design-System` / `TCRN-AOS`（同 Claude 侧 `.mcp.json` 指法、同 Codex 侧现有 `codegraph` 块的 command/args/startup_timeout_sec 形态）。
- **未应用**：config.toml 是用户级配置，只读；应用是 S4.2，归审查层代办（MIN-058）。
- **待门**：S4.2 应用 → 三服务器 `status` 实测 → ⑪ parity 白名单收缩，均由审查层完成。

## ⚠ 订正（2026-08-05，核验层 · TCRN-CROSS-INC-038）：归档态 diff **不可**直接 `patch -p1` 应用

原文保留可见。上面第 7 行「路径已 scrubbed 为 `<local-home>
而这个后果会静默地把一份坏配置装进用户级 `~/.codex/config.toml`。复核：`INC-038/recheck.sh` 第 6 节。

**红/绿两侧实测**（scratch 复现件，结构同真配置但用真实 home 路径）：

```
patch -p1      < codex-config-incremental.diff   -> exit 0，"patching file"，无任何告警   ← 静默接受
patch -p1 -F0  < codex-config-incremental.diff   -> exit 1，"1 out of 1 hunks failed"，落 .rej
```

`patch(1)` 的**默认 fuzz** 允许上下文行不精确匹配。本 diff 的上下文行里带着 2 个
`<local-home> 占位符，任何真实的 `config.toml` 都不会有这两行——精确匹配必失败；
可默认 fuzz 把它们当作可容忍的偏差**吞掉**，于是 hunk 照样落地，退出码 0，不打印警告。
落地后的文件长这样（实测截取）：

```toml
[mcp_servers.codegraph-ds]
command = "<local-home>/.nvm/versions/node/v24.16.0/bin/pnpm"
args = ["--dir", "<local-platform-root>/TCRN-TMS", "exec", "codegraph", "serve", "--mcp", "--no-watch", "--path", "<local-platform-root>/TCRN-Design-System"]
```

`<local-home>/…` 是**字面路径**，文件系统上不存在（实测 MISSING）。两个新 MCP 服务器会在
Codex 启动时因 command 不存在而起不来——而 `patch` 已经报了 0，应用者不会去看。

### 应用前必须替换的占位符清单（6 处，全在 `+` 行）

| # | diff 行 | 键 | 占位符 | 应替换为（本机实测值） |
| --- | --- | --- | --- | --- |
| 1 | +8 | `[mcp_servers.codegraph-ds].command` | `<local-home>/.nvm/versions/node/v24.16.0/bin/pnpm` | `$HOME/.nvm/versions/node/v24.16.0/bin/pnpm`（本机存在，指向 corepack 的 `pnpm.js`） |
| 2 | +9 | `[mcp_servers.codegraph-ds].args[1]` | `<local-platform-root>/TCRN-TMS` | 平台根下的 `TCRN-TMS`（二进制宿主仓） |
| 3 | +9 | `[mcp_servers.codegraph-ds].args[-1]` | `<local-platform-root>/TCRN-Design-System` | 平台根下的 `TCRN-Design-System` |
| 4 | +13 | `[mcp_servers.codegraph-aos].command` | `<local-home>/.nvm/versions/node/v24.16.0/bin/pnpm` | 同 #1 |
| 5 | +14 | `[mcp_servers.codegraph-aos].args[1]` | `<local-platform-root>/TCRN-TMS` | 同 #2 |
| 6 | +14 | `[mcp_servers.codegraph-aos].args[-1]` | `<local-platform-root>/TCRN-AOS` | 平台根下的 `TCRN-AOS` |

其中 **#1 与 #4 是两条 command 路径**——它们坏掉的后果最直接：服务器根本不启动。
另有 2 个 `<local-home> 在**上下文行**（`command` / `args` 那两行原有的 `codegraph` 块），
它们不该被写入，只是让精确匹配必然失败的那两行；数占位符时别把它们算进要替换的 6 处里。

### 因此 S4.2 应用时（审查层）

1. **不要**直接 `patch -p1`。要么先把 6 处占位符替换成实际 home 与平台根后再打，
   要么**手工按块粘贴**（本 diff 只加两个独立的 TOML 表，无删改，手工粘贴无风险）。
2. 若仍用 `patch`，**必须加 `-F0`**：让它在上下文不符时红出来，而不是靠默认 fuzz 蒙混。
3. 应用后先**读回**那两块，确认落盘的是真实路径而非 `<you>`；再跑 `codex` 会话实测三服务器 `status`。
4. 编辑用户级配置属审查层动作（需经用户批准），本单不应用——与原文一致。

## 说明

- 简报提到的「workflow MCP 门面」经实测**已在** Codex 侧（`[mcp_servers.tcrn-workflow]`，2026-08-05），无需再补，故 diff 只含 codegraph-ds/aos 两块。
- `tcrn-workflow-aos-read`（AOS 只读面）Codex 侧无对等；简报 S4 范围不含它，parity 白名单已豁免，是否在 Codex 侧补由审查层决。
- diff 的 TOML 块与现有 `codegraph` 块逐键同构（command/args/startup_timeout_sec），结构性低风险；S4.2 应用后审查层跑 `codex` 会话实测三服务器。

## 证据包

- `commands.md`、`notes.md`、`codex-config-incremental.diff`、`payloads/`。
