# STORY-164 收口 —— S2 语料扩面:SSH 直驱引擎判 HIT

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 96 条既有样例只准加不准弱化;任何 classify 判据削弱须点名给理由;白名单消费 158.1 同一份文件 |
| 文件指针 | `tcrn-workflow/scripts/ssh-write-observer.mjs`;`tcrn-workflow/tests/ssh-write-observer.test.mjs` |
| 验证命令 | `node tcrn-workflow/scripts/ssh-write-observer.mjs --self-test ; echo exit=$?` → 0;红侧喂真实 SSH 读命令判 HIT |
| 收口动作 | 读动词(status/work-list/work-show)经 ssh 判 HIT;新语料在 CI lessons job 里跑到 |
| 生效证据命令 | `pnpm --dir tcrn-workflow verify:observe-channel` exit 0;喂真实 SSH 读命令判 HIT;白名单内 PASS |

## 判据变化(点名:这是**加强**不是削弱)

**旧**:`ssh host "node <engine> status/work-show …"` 走 host-engine 豁免 → PASS(no-write-primitive)。
**新**(D1/D9 对齐):任何 ssh 直驱引擎 CLI → `HIT/ssh-engine-direct`,除非命中 break-glass 白名单。
- 移除 `host-engine` 豁免:引擎不再因其身份被信任,只有 operator 声明 break-glass 理由才放行。
- 引擎检查置于 governance-path / write-primitive 之前:违反的是「经 ssh 驱动引擎」这件事本身。
- 语料从 96 → **116 条**(100 既有 + G05-G08 读动词 + H01-H16 非引擎证人)。
- 白名单消费 `TCRN-AOS/deploy/aos-local-client/ssh-breakglass-allowlist.json`(158.1 同一份;
  doc-topology 2 处引用、observer 1 处引用,`grep -c` 各 ≥1)。当前 entries 空 → 全部引擎命令 HIT。

## 测试套件调整(点名并给理由)

- **重定向 20 个 mutation 证人**到非引擎样例(H 系列):引擎样例因引擎检查前置,不再覆盖写检测分支;
  改为非引擎等价命令(同构造、同判定),证人逐条经 mutation 测试实跑验证。
- **删除 9 个不可红/已死的 mutation**:`exemption-entry-host-engine`/`exemption-runner-unwrap`/
  `exemption-direct-exec`(目标代码=已删的 host-engine 豁免)、`safe-target-absolute`/`safe-target-governance`/
  `exemption-target-guard`(host-engine 移除后无任何豁免匹配治理写,分支不可证伪)、
  `tok-amp-redirect`/`tok-amp-split`/`tok-fd-prefix`(tokenizer 微分支,备选解析产出相同判定,无证人可红)。
  **这不是判据削弱**——判据变严(更多 HIT);是覆盖测试的去伪,避免恒不红的 mutation 变恒真门。

## 实测记录

- `--self-test`:116 样例全部按期望判定,exit 0。
- 红侧(真实输入):`status`/`work-list` 经 ssh → `HIT/ssh-engine-direct`;`ls /srv/tcrn/governance` → PASS。
- `verify:observe-channel`(平台根 + tcrn-workflow 两 project-dir):exit 0,两通道 LIVE。
- 白名单机制:空表 → HIT;构造匹配 pattern → `breakglassAllows` true(判 PASS 路径就绪)。

## 已提交
- `scripts/ssh-write-observer.mjs` + `tests/ssh-write-observer.test.mjs`(tcrn-workflow 仓)。
