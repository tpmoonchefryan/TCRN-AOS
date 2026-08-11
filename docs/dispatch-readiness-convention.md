# 派工就绪公约入口（兼容指针）

本文件不是第二份正本。平台唯一正本是
`../../docs/dispatch-readiness-convention.md`，由平台根的
`DOC_REGISTRY` 注册并由 `doc-topology:proof` 收容。

AOS 侧凡引用 `docs/dispatch-readiness-convention.md`，均按平台正本解释。当前硬规则包括：

- 链上旧四要素不得丢失，并补齐目的三件套；
- Story 必须按 Goal、Requirements、Acceptance Criteria、Business Background、Preconditions、Assumptions、Use Cases & Examples、Feature Toggle & Setting、Permissions、Implementation Notes 十区块出现且各一次；无内容必须写明“无——原因”；
- 派工简报五要素、生效证据、最终 HEAD 收口、逐项处置和 live authority 复验均为硬条件；
- 派工 brief 先运行 `pnpm --dir ../tcrn-workflow dispatch:validate -- --brief <brief.json>`；五要素缺任一项、缺 `storyScope` 或 Story scope 不合规即拒派；
- 新建、注记、状态迁移和独立收口门分别复验，终态历史不回写。

同步/漂移复核：

```bash
rg -n 'Goal|Requirements|Acceptance Criteria|Business Background|Preconditions|Assumptions|Use Cases & Examples|Feature Toggle & Setting|Permissions|Implementation Notes' "../docs/dispatch-readiness-convention.md"
pnpm --dir TCRN-AOS closeout:proof
```
