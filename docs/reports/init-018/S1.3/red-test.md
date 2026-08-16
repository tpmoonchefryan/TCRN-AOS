# S1.3 红测 — 归档树 Edit 被拒

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 状态：红测待审查层（不算 BLOCKED）

按简报 S1.3：「若你的宿主允许开新会话，实测 Edit 归档树文件被拒并存档；不允许则在 notes.md 写明「红测待审查层」，不算 BLOCKED。」

执行宿主为流水线执行层会话，**无法从本会话内开新会话**。且 Claude Code 的权限规则在**会话启动时快照**（
平台既有教训：`stop-pact` hook 同样如此——改 settings 不影响正在跑的会话），本会话不会加载新写入的 deny 规则，
在这里实测 Edit 只会测「没有 deny 的会话」，测不出「有 deny 的会话被拒」。

因此红测留给核验层（Opus 5）在新会话中执行。核验配方：

```bash
# 在任一仓（如 TCRN-AOS）新开会话
cd "<local-platform-root>/TCRN-AOS"
# 尝试 Edit <local-platform-root>/.tcrn-workspace/TCRN-AOS/ARCHIVED.md
# 期望：Write/Edit 被 deny 规则拦截（deny: Write(**/.tcrn-workspace/**) / Edit(...)）
```

同一会话还应抽查 `.tcrn-workflow/**` 路径（如 `tcrn-workflow/.tcrn-workflow/**`）同样被拒。

## 本会话已实测的邻近防线（S1.4）

archival 树的 **os-level 写保护**已实测：`touch .tcrn-workspace/TCRN-AOS/evidence-locator/write-probe.txt`
报 `Operation not permitted`（exit 1）——即使 deny 规则未生效的旧会话，归档内容也已物理不可写。
