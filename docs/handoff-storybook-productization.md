# 派工：Storybook 产品化与三处 DS 缺陷

> **2026-08-22 更新**：本批已扩为十五条单，其中十四条属 DS 仓。
> **完整派工书已移至 DS 仓**：`TCRN-Design-System/docs/2026-08-22-de-productization-handoff.md`
> —— 那里是这些工作的home。本文保留为本批的缘起记录，以及 `TCRN-AOS-INC-052`（本仓唯一一条）的规格。
> 两个待裁项（`WorkRelationshipType`、`GatePipelineGate`）Owner 已裁「通用」，详见 DS 侧派工书第三节。

给 Codex。可以用 `goal` 指令完成。**没有硬门**，末尾的「验收」是验收项。

Owner 于 2026-08-22 看图指出 Storybook 的样式与章节产品化问题，并要求一并检查 logo 取用规则。

---

## 零、五条落在哪

| 单 | 内容 | 仓 |
| --- | --- | --- |
| `TCRN-DS-INC-010` | Storybook 文档外壳未产品化（7 个栏目落地页 + 翻页器 + 四类杂项 + 一道门） | TCRN-Design-System |
| `TCRN-DS-INC-011` | core 缺三组修饰类定义（inline-alert / state-view / heading--4 + 一道门） | TCRN-Design-System |
| `TCRN-DS-INC-012` | AI 消费契约不写品牌资产的正本取用地址 | TCRN-Design-System |
| `TCRN-DS-INC-013` | `--wrap` 档圆点仍浮在两行之间（STORY-097 残留） | TCRN-Design-System |
| `TCRN-AOS-INC-052` | `LEGACY_TONE_ALIASES` 与工作状态词撞 | TCRN-AOS |

**每条单的 scope 就是规格**，链上写得比本文细，动手前读它。

---

## 一、一条贯穿全部五条的认识

**Storybook 是 DS 自己的发布面，本地这份仓是开发源码。** 消费方（包括 AI 消费方）取的是发布出去的那份。
所以：

- 发布面的未产品化不是内部瑕疵，是**权威源本身在向所有消费方展示一个未完成的样子**（INC-010）
- 品牌资产的取用路径必须指向发布面，**不许写成仓内路径**（INC-012）——那正是这条单要区分掉的东西

---

## 二、INC-010 Storybook 文档外壳

实测（量的是 `storybook-static` 构建产物，不是源码推断）：

- `tcrn-doc-category-index` 全家 **7 个类在三份样式表里一条定义都没有**。浏览器实测链接色
  `rgb(0, 0, 238)`、`text-decoration: underline`——就是浏览器默认。**七个栏目落地页全部如此**：
  `index`(欢迎)、`style-guide`、`foundations`、`components`、`patterns`、`change-log`、`proof`。
  那是读者进入每一章时第一眼看到的页。
- 同一页两个 `<h2>欢迎</h2>`：一个来自 `pageHeadHtml`，一个来自 `sectionIndexBodyHtml`。
- `tcrn-doc-chapter-pager__link--previous` 无定义（29 页命中），而 `--next` 有——翻页器只有一半有样式。
- 另有 `tcrn-doc-nav__section-icon-svg`（224 次 / 32 页）、`tcrn-story-disclosure__title` 与
  `__chevron-svg`（各 55 次 / 20 页）、`tcrn-component-reference__intro`（5 页）、`tcrn-eyebrow` 无定义。

**链接直接用 `.tcrn-link`，不要自造。** 那个基元刚随 `TCRN-DS-STORY-095` 进 core，栏目页正是它的用例。

**第五项那道门是本条唯一防复发的东西**：断言文档模板用到的每个 `tcrn-*` 类都在样式表里查得到。
前四项补的是这一批，门管下一批。

---

## 三、INC-011 core 的修饰类

实测 `tcrnComponentCss`（106,900 字节）：

- `.tcrn-inline-alert--warning` 有，`--danger` / `--positive` / `--neutral` **没有**——
  一条危险提示与一条中性提示长得一样
- `.tcrn-state-view` 基类有，四个色调修饰 **全部没有**
- `.tcrn-heading--1/2/3` 有，`--4` **没有**（构建产物里 34 次 / 4 页）

取值沿用既有状态令牌，**不新造颜色**。

**这是同一类错的第三次。** 设计规格作者写案④时给 Badge 传了 `tone="info"`，`tcrn-badge--info`
不存在，渲染出来和 neutral 一样，肉眼盯着才发现；AOS 因此在 `gate:ds-adoption` 立了一条断言。
**那道门在消费方仓里，而缺陷在 DS——消费者替权威源立了门，权威源自己没有。** 本条把它搬回来。
可参考 AOS 那道门的做法，但**不许跨仓引用其代码**。

---

## 四、INC-012 契约里的取用路径

契约把「必须用哪一个 logo」写到了极细——`productLogoRegistry` 有每个产品的 assetId、五语 tagline、
suffix 类名；`requiredBeforeProductFrontendImplementation` 第 6/7/8 条强制使用已登记资产。
**但 40 个顶层键里没有一条说那个 svg 从哪里取。**

三包实测不带任何 svg 或字体实体（直接列 tar 即可确认）；`TcrnBrandMark` 的默认 `src` 是裸相对名
`"tcrn-brand-mark.svg"`，即假定消费方自己在同源下供一份。结果是**最该被规则挡住的那一步反而没有规则**——
AOS 接入时只能靠人去发布面上试出来。

同样没写进契约的另一半：**开发源码与发布面的区别**。一个读到本仓的消费方会以为仓里那份就是权威。

**不要把答案写成仓内路径。** 路径要指向消费方真正能取到的那一份，并配一个可复核命令——
一条无人核对的地址与没有地址等价。

---

## 五、INC-013 `--wrap` 档的圆点

实测：`--wrap` 徽章折成两行、高 36px 时，圆点中心距顶 **18px**，第一行文字中心在 **10.5px**——
点在两行之间。根因未变：`.tcrn-badge::before` 仍是 `inset-block-start: 50%`。

STORY-097 的三处成因里，①会折与③居中散排随 `nowrap` 一并解决，②**是被遮住而不是修好的**。
`--wrap` 是现在唯一能折行的路径，谁 opt-in 谁就撞上。

**判据 2 是安全带**：单行外观一个像素都不许变。

---

## 六、INC-052 AOS 的词撞（另一个仓）

`STATUS_TONE` 与 `LEGACY_TONE_ALIASES` 两张表，后者含 `active → warning`——正是重排要修掉的错映射。

**今天到不了**：两处 `statusPill` 都走 `tone(status)`，返回色调词，`badgeTone` 第一分支放行。
但有 **8 处**调用点传与工作状态同名的字面量作 toneName（「未读」传 `"active"`、「实例管理员」传
`"active"`、「已停用」/「过期」传 `"blocked"`、「已复核」/published 传 `"done"`），喂的正是 legacy 表。

**风险在将来**：谁写一句 `h(Pill, { toneName: item.status })`，会静默拿回旧的错映射而不报错。

改键名（较小）或显式拒绝工作状态字符串（较严），二选一，**并在测试里钉住**。
那 8 处的观感不改。

---

## 六点五、EPIC-034 发布面去产品化（新增一批）

Owner 2026-08-22 追加裁定：**「DS 的 Storybook 应该提供平台统一的设计规范和组件，不应该按产品分类，
而是按功能来分，不同产品相同功能的地方都可以使用，而不是仅限于一个产品，那么这个 DS 就没有意义了。」**

实测（量的是构建产物）：

- 十八个分类槽里 **三个**是某一产品的域名：`work-management`（「组件」与「模式」两章各一）、
  `knowledge-management`（「组件」章）——那是 AOS 的工单与知识库
- 五十五个故事里 **十三个**是产品或产品域形态：`aos-frontend-shell-slice`、
  `aos-owner-quality-product-shell`，加上 `work-management-*`(8) 与 `knowledge-management-*`(3)
- **没有任何 TMS 或 workflow 命名的故事**——若分类真按功能划分，同一个槽位本应同时服务三个产品

对照：core 的 86 个导出里以业务实体命名的是 **0**，`@tcrn/ui-domain` 的 35 个里有 **30 个**是
`Work*`/`Knowledge*`/`Gate*`/`Evidence*`。**INIT-012 修好了包的边界，发布面没动。**

三条子单：

| 单 | 内容 |
| --- | --- |
| `TCRN-DS-STORY-098` | 三个分类槽换功能名，十一个故事按功能重新归位 |
| `TCRN-DS-STORY-099` | 两个 AOS 具名故事：把「取证对象」与「判据」分开 |
| `TCRN-DS-STORY-100` | 发布面命名门（先立门、后清债，照 STORY-094 的次序） |

**功能名由 Owner 定**，STORY-098 只提候选、不自行落名。取名判据是「另外两个产品看到这个名字，
知道自己要的东西在里面」。

**不要删故事。** 十三个故事的内容是真做过的工作，这一批是把它们放回按功能划分的位置。

**一件不在本批、须另呈 Owner 的**：`WorkActivityFeed`、`KnowledgePageTree`、
`EvidenceAttachmentList` 这些**导出名**描述的其实是活动流、页面树、附件列表这些通用功能，
按同一条裁定它们本就该三个产品共用。但改导出名会动到消费方，且 INIT-012 依
`TCRN-TMS-MIN-008` 已裁「抽出而非删除」并据此建了 `@tcrn/ui-domain`——改变那个方向是一次新的裁定。
本批只做发布面。

---

## 六点六、EPIC-035 组件与类型去产品化，`@tcrn/ui-domain` 归并

Owner 2026-08-22 追加裁定：**「一并做，接受重组重构」**——把「按功能而非按产品」从发布面贯彻到
组件与类型本身。

### 先读这一段：判据被施加在名字上

`scripts/generic-primitive-scan.mjs` 的 `DOMAIN_PREFIXES` 是 `["Work","Knowledge","Gate","Evidence"]`，
匹配式 `^export function ((?:Work|Knowledge|Gate|Evidence)[A-Z]\w*)`——**只读函数名，从不看 props**。
执行「组件属于 DS 当且仅当其 props 能被描述而不提及任何单一产品的业务概念」这条裁定的机制，
检查的是名字。两个方向的错都由此产生：

- **假阴性**：`WorkActivityFeed` 改名 `ActivityFeed`，门立刻变绿，而它是否通用毫无变化
- **假阳性**：`KnowledgeLabelSet`、`MachineToken`、`WorkFieldPanel`、`WorkInlineCreateStatic`、
  `WorkSplitView` 的 props 里**不出现任何产品实体类型**，按裁定本就属 core，却因前缀被逐出

**所以 STORY-101 必须先做。** 后面四条会大量改名，判据不先修，那些改名会让门整片变绿——
而变绿的原因是判据被绕过，不是实质变好。

### 实测出来的三件事

**一、同一功能被实现了多遍。** 五个组件 props 形状完全相同（`density, items, label, locale`）：
`EvidenceAttachmentList` ≡ `KnowledgeAttachmentList` ≡ `WorkActivityFeed` ≡ `KnowledgePageTree` ≡
`KnowledgeTocRail`。前两个连文案表都是同一张 `attachmentTableLabels`，只差默认密度；
`MetadataRail` 与 `KnowledgeMetadataRail` 只差一个可选 `labels`。

**注意 STORY-102 的判据 3**：后三个形状相同但**职责不同**，是三个功能共用一个 props 形状，
**不是同一功能的三份实现**——不要合并，并把这个区分写进注释。

**二、类型层同样带产品前缀，而多数是通用概念穿了产品的名字。** `WorkAction` 就是一个动作
（出现在四个组件上）、`KnowledgeVersion` 就是一个版本、`EvidenceAttachment` 与
`KnowledgeAttachment` 是同一个附件的两个名字。乙组 26 个之所以「props 含产品实体」，
正是因为这些类型自己带前缀——**判据在此处是循环的**。不改类型，组件改名就是表面工作。

**三、该包没有任何产品消费方。** AOS 零代码引用、TMS 零、workflow 零。唯一消费方是 DS 自己的
Storybook 与 `examples/tms-react-pilot`，而后者第 3 行是
`import { WorkIndex } from "@tcrn/ui-domain"`——**一个 TMS 示例引用以 AOS 域命名的组件**，
本裁定要消除的形态在仓里已经字面发生。

**重构因此不打断任何产品。** 若实施中发现某个未登记的消费方，停下来呈报，不要就地改人家的代码。

### 五条子单，次序要紧

| 单 | 内容 |
| --- | --- |
| `TCRN-DS-STORY-101` | 通用性判据从名字改为 props 实质（**先做**） |
| `TCRN-DS-STORY-102` | 合并重复实现（AttachmentList、MetadataRail） |
| `TCRN-DS-STORY-103` | 类型层去产品化，一路到底 |
| `TCRN-DS-STORY-104` | 组件按功能改名并归位 core |
| `TCRN-DS-STORY-105` | `@tcrn/ui-domain` 的处置（先清点，再结论） |

**功能名由 Owner 定**，STORY-104 只提候选。判据与 EPIC-034 一致：
「另外两个产品看到这个名字，知道自己要的东西在里面」。

**STORY-104 最容易犯的错是查重不足**：core 已有 `DetailInspector`、`SegmentedNav`、
`SectionTabs`、`TableShell`，而 `WorkItemInspector`、`WorkViewTabs`、`WorkList` 归位后
很可能与它们同功能。把一个产品域件改名后放进 core，结果 core 里出现两个做同一件事的组件——
那是把问题从一处搬到另一处。**先查重，再改名。**

**两个待裁项**（STORY-103 提出判断、不自行拍板）：`WorkRelationshipType`（十二个具名关系类型）
与 `GatePipelineGate`（治理门）是否也应通用化。一个由调用方给词汇表的关系芯片、
一个由调用方给阶段的流水线，本身是通用的。

### 与 `TCRN-TMS-MIN-008` 的关系

INIT-012 的抽出是对的：当时 AOS 在用那些组件，删掉会打断唯一的活消费方。今天那个消费方不在了。
**这是前提失效，不是裁定被推翻**——STORY-105 的判据 4 要求把这句话写清楚。

---

## 七、顺序与停止点

INC-010/011/012/013 同在 DS 仓，可并行；INC-052 在 AOS 仓，独立。

EPIC-034 与 EPIC-035 是同一裁定的两面，**要在故事 id 上对齐**（发布面改名与组件改名不能各叫各的）。
EPIC-035 内部次序是硬的：**101 → 102 → 103 → 104 → 105**，先修判据再改名。

DS 改完若动了 `tcrnComponentCss`，按既有约定要重打 tarball、AOS 换包、门户刷新 CSS 快照
（`TCRN-CROSS-INC-223` 立的规矩）。

提交身份 `tpmoonchefryan <253097889+tpmoonchefryan@users.noreply.github.com>`，不加 `Co-Authored-By`。

**做完不是 `done`。** INC-010 的外观归 Owner 亲眼判，门全绿后仍待 Owner 看；其余属机检车道。
推送、发布、部署是各自独立的停止点。

---

## 附：本批未开单的两件

- **密度修饰的长尾**：`--compact` / `--dense` 在组件表里是有的（10 / 18 次），但没覆盖到每个组件；
  `--comfortable` 一次都没有。构建产物里有二十余个这类类名无定义。未开单是因为还不确定它们是
  「该有样式而漏了」还是「本就只作语义标记」——需要先有一个判断，而那个判断是 Owner 的。
- **`TCRN-DS-STORY-097` 判据 4 已作废**（rev 3 注记）：那条要求 DS 断言七状态标签宽度不超过 96px，
  但七个状态是 AOS 的词汇、案③已裁定留在 AOS，DS 侧没有可查的文案——**判据写错了仓，是写单人的错**。
  测得的数字仍成立（最宽真实标签 85px、裸枚举 142px），断言的归属地是 AOS，该门另开单。
