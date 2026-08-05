# INC-051 收口 —— 验收 P2 批(含 enforce 三前置)

签发:执行层 agent:fable · 2026-08-06 · TCRN-CROSS-INIT-019 QA 补漏批次

## 已修复(P2/★ enforce 前置)

### ★ break-glass 白名单空转 → 落地
- 两类已裁场景补真实条目:`mcp-unreachable-fallback`(只读 status 经 ssh)与 `service-layer-byte-compare`(引擎路径 sha 校验)。
- **两消费者匹配对象统一**:doc-topology 不再截断片段,现在把**完整命令行**交给白名单匹配(与 observer 一致);
  两处对同一 status-fallback 命令同判 PASS/breakglass-allowlist,对写命令同判 HIT。
- **写守卫**:白名单永不豁免治理树写——`status; rm GOV/...` 判 HIT/ssh-write(不能搭 status 条目便车);
  scratch 写(tee /dev/null、> /tmp)仍豁免。有 mutation 证人(F06)。
- schema 测试:每条 entry 必须 class/pattern/reason/since,pattern 可编译。
- 白名单路径支持 `TCRN_SSH_BREAKGLASS_ALLOWLIST` env 覆盖(mutation harness 用真实文件)。
- 观察器语料从 116→117:纯 status 经 ssh 改判 PASS/breakglass-allowlist(A15/D01/D06/D07/D12/F12/F15/G05),
  status+写改判 HIT/ssh-write(C16/E16/E17/E19/E20/F02/F03/F06/F07/F10/F13),新增 H17(backups 引擎 status)作 host-engine-anchor 证人。

### owner-queue 取数失败静默 → 首类行
- read face 失败不再静默空队列:新增 `chain-read-failed` 首类行(reasonCode + error),任何层都不会无声丢 Owner 事项。

### self-test 判据(INC-044 已修,复核)
- `--self-test` 要求 candidateCount>0,与 verify-channel 对齐,零检索不再恒绿。

## 已修复(其余 P2)

### projection-freshness codegraph 判据(与 INC-049 同批)
- 问仪器自己(status)→ 报 pending 时 sync 一次 → 仍 pending 视为 walker 残余(索引已达仪器可达新鲜度),不硬红;
  sync 失败才 unproven。verify 不再因 codegraph 假红。

### DOC_REGISTRY 扩面(与 INC-050 同批)
- 三份新公约 + direction 文档入册;direction 文档地址字面量改指平台根核对表。

## 已知保留(收口批外,择办)

| 项 | 状态 | 理由 |
| --- | --- | --- |
| ★ heredoc 误报归因口径 | **待定** | 观察窗内 agent 用 heredoc 引用 ssh 命令仍判 HIT。修法需 tokenizer 增加 heredoc 意识(把正文当数据),或评审预设归因口径。**enforce 切换前须定**(评审节点 2 ③)。 |
| safe-target 守卫惰性 | 已知 | isScratchTarget ⊆ isSafeTarget 恒成立,守卫永不改变结果;三条 mutation 删未补。语义上删除惰性分支是正道,但涉及 exemption 逻辑重审,列收口批。 |
| 仪式 auto-rebase 载荷外无回读 + SPEC 未载 | 待办 | auto-rebase 是写路径自动步,SPEC 未声明;应在 SPEC 补载并考虑回读覆盖。 |
| RESERVED_FLAGS 漏 `--expected-revision` | 待办 | 引擎 knowledge-promote/retire/reverify 的 expected-revision 由载荷供给(安全,CAS 兜底),但 SPEC 承诺「哨兵来自现读」只对 expected-version 成立。 |
| read-face 超时进程悬挂 | 已知 | callReadFace 的 poll 无条件重排;hook 靠 spawnSync 25s 兜住,CLI/runner 靠外层超时。 |
| platform-runner 进程组回收 / --if-due 幻影 / stderr 截断 | 已知 | spawnSync 超时只 SIGTERM 直接子进程;`--if-due` 是用法文案残留;日志截 200 字节。 |
| SSH_ENGINE_PATTERN 窄于声明 | 已知 | `ssh -o BatchMode` 等形态逃逸;声明「任何 SSH 直驱即红」覆盖>实现。 |
| SessionStart 不按 source 过滤 | 已知 | resume/clear 重复注入基线;VM 不可达时每次启动 +25s。 |
| RUNNERS 死常量 | 待清理 | host-engine 豁免移除后无消费者。 |

## 实测
- observer self-test 117/117;observer 测试套件 92 绿;doc-topology:proof 绿(18 文档,6 红证含 SSH);
  predicates 30/30;projection-freshness:proof 绿;owner-queue 正常渲染。
