# STORY-162 收口 —— 注入触发:hook 按 prompt 检索

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 不得每轮无条件全量注入(上下文预算硬约束);relevance 归 candidates,不另写相关性;注册命令必须 ${CLAUDE_PROJECT_DIR} 形态;settings.json deny 一字不动 |
| 文件指针 | `tcrn-workflow/scripts/knowledge-inject.mjs`(检索链)、`knowledge-inject-hook.mjs`(hook 包装);平台根 `.claude/settings.json`(仅 hooks 块);`S162/design.md`、`outputs/`;`TCRN-AOS/deploy/aos-mcp-write/knowledge-inject.test.mjs` |
| 验证命令 | `node tcrn-workflow/scripts/knowledge-inject.mjs --self-test ; echo exit=$?`;`--verify-channel` 三 cwd 绿 |
| 收口动作 | hooks 注册落地;活性门进 verify 链(测试名册) |
| 生效证据命令 | 新会话实测注入发生(上下文出现卡片元数据);`--verify-channel` 三 cwd 均 `INJECTION_CHANNEL_LIVE` |

## 实测记录

### 162.1 触发点选型
- SessionStart(保底一次,基线注入单宽词 `lesson`,预算封顶);UserPromptSubmit(关键词门双道:harness matcher + 脚本 trigger gate)。设计见 `design.md`。

### 162.2 检索链
- `knowledge-inject.mjs`:门 → (命中触发词为查询)→ MCP 只读面 `knowledge-candidates` → 字节预算 → 元数据级注入。
- **不另写相关性**:relevance 归 candidates;预算由脚本按 `--budget`(默认 8000)封顶并显式截断声明
  (context-route 需一次性供权,过渡形态已在 on-demand-context 文档声明)。
- 实测:`"hook 没有生效"` → 查询 `hook` → 1 候选;`"今天天气如何"` → `TRIGGER_GATE_NO_MATCH`。

### 162.3 注入体量预算
- 上限可配置 `--budget`,字节级截断(`truncateToBudget`,CJK 安全);超量实测被裁且 `truncated: true`。

### 162.4 hook 注册
- settings.json 仅加 SessionStart + UserPromptSubmit hooks,命令用 `node "${CLAUDE_PROJECT_DIR}/tcrn-workflow/scripts/knowledge-inject-hook.mjs"`;
  deny 规则与既有 PreToolUse(ssh-write-observer)一字未动。
- 实测:UserPromptSubmit 注入 1 条;SessionStart 注入 8 条(预算 ~2KB);非触发 0 条。

### 162.5 活性门
- `--verify-channel` 执行注册字符串本身:读 settings 找 `knowledge-inject` 命令 → 起真进程 → 检索链返回。
- 红侧:未注册时 `REGISTRATION_MISSING`(先验到);注册后三 cwd(平台根/TCRN-AOS//tmp)均 `INJECTION_CHANNEL_LIVE`。
- 纯逻辑测试 6 项(门/token/预算)挂进 AOS test 名册。

### 162.6 红绿实测
- 绿:三 cwd 活性门绿、self-test 返回候选。
- 红:注册缺失 → `REGISTRATION_MISSING`;检索链无返回 → `RETRIEVAL_CHAIN_NO_RETURN`。

## 已提交
- `tcrn-workflow/scripts/{knowledge-inject.mjs, knowledge-inject-hook.mjs}`(tcrn-workflow 仓);
  `TCRN-AOS/deploy/aos-mcp-write/knowledge-inject.test.mjs` + package.json(AOS 仓);
  平台根 settings.json 不在 git 仓,以工作树形态生效。
