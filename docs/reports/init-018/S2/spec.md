# S2 · SSH 写启发式规格（起草稿 · 判断型）

> 起草：执行层 `agent:deepseek-v4-flash` · 2026-08-05。流程：**执行层起草 → 核验层复核 → 审查层终审**。切 enforce 由审查层依无误报报告代办（MIN-058），**执行层不切**。
> 实现载体：`scripts/ssh-write-observer.mjs`（observe 模式 matcher）+ `.claude/settings.json` PreToolUse 接线。

## 目的

对「经 SSH 写 tcrn-platform-dev 上的受治链树（`/srv/tcrn/governance`）」这类高危命令做机器拦截。依据：平台 CLAUDE.md §三.2「SSH 不是豁免」——经 SSH 用 `cat >`/`sed -i`/`rsync`/任何文件写入工具碰治理树，与本地编辑器保存是同一件事。

## 危险模式（HIT）

命令**同时满足**：①指向 `tcrn-platform-dev`（ssh/rsync/scp 目标）；②带远程写原语；③命名受治树 `/srv/tcrn/governance`。

写原语（`SSH_WRITE_PRIMITIVE`，裸词带前导 `\b`）：
- 重定向：`>` / `>>`
- `tee`
- `sed -i`
- `cat >`（含 heredoc）
- 文件操作：`cp` / `mv` / `dd` / `install` / `touch` / `rm`
- `rsync` / `scp` 指向 host 且含治理路径（方向不限，pull/push 皆记；enforce 时可由审查层按 pull/push 收窄）

## 豁免（PASS / 放行）

- `ceremony.mjs`（受治链写唯一通道）
- `paired-backup.mjs`（配对备份，PULL 是裁定方向）
- `engine-host:verify`（只读引擎副本核验）
- `ship-web.mjs`（STORY-138 白名单船运，写 web 根非治理树）
- 只读动词：`status` / `work-show` / `work-list` / `snapshot-manifest` 等（无写原语即 PASS）
- 非治理路径的写（`/srv/tcrn/aos-cockpit`、`/srv/tcrn/engine`、`/tmp` 等）
- 无 ssh/rsync/scp 的本地命令

## 判定（classify）

```
classify(command) →
  exemption 命中              → PASS（豁免）
  无 /srv/tcrn/governance      → PASS（不在受治树）
  指向 host + 写原语 + 治理路径 → HIT（记录）
  其余                          → PASS（无写原语 / 只读）
```

保守原则：observe 期宁可多记不少拦——每个 HIT 都进日志供审查层复核误报。命令级匹配不解析脚本内部（`node scripts/ship-web.mjs` 不展开其内部 rsync）。

## 接线（observe 模式，只记日志不拦）

`tcrn-workflow/.claude/settings.json` 新增 PreToolUse hook（matcher `Bash`）→ `node scripts/ssh-write-observer.mjs`。行为：
- stdin 收 `{tool_name, tool_input}`；非 Bash 或空命令 → no-op。
- 判 HIT → 追加一行 JSON 至 `docs/reports/init-018/S2/observed-hits.log`（`S2_OBSERVE_LOG` 可覆盖）。
- 恒 exit 0，不输出阻断判定 → **永不拦**。

## 验证（自检语料，可重跑）

`node scripts/ssh-write-observer.mjs --self-test`：21 样例（10 HIT + 11 PASS）全按预期分类，exit 0。红测：临时删一条判定规则 → 自检红（1 mismatch）→ 还原 → 绿。证据 `S2/self-test.json`。

## 待审查层（判断型终审项）

1. **enforce 切换**：observe 无误报后由审查层代办（MIN-058）。enforce 时应输出 `permissionDecision:"deny"` 并对 HIT 阻断。
2. **rsync pull/push 方向收窄**：当前双向皆 HIT（保守）；enforce 时可评估仅拦 push（`本地 → 远端`）与反向 gov→local 拉取是否放行。
3. **多仓传播**：本单接线在 tcrn-workflow 一个项目；是否向 TCRN-AOS 等其余仓传播由审查层决（observe 低风险）。
4. **观察日志读取**：审查层复核 `observed-hits.log` 以判无误报。

## 证据包

`docs/reports/init-018/S2/`：`commands.md`、`notes.md`、`self-test.json`、`red-proof.json`、`observed-hits.log`（运行期追加）、`payloads/`。仓内改动：`scripts/ssh-write-observer.mjs`、`.claude/settings.json`。
