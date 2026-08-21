# 派工：把 TCRN Design System 接进 AOS 的渲染管线

给 Codex。可以用 `goal` 指令一次做完。**没有硬门**，下面每一包末尾的「验收」是验收项，不是阻断条件。

---

## 零、这一包做什么，不做什么

Owner 2026-08-21 的裁定分成两句，两句都要照做：

> 我同意你先带入 DS 的组件和 CSS 规范，**但是具体的页面设计先 hold 住**，我们要一页页来过，首先是登录页面。

所以：

**做（基座）**
- DS 的 CSS 与资产按正确方式供给
- 外壳换成 `ProductShell`
- 原语一对一换成 DS 现成件——**只换实现，不改版式**
- 新增一个能自动发现「死控件」和「假样式」的验收门

**不做（页面设计）**
- 任何页面的版式、信息架构、栏目取舍、文案
- 登录页的设计。登录页是 Owner 要一页页过的第一页，**这一包只把它的原语换掉，长相一个像素都不许动**
- 工作项列表页的设计。上一轮做过一版预览，Owner 已 hold，那版不进仓，也不要去找

判断边界的一句话：**如果一个改动会让页面截图变得不一样（DS 组件自带样式导致的差异除外），它就不在这一包里。**

同样重要：**这一包不许自造任何 DS 没有的组件。** DS 缺件的地方在第六节点名，一律停下、留裸标签、写进呈报，不要发明替代品。Owner 的原话是「不够的就向我申请设计审核并导入，而不是自立门户」。

---

## 一、你不需要重新发现的事实

下面每一条都是 2026-08-21 在本仓实测出来的，直接用，不用再验一遍。

**AOS 本来就在跑 React。** `apps/server/src/render.tsx:1` 是 `import { createElement as h } from "react"`，出口是 `renderToStaticMarkup`。DS 组件可以直接落进现有管线，**不需要改构建、不需要动 tsconfig、不需要引入 JSX 转换**。

**DS 是 vendored tarball，不是兄弟仓路径依赖。** `package.json:50-52` 是 `file:vendor/tcrn-ui-*.tgz`，三个 tgz 都已入库。所以 `gate:absence`（管的是 tcrn-workflow / helper）和 `gate:self-sufficiency` 都不受影响，不要为了 DS 去改它们。

**DS 的 SSR 是干净的。** 实测 `ProductShell` 加一整页内容渲染出 21,978 字节标记，`<script>` 标签 **0 个**。`gate:human-only` 的「无 script」断言不会因为接入 DS 而红。

**AOS 已经在 DS 的产品标识注册表里。** `tcrnProductLogoRegistry` 有四个条目 `design-system / aos / tms / workflow`；`aos` 的 `assetId` 是 `tcrn-aos-two-line`，wordmark「TCRN AOS」。传 `brandProductId: "aos"` 就能取到，**不要自己写死品牌文案**。注意属性名是 `brandProductId` 不是 `productId`——传错会静默退回通用的「TCRN 产品」。

**DS 只有一个组件带必填回调。** 扫全部 `*Props` 接口，必填 `on*` 的只有 `Tabs.onSelect`。其余组件的回调都是可选的，SSR 下不传即可。

**壳层的三个按钮能在零脚本下变活。** `ProductShell` 无条件渲染五个控件。实测 `ShellThemeToggle`、`SideNavCollapseButton`、`MobileNavToggle` 渲染时**不带** `type="button"`，且 `name` / `value` / `form` 能经 `...props` 透传（`IconButtonProps extends ButtonProps extends ButtonHTMLAttributes`）。放进 `<form method="POST">` 里它们就是真提交按钮。剩下两个不行，见第六节。

**DS 自己就准备了服务端渲染的偏好通道。** `readPreferenceCookieValues(cookieHeader, keys)` 返回 `ProductShellRequestPreferences`，包里的注释写着「消费者在自己的请求处理器里调一次，把结果作为 `requestPreferences` 传进来」。主题、语言、侧栏收起都走这条路，不要自己另发明一套。

---

## 二、包 A：CSS 与资产的供给方式

**现状。** `apps/web/src/styles.ts` 是 282 行、89 条规则的自写样式表，被 `render.tsx` 的 `html()` 用 `<style dangerouslySetInnerHTML>` **内联进每一个页面**。tokens 已经走 `/assets/tokens.css`（`apps/server/src/main.ts:88` 的 `require.resolve("@tcrn/ui-tokens/tokens.css")`）。

**要做的。**

1. 照 tokens.css 的样子加一条 `/assets/tcrn.css` 路由，内容是 DS 的组件 CSS。DS 导出两个粒度：`tcrnCoreComponentCss`（77,310 字节）和 `tcrnComponentCss`（105,187 字节，含 domain 件）。**先用 `tcrnCoreComponentCss`**；如果构建出来发现有类没定义（包 E 的门会告诉你），再换全量并在提交信息里说明是哪个类逼的。
2. `html()` 里加 `<link rel="stylesheet" href="/assets/tcrn.css">`，放在 tokens 之后、AOS 自己的 `<style>` 之前。
3. **AOS 自己的 `STYLESHEET` 逐条过一遍。** 每条规则只有两个下场：DS 有对应件的删掉；DS 没有的留下，**并在那条规则上方写一行注释说明它为什么必须留**。不写理由的留存视为遗漏。
4. 不要把 DS 的 CSS 内联进 HTML。100KB 乘以每一次页面加载，而且 `<link>` 可缓存。

**品牌资产。** `brandMarkSrc` 的默认值是裸相对名 `"tcrn-brand-mark.svg"`，而 `find node_modules/@tcrn -name '*.svg'` **结果为空**——包里不带 svg 实体，得由消费者自己供。这一项**你不要自己画**：在第六节呈报里向 Owner 取正本文件，拿到之前先传一个明确不存在的路径（例如 `/assets/tcrn-brand-mark.svg`）让它 404，不要用占位图糊过去。

**CSP 不用改。** 现在是 `style-src 'self' 'unsafe-inline'`、`img-src 'self' data:`（`packages/kernel/src/read.ts:186`），`<link>` 和 `/assets/*.svg` 都在 `'self'` 里。

**验收**
- 渲染出的页面 HTML 里不再内联 DS 的 CSS
- `GET /assets/tcrn.css` 返回 200，`content-type` 是 `text/css`
- `styles.ts` 里每一条留存规则都带理由注释
- `pnpm verify` 十六步仍走通

---

## 三、包 B：外壳换成 `ProductShell`

**现状。** `apps/server/src/render.tsx` 里的 `Shell()` 是自写的。

**要做的。** 换成 `DS.ProductShell`，传 `brandProductId: "aos"`、`brandHref: "/"`、`navGroups`、`navLabel`、`locales`、`currentLocale`、`currentRouteLabel`。`ProductShellNavItem` 的 `href` 是必填的，AOS 的链接式导航正好合。

**五个壳层控件的处置，一个都不许留成死的。**

| 控件 | 零脚本下 | 这一包怎么办 |
|---|---|---|
| `SideNavCollapseButton` | 可救 | 包进偏好表单，`name="collapsed"` |
| `MobileNavToggle` | 可救 | 同上，`name="nav"` |
| `ShellThemeToggle` | 可救 | 同上，`name="theme" value="dark"` |
| `ShellLocaleMenu` | **死的** | trigger 与 option 硬编码 `type="button"` 且在组件内部，够不着。**等 Owner 裁**，见第六节 |
| `ProductShellSearch` | **死的** | 同上。**在裁定前不传 `search` 属性**，让它不渲染 |

偏好表单的做法：页面上放一个 `<form id="shell-prefs" method="POST" action="/api/v1/commands/…">`（带 csrf 与 redirect，照 `ui-kit.tsx` 的 `Form` 的样子），三个按钮用 `form="shell-prefs"` 指过去。HTML5 的 `form` 属性允许按钮在表单外部。落库还是落 cookie 由你定，读回来用 `readPreferenceCookieValues`。

`ShellLocaleMenu` 的 `locales` 是必填的。裁定之前**只传当前一种语言**，让菜单里没有可选项，死控件的伤害面降到最小。不要为了绕开它去自写一个语言切换器。

**验收**
- `gate:forms`、`gate:human-only` 绿
- 三个偏好按钮点下去真的改变了下一次渲染
- 页面上剩余的每一个 `<button>`，要么在表单里，要么在第六节被点名

---

## 四、包 C：原语一对一替换

**纪律先写在前面：这一包只换组件，不改结构。** 同一段 DOM 里元素的顺序、层级、文案、条件分支，一个都不许动。改版式是 Owner 一页页过的时候的事。

**ui-kit 的九件。** 用点数是本轮实测的：

| `apps/web/src/ui-kit.tsx` | 用点 | 换成 | 说明 |
|---|---|---|---|
| `Field` | 88 | `DS.Field` | DS 的是超集：`{label, hint, error, children}`，AOS 的是 `{label, hint, children}`。顺手核一下 label 与控件的 id 关联 DS 有没有接上——AOS 现在的是裸 `<label>` 不带 `for`，本来就没接 |
| `Panel` | 50 | `DS.Card` | `CardProps extends HTMLAttributes` + `tone` + `interactive`。AOS 的 `Panel` 有 `title`，DS 的没有；title 用 `DS.Heading` 单独放进 Card 里，**不要改标题的层级** |
| `Pill` | 41 | `DS.Badge` | 见下面的色调警告 |
| `Empty` | 39 | `DS.EmptyState` | `= Omit<StateSurfaceProps,"tone"> & {tone?: "neutral"｜"warning"}`，有 `title`/`description`/`icon`/`action` |
| `breadcrumb` | 17 | `DS.Breadcrumb` | `BreadcrumbItem` 有 `href`，渲染真链接。末项省略 href 即为当前页 |
| `rowsList` | 5 | `DS.TableShell` | `{columns: {key,label,value}[], rows: Record<string,ReactNode>[], emptyState?, label?}` |
| `Form` | 52 | **保留** | AOS 特有的 csrf + redirect 隐藏字段，DS 无对应物 |
| `Attribution` | 16 | **保留** | DS 无对应物 |
| `Truncation` | 14 | **保留** | DS 的 `Pagination` 是空的，见第六节 |

**裸标签。** 有确切对应件的换：

| 现在 | 用点 | 换成 |
|---|---|---|
| `h("input")` | 137 | `DS.Input`（`type="checkbox"` 的换 `DS.Checkbox`） |
| `h("button")` | 55 | `DS.Button` |
| `h("select")` | 30 | `DS.Select`（`options: {value,label}[]`，不是 children） |
| `h("h2")` | 21 | `DS.Heading level={2}` |
| `h("textarea")` | 19 | `DS.Textarea` |

**明确不动的**，因为 DS 没有对应件，换了就是自造：

`h("div")` 267 · `h("p")` 163 · `h("span")` 137 · `h("a")` 102 · `h("ul")`/`h("li")` 48 · `h("label")` 5

其中 **`h("a")` 那 102 个是最要紧的一条**。DS 的 86 件里带链接语义的只有 `LinkButton`（按钮外观的 `<a>`）和 `SkipLink`，**没有正文链接件**。AOS 整个产品靠链接导航，一张表里十几个链接不可能都做成按钮。所以这 102 个保持裸 `<a>`、保持浏览器默认外观，**不要给它们写任何 CSS**——写了就是自立门户。缺口要看得见，Owner 才能裁。

**色调警告，这是本轮我踩过的坑，不要再踩一遍。**

`Badge` 的 `Tone` 只有四个值：`neutral | positive | warning | danger`。我上一轮传了 `info`，TypeScript 没拦住（因为是经 `h()` 传的），渲染出 `class="tcrn-badge tcrn-badge--info"`，而 `tcrn-badge--info` **在 DS 的 CSS 里根本不存在**，结果和 `neutral` 长得一模一样，肉眼要盯着才发现。同一类错还有一个：我给 `DS.Text` 传了 `tone="muted"`，`Text` 根本没有这个属性，它原样泄漏成了 `<p tone="muted">` 这个无效 DOM 属性。

包 E 的门就是为这两个错写的。

顺带：`neutral` 在 CSS 里也没有自己的类——它就是徽章的基础样子。所以 DS 能给徽章的实际外观只有 **四种**，而 AOS 有 **七个**工作状态。这个碰撞在第六节呈报，**你不要自己挑映射**。这一包里 `Pill` 换 `Badge` 时，把现在 `ui-kit.tsx:53` 的 `tone()` 逻辑原样搬过去（它现在只区分 done / active / blocked 三个，其余无色调），不要扩展。

**验收**
- `pnpm typecheck` 绿
- `pnpm test` 53/53
- `gate:forms` 绿——这一条最实：它开每一个声明过的 ui.route，重放找到的每一个表单。`DS.Input`/`DS.Select`/`DS.Textarea` 如果丢了 `name` 属性，这里立刻红
- `gate:human-only` 绿——它整条走完一个项目的手工流程

---

## 五、包 E：新增 `gate:ds-adoption`

四条断言，跑在真起的服务器上，照 `scripts/gate-forms.mjs` 的样子（起服务、遍历每个 `ui.route`、用 parse5 解析）。

1. **没有死控件。** 渲染出的每一个 `<button>`，要么在某个 `<form>` 里，要么带 `form=` 属性。不满足的**点名列出来**。零脚本产品只有这一个办法能自动发现「看起来能点、其实点了不动」的控件。第六节里 Owner 尚未裁定的可以进豁免名单，但豁免要一条条写在门的源码里并带理由。
2. **没有内联的 DS CSS。** 页面 HTML 里不出现 DS 组件 CSS 的正文，防止哪天退化回内联 100KB。
3. **没有假样式。** 收集渲染结果里所有 `class="tcrn-*"` 的修饰类（`tcrn-badge--info` 这种带 `--` 的），逐个到供给的 CSS 里查有没有定义。查不到就红，并报出是哪个组件的哪个属性造出来的。
4. **没有泄漏的属性。** 渲染结果里不出现 `tone=`、`variant=`、`selected=`、`label=` 这些出现在 DOM 元素上的组件属性名。这类泄漏 React 不报错、TypeScript 经 `h()` 也拦不住，只有看渲染结果能发现。

门加进 `package.json` 的 `verify` 链，位置在 `gate:forms` 之后。

**验收**
- 门自己红过一次再变绿：先故意传一个 `tone="info"`，确认第 3 条抓得住；再故意留一个表单外的 `<button>`，确认第 1 条抓得住。**没红过的门不算写完**

---

## 六、呈报给 Owner，不要 Codex 决定

碰到下面任何一条，**停下、留裸标签、记在这一节，不要发明替代品**。

1. **分段导航的链接形态。** `SegmentedNav` / `ModuleTabs` / `SectionTabs` 三件同签名 `({items, locale, onSelect})`，渲染 `<button type="button">`；`Tabs` 是 ARIA tab 模式且 `onSelect` 必填。零脚本下四件都点不动。已向 Owner 申请照 `BreadcrumbItem` 的先例加 `SegmentedNavItem extends NavItem { href?: string }`。
2. **正文链接件。** 见包 C。已申请 `Link` / `TextLink`。
3. **`Pagination` 的链接形态。** 实测 `Pagination({label})` 渲染出 `<nav class="tcrn-pagination" aria-label="…"></nav>`——一个空地标。已申请补 `prevHref` / `nextHref` / `disabled`。
4. **工作状态词汇表。** `StatusBadge` 绑死在 `CopyStateInput` 的 11 个就绪度值上，不是 AOS 的七个工作状态；退到 `Badge` 只有四种外观。已申请。
5. **`ShellLocaleMenu` 与 `ProductShellSearch` 在零脚本产品里的处置。** 两件的按钮都硬编码 `type="button"` 且在组件内部够不着。已申请。
6. **品牌 svg 正本。** 包里不带实体，要 Owner 给。

另外有一条回报给 DS 的缺陷（不阻塞这一包）：`ShellLocaleMenu` 内部渲染 locale 列表缺 `key`，每次 SSR 都出 React 告警。

---

## 七、顺序与提交

A → B → C → E。每包一次提交。C 包最大（约 400 个用点），可以按文件再切成 `render.tsx` / `admin` / `collab` / `governance` / `knowledge` 五次。

提交身份 `tpmoonchefryan <253097889+tpmoonchefryan@users.noreply.github.com>`，不加 `Co-Authored-By`。

**这一包做完不是 `done`。** 前端属于 Owner 亲眼判的那条道，停在 `pending-owner-acceptance`。做完之后 Owner 要一页页过设计，第一页是登录页。
