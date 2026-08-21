# 派工：把 TCRN Design System 接进 AOS 的渲染管线

给 Codex。可以用 `goal` 指令一次做完。**没有硬门**，每一包末尾的「验收」是验收项，不是阻断条件。

---

## 零、先读这一节：本文的前一稿是错的

前一稿（提交 `c644607`）通篇建立在「AOS 是零脚本产品」这个前提上，把 DS 的一半组件判成「在零脚本下是死的」，并据此设计了绕路方案。**那个前提是本仓作者自己发明的，不是任何人的裁定。**

查证结果（2026-08-21）：

- 仓内两处主张（`README.md`、`AGENTS.md`）与两处门断言（`gate-human-only.mjs`、`gate-forms.mjs`）全部出自本次重建的提交 `c5df29e` / `5d782c4`。
- TCRN-AOS 分区链上 157 条记录里**没有 INIT-006**，本次重建的方向从未上链，零脚本自然也不在链上。
- **DS 没有这条规定，而且预期相反**：`Tabs` 的 `onSelect` 是必填的，`Dialog`/`Popover`/`Menu`/`Tooltip` 基于 Radix，包里还导出了 `useProductShellController` 这个驱动外壳的客户端 hook。
- 链上四条 `done` 记录（`TCRN-AOS-STORY-018` / `-022` / `-026` / `-108`）写的是**渐进增强**：「行点击只换右栏不跳页，**无脚本时退化为真链接**」「SearchInput 包 GET 表单（**Enter 无脚本可用**）**250ms 去抖**」。那几条描述的是被本次重建破坏掉的旧树，不是对新树的现行约束——但它们证明零脚本从来不是规定，是作者把一个渐进增强的姿态翻成了禁令，还写了门去执行自己的翻转。

Owner 2026-08-21 的裁定：**前端设计规范只从 DS 取；不是 DS 规定的就撤销。**

撤销已随本次提交落地：`README.md`、`README.zh-CN.md`、`AGENTS.md` 三处措辞改写并写明为什么改，`gate-human-only.mjs` 的 `no page carries a script tag` 一步删除，`gate-forms.mjs` 里「渲染出的页面含客户端 JavaScript 即判失败」一段删除。**两道门证明「手工可管理」的部分一个字没动**——零个 agent 主体、MCP 全程未被调用、每一步都是从渲染出的标记里读出来的表单——那才是 Owner 真正提过的要求（「手工也能管理项目」）。

`docs/handoff-init006-remaining.md` 里也提到过那条断言。**不要去改它**：那是一份已完成派工的历史记录，记的是当时被要求做什么。本文取代它，不改写它。

---

## 一、这一包做什么，不做什么

Owner 的裁定分成两句，两句都要照做：

> 我同意你先带入 DS 的组件和 CSS 规范，**但是具体的页面设计先 hold 住**，我们要一页页来过，首先是登录页面。

**做（基座）**：DS 的 CSS 与资产按正确方式供给；外壳换 `ProductShell`；原语一对一换 DS 现成件；加一道能自动发现「假样式」和「泄漏属性」的验收门。

**不做（页面设计）**：任何页面的版式、信息架构、栏目取舍、文案。登录页是 Owner 要过的第一页，这一包只换它的原语，**长相一个像素都不许动**。工作项列表页上一轮做过预览、Owner 已 hold，那版不进仓也不要去找。

判断边界：**如果一个改动会让页面截图变得不一样（DS 组件自带样式导致的差异除外），它就不在这一包里。**

**不许自造任何 DS 没有的组件。** 缺件的地方在第六节点名，一律停下、留裸标签、写进呈报。Owner 的原话是「不够的就向我申请设计审核并导入，而不是自立门户」。

---

## 二、你不需要重新发现的事实

下面每条都是本仓实测出来的，直接用。

**AOS 本来就在跑 React。** `apps/server/src/render.tsx:1` 是 `import { createElement as h } from "react"`，出口是 `renderToStaticMarkup`。DS 组件直接落进现有管线，**不改构建、不动 tsconfig、不引 JSX 转换**。

**DS 是 vendored tarball，不是兄弟仓路径依赖。** `package.json:50-52` 是 `file:vendor/tcrn-ui-*.tgz`，三个 tgz 已入库。`gate:absence`（管的是 tcrn-workflow / helper）和 `gate:self-sufficiency` 都不受影响，不要为 DS 去改它们。

**AOS 已在 DS 的产品标识注册表里。** `tcrnProductLogoRegistry` 四个条目 `design-system / aos / tms / workflow`；`aos` 的 `assetId` 是 `tcrn-aos-two-line`，wordmark「TCRN AOS」。传 `brandProductId: "aos"` 就能取到，**不要自己写死品牌文案**。属性名是 `brandProductId` 不是 `productId`，传错会静默退回通用的「TCRN 产品」。

**品牌 svg 不在 npm 包里，但在 DS 的正本站上。** 跟随符号链接重查、并直接列三个 tgz 内容：里面只有 `tokens.css`，没有任何 svg 或字体。资产在 Owner 指定的设计权威源上，就在 DS 默认 `src` 期望的裸路径：

```
https://tcrn-design-system-storybook.vercel.app/tcrn-brand-mark.svg
```

实测 `200` / `image/svg+xml` / `64,989` 字节（2026-08-21）。取它，落进 AOS 自己的 `/assets/`，**不要自画占位图**。

---

## 三、客户端运行时：这一包不决定它

脚本不再被禁，但这一包**也不引入客户端 React 运行时**。理由：把 DS 接进来不需要它，而加水合（hydration）是比原语替换大得多的一次架构改动，应该在遇到真正需要它的那一页时单独决定——那正是 Owner 说的「一页页来过」。

所以这一包的姿态是：**服务端渲染 DS 组件；需要客户端才活的控件，先如实留着并列进清单。**

`ProductShell` 无条件渲染五个控件，在没有客户端运行时的情况下都不响应：`SideNavCollapseButton`、`MobileNavToggle`、`ShellThemeToggle`、`ShellLocaleMenu`、`ProductShellSearch`。

**这一包对它们的处置：**

- 用 DS 自己给服务端准备的通道读初值：`readPreferenceCookieValues(cookieHeader, keys)` 返回 `ProductShellRequestPreferences`，包里注释写着「消费者在自己的请求处理器里调一次，把结果作为 `requestPreferences` 传进来」。主题、语言、侧栏收起的**初始状态**走这条路。
- 先不传 `search` 属性，让 `ProductShellSearch` 不渲染。AOS 已有 `/search` 页面，壳层搜索是重复的。
- 其余四个照常渲染。包 E 的门会把它们列进清单，让「哪些控件还没活」是一份看得见的账，而不是谁记得。
- **不要为了让它们动而自己写脚本或包表单。** 那是下一次决定的事。

---

## 四、包 A：CSS 与资产的供给方式

**现状。** `apps/web/src/styles.ts` 是 282 行、89 条规则的自写样式表，被 `render.tsx` 的 `html()` 用 `<style dangerouslySetInnerHTML>` **内联进每一个页面**。tokens 已走 `/assets/tokens.css`（`apps/server/src/main.ts:88`）。

1. 照 tokens.css 的样子加 `/assets/tcrn.css`。DS 导出两个粒度：`tcrnCoreComponentCss`（77,310 字节）和 `tcrnComponentCss`（105,187 字节，含 domain 件）。**先用 core**；若门报出有类没定义再换全量，并在提交信息里写明是哪个类逼的。
2. `html()` 里加 `<link rel="stylesheet" href="/assets/tcrn.css">`，位置在 tokens 之后、AOS 自己的 `<style>` 之前。
3. 加 `/assets/tcrn-brand-mark.svg`（来源见第二节），`ProductShell` 传 `brandMarkSrc="/assets/tcrn-brand-mark.svg"`。
4. **AOS 自己的 `STYLESHEET` 逐条过。** 每条规则两个下场：DS 有对应件的删掉；DS 没有的留下，**并在规则上方写一行为什么必须留**。不写理由的留存视为遗漏。
5. 不要把 DS 的 CSS 内联进 HTML。100KB 乘每次加载，而 `<link>` 可缓存。

**CSP 不用改。** 现在是 `style-src 'self' 'unsafe-inline'`、`img-src 'self' data:`（`packages/kernel/src/read.ts:186`），`<link>` 与 `/assets/*.svg` 都在 `'self'` 内。**注意 `script-src 'self'`**：将来真加脚本，内联的会被这条挡掉，得走外部文件。这一包不涉及。

**验收**：页面 HTML 里不再内联 DS 的 CSS；`GET /assets/tcrn.css` 与 `/assets/tcrn-brand-mark.svg` 都 200 且 content-type 正确；`styles.ts` 每条留存规则带理由；`pnpm verify` 走通。

---

## 五、包 B：外壳换成 `ProductShell`

`render.tsx` 里的 `Shell()` 换成 `DS.ProductShell`，传 `brandProductId: "aos"`、`brandHref: "/"`、`brandMarkSrc`、`navGroups`、`navLabel`、`locales`、`currentLocale`、`currentRouteLabel`、`requestPreferences`。`ProductShellNavItem` 的 `href` 必填，AOS 的链接式导航正好合。

五个壳层控件的处置见第三节。

**验收**：`gate:forms`、`gate:human-only` 绿；品牌区渲染出的是 DS 注册的「TCRN AOS」而不是通用回退。

---

## 六、包 C：原语一对一替换

**纪律先写在前面：只换组件，不改结构。** 同一段 DOM 里元素的顺序、层级、文案、条件分支，一个都不许动。改版式是 Owner 一页页过的时候的事。

**ui-kit 九件**（用点数为实测）：

| `apps/web/src/ui-kit.tsx` | 用点 | 换成 | 说明 |
|---|---|---|---|
| `Field` | 88 | `DS.Field` | DS 的是超集 `{label, hint, error, children}`，AOS 的是 `{label, hint, children}`。顺手核 label 与控件的 id 关联 DS 有没有接上——AOS 现在是裸 `<label>` 不带 `for`，本来就没接 |
| `Panel` | 50 | `DS.Card` | `CardProps extends HTMLAttributes` + `tone` + `interactive`。AOS 的 `Panel` 有 `title`，DS 的没有；title 用 `DS.Heading` 单独放进 Card，**不改标题层级** |
| `Pill` | 41 | `DS.Badge` | 见下面的色调警告 |
| `Empty` | 39 | `DS.EmptyState` | `Omit<StateSurfaceProps,"tone"> & {tone?:"neutral"｜"warning"}`，有 `title`/`description`/`icon`/`action` |
| `breadcrumb` | 17 | `DS.Breadcrumb` | `BreadcrumbItem` 有 `href`，渲染真链接；末项省略 href 即当前页 |
| `rowsList` | 5 | `DS.TableShell` | `{columns:{key,label,value}[], rows:Record<string,ReactNode>[], emptyState?, label?}` |
| `Form` | 52 | **保留** | AOS 特有的 csrf + redirect 隐藏字段，DS 无对应物 |
| `Attribution` | 16 | **保留** | DS 无对应物 |
| `Truncation` | 14 | **保留** | DS 的 `Pagination` 是空的，见第八节 |

**裸标签**，有确切对应件的换：

| 现在 | 用点 | 换成 |
|---|---|---|
| `h("input")` | 137 | `DS.Input`（`type="checkbox"` 的换 `DS.Checkbox`） |
| `h("button")` | 55 | `DS.Button` |
| `h("select")` | 30 | `DS.Select`（`options: {value,label}[]`，不是 children） |
| `h("h2")` | 21 | `DS.Heading level={2}` |
| `h("textarea")` | 19 | `DS.Textarea` |

**明确不动**，DS 没有对应件，换了就是自造：`h("div")` 267 · `h("p")` 163 · `h("span")` 137 · `h("a")` 102 · `h("ul")`/`h("li")` 48 · `h("label")` 5。

其中 **`h("a")` 那 102 个最要紧**。DS 的 86 件里带链接语义的只有 `LinkButton`（按钮外观的 `<a>`）和 `SkipLink`，**没有正文链接件**。这 102 个保持裸 `<a>`、保持浏览器默认外观，**不要给它们写任何 CSS**——写了就是自立门户，缺口要看得见 Owner 才能裁。

**色调警告，这是上一轮踩过的坑。**

`Badge` 的 `Tone` 只有四个值：`neutral | positive | warning | danger`。上一轮传了 `info`，TypeScript 没拦住（经 `h()` 传的），渲染出 `class="tcrn-badge tcrn-badge--info"`，而 `tcrn-badge--info` **在 DS 的 CSS 里根本不存在**，结果和 `neutral` 长得一模一样，肉眼要盯着才发现。同类错还有一个：给 `DS.Text` 传 `tone="muted"`，`Text` 根本没这个属性，原样泄漏成 `<p tone="muted">` 这个无效 DOM 属性。包 D 的门就是为这两个错写的。

另：`neutral` 在 CSS 里也没有自己的类——它就是徽章的基础样子。所以 DS 给徽章的实际外观只有**四种**，而 AOS 有**七个**工作状态。这个碰撞在第八节呈报，**不要自己挑映射**：`Pill` 换 `Badge` 时把 `ui-kit.tsx:53` 现有的 `tone()` 原样搬过去（它只区分 done / active / blocked，其余无色调），不要扩展。

**验收**：`pnpm typecheck` 绿；`pnpm test` 53/53；`gate:forms` 绿（它开每条 ui.route 重放每个表单，`DS.Input`/`Select`/`Textarea` 丢了 `name` 立刻红）；`gate:human-only` 绿。

---

## 七、包 D：新增 `gate:ds-adoption`

跑在真起的服务器上，照 `scripts/gate-forms.mjs` 的样子（起服务、遍历每条 `ui.route`、parse5 解析）。三条断言 + 一份清单。

**断言 1 — 没有假样式。** 收集渲染结果里所有带 `--` 的 `tcrn-*` 修饰类，逐个到供给的 CSS 里查有没有定义。查不到就红，并报出是哪个组件的哪个属性造出来的。

**断言 2 — 没有泄漏的属性。** 渲染结果里不出现 `tone=`、`variant=`、`selected=`、`interactive=` 这些落在 DOM 元素上的组件属性名。这类泄漏 React 不报错、TypeScript 经 `h()` 也拦不住，只有看渲染结果能发现。

**断言 3 — 没有内联的 DS CSS。** 页面 HTML 里不出现 DS 组件 CSS 的正文，防止退化回内联 100KB。

**清单（不判红）— 尚未生效的控件。** 列出渲染结果里每一个既不在 `<form>` 内、也不带 `form=` 属性、也没有 `href` 的 `<button>`，连同它的 `data-shell-control` 或最近的 `tcrn-*` 类。这不是失败，是一份账：客户端运行时的决定还没做（第三节），这份清单就是那次决定要看的输入。**清单不许为空却不打印**——每次跑都要输出，哪怕零条。

**验收**：门自己红过一次再变绿——先故意传一个 `tone="info"` 确认断言 1 抓得住，再故意给 `DS.Card` 传 `interactive` 确认断言 2 抓得住。**没红过的门不算写完。**

---

## 八、呈报给 Owner，不要 Codex 决定

前一稿列了六条，撤销零脚本前提后剩三条。碰到就停下、留裸标签、记在这里，**不要发明替代品**。

1. **正文链接件。** DS 无对应物，见包 C。已申请 `Link` / `TextLink`。
2. **`Pagination` 的链接形态。** 实测 `Pagination({label})` 渲染出 `<nav class="tcrn-pagination" aria-label="…"></nav>`——一个空地标，里面什么都没有。**这条与脚本无关**，撤销后依然成立。已申请补 `prevHref` / `nextHref` / `disabled`。
3. **工作状态词汇表。** `StatusBadge` 绑死在 `CopyStateInput` 的 11 个就绪度值上，不是 AOS 的七个工作状态；退到 `Badge` 只有四种外观。已申请。

**前一稿列过、现已撤销的三条**（记在这里是为了不再有人把它们捡回去）：分段导航需要 `href` 形态、`Tabs` 不可用、语言菜单与壳层搜索是死的。三条都只在零脚本前提下成立，前提已撤。

回报给 DS 的缺陷一条（不阻塞）：`ShellLocaleMenu` 内部渲染 locale 列表缺 `key`，每次 SSR 都出 React 告警。

---

## 九、顺序与提交

A → B → C → D。每包一次提交。C 包最大（约 400 个用点），可按文件切成 `render.tsx` / `admin` / `collab` / `governance` / `knowledge` 五次。

提交身份 `tpmoonchefryan <253097889+tpmoonchefryan@users.noreply.github.com>`，不加 `Co-Authored-By`。

**做完不是 `done`。** 前端属于 Owner 亲眼判的那条道，停在 `pending-owner-acceptance`。之后 Owner 一页页过设计，第一页是登录页。
