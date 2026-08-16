# STORY-158 收口 —— SSH 降格为 break-glass

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 白名单只收两类(主机 MCP 不可达 fallback / 按设计绕开服务层的逐字节比对);每条带日期与理由;不在本单改观察器语料(那是 164 的文件) |
| 文件指针 | `TCRN-AOS/deploy/aos-local-client/ssh-breakglass-allowlist.json`(新建);平台根 `CLAUDE.md` 第三节(声明);`S158/notes.md`(对 164 的需求) |
| 验证命令 | `node -e` 断言每条 entry 有 reason 与 since(见下) |
| 收口动作 | 白名单被 157.3 与 164.2 共同引用(一份名单、两处消费) |
| 生效证据命令 | 两处引用同一个文件路径(`grep -c` 各 ≥1);新会话读到第三节声明段 |

## 实测记录

### 158.1 白名单定义
- `ssh-breakglass-allowlist.json` 落盘:`schemaVersion: aos.ssh-breakglass-allowlist.v1`。
- 两分类:
  - `mcp-unreachable-fallback`:主机 MCP 面不可达时的 break-glass 只读核查(D1 残余适用性);
  - `service-layer-byte-compare`:按设计绕开服务层的逐字节比对(D9 残余适用性,engine-host:verify 类)。
- `entries` 当前为空——157.2 已把 14 处复核命令全部改写为 MCP 形态,活跃文档无任何待豁免的 SSH 直驱命令。
- 验证:`node -e` 断言 entry 各有 reason/since(空集真空成立),classes 各带 id/name/reason → exit 0。

### 158.2 使用即留痕(对 164 的需求)
- 本单**不改** `tcrn-workflow/scripts/ssh-write-observer.mjs`(那是 STORY-164 的文件,避免并发冲突)。
- 对 STORY-164 的需求(写在这里,164 收口后回读本条):
  1. 消费 `TCRN-AOS/deploy/aos-local-client/ssh-breakglass-allowlist.json` **同一份文件**(不是拷贝)——白名单内命令判 PASS,白名单外判 HIT;
  2. 判据要求:观察器判定 SSH 直驱引擎命令是否命中时,以这份白名单为唯一豁免源,保证「文档门(157.3)与运行观察器(164.2)看到的豁免集一致」。
- 生效证据(164 收口后):一条 SSH 直驱引擎的命令经观察器判 HIT;白名单内命令判 PASS。

### 158.3 文档声明
- 平台根 `CLAUDE.md` 第三节新增声明段:「SSH 直驱引擎 CLI 已降格为 break-glass,不是删除」,写明两类残余适用性,
  并指名白名单文件与「一份名单、两处消费」的机制。
- 声明不带示例 SSH 命令(避免自造红);`doc-topology:proof` 对声明段落无 finding。
- 生效证据:新会话读到该段(文档即代理入口;本会话改动后重跑 doc-topology 已绿)。

## 已提交
- `ssh-breakglass-allowlist.json` 随 STORY-157 提交(157.3 与 158.1 同批,因 157.3 消费它)。
- 平台根 CLAUDE.md 声明不在 git 仓内,以工作树形态生效。
