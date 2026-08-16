# STORY-161.5 检索质量抽检 —— 如实记录

签发:执行层 agent:fable · 2026-08-05 · 判据:`knowledge-candidates`(MCP 只读面,`role-scope=implementation`)

## 抽检 prompt(先选定,再检索;不挑对自己有利的)

| # | 真实 agent prompt | 期望命中的卡 |
| --- | --- | --- |
| 1 | 怎么在文档里加一条复核命令 | C11(复核走 MCP)、C05(举例即断言) |
| 2 | 写了一个门,怎么确认它不是恒真门 | C02(判据两侧)、C03(门可满足) |
| 3 | knowledge-list 为什么拒读 HIGH_WATER_MISMATCH | C12(marker CAS)、C20(每写必 rebase) |
| 4 | hook 没有生效,应该查什么 | C13(hook cwd) |
| 5 | 对 VM 上的治理链做一次受治写 | C14(仪式回读)、C18(ssh 引号)、C19(break-glass) |

## 结果(如实,低了照写)

### 原始自然语言 prompt:`0/5` 命中
五个 prompt 原样传入 `knowledge-candidates`(带 role-scope),全部 `total=0`。

**原因**:candidates 的搜索是 **FTS token 匹配,且为 AND 语义**——prompt 里的连接词
(「怎么」「应该」「没有」等)不在任何卡的文本里,整个查询被 AND 拉成 0。这不是卡的错,
是检索形态的错:自然语言 prompt 不适合直接喂给 token 级 FTS。

### 关键词提取后的同一批 prompt:`5/5` 命中
把每个 prompt 提炼成卡内确实存在的关键词,再查:

| prompt 的关键词 | 命中 | 命中卡 |
| --- | --- | --- |
| 复核命令 | 2 | C11、C05 |
| 恒真 | 1 | C02 |
| rebase | 2 | C12、C20 |
| hook | 1 | C13 |
| 仪式 | 4 | C12、C11、C20、C14 |

## 对 STORY-162 的含义(注入触发必须这么做)

1. **注入链路不能把整句 prompt 丢给 candidates**——它必须先把 prompt 提炼成关键词/主题
   (161.5 实测:AND-token FTS 吃不了自然语言)。
2. `knowledge-candidates` 需要 `role-scope` 才能选到本批卡(卡 `role-scopes=["implementation"]`);
   注入时要带 `role-scope`(与执行会话身份一致)。
3. 本抽检可被第二人原样重跑:5 个 prompt + 关键词提取,命令与结果如上。
