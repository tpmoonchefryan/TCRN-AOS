# 读面 LAN 可达边界设计（STORY-137）

> 事实基础：`TCRN-AOS-CONF-014`（multi-agent-deliberative，读面 LAN 可达边界设计审议）三视角立场 + `TCRN-AOS-MIN-013` 方向裁定 + Owner 执行裁定（受众=整个 LAN、形态=独立只读进程）。
> 本设计是三视角立场的落地，不是新主张。

## 1. 设计目标

把读面从持 pins 的写进程架构性拆出为**独立只读进程**，放 LAN 供人（含手机、无 SSH）直连查看。写面维持 `127.0.0.1`+SSH，pins 永不出网。两条硬不变量：

1. **读面进程永不持有 pins**（operator-authority pins 永不出现在读进程的部署清单/运行环境/进程内存）
2. **写面永不出 loopback**（写面进程端口只监听 127.0.0.1）

## 2. 威胁模型（三视角收敛的最坏情形）

**最坏情形不是"被改链"**（写面 loopback 不变量挡住），而是：
- **全链可读 + 渲染不安全 → 成为跳板**：若读进程渲染链上自由文本时执行 HTML/JS，存储型注入在查看者浏览器执行；且读进程若可连回写面 loopback，被攻破即成写面代理。
- **治理记录机密性暴露**：立场、纪要、注解、决策与责任人归属对 LAN 一切设备可读；攻击者可对责任人社工、影响进行中的审议。

**数据分级（minerva）**：链上无密钥、无 pins，机密性低；高价值属性是**完整性**，已由两条硬不变量守护。分级成立则开放只读可接受，但须白纸黑字写明是主动取舍。

## 3. 设计决策

### 3.1 独立只读进程（`apps/cockpit-read`）

- **新进程**，与写面 `apps/cockpit-service` 分离；不构造 ChainClient、不接收 pins、无 `/api/chain/*` 写路由。
- 独立低权 OS 用户、独立进程组；与写面零共享；网络策略禁止其连接写面 loopback 端口（无回路）。
- 服务内容：静态 web（内置 `cockpitData`，与写面同一份 build）+ 只读 API（`/api/health`、`/api/domain/*` GET、`/api/work/readback/*`）。

### 3.2 只读面（读路由清单）

放行的读路由：
- 静态 web（GET/HEAD）
- `GET /api/health`
- `GET /api/domain/export`、`GET /api/domain/<partition>/<recordId>`（读注解/评论/关系）
- `GET /api/work/readback/*`（tickets/audit/knowledge/policy/backups）

**拒绝的写路由（读进程必须 404/405）**：
- 全部 `/api/chain/*`（transition/annotate/work/enrol —— 写面专有）
- 域写：`PUT /api/domain/annotation`、`POST /api/domain/comment`、`POST /api/domain/relation`

### 3.3 内容安全（sable 硬性）

- 链上自由文本一律按**不可信内容**处理：React 默认转义（禁对链字段用 `dangerouslySetInnerHTML`）；无视图把链文本当 HTML 输出。
- 所有响应带安全头：`Content-Security-Policy`、`X-Content-Type-Options: nosniff`、`X-Frame-Options`。
- JSON 一律 `application/json; charset=utf-8`，绝不 `text/html`。

### 3.4 网络绑定与防 DNS rebinding（minerva/sable 收敛）

- **显式绑定 LAN 接口地址**（非 `0.0.0.0`、非 WAN 接口），由部署声明。
- **校验 Host 头**：白名单允许的 Host 才应答，其余拒绝——防 DNS rebinding 把 LAN 读面当内部跳板。
- 无状态、无 cookie；仅纯 GET 读端点。
- 读取限速，防读进程耗尽与写面同机资源。

### 3.5 认证与审计（minerva vs sable 张力的落地）

- **默认不做应用层 per-viewer 认证**（minerva）：受众裁定即"整个 LAN"，治理元数据低机密性，per-viewer 认证成本高而防护增益趋零。
- **审计记录**（sable 的让步收敛）：读进程记录读取审计（日志可查），但不把认证当作边界。
- **升级杠杆**：若日后机密性分级升高，用**网络分段**（VLAN/防火墙限源），而非应用层认证。

### 3.6 两条不变量的可证性（verity）

- **写面永不出 loopback = 机器门**：判据设在**实际监听套接字**（VM 上 `ss -tlnp` 断言写进程端口 == 127.0.0.1），跑在 VM 与写进程同宿主。红证：改绑 0.0.0.0 门必须红。
- **读面永不持 pins = 静态面可证 + 运行期残余**：
  - 静态面（可证）：读进程部署清单授予的文件系统范围不含 pin 库路径；bundle 无出站凭据通道；读进程从不构造 ChainClient。红证：给读进程一个含 pin 的 bundle 或一条能拉到 pin 的路径，门必须红。
  - 运行期内存（不可证）：任何快照证否不了"永不"，只靠拓扑。残余写成声明进记录，**不得标为已验证**。
- **判据在求值世界可满足**：写面门跑 VM（写面宿主），读面门跑读进程部署侧。

## 4. 验收不变量（STORY-139 落地为机器门）

| 不变量 | 判据 | 红证 |
| --- | --- | --- |
| 读面无写路由 | 读进程对全部 `/api/chain/*` 与域写路由应答 404/405 | 发写请求预期拒答（机器门） |
| 读面无 pins | 读进程部署清单无 pin 路径、不构造 ChainClient | 给含 pin bundle 门必须红 |
| 读面内容安全 | 无链字段 `dangerouslySetInnerHTML`；响应带 CSP/nosniff | 注入 HTML 预期被拒 |
| 写面永不出 loopback | VM 上写进程端口监听地址 == 127.0.0.1 | 改绑 0.0.0.0 门必须红 |

## 5. 已知边界（如实声明）

- "读面运行期内存永不持 pins"不可机证，靠拓扑 + 部署期控制，**不是已验证**。
- "LAN 上是谁"不可证，故读面边界不依赖 LAN 身份；来源性由链哈希承载（内容级声明，非传输层认证）。
- 读面服务的是**内置 `cockpitData` 快照** + 实时域读；快照新鲜度受重建节拍约束（与写面一致，非本设计引入的降级）。

## 6. 本设计经 STORY-138..141 落地

- STORY-138：实现 `apps/cockpit-read`（§3.1-3.4）
- STORY-139：两条不变量落机器门 + 红证（§3.6, §4）
- STORY-140：读进程上 VM、绑 LAN 接口、浏览器直连（含手机无 ssh）
- STORY-141：pnpm verify 全绿 + 读面可用性证明 + 与镜像退役对照
