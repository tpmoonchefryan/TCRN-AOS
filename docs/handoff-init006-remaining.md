# TCRN-AOS INIT-006 · 剩余工作派工书

> **给接手的 Codex。** 这份文件里没有硬门：不需要先让什么变绿才能开工，也不存在"必须按顺序"
> 的检查点。每个工作包末尾的**验收项**描述的是"做完了长什么样"，用来自检，不用来卡你。
>
> 前一轮已经把产品建起来、部署起来、并过了一轮独立对抗审查。审查提了 58 条，18 条过了
> 三名反驳员，其中 20 条 blocking 里 **19 条已修**。这份文件是剩下的部分。
>
> **事实截至 2026-08-20，逐条对着代码核过**；写"未修"的地方我都实际 grep 过，不是照抄审查报告。

---

## 一、现状（可复核）

分支 `feat/init006-standalone-rebuild`，已推 `origin`。最后一条提交
`e28d778 fix what the adversarial review confirmed`。

```bash
cd "TCRN Platform/TCRN-AOS"
node scripts/dev-db.mjs up
AOS_DATABASE_URL=postgres://postgres:devpass@127.0.0.1:55432/aos pnpm verify   # 实测 exit 0
```

`pnpm verify` 十五步全绿：typecheck、codegen 校验、build、38 个测试、许可证（241 个分发包全部宽松）、
十道门（注册表同权 / 无侧门 / OpenAPI / MCP 握手 / 表单回放 / 纯人工通关 / 中文检索 / 兄弟仓缺席 /
自足性 / 生成物编码）。

规模：68 个操作、60 个 MCP 工具、32 条界面路由、8 个迁移文件。
部署实测：k3d 单节点 k3s 上跑通，删掉 Postgres Pod 后数据完好，备份 dump→验证→恢复行数一致。

**环境状态**：Docker Desktop 与 `k3d` 集群 `aos` 都在，但机器重启后需要手动拉起
（`open -a Docker`，等守护进程；集群本身会自动恢复）。

---

## 二、剩余工作

按包分组。包与包之间**没有依赖顺序**，挑你顺手的先做。

### 包 A · 认证面的硬伤（建议先做，价值最高）

审查在这里提的几条互相叠加，合起来是"未认证的登录端点既能枚举账号、又能被当成 CPU 消耗器、
还能把受害者悄悄登进攻击者的账户"。

1. **登录是账号存在性预言机，而且注释声称的恰好相反。**
   `packages/kernel/src/auth.ts` 的 `authenticatePassword` 在账户不存在时，
   `verifyPassword(password, null)` **第一行就 `return false`**——不做任何 scrypt 工作。
   于是"账户不存在"比"口令错误"快两个数量级，而它上面的注释写着"两者耗时相同"。
   注释比代码更危险：它让下一个人不再检查。
   *修法方向*：账户不存在时也跑一次同参数的 scrypt（对一个固定的假 PHC），或改注释说实话。

2. **登录没有任何限流，每次请求的代价是一次 N=2^15 的 scrypt。**
   Pod 没有 CPU limit（`deploy/k8s/base/app.yaml` 只有 requests）。这是一条免费的资源耗尽通道。
   *修法方向*：按来源与按 handle 的双维度节流，失败计数落库或落内存皆可；给 Pod 加 CPU limit。

3. **登录豁免 CSRF，且接受未校验的 `_redirect`。**
   `apps/server/src/app.ts` 的 CSRF 检查条件是 `isBrowserSession`——登录时还没有会话，所以跳过。
   攻击者可以让受害者的浏览器提交一份指向**攻击者账户**的登录表单，之后受害者以为自己在自己的
   账户里，实际在攻击者的账户里打字。`_redirect` 目前只要是字符串就照跳。
   *修法方向*：登录表单带一个 pre-session 的一次性 token；`_redirect` 只接受本站相对路径
   （以 `/` 开头且不以 `//` 开头）。

4. **会话 cookie 在所有已提供的部署路径里都没有 `Secure`。**
   `AOS_SECURE_COOKIES` 这个开关只存在于源码，`deploy/k8s/base/app.yaml` 的 ConfigMap 里没有它，
   Ingress 也没有 TLS。
   *修法方向*：要么把 Ingress 配上 TLS 并默认开 `AOS_SECURE_COOKIES`，要么在 ConfigMap 里显式
   写上它为什么是关的（本地 HTTP 演示），并在 README 的"刻意没有的东西"里说明。

**验收项**：一个不存在的账号与一个存在但口令错误的账号，登录耗时在同一量级；
连续失败若干次后被拒；跨站提交的登录表单被拒；`_redirect=https://evil` 被拒。

---

### 包 B · read.ts 整套读面纪律是死代码

`packages/kernel/src/read.ts` 里的 `parseQuery` / `rejectForbiddenAuthorityKeys` /
`rejectUnsupportedQueryKeys` **导出后从未被任何请求路径调用**（`grep` 全仓，除 read.ts 与
index.ts 外零命中）。

后果是这套纪律现在只是注释：

- **未知或拼错的查询参数被静默忽略。** `?statuss=done` 与不带过滤返回同一批结果，
  而 read.ts 自己写着"deny by default，未知过滤按名字拒绝，绝不忽略"。
- **禁用授权键没有被拒。** `?actor=…` / `?role=…` 这类"请求自称身份"的参数不会触发
  `client_authority_denied`，只是被忽略——行为上等价，但拒绝与忽略对调用方是两件事。

`apps/server/src/app.ts` 生成 REST 查询路由时直接 `{...query, ...params}` 交给 dispatch，
TypeBox 的 `Value.Clean` 把多余键删掉，所以既不报错也不生效。

*修法方向*：在 dispatch 或生成的 GET 路由里，用操作自己的 input schema 的属性名作为白名单，
先拒授权键、再拒未知键。注意 read.ts 的注释已经写明两者的**次序**（授权键先于白名单）与
**大小写规则**（授权键不分大小写、白名单区分），照它做。

**验收项**：`GET /api/v1/work-items?statuss=done` 返回 400 且点名 `statuss`；
`?actor=x` 返回 `client_authority_denied`；正常过滤不受影响。

---

### 包 C · 门自身的质量（这些门现在有真绿也有假绿）

审查用了一整个视角专门判门，结论是有几道门**删掉整个功能也不会红**。

5. **`gate:parity-registry` 算了 `commandsWithoutUi` 却从不据此失败。**
   `scripts/gate-parity-registry.mjs` 把"有命令但没有 UI 控件"算出来放进报告，
   `problems` 里却不加它。文档说的契约是"每个命令都要有人能手工执行"，门没有执行这条。
   *修法方向*：把它计入失败，除非该操作声明了 `uiExemptReason`。

6. **`gate:absence` 的"跑测试"只跑两个纯函数文件。**
   `scripts/gate-absence.mjs:91` 硬编码了 `search-text.test.mjs` 与 `url.test.mjs`。
   现在已经有内核测试套件了（`packages/kernel/test/kernel.test.mjs`），它没被包含。
   同一个脚本的引用扫描也只扫 `packages/apps/scripts/deploy` 四个目录，**仓库根目录的文件跳过了**。
   *修法方向*：改成跑与 `pnpm test` 相同的 glob；扫描范围含根目录文件。

7. **`gate:no-side-door` 只匹配静态 import 说明符。**
   它检查 `from "…store…"`，但每个页面都拿到一个活的 `pg.Pool`（`ctx.pool`），可以直接
   `ctx.pool.query(...)` 绕过 dispatch——而门看不见。
   *修法方向*：加一条检查：`apps/web/src/pages/**` 与 `apps/server/src/render.tsx` 里不得出现
   `.query(` 直接调用；或者更彻底，别把 pool 放进 `PageContext`（页面只需要 `call`）。
   后者更干净：把 `pool` 从 `PageContext` 拿掉，侧门就不存在了，而不是被检查出来。

8. **`gate:openapi` 拿生成器和它自己的输出比。**
   它能发现"提交的文档过期"，但发现不了"生成器本身写错了"。
   *修法方向*：加少量对生成结果的断言（每个操作有 operationId、命令有 requestBody、
   查询的参数来自 schema），让规格错误也能红。

9. **`gate:search-cjk` 认证的是一份手抄的副本。**
   门里自己写了一遍 `setweight(to_tsvector(...))` 建临时表，而不是走产品真正的
   `upsertSearchDoc` + `search_doc` 表。生产索引语句改了、门不会红。
   *修法方向*：改成调用 `upsertSearchDoc` 写进真表再查，用完清理。

10. **没有任何东西断言"门的名册"。** 从 `verify` 里删掉一道门是无声的。
    *修法方向*：一份 `scripts/gates.json` 之类的名册，加一道检查断言 `verify` 的步骤集合与它相等
    （这正是平台层"九门名册"那条教训的同一形状）。

11. **`gate:forms` 的 `{projectId}` 绑到了未开治理的夹具项目。**
    `scripts/gate-forms.mjs` 特意建了一个 `governanceEnabled: true` 的项目 `GOV`，
    但 `substitutions["{projectId}"]` 指向的是未开治理的 `GATE`。于是三条治理路由渲染的都是
    "治理没开"的提示页，零个表单被回放——**删掉整个建门面板，门依然绿**。
    *修法方向*：治理相关路由用 `governed.id` 替换；或者两个项目各跑一遍。
    （这是 20 条 blocking 里唯一没修的一条。）

12. **`mustChangePassword` 只是一条横幅。** 带着"必须改口令"标记的账户可以正常做任何事。
    *修法方向*：要么让它真的拦住（除改口令与登出外一律 403），要么把文案改成"建议尽快修改"，
    不要让标记声称一件它不做的事。

**验收项**：对每一道门做一次变异——删掉它守护的那个能力，门必须红。红了再改回来。

---

### 包 D · 数据与行为的正确性

13. **列表的 `total` 带着游标谓词一起数。** 五个列表都是同一形状（work-items 是
    `packages/kernel/src/operations/work-items.ts:367`）：`whereSql` 已经包含游标条件，
    却又用它去数总数。于是"显示 N 条，共 T 条"里的 T **随着翻页越来越小**。
    *修法方向*：总数用不含游标条件的 where 数。

14. **人无法通过界面创建一条 Decision。** `decision` 行只有 `deliberation.close` 写，
    而它需要 `decisions`（对象数组）与 `unresolved`（字符串数组）。dispatch 现在已经能把
    文本域按行转成**字符串**数组了，但对象数组仍然发不出去。
    *修法方向*：把 `decisions` 改成结构化的具名字段组（标题一行一条 + 一个 outcomeClass），
    或者提供 `decision.create`。前者更贴合"纪要承载裁定"的语义。

15. **非工作项上的评论以 `project_id NULL` 入索引，非管理员搜不到。**
    `packages/kernel/src/operations/comments.ts` 只对 work_item 主体解析 project_id，
    而检索按项目成员资格过滤，NULL 的行被过滤掉。
    *修法方向*：写 search_doc 时用与授权同一套 `PROJECT_SOURCE` 解析出的项目。

16. **中文检索结果的摘要是文档开头，不是命中段落，也没有高亮。**
    `search-inbox.ts` 的 snippet 取的是正文前若干字符。
    *修法方向*：用 `ts_headline` 配同一套二元切分的 query；注意 headline 的 StartSel/StopSel
    要选一个不会被当成 HTML 的标记（页面按纯文本渲染）。

17. **`board.move` 在两个相邻卡片 rank 相同时静默追加到末尾。**
    `rankBetween` 在 `lo >= hi` 时返回 `lo + "m"`，而同一批建立的卡片 rank 全是默认的 `"m"`。
    *修法方向*：移动前若目标区间的邻居 rank 相同，先对该列重新分配一次 rank（一次性 O(n) 写），
    再插入。

18. **`Idempotency-Key` 不能阻止重复执行。** `dispatch` 里的重放检查是一条裸 `SELECT`，
    没有锁；两个并发的同键请求都会读到空、都会执行、其中一个的 INSERT 撞 `ON CONFLICT DO NOTHING`。
    *修法方向*：先 `INSERT ... ON CONFLICT DO NOTHING RETURNING`，抢到行的执行、没抢到的等待或
    返回冲突；或对键取 `pg_advisory_xact_lock`。

19. **`work_item.update` 接受跨项目的父项，而 `create` 明确禁止。**
    结果是子项出现在另一个项目的树里。
    *修法方向*：`update` 加同一条检查。

20. **`work_item.unrelate` 按 id 删除全实例任意关联行；`relate` 不检查远端。**
    `unrelate` 只按 `relationId` 删，没有校验这条关联属于 `key` 指的那个工作项；
    `relate` 只检查近端的项目角色，远端可以是任何项目的工作项。
    *修法方向*：`unrelate` 加 `AND from_id = $2`；`relate` 对远端也要 viewer 以上。

21. **软删除留下孤儿。** 子项的面包屑仍指向已进回收站的祖先；被删工作项的评论仍在检索里。
    *修法方向*：面包屑跳过已删除祖先并说明；删除时同步清掉该主体的评论 search_doc 行。

**验收项**：每条都能用一段可复跑的脚本演示"修之前是什么、修之后是什么"，
并在 `packages/kernel/test/kernel.test.mjs` 里留下一条会失败的断言。

---

### 包 E · 运维与部署

22. **`statement_timeout` 也套在迁移连接上。** `packages/store/src/pool.ts` 给整个池设了
    15 秒的 `statement_timeout`，迁移走的是同一个池。一次稍长的迁移或一次锁等待会让启动永久失败，
    而且失败信息看起来像数据库有问题。
    *修法方向*：迁移用一条单独的、不设超时（或设很长）的连接。

23. **附件在任何代码路径里都不存在，但 20Gi 的 PVC 和 `Recreate` 策略是用它论证的。**
    `attachment` / `attachment_link` 两张表建了，没有任何操作写它们。
    而部署清单与 README 都用"附件卷是 RWO"来解释为什么只能单副本。
    *修法方向*：二选一并说实话——要么实现附件上传（`@fastify/multipart` 已在依赖里），
    要么把 PVC 与那段论证一起去掉，改成"多副本受限于 X"。**不要保留一个用不存在的东西
    做的论证**，那正是这个仓库自己那条"不撒谎"纪律要禁的。

24. **没有任何东西修剪会话、幂等记录、通知；`activity_event` 结构上不可修剪。**
    前三张表只增不减；活动流是第二层追加不可改，连清除路径都不覆盖它。
    *修法方向*：给前三者加过期清理（一个 CronJob 或启动时的一次性清理）；
    活动流的增长是设计选择，把它写进文档而不是留给人自己发现。

25. **`project.list` 在每次页面渲染时跑，聚合整张 `work_item` 表，且是唯一没有 limit 的列表。**
    外壳每次渲染都要它（范围选择器需要项目清单）。
    *修法方向*：计数改成按项目的物化或一次 group by 的缓存；或者外壳只取项目名，计数按需取。

26. **抹除留下的痕迹没人读得到。** `admin.purge_revisions` 写的活动事件不带 projectId，
    `purge_journal` 没有任何操作暴露。
    *修法方向*：给 purge 事件带上 projectId；加一个 `admin.list_purges` 只读操作与一屏。

27. **`pnpm k8s:apply` 指向一个不存在的脚本**（`scripts/k8s-apply.mjs`）。实测缺失。
    *修法方向*：写它，或从 `package.json` 删掉这一条。

28. **k3s 部署没有自动化证据。** 部署是实跑过的，但没有任何脚本能重跑证明它。
    `scripts/k8s-smoke.mjs` 与 `scripts/k8s-persistence-check.mjs` 存在但不在任何链条里
    （刻意的：它们要集群）。
    *修法方向*：一条 `pnpm verify:deploy` 之类的独立入口，把两者串起来，文档写明它需要集群。

**验收项**：22 与 27 修完；23 二选一并且文档与清单一致；24/25 有明确处置（做或写明不做的理由）。

---

### 包 F · 导航可达性

29. **七条已建成的屏没有任何入口，只能靠输网址到达**：
    `/activity`、`/admin/erasure`、`/trash`、`/views`、`/watching`，
    以及项目设置与治理三屏（`/projects/{id}/settings`、`/governance/*`）。
    侧栏只有六项：我的工作 / 收件箱 / 项目 / 工作项 / 看板 / 知识空间。
    *修法方向*：侧栏加"治理"与"管理"两组（管理组仅实例管理员可见），
    项目页加设置与治理的入口。

**验收项**：从首页出发，只靠点击能到达每一条已建成的路由。

---

### 包 G · 两条小的但会误导人的

30. **"没有客户端 JavaScript"这句话只在一个页面上被断言过。**
    `gate:human-only` 只检查登录页。三十二屏里其余三十一屏没人查过。
    *修法方向*：`gate:forms` 已经 GET 了每一条路由，顺手断言每份响应里没有 `<script`。

31. **`/readyz` 把驱动的原始错误信息返回给未认证的调用方。**
    `apps/server/src/app.ts` 的 catch 分支返回 `(error as Error).message`，
    而这个仓库自己的规则是"未预期错误的原文永不跨边界"。
    *修法方向*：返回稳定的 reasonCode，细节只进日志。

**验收项**：随便挑三屏抓 HTML，`<script` 零命中；`/readyz` 在数据库不可达时不含驱动文本。

---

## 三、可以用 goal 一次跑完

Codex 侧建议这样开：

```
/goal 按 docs/handoff-init006-remaining.md 依次完成包 A 到包 G；每个包做完自测其验收项并提交一次；
包之间没有依赖，遇到判断题取该包里写的修法方向；全部完成后跑 pnpm verify 并推分支。
```

几条会省时间的提示：

- **`pnpm verify` 需要 Docker 与本地 Postgres**：`node scripts/dev-db.mjs up` 起库，
  `AOS_DATABASE_URL=postgres://postgres:devpass@127.0.0.1:55432/aos pnpm verify`。
- **改了操作的输入或新增操作之后，OpenAPI 文档会过期**，`node scripts/gate-openapi.mjs --write`
  重新生成，否则 `gate:openapi` 红。这不是缺陷，是那道门在工作。
- **改门的时候先做一次变异**：删掉它守护的能力，确认它会红。本仓库已经三次因为
  "不会失败的判据"付过学费。
- **写注释只写为什么**，不写下一行在做什么；这个仓库现有的注释密度就是标准。
- 提交署名固定为 `tpmoonchefryan <253097889+tpmoonchefryan@users.noreply.github.com>`，
  不要加 `Co-Authored-By`。

## 四、不在这份派工里的事

- **上链**。INIT-006 的记录、方向材料落链、`TCRN-CROSS-INC-234` 的关闭与 AOS 回归
  `product-gates` 名册，都属于治理车道，需要 Owner 的仪式，不由这份派工推进。
- **平台器官的退役记录**（`doc-topology`、`local-purity`、`engine-pin`、`production-readiness`
  与 `verify-deliberation-binding`）。它们已随重建从本仓消失，但平台侧
  `AGENTS.md` 与《交付节奏公约》里点名它们的文字仍需同批修订——那是 `TCRN-CROSS-*` 的事。
- **合并 `main` 与对外发布**。按交付节奏公约，那是唯一必停点，需要 Owner 说 go。
