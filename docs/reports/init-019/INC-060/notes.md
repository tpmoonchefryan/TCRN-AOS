# INC-060 收口 —— 复验 P3 尾单(逐项核销首战)

签发:执行层 agent:fable · 2026-08-06 · 二次 QA 修复批尾单。

## 逐项核销(INC-054 协议首战;manifest 见 `QA/inc060-reconciliation.json`,closeout-verify 零无归属项)

| 项 | 处置 | 说明 |
| --- | --- | --- |
| ① runner 吞层 | **fixed** | owner-queue 三态退出码(0 空 / 1 提醒 / 2 数据源失败);platform-runner `expectExitIn:[0,1]`,exit 2 判 job 失败——判层不再把 chain-read-failed 读作 reminder |
| ② gate_list 数据源 | **deferred→INC-165** | owner-queue 现读 work-list status=blocked;gate_list 作 owner_intent 权威源需引擎 surface 接线,并入 enforce 切换 |
| ③ INC041 双写比对 | **deferred→INC-165** | INC041_TODOS 与 BRIEFING §7 手工双写;机器 diff 需单一声明源,与 ② 同批 |
| ④ doc-topology 红证数量下限 | **fixed** | `RED_PROOF_COUNT_FLOOR`(≥5 红证必须跑),全 local 名册静默跳过类缺陷不可复现 |
| ⑤ hygiene 三 plist 出圈 | **retained→INC-046** | 已按名排除并留名;残余风险在 evidence-hygiene FIXTURE_EXCLUDED_FILES 注释 |
| ⑥ 小尾 | **fixed** | knowledge-inject-hook「empty array」头注→empty string;WF settings 重复 deny 去重;observer「empty today」→in-repo mirror |
| ⑦ S162 注入活证 | **fixed** | 本会话 SessionStart 8 卡 + UserPromptSubmit 1 卡转录至 `S162/outputs/injection-live-proof.md` |
| ⑧ INC-043..051 收口注记 | **fixed** | 链上 annotate 指向 QA 报告与生效证据(见 transition 批) |
| ⑨ throw 回执步数语义 | **retained→INC-047** | thrownBeforeReceipt=true = 诚实未知;回执不伪造「落了几步」,语义已留档 |

## 生效证据

- `node tcrn-workflow/scripts/closeout-verify.mjs --manifest …/inc060-reconciliation.json` → `CLOSEOUT_ITEMS_RECONCILED`(9 项零无归属)。
- runner:owner-queue exit 1(提醒)判 expected、exit 2 判失败。
- doc-topology `RED_PROOF_COUNT_FLOOR` 随 proof 绿(6 红证 ≥5)。
- 单跑 offline-boundary 6/6 绿(INC-059 移交确认)。
