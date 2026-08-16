# S1.2 deny 规则 — 五仓 `.claude/settings.json`

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 改动

以下五仓 `.claude/settings.json`（原均不存在，新建；无既有键可丢）写入同一条 deny 规则：

```json
{
  "permissions": {
    "deny": [
      "Write(**/.tcrn-workflow/**)",
      "Edit(**/.tcrn-workflow/**)",
      "Write(**/.tcrn-workspace/**)",
      "Edit(**/.tcrn-workspace/**)"
    ]
  }
}
```

- `TCRN-TMS/.claude/settings.json`
- `TCRN-Design-System/.claude/settings.json`
- `TCRN-AOS/.claude/settings.json`
- `tcrn-workflow/.claude/settings.json`
- `tcrn-workflow-helper/.claude/settings.json`

## 命令

```bash
cd "<local-platform-root>"
for r in TCRN-TMS TCRN-Design-System TCRN-AOS tcrn-workflow tcrn-workflow-helper; do
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$r/.claude/settings.json"
done
# 五仓全部 JSON 合法，每仓 4 条 deny
```

## 语义

- 拦 `Write`/`Edit` 于任意深度 `.tcrn-workflow/` 与 `.tcrn-workspace/` 下——控制树只能由引擎的规范字节形态写入（平台 CLAUDE.md 第三节第 2 小节），写工具改动会让整条链 fail-closed。
- 不拦 `Read`（「看可以，存不行」）。
- 不拦 `Bash`（引擎经 CLI 写链的正当通道不受影响）。
- 合并语义：本仓原无 settings.json，无丢键问题；后续若加 allow/deny，需保留本段四条。

## 备注

deny 规则在会话启动时快照。已加载本会话不会即时生效；自新会话起按仓生效（见 S1.3 红测待审查层说明）。
