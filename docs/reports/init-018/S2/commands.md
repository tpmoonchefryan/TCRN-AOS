# S2 commands — STORY-144 · SSH 写启发式（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `tcrn-workflow` 仓根起。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S2/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S2/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S2/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S2/payloads/close.json（同法）
```

## 自检（21 样例：10 HIT + 11 PASS）

```bash
node scripts/ssh-write-observer.mjs --self-test; echo $?   # 0，0 mismatch
```

## 分类单条

```bash
node scripts/ssh-write-observer.mjs --classify 'ssh tcrn-platform-dev "cat > /srv/tcrn/governance/x"'
# → {"command":"...","verdict":"HIT","reason":"ssh-write"}
```

## Hook 模式（observe：只记不拦）

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ssh tcrn-platform-dev \"cat > /srv/tcrn/governance/x\""}}' \
  | S2_OBSERVE_LOG=/tmp/s2.log node scripts/ssh-write-observer.mjs; echo $?   # 0，且 /tmp/s2.log 追加 1 行 HIT
# PASS 样例不落日志，恒 exit 0
```

## 红测（改判定证能红，演示后还原）

```bash
# 原子地：删 SSH_WRITE_PRIMITIVE 里的 \brm\b → self-test 红（1 mismatch）→ 还原 → 绿
# 实测：RED exit=1 ok=false mismatches=1；GREEN exit=0 ok=true；restored-identical=true
```

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S2/spec.md` | 判断型规格（起草稿，待核验复核+审查层终审） |
| `docs/reports/init-018/S2/self-test.json` | 自检 21/21 绿 |
| `docs/reports/init-018/S2/red-proof.json` | 红测存档（改判定→红→还原→绿） |
| `docs/reports/init-018/S2/observed-hits.log` | observe 运行期 HIT 日志（审查层复核误报用） |
| `scripts/ssh-write-observer.mjs` | matcher（observe 模式） |
| `.claude/settings.json` | PreToolUse hook 接线（+原 deny 规则） |
