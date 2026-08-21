<h1 align="center">TCRN AOS</h1>

<p align="center">
  工单与知识库，给人和 agent 同队使用。
  单节点即可运行，自己持有数据，运行期不依赖任何外部服务。
</p>

<p align="center">
  <a href="README.md">English</a>
  · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-5865d8" />
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24.16-3c873a" />
  <img alt="PostgreSQL 18" src="https://img.shields.io/badge/PostgreSQL-18-336791" />
  <img alt="single-node k3s" src="https://img.shields.io/badge/deploys%20on-single--node%20k3s-2f6b45" />
</p>

## 这是什么

一套你可以自己跑起来的 Jira + Confluence 级系统：项目、工作项树、12 种关联、标签、看板、
评论、通知、保存视图、带版本历史的知识空间，以及可按项目开关的治理层（门、审议、决定）。

REST API、MCP 服务、服务端渲染的网页界面——三个面**由同一份操作注册表生成**。这不是实现细节：
它是"**凡 agent 能做的，人也能手工做**"这句话能被构建检验、而不是只能被承诺的原因。

## 与别处不同的地方

**每一次改动都是一次真实的表单提交。** 界面靠 `<form method="POST">` 提交给 API 暴露的同一批
操作，因此它在构造上就是一个 API 客户端，而不是在意图上，整个产品也因此始终可以手工使用。

这是底线，不是天花板。本文件的早先一稿写着禁止客户端 JavaScript、并声称本产品"不是渐进增强"。
那不是任何人的裁定：那是作者从"人能手工管理项目"推出来的、比要求本身更严的一条禁令，而且和它
之前那棵树在链上记下的姿态正好相反。本产品所用的设计系统预期有脚本——它的页签组件 `onSelect`
是必填的，浮层件基于 Radix，还发布了一个驱动外壳的客户端控制器。留下来的要求，是门真正在检验
的那一条。

**主张即测试。** `gate:parity-registry` 断言注册表、OpenAPI 文档、MCP 工具表是双向相等的同一
集合；`gate:forms` 启动真服务器、打开每条控件声明的路由、回放它渲染出的每个表单；
`gate:human-only` 在数据库里零个 agent 主体、MCP 全程未被调用的前提下，只用表单跑完整个项目。
少一屏，构建就红。

**三层可变性，由数据库强制。** 工作项与页面可编辑、可重开，每次改动的旧值写进修订行；活动流与
修订表追加不可改，由触发器守着而不是靠自觉；审议立场、纪要、门决议、决定不可改，更正只能写一条
取代它的后继——**被驳倒的立场留在记录上**。

**能抹除，又不毁掉审计。** 活动流只记谁改了哪些**字段名**并指向修订行，从不存值。抹除个人数据
删的是修订行，走一条具名并留痕的通道，而不可改的流完好无损。清除日志自己的触发器没有豁免，
所以一次清除抹不掉自己的痕迹。

**中文检索真能用。** `to_tsvector` 把一整串中文当成一个词元，于是两个汉字的查询——中文最主要的
词形——什么也搜不到。分析器对 CJK 发出重叠二元组、对拉丁发出普通词元，写入与查询跑的是同一个
函数，两者无从漂移。`gate:search-cjk` 既守着语料，也断言**朴素做法仍然失败**——这条理由要么继续
成立，要么让门变红。

## 跑起来

```sh
pnpm install
pnpm db:up          # Docker 里的 Postgres 18，端口 55432
pnpm build
AOS_BIND_HOST=127.0.0.1 AOS_DATABASE_URL=postgres://postgres:devpass@127.0.0.1:55432/aos pnpm start
```

首次启动会建立一个管理员并把口令打印一次。**从不带默认凭据。**

单节点 k3s 见 **[deploy/BOOTSTRAP.md](deploy/BOOTSTRAP.md)**——六条命令，每一条都是实跑过的，
不是描述出来的。

## 检验它

```sh
pnpm verify
```

十五步：类型、生成的迁移模块、构建、测试、许可证，以及十道门——注册表同权、无侧门、OpenAPI 文档、
MCP 握手、表单回放、纯人工通关、中文检索、兄弟仓缺席、自足性、生成物编码。

`pnpm verify:fast` 跳过需要 Docker 的门。

## 目录

```text
packages/store    Postgres 访问、编译进产物的迁移、id、文本分析
packages/kernel   操作注册表、派发、授权、审计，以及全部领域逻辑
packages/mcp      由注册表生成的 MCP 服务
apps/server       Fastify：REST、MCP 端点、服务端渲染
apps/web          界面——页面、共享套件、样式表
deploy/k8s        Kustomize base 与单节点 overlay
scripts           那些门
```

## 刻意没有的东西

没有富文本编辑器——页面正文是文本域里的 Markdown，按纯文本渲染。没有邮件与 webhook，通知只在站内，
因为 SMTP 是运行期的外部服务。没有拖拽看板；同一个动作是一个下拉加一个按钮，这正是看板在关掉脚本后
仍然可用的原因。没有多租户、没有自定义角色、没有身份提供方。多副本需要共享写卷或附件的对象存储——
其余状态早已在 Postgres 里。

它不依赖本平台任何其他仓库，`gate:absence` 会把它们改名移走再跑一遍测试，以保持这句话为真。

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。
