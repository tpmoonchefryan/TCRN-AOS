# S162 注入活证(INC-060 item 6)——真会话双 hook 实际注入

签发:执行层 agent:fable · 2026-08-06 · 归档本会话(执行 INC-052..060 批次)的注入实况。

## 结论:注入链路在真实会话中活着——「建成未接线」的世界已关闭

上轮验收的 UNVERIFIED(宿主对 string additionalContext 的接受)由本会话活证关闭:
宿主确实接受了字符串 additionalContext 并把它追加进上下文(下方两处均能在上下文里读到)。

## SessionStart(会话启动,保底一次)

本会话启动时,SessionStart hook 注入 **8 条**知识卡元数据(预算封顶 ~2KB),上下文可见:

- knowledge:155621… knowledge 写动词的 CAS 用 store marker 版本
- knowledge:27a5c4… 复核命令走 MCP 读面,不 SSH 直驱引擎
- knowledge:296950… hook 注册必须用 ${CLAUDE_PROJECT_DIR} 形态
- knowledge:2c9f23… 远程 argv 经 ssh 重新拼接,必须 shellQuote
- knowledge:3b1352… SSH 直驱只两类 break-glass
- knowledge:3e5c46… 探针身份也是量具
- knowledge:4b0376… 上下文将满不是收尾的理由
- knowledge:65d088… 文档里的举例就是断言

## UserPromptSubmit(关键词门)

本会话在 prompt 含触发词时,UserPromptSubmit 注入 1 条:

- knowledge:9fd99b… 本地全绿不等于 CI 绿(prompt 含「CI」触发词)

非触发 prompt(本批多数工作消息)零注入——关键词门按设计工作,不是每轮全量注入。

## 复现

`echo '{"hook_event_name":"SessionStart"}' | node tcrn-workflow/scripts/knowledge-inject-hook.mjs`
→ additionalContext 为字符串、含 8 条卡(与上方一致)。

## 关联

- INC-044 修复(字符串 additionalContext + OR 检索 + self-test 判据)后,注入端到端可用。
- 知识卡 20 张在 cross-project 链上(cross v1888)。
