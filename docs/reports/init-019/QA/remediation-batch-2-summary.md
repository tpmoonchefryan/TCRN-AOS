# TCRN-CROSS-INIT-019 二次 QA 强化与修复批次 —— 收口总结

签发:执行层 agent:fable · 2026-08-06 · 依据 Owner「根据 QA report,完成落地本次落链的强化和修复单」

## 结论:4 张强化单 + 5 张修复单全部落地并链上 done(cross 1888→1917)

按二次 QA 报告(`QA/re-acceptance-report.md`)与两代理原文逐单执行,依赖序满足(强化单先于修复单),每条带生效证据实跑。

## 强化单(先落地,封四结构性漏洞)

| 单 | 漏洞 | 落地 | 生效证据 |
| --- | --- | --- | --- |
| **INC-052** 收口绑定生效证据 | 漏洞 1(收口无对偶) | dispatch-readiness 补第三层收口协议(末次门晚于末次提交/结果表命令产出/done 附注记)+ closeout-evidence-runner | runner 对 INC-043..051 批**先复现三红**(红腿自证)、修后 `CLOSEOUT_EVIDENCE_GREEN`;INC-052 链上收口注记 |
| **INC-053** 豁免面/门改动对抗义务 | 漏洞 2(PASS 路径无对抗) | harness-constraint 二之三·公约 12:对抗义务检查表(绕行构造/pass-path mutation 证人/反问敌人/修门跑红腿) | 评审模板点名;INC-057/058 修复即按此附绕行语料与红腿 |
| **INC-054** 批单逐项核销 | 漏洞 3(批单无核销) | dispatch-readiness 批单收口节 + closeout-verify(漏项/未知处置/retained 无票/deferred 无由皆红) | INC-060 核销 9 项 `CLOSEOUT_ITEMS_RECONCILED`;对漏项试验批判红 |
| **INC-055** 跨仓运行时依赖守卫 | 漏洞 4(跨仓无守卫) | 方向 B 已决:白名单权威在 AOS、WF 内嵌镜像 + 世界分级一致性门;孤立试验进 verify | 孤立布局 self-test 117/117(原 8 mismatches);一致性门两世界绿、篡改红 |

## 修复单(依赖强化单先行,按新协议收口)

| 单 | 修复 | 生效证据 |
| --- | --- | --- |
| **INC-056** tip 三红一次收 | A1 用户名占位符化 / A2 测试登记+regen / A3 投影提交 v1888+doc-sync 18 文档 | closeout 批三红转绿;doc-topology 绿;hygiene 11/11 |
| **INC-057** break-glass 三绕行闭合 | B1 跨段:白名单命中不 return 继续扫全段;B2 子串:白名单匹配段级命令;B4 doc 侧写守卫 | 三构造全红(B1/B2/B4)、两条目合法 PASS、self-test 117/117 |
| **INC-058** freshness 门语义回正 | codegraph 去 sync-once(verify 只读)+ 按 tracked 源改动判真陈旧/walker 残余;web truth 不可读→unproven;memory 改 activity;SIDECARS 自检 | projection-freshness OK(真陈旧红=判据可证伪);纯逻辑红腿测试 3/3 |
| **INC-059** offline-boundary | 测试自足安装 guard(幂等) | 单跑 6/6 绿(三世界同绿) |
| **INC-060** P3 尾单逐项核销 | runner 三态 job / doc-topology 红证数量下限 / 小尾清理 / S162 活证归档;2 项 deferred→INC-165、2 项 retained→INC-046/047 | closeout-verify 9 项零无归属;runner owner-queue exit1 提醒判 expected、exit2 判失败 |

## 链收口

- INC-052..060 九单经写面 27 步 + 9 回读,planned→done(cross 1888→1917);INC-052/056 补收口注记(生效证据落链)。
- INC-060 核销 manifest 由 closeout-verify 校验 `CLOSEOUT_ITEMS_RECONCILED`。

## 门/套件终态(HEAD)

doc-topology exit 0(DOC_TOPOLOGY_IN_SYNC,18 文档、6 红证 + RED_PROOF_COUNT_FLOOR) / projection-freshness 待投影重建后 exit 0(重建至链头) / parity PARITY_VERIFIED / observer self-test 117/117 / breakglass-consistency 两世界绿 / closeout-verify exit 0 / hygiene 11/11 / offline-boundary 单跑 6/6。

## 保留与归属(deferred/retained 均指名链上活单)

- **gate_list 数据源 + INC041 双写比对**:deferred → INC-165(enforce 切换并入)。
- **hygiene 三 plist 出圈**:retained → INC-046(已按名排除留名)。
- **throw 回执步数**:retained → INC-047(thrownBeforeReceipt=诚实未知,语义留档)。
- **STORY-165 enforce 切换**:观察窗 2026-08-12 评估;四前置(白名单三绕行已闭合/红证数量下限/offline-boundary 三世界/判据第 4 条 projection 真陈旧可红)全部达成。

## 落盘

- AOS `feat/cross-init019-single-data-plane` + tcrn-workflow + 平台根公约(docs/ 工作树生效);未推送。
- 新工具:closeout-evidence-runner / closeout-verify / breakglass-consistency-check;文档:dispatch-readiness 收口协议+批单核销节、harness-constraint 对抗义务附则。
