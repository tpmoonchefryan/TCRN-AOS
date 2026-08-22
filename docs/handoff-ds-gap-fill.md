# 派工：补齐 DS 的三处缺件，并重排 AOS 的状态色调

给 Codex。可以用 `goal` 指令完成。**没有硬门**，每条末尾的「验收」是验收项，不是阻断条件。

Owner 于 2026-08-22 通过设计规格 `TCRN-AOS/docs/ds-gap-spec.html` 全文，并单独裁定案④取**截断**而非折行。

---

## 零、四条落在哪两个仓

| # | 内容 | 仓 | 链记录 |
| --- | --- | --- | --- |
| ① | 正文链接件 `.tcrn-link` / `.tcrn-link--quiet` 提升到 core | TCRN-Design-System | `TCRN-DS-STORY-095` |
| ② | `Pagination` 从空 nav 补成可用件 | TCRN-Design-System | `TCRN-DS-STORY-096` |
| ④ | 状态徽章一行不折，装不下截断 | TCRN-Design-System | `TCRN-DS-STORY-097` |
| ③ | 七个工作状态的色调按 DS 语义重排 | TCRN-AOS | **未落链**，见第五节 |
| 附 | core/domain 切分不看嵌套 at-rule | TCRN-Design-System | `TCRN-DS-INC-009` |

三条 DS 单挂在 `TCRN-DS-EPIC-033` 下，Epic 挂在 `TCRN-DS-INIT-012`。**每条单的 scope 就是规格**，
链上写得比本文细——动手前读它：

```bash
node ~/.tcrn-workflow/tcrn-workflow/scripts/tcrn-workflow.mjs work-list --workspace /Users/ryanlan/Code/.tcrn-workspace/TCRN-Design-System/workspace
```

案③为什么不在链上，第五节说清楚了，不是遗漏。

---

## 一、纪律

**跨仓**。这次要动两个仓。DS 的改动落 DS 仓、AOS 的落 AOS 仓，**任何一仓都不许伸手进另一仓的树**。
AOS 消费 DS 的方式仍然是 `vendor/*.tgz`：DS 改完要重新打包、AOS 换 tarball，这是两次动作不是一次。

**九个门**。「门过了」指 `TCRN Platform/docs/acceptance-gate-groups.json` 里点名的九组，
不是你恰好关心的那几个。跨仓改动尤其容易只盯着自己那半边——这条链为此红过一整天。

**提交身份** `tpmoonchefryan <253097889+tpmoonchefryan@users.noreply.github.com>`，不加 `Co-Authored-By`。

**不许自造 DS 没有的东西**。这次是往 DS 里加件，加的是链上单子写明的那几个，别顺手多加。

---

## 二、① 正文链接件（`TCRN-DS-STORY-095`）

**不是新设计，是把已有的墨从 domain 提到 core。** DS 自己的注释就点了名：`Navigation.tsx:3359`
写着「Same inline-record-link ink as the Knowledge result anchor」——作者写第二处时就知道是同一套墨。
两处逐字相同：`.tcrn-machine-token__link` 与 `.tcrn-knowledge-search-results__head a`，
但两处都带 domain 前缀，而产品只外链 core，所以够不着。

**常驻下划线是必需，不是风格。** 实测品牌墨对正文墨：明 **2.94:1**、暗 **1.73:1**，
两档都低于 WCAG G183 的 3:1——颜色单独无法承担「这是链接」。

**下划线颜色取 70% 而非继承的 35%**：35% 实测明 1.69:1 / 暗 2.17:1，那个承重的提示自己几乎看不见；
70% 是两档同时过 3:1 的交叉点（明 3.14 / 暗 4.83），仍明显比正文轻。

`.tcrn-link--quiet` 与现有 `.tcrn-breadcrumb a` **逐字一致**，取 `0.2em` 偏移。
（顺带记一笔：野生的 quiet 档现有两个偏移值，面包屑 0.2em，而 `.tcrn-work-board__card-link` 与
`a.tcrn-relationship-chip` 用 0.15em。哪个都不算错，两个并存说明没有基元可抄——这正是命名它要解决的事。
domain 侧那两处**不在本单**，别顺手改。）

**验收**：只外链 core 的页面里 `<a class="tcrn-link">` 命中样式；四个对比度数字以断言形式写进门；
`.tcrn-link--quiet` 与 `.tcrn-breadcrumb a` 声明集合相同；DS `pnpm verify` 绿。

---

## 三、② `Pagination`（`TCRN-DS-STORY-096`）

`Pagination({label})` 今天渲染出 `<nav class="tcrn-pagination" aria-label="…"></nav>` —— 一个空地标。
**壳搭好了，件没做**：`.tcrn-pagination` 的行布局 CSS 早就在 core 里。

签名 `Pagination({ label, shown, total, nextHref, prevHref?, locale })`，三条边界各有确定行为：

- `total` 缺省 → 返回 `null`。没有产品数据就不出计数，边界由构造保证，不靠自律。
- `shown >= total` → 返回 `null`，整个 nav 一个字节都不留。不做假天花板。
- `nextHref` 缺省 → 省略该可点项，**不要渲染一个禁用态**。

**永不提供 `pageCount` 或页码。** 游标翻页的数据层算不出来，提供一个算不出来的 API 会让消费方
以为它能给。`prevHref` 由消费方供给（浏览器历史或调用方自己的游标栈），DS 不暗示 API 能产出它。

读数用 `text-secondary` 而非 `text-muted` —— 这不是本单新裁的，是抄 `.tcrn-table-toolbar__count`
的既有裁定：计数是真信息，而 muted 在面板上明 3.36:1 / 暗 4.21:1，两档都不到 4.5:1。

**验收**：三条边界各有测试；读数对比度两档 ≥4.5:1；输出中不出现页码；DS `pnpm verify` 绿。

---

## 四、④ 状态徽章一行不折（`TCRN-DS-STORY-097`）

**三处叠加，不是一处**，全在 `.tcrn-badge`：

1. `white-space:normal` + `overflow-wrap:anywhere`，配 `width:max-content` / `max-width:100%`
   → 单元格一窄就必折。
2. `::before` 定在 `inset-block-start:50%` → 单行时恰是文字中心，折成两行后落在**两行之间**，
   圆点不属于任何一行。
3. `text-align:center` → 单行无作用，一折行变成居中散排。

实测：状态列 150px、徽章被卡到 126px 时，`pending acceptance` 高 **36px** 而同列其它 **24px**；
该行从 **48px** 涨到 **62px**（+29%），同表其它行仍是 48px —— 表格的行高不再是常量。

**修法**：`white-space:nowrap`，去掉 `text-align:center`；新增 `.tcrn-badge__label` 承接截断。
**标记必须多一层 span**：`.tcrn-badge` 是 `inline-flex`，`text-overflow` 作用在弹性项上，
直接挂容器对匿名文本项无效。全文留在 `title` 与无障碍名里。

自由内容的徽章显式 opt-in `.tcrn-badge--wrap`。**`Badge` 今天一件干两份活** —— 封闭词汇的状态片，
和长度不可控的自由标签；默认值归状态片，因为 padding 与圆点的令牌本来就叫
`--tcrn-state-chip-padding` 与 `--tcrn-state-dot-size`，DS 自己早把它当状态片命名了。

`StatusBadge` 经 `Badge` 渲染，因此同样受益，**不需另改**。

**96px 的门槛是安全网，不该是常态**：七个状态 × 五种语言逐个量过，最宽的是法语 `En recette` **85px**；
撑破格子的 `pending acceptance` 是 **142px**，而它是裸枚举，本来就被
`tcrnI18nContract.rawEnumLabelsAllowed: false` 禁着。一个每天都在触发的降级不叫降级。

**验收**：150px 列里 `pending acceptance` 高 24px 且该行与同表其它行同高；截断出省略号且 title 有全文；
`.tcrn-badge--wrap` 仍能折行；门断言任一标签在参考度量下 ≤96px 且对 142px 判红；DS `pnpm verify` 绿。

---

## 五、③ 状态色调重排（AOS 仓，**未落链**）

**先说为什么不在链上，这不是遗漏。** AOS 分区的 Story 必须有 Epic 父项（实测 77/77，引擎对无父
Story 判 `REFERENTIAL_INTEGRITY`，我探过一次，被拒且未写入）。而 AOS 当前没有任何未完成的 Epic；
唯一候选 Initiative `TCRN-AOS-INIT-005` 写于 2026-08-18，讲的是把 25 个领域组件从 `@tcrn/ui-react`
迁回 AOS 并点名 `apps/web/src/work-management-mockups.tsx` —— **那棵树已被 INIT-006 重建整个销毁，
而 INIT-006 从未上链**。把一条真记录挂进一个描述着不存在之物的上下文，不比不挂好。
补 AOS 侧的 Initiative 是 Owner 的仪式。在那之前，这一条以本派工书为准。

**缺陷在分配，不在数量。** DS 已经答过这题：它用**十一个**状态对四种色调，收敛只发生在视觉层。
AOS 今天的映射（`apps/web/src/ui-kit.tsx` 的 `tone()` 与 `badgeTone()`，**同一份知识的两份抄写**）是反的：

- `active` → warning：一个正常推进中的任务被打扮成需要注意。一屏 `active` 全是琥珀色，
  一个健康的迭代看起来像告警板。
- `pending_acceptance` → neutral：**唯一真的在等人动手**的状态，被画成惰性的。

DS 表里的规则是可读的：`review_required` → warning、`ready` → positive。
**warning 的意思是「有人欠一个动作」，不是「这里在动」。**

要照搬的是**形状**不是位置：封闭联合 + 单一映射表 + fail-closed 默认 + `data-state` 保留身份 +
色调派生而非各调用点手写。那七个词是产品自己的词汇（`search-inbox.ts:532`「The seven words for
state, from 0002」），DS 的 `ReadinessState` 说的是证据就绪度，是另一根轴 —— **不要把产品状态塞进 DS**。

**不给「待验收」单开第五档。** 数字上 brand-accent 够（明 6.43:1 / 暗 5.71:1），但那是图章专用墨：
DS 明文把衬线与豫红保留给 `.tcrn-stamp`，并由 `scripts/stamp-whitelist-proof.mjs` 机器执行 ——
「an impression that shows up everywhere stops meaning anything」。设计必须活在四档之内。

**中文标签**：`STATUS_LABEL` 今天是英文近枚举词，而界面其余部分是中文；它没被 DS 的
`findRawEnumLabelHits` 拦下，只是因为下划线换成了空格。给七个状态一套中文文案。
**这是本条里唯一一处产品文案决定，Owner 可单独否掉它而保留色调重排。**

**不要碰的一件事**：徽章底对面板底只有 1.1:1 左右，这是**故意的、承重的**。DS 的注释写着状态读作
「ink dot plus word」，它替换掉的那种饱和色块「在这个密度下很吵」。提高那个对比是把设计意图当 bug 修绿。

**验收**：`active` 不再是 warning；`pending_acceptance` 拿到 warning；未知状态落中性默认且不抛错；
`data-state` 与状态一对一；全仓只有一处映射定义；状态标签是中文；AOS `pnpm verify` 绿。

---

## 六、顺序与停止点

DS 三条可并行，`TCRN-DS-INC-009` 独立。AOS 那条**要等 DS 打出新 tarball 之后**才能验完整
—— 它依赖案④的截断行为。

顺序：DS 三条 → DS 打包 → AOS 换 `vendor/*.tgz` → AOS 状态色调重排。

**做完不是 `done`。** DS 侧属机检车道，九个门组全绿即 `done`；AOS 侧是前端，属 Owner 亲眼判的车道，
门全绿后停在 `pending-owner-acceptance`。

发布、推 tag、部署是各自独立的停止点，不要从本地测试推断。
