# S15 复测口径（remeasure policy）— 热路径字节计量

> 关联 TCRN-CROSS-STORY-143。执行层 agent:deepseek-v4-flash · 2026-08-05。
> 基线：`context-bytes.md` / `context-bytes.json`（本目录）。

## 触发条件（两个，任一即复测）

1. **公约大改**：平台级 `docs/` 或平台根/各仓 `CLAUDE.md` 发生结构性改写（新增章节、合并公约、迁移段落），
   使「每个受治会话都加载的固定前缀」显著变化。
2. **模型代际触发**：所驱动的模型或宿主代际切换（如执行/核验层换模型族），tokenizer 与上下文预算随之变化，
   旧字节基线的参考价值失效。

## 复测方法

```bash
cd "<local-platform-root>/tcrn-workflow"
node scripts/bench/measure-context-bytes.mjs        # 输出到 docs/reports/init-018/S15/
```

将新输出与既有 `context-bytes.md` 逐行 diff；字节数变化即记录为新基线（git diff 存档）。
MEMORY 索引（`~/.claude/projects/<local-project-dir>/memory/MEMORY.md`）随每次会话
自动压缩而变化，属**运行态**，只在「字节基线显著漂移」时更新，不作为每次会话的强制复测对象。

## 口径边界（诚实声明）

- **只计字节，不冒充 token。** token 数依赖模型与分词器；本表是廉价、稳定、与机型无关的**字节**基线，
  供判断「固定前缀是否显著膨胀」，不回答「一次推理花多少 token」。
- `tcrn-workflow-helper` 无 `CLAUDE.md`、各仓无独立 `.mcp.json`（唯一的 `.mcp.json` 在平台根）——
  表记 `absent` 而非 0。
