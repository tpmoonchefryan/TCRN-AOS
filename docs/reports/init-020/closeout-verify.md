# STORY-172 核销清单(INC-061..071)

> **角色**:TCRN-CROSS-STORY-172 交付物。清单按 closeout-verify 机器核形态成文
> (`tcrn.closeout-verify.v1`),逐单以其链上 scope 原文重判,非照搬 PLAN.md 预判。
> **真值**:链上 `work-show` scope 是唯一判据来源;本清单是本地可用性副本。
> **状态**:2026-08-06 定稿;对 INC 各单的链上处置注记留执行期(本单红线:不动手)。

---

## 0. 处置集与机器核形态

清单以 manifest JSON 形式交付(`payloads/` 或本目录 `closeout-verify-manifest.json`),
字段:
- `schemaVersion: "tcrn.closeout-verify.v1"`
- `incident: "TCRN-CROSS-INIT-020"`(本 INIT 是核销载体)
- `items`:十一单的 `TCRN-CROSS-INC-0XX` 全名单(原单条目集)
- `dispositions`:每单恰一处置,kind ∈ {fixed, retained, superseded, deferred}

`superseded` kind 由 STORY-172 引入 closeout-verify(新增 `carriedBy` 字段,指名承接的
链上 work id),红腿测试见 `tests/closeout-verify-dispositions.test.mjs`。`retained`
仍须指名链上 work ticket。

**红线**:本单只出清单文本与红腿实证(closeout-verify 对清单绿、蓄意漏一单必红),
对 INC 各单的链上处置注记留待执行期。

---

## 1. 处置表(逐单以 scope 原文重判)

| INC | 预判(PLAN.md) | 定稿处置 | 承接处 / 时机 | 依据(scope 原文要点) |
| --- | --- | --- | --- | --- |
| INC-061 仪式层收口闸门 | superseded | **superseded** | `STORY-182`(写面仪式语义服务端化)——单收口+证据纪律、同载荷多单 done 拒绝,落点在门面写面 | 点名 `ceremony-plan.mjs`/`aos-mcp-write`,红线「落点在仪式载荷判据,不改引擎」;门面写面收口闸门即其生产形态 |
| INC-062 收口规格从链上推导 | retained | **retained** | 传输无关收口纪律;随 STORY-190 引用 | 批单证据/核销条目从 `work-show` scope 派生;retained 真查链上状态 |
| INC-063 门名册与可达性 | superseded | **superseded** | `STORY-187`(判据扩面+入口文档改写)——门名册与自动通路 diff | 未接线门须如实登记;门面统一通路后名册可达性机器 diff |
| INC-064 PASS 证人覆盖 | superseded | **superseded** | `STORY-183`(拒绝面语料+宕机演练)——SSH observer 退役前的证人义务维持现状 | 判决函数 PASS 返回点须被 MUTATIONS 证人点名;SSH observer 语料由拒绝面承接 |
| INC-065 结果表与证据侧车机器化 | retained | **retained** | 传输无关证据纪律;随 STORY-190 引用 | 结果表由命令产出不手抄;复用现成机器,不造新机器 |
| INC-066 判据卫生三态退出 | retained | **retained** | 通用判据纪律;随 STORY-190 引用 | 「不能测量」读作红;声明与实现同源 |
| INC-067 干净树测量 | retained | **retained** | 通用纪律(污染源=调度器产物写工作树);随 STORY-190 引用 | 先消除树污再谈干净树;复用 isolated-proof 临时克隆形态 |
| INC-068 对抗复核入环 | retained | **deferred** | 含公约修订,需 Owner 裁定 → 独立立项 | scope 明言「本单含公约修订,需 Owner 裁定」;本 INIT 执行期不径行修订公约,登记待裁 |
| INC-069 段内走私+判决函数统一 | superseded | **superseded** | `STORY-182`(白名单判定)+`STORY-183`(拒绝面语料)——两侧判决函数统一、跨消费者差分测试 | 白名单锚点匹配两侧相反;SSH 写观察器+doc-topology 两消费者共享判决函数;SSH observer 退役由门面承接 |
| INC-070 codegraph 判据回正 | retained | **fixed** | 独立于本 INIT 的门修复;执行期验证 | 恢复可证伪而非删门;INC-049 自声明红腿须复活 |
| INC-071 P2/P3 尾单 | 逐条重判 | **retained** | 核销批,随 STORY-190 收口核验 | 十二条逐条处置,条目集从 scope 推导(INC-062 前置) |

---

## 2. 处置与时机一览(决策点:retained 单的窗前/窗后时机)

| INC | 处置 | 时机 |
| --- | --- | --- |
| 061 | superseded → STORY-182 | 窗前(门面写面服务端化时承接) |
| 062 | retained | 窗后(STORY-190 收口时引用) |
| 063 | superseded → STORY-187 | 窗内(STORY-187 判据扩面) |
| 064 | superseded → STORY-183 | 窗前(STORY-183 拒绝面语料) |
| 065 | retained | 窗后(STORY-190) |
| 066 | retained | 窗后(STORY-190) |
| 067 | retained | 窗后(STORY-190) |
| 068 | deferred(待 Owner 裁定) | 独立于本 INIT |
| 069 | superseded → STORY-182+183 | 窗前 |
| 070 | fixed | 执行期验证 |
| 071 | retained | 窗后(STORY-190 收口核验) |

---

## 3. 红腿实证记录

closeout-verify 对本清单必须绿:每条原单恰一处置、无未知条目、`superseded` 指名
`carriedBy`、`retained` 指名 ticket、`deferred` 带 reason。蓄意漏掉任一单(从
`dispositions` 移除 INC-0XX)必红 `CLOSEOUT_ITEMS_UNRECONCILED`。

---

## 4. 承接处校验(执行期对账用)

superseded 的 `carriedBy` 必须指向真实存在的链上 work id。本 INIT 内:
- INC-061 → STORY-182 `work:f259c5066ba7d9af72198e6b`
- INC-063 → STORY-187 `work:f805208e3c9bd147f95cbc1c`
- INC-064 → STORY-183 `work:d8470bce54832e7e2e29f813`
- INC-069 → STORY-182 + STORY-183(同一承载,`carriedBy` 取 STORY-182)
