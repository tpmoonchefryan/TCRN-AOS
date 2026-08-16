# AUTHORIZATION — Owner 四裁定（2026-08-09，投产收口解锁批）

来源：Codex 三轮同一阻断标 `blocked` 后上报四项待决；Owner 经 AskUserQuestion 逐项裁定（答案逐字引用）。裁定记录入链 = INIT-020 注记 rev10。承接 AUTHORIZATION-2026-08-07-qa4-owner.md（A 档铸造授权仍有效）。

## 裁定一 · Stop hook 接线（INC-105）

Owner：「**批准写入并取证（推荐）**」。
已执行（agent:fable，Claude 宿主侧）：用户级 + 平台根 + TCRN-AOS 根三处 Stop 注册；verify-channel 两根 `STOP_PACT_CHANNEL_LIVE`（scratch 活契约真启动注册串，decision:block）；prod:ready 该项绿。证据 = evidence/stop-pact-d1-wiring-2026-08-09.md。残余 = 真实宿主触发证据于下一新会话自然取得。

## 裁定二 · 真仓历史处置（解锁 INC-103→097→113 链条）

Owner：「**重写成果转正（推荐）**」。
授权内容：老 `.git` 先整库 bundle 备份（可回滚）→ tcrn-workflow 真仓 refs 转正为 INC-098 已验证清洗历史（284 提交、全对象库隐私命中 0、内容零丢失）→ 重铸 v0.11.0–v0.11.8 annotated tags → GC 旧 blobs → 真仓 p8 可绿 → INC-097 经 INC-093 铸造门铸 v0.11.8（A 档既授，门绿即行）。
边界：**零 push，公开 main 不动**；C 档必停不变；backup bundle 落 governance-archive/ 并在收口注记留指针。

## 裁定三 · helper 重钉（INC-113）

Owner：「**批准，tag 铸成即执行（推荐）**」。
即：v0.11.8 annotated tag 铸成后立即重钉（IDENTITY 三值 + provenance + anchor digest 六文档 + candidate 号升位，配方承 RELEASING.md 与 candidate.30 先例）；`HELPER_REPIN_OWNER_APPROVAL_REQUIRED` 必停点就此清偿，无需再问。

## 裁定四 · VM 缺失的两个 evidence 文件

Owner：「**不处置（推荐）**」。
`dist/evidence/p1/{history,privacy}.json` 缺失与 engine-host:verify DRIFTED 随 AOS 轨道封存；不在投产判据（prod:ready 七项）内；重返 AOS 模式时再处置。

## 对 Codex 的效力

`blocked` 状态据此解除；按 handover §5 续跑：波 5（103→097→113→101）→ 波 6（196 已绿六项→197→S189/S190）。收口验收与任何 push 仍为 Owner 必停。
