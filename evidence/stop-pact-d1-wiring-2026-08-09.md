# INC-105 — Stop hook D1 接线证据（2026-08-09）

Owner 批准（AskUserQuestion 答案逐字：「批准写入并取证（推荐）」；裁定记录 = INIT-020 注记 rev10，授权书 = docs/reports/init-020/AUTHORIZATION-2026-08-09-owner-prod.md）。执行方 agent:fable（Claude Code 宿主侧）。

## 变更一：用户级 ~/.claude/settings.json（D1 字面要求）

```diff
 {
   "env": {},
-  "skipWorkflowUsageWarning": true
+  "skipWorkflowUsageWarning": true,
+  "hooks": {
+    "Stop": [
+      {
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node \"<platform>/tcrn-workflow/tools/stop-pact/hook.mjs\"",
+            "timeout": 10
+          }
+        ]
+      }
+    ]
+  }
 }
```

（证据文件内以 `<platform>` 代平台根绝对路径——INC-089 卫生纪律；实际写入值为带引号的绝对路径，路径含空格必须引号，否则 shell 切词后 hook 永不启动——INIT-018「注册字符串本身」死因的同族。）

## 变更二：平台根 .claude/settings.json（verify-channel 所量项目根 ①）

在 `hooks` 下新增 `Stop` 组（既有 PreToolUse/SessionStart/UserPromptSubmit 未动）：

```json
"Stop": [ { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/tcrn-workflow/tools/stop-pact/hook.mjs\"", "timeout": 10 } ] } ]
```

## 变更三：TCRN-AOS/.claude/settings.json（verify-channel 所量项目根 ②）

新增 `hooks.Stop`（既有 permissions.deny 未动），用 `${CLAUDE_PROJECT_DIR}/../` 相对形态，零绝对路径入仓：

```json
"Stop": [ { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/../tcrn-workflow/tools/stop-pact/hook.mjs\"", "timeout": 10 } ] } ]
```

## 验证（2026-08-09 实测）

1. 命令行可执行且 fail-open：合成 Stop 事件从 stdin 喂注册串 → exit 0（无活契约即放行,零日常影响）。
2. `verify-channel.mjs --verify-channel`（两根）→ `STOP_PACT_CHANNEL_LIVE`：每根在 scratch 活契约世界真启动注册串,均返回 `decision:"block"`、reason 702 字节——通道端到端活证。
3. `pnpm --dir TCRN-AOS prod:ready` → `stop-pact-channel: green — STOP_PACT_CHANNEL_LIVE`,红腿 verified;整门余一红 `helper-engine-pin`（等 v0.11.8 tag,另案已批）。

## 如实登记的残余

真实宿主触发证据（宿主自己在会话 Stop 时调起 hook）在**下一个新会话**自然取得——hooks 于会话启动快照,本会话早于写入。取得后 INC-105 按 pending-owner-acceptance 随 S190 打包验收。gate 的 live-fire 是通道活证,不冒充宿主触发。
