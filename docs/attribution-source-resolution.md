# 归因来源消解（EPIC-041 STORY-146）

> 消解 `conf-007` T3 预挂归因待裁项："写面扩容前须裁逐请求归因来源"。MIN-013 A2 已裁 actor 双类，本文件落定**每个写路径的归因来源**。

## 归因来源表

| 写路径 | 归因 actor | 类 | 依据 |
| --- | --- | --- | --- |
| Owner 经 SSH 隧道（写面） | `person:owner:governance` | person | Owner 是自然人，经 SSH 身份进写面 |
| AI 会话（Claude/Codex）经 ceremony | `agent:fable` / `agent:<model>` | agent | AI 是 agent |
| 座舱写面 `AOS_ACTOR` | 部署声明的 person 或 agent | 双类 | 谁在操作座舱（Owner→person，AI→agent） |
| 域写（annotation/comment/relation） | 写面注入的同一 actor | 双类 | 域库与链同源归因（STORY-143 强制） |
| 读面 | 无 actor（只读） | — | 读面不产生写（STORY-138） |

## 不变量

1. **零匿名写**：每条链写/域写必须归因到 `person:<id>` 或 `agent:<model>`（STORY-143 在域库层强制；ceremony 在送网络前校验；写面启动时校验）。
2. **人机可分**：任何记录能回答"人还是 AI、哪个 id"。
3. **读面无 actor**：只读不产生写，故无归因（A1 已建立）。

## 判定

- 链写 actor 由 ceremony/写面注入，引擎校验合法性；域写 actor 由 DomainStore 强制（STORY-143）。
- Owner 的仪式写默认 `agent:fable` 维持，但可用 `person:owner:governance` 显式覆盖——覆盖后该批链写归属 person。

## conf-007 T3 关账

conf-007 T3 挂账"写面扩容前须裁逐请求归因来源"已由本文件 + STORY-143/144/145 消解：
- 逐请求归因 = 写路径自带的 actor（person/agent 双类），无默认匿名；
- 座舱 `AOS_ACTOR` 必须声明（STORY-112 依旧），且须合法双类（STORY-144）；
- 域写强制归因（STORY-143）。

关账：`TCRN-AOS-EPIC-041` 完成即 conf-007 T3 归因前置闭环。
