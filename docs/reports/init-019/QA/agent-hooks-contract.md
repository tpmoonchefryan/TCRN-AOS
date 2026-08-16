# 代理原文 · hooks 宿主契约求证(claude-code-guide)

收录:2026-08-06 · INIT-019 验收 · 主审收到的两轮回答原文(除宿主路径打码外未改动)。
用途:INC-044(知识注入末跳失效)的宿主契约证据;结论以官方文档为出处。

## 第一轮:五个问题

| # | 问题 | 答案 | 出处 |
|---|------|------|------|
| **1** | `UserPromptSubmit` 支持 `matcher` 吗? | **否,不支持。** `UserPromptSubmit` 在官方的「Matcher patterns」表中被明确列为「no matcher support」。任何 matcher 配置会被忽略;hook 对每条 prompt 都执行。 | hooks-guide.md L685 (https://code.claude.com/docs/en/hooks-guide.md#matcher-patterns) |
| **2** | `SessionStart` 的 matcher 语义 | Matcher 过滤**会话启动方式**,可取值 `startup`(新启)、`resume`(恢复)、`clear`(清空)、`compact`(压缩后)、`fork`(分叉)。**不写 matcher 时对所有启动方式都触发**。 | hooks-guide.md L471, L671-672 |
| **3** | `${CLAUDE_PROJECT_DIR}` 展开规则 | **以启动会话的项目根为准**。在 /a/b 启动会话时,该变量展开为 /a/b;在 /a/b/c(c 自己有 .claude/settings.json)启动时,展开为 /a/b/c。多层配置会被加载合并,但 `${CLAUDE_PROJECT_DIR}` 总是指向当前会话的项目根。 | hooks-guide.md L286, L777;settings 加载规则 |
| **4** | stdout 注入上下文规则 | **`SessionStart` 和 `PostToolUse` 可直接写 stdout(exit 0 时追加到 context);`UserPromptSubmit` 必须用 JSON:`{"hookSpecificOutput": {"additionalContext": "..."}}` 否则被忽略**。大小限制未明确规定。Exit 非 0 时:code 2 = 阻止行为;其他 = 继续执行+stderr 记日志。 | hooks-guide.md L586-588; L305-318; L626-635; L589-591 |
| **5** | hooks 配置在会话启动时快照吗? | **否。** 文档明确说「file watcher normally picks up hook changes automatically」。会话中途编辑 settings.json 中的 hooks,改动会被动态加载;不需重启会话。 | hooks-guide.md L819 |

补充:matcher 字段存在于 JSON 中也会被解析(不报校验错),但被当作「每条 prompt 都运行」处理。Hook 命令**运行时的参数**(如 `$CLAUDE_PROJECT_DIR` 的展开值)在启动时锁定,但 hooks 表本身可热更新。

## 第二轮:追问三点(additionalContext 类型)

| # | 问题 | 答案 | 出处 |
|---|------|------|------|
| **1** | `additionalContext` 的 JSON 类型?数组形式会被接受吗? | **必须是字符串**。若输出 `{"hookSpecificOutput":{"additionalContext":["一段文字"]}}`(数组包字符串),宿主会因 schema 不匹配而**整体丢弃并报 JSON 验证错误**。文档所有示例(L316, L632, L448)都显示为字符串值,无数组形式支持。 | hooks-guide.md L305-325; L626-635; hooks.md 说明表格 |
| **2** | `SessionStart` 支持 `additionalContext` 吗? | **支持。** 既支持「stdout 纯文本直接追加」(L305, L316),也支持 JSON 形式;类型同样**必须是字符串**,不接受数组。 | hooks-guide.md L303-325;hooks.md 的 SessionStart schema |
| **3** | 无效 JSON 时宿主行为与调试方式 | JSON 无效(schema mismatch)或前缀有非 JSON 文本时,**静默丢弃该 hook 的输出**并报错(「JSON parsing error」/「JSON validation failed」)。调试:①Ctrl+O Transcript 看 hook error notice;②`claude --debug-file <路径>` 或 mid-session /debug;③/hooks 菜单看配置。 | hooks-guide.md L996-1027;L1000-1007;L1018-1027 |

关键细节:数组形式 `additionalContext: ["text"]` 导致整条 hook output 被判无效——该 hook 对会话无效果;JSON validation 失败时**没有「部分接受」**;SessionStart 纯文本与 JSON 二者选一,不要混用。
