# STORY-156 收口 —— MCP 写面:单一 `ceremony` 工具

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1

## 五要素

| 要素 | 本单内容 |
| --- | --- |
| 红线边界 | 不重写仪式逻辑(156.2 包裹现有 ceremony.mjs);载荷不得指名 workspace/attest-dir/expected-version;回执与载荷落盘路径由工具决定;不驱动一次性供权动词族;不改用户级配置 |
| 文件指针 | `TCRN-AOS/deploy/aos-mcp-write/{SPEC.md, server.mjs, server.test.mjs, drive.mjs}`(新建);`TCRN-AOS/package.json`(test 名册);`TCRN-AOS/deploy/aos-local-client/parity-proof.mjs` + `.test.mjs`(锚名册);平台根 `.mcp.json`(接线) |
| 验证命令 | `node deploy/aos-mcp-write/server.mjs --self-test ; echo exit=$?` → 0(156.2);`node --test deploy/aos-mcp-write/server.test.mjs ; echo exit=$?` → 0(156.5) |
| 收口动作 | 规格存在且被 server.mjs 引用(SPEC 注释即契约);四条红侧实测输出存 `S156/outputs/`;新测试进 `package.json` 名册字符串 |
| 生效证据命令 | dry-run 经 MCP 客户端跑通 → `CEREMONY_PLANNED_ONLY`,回执 `partition`/`chainBefore.version` 与只读面一致(156.2);四条红侧经 MCP 客户端 reason code 互不相同(156.3);回执 `chainAfter.version` 与只读面 `status` 一致(156.4);`pnpm --dir TCRN-AOS parity:proof` 绿(156.6) |

## 实测记录

### 156.2 自测与 dry-run
- `node deploy/aos-mcp-write/server.mjs --self-test` → `SELF_TEST_OK`,initialize + tools/list 往返,单工具 `tcrn_ceremony`。
- dry-run 经 `drive.mjs`(真实 MCP 客户端进程)驱动:reason=`CEREMONY_PLANNED_ONLY`,partition=`TCRN-AOS`,chainBefore.version=1047(与当刻只读面一致),steps 全部 planned-only。

### 156.3 四条红侧(经 MCP 客户端,reason code 互不相同)
| 用例 | reason code |
| --- | --- |
| 载荷 step 指名 `expected-version` | `RESERVED_FLAG_IN_PAYLOAD` |
| 载荷 readback 为空 | `PAYLOAD_INVALID` |
| 动词不在主机 catalogue | `VERB_NOT_IN_CATALOGUE` |
| 一次性供权动词族(relocation-vacate) | `VERB_REQUIRES_OUT_OF_BAND_AUTHORITY` |

四者输出存 `S156/outputs/live-reds-result.json`;四者全部 isError=true。

### 156.4 真写
- 目标:`work:0067159642aa7871a6b31873`(TCRN-AOS-STORY-016,已 done、非承重的仪表盘 story)。
- 方式:原 scope 逐字保留 + 追加一行透明证明标记(内容无损、可归因、可回读)。
- 结果:`CEREMONY_COMPLETED_AND_READ_BACK`,chainBefore 1047 → chainAfter 1048,eventsAppended=1,readback `READBACK_MATCHES_FULL_VALUE`。
- 回执路径在工具返回值里:`evidence/mcp-ceremony-write/receipts/2026-08-05T14-11-04-742Z-d8e57f-TCRN-AOS.json`。
- 生效证据:回执 `chainAfter.version=1048` 与只读面 `status`(version 1048)一致。

### 156.5 测试挂进列车
- `server.test.mjs` 11 项:决策逻辑(真实 ceremony-plan 纯函数 + fake catalogue)覆盖 `RESERVED_FLAG_IN_PAYLOAD` / `VERB_NOT_IN_CATALOGUE` / `VERB_REQUIRES_OUT_OF_BAND_AUTHORITY` / `PAYLOAD_INVALID`;dispatcher 管线(注入 executor + 临时 writeRoot)覆盖 `MCP_PARTITION_UNKNOWN` / `MCP_ARGUMENT_INVALID` / isError 包装 / dry-run 非错误结果 / JSON-RPC 拒绝。
- `node --test deploy/aos-mcp-write/server.test.mjs` 11/11 绿;`parity-proof.test.mjs` 同步更新锚名册断言后 38 项共绿。
- 名册:`package.json` test 字符串末尾追加 `deploy/aos-mcp-write/server.test.mjs`。

### 156.6 接线与名册对等
- 平台根 `.mcp.json` 注册 `aos-mcp-write`(审查层批准范围,此处点名)。
- `parity-proof.mjs` 锚名册新增 `aos-mcp-write`(claude 侧必须),白名单新增 `missingFrom: codex`(带日期理由)。
- `pnpm --dir TCRN-AOS parity:proof` → `PARITY_VERIFIED`。
- 生效证据「新开会话可见」:工具注册是会话启动快照,老会话不可见 —— 本会话内以 `self-test` + `drive.mjs`(独立 MCP 客户端进程)验证单工具可达;新会话可见性由下一会话复核。

## 已知保留
- 写面已在 .mcp.json 注册,但**本会话**的工具列表不含 `tcrn_ceremony`(注册快照),属设计;新会话复核即可见。
- `evidence/mcp-ceremony-write/` 回执与 `docs/reports/init-019/` 证据按 INC-042 前提,随 INC-042 一起入库。
