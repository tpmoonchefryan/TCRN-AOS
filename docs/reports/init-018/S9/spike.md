# S9 · 观测选型 spike（三候选运营成本对比 + PoC 清单）

> 执行层 agent:deepseek-v4-flash · 2026-08-05。为 STORY-150（S10 埋点）选观测后端。**运营成本为决定性审查**。VM 起服务实操归审查层，本单出到 PoC 可执行清单为止。

## 一、三候选运营成本对比表

> 内存为典型单机自托管量级（来源见文末）。运营成本 = 进程数 + 内存 + 持久化依赖 + 月维护动作。

| 维度 | Langfuse 自托管 | OTel Collector + 轻 sink + 座舱渲染 | Jaeger all-in-one |
| --- | --- | --- | --- |
| **进程数** | 2 应用容器（web + worker）+ **postgres + redis** = 最少 **4 进程**；可选 clickhouse/s3 更多 | **1 进程**（Collector 单 Go 二进制）+ sink 并入（文件/SQLite，无独立进程）；座舱渲染复用既有 cockpit | **1 进程**（all-in-one：agent+collector+query+UI 内嵌）；生产耐久需外部存储 → 2+ |
| **内存** | 官方推荐 **≥2 CPU / ≥4 GB RAM**（全部容器）；Node 默认 heap 1.7 GiB/容器 | Collector 典型 **~100–200 MB**；sink（JSONL/SQLite）~可忽略 | all-in-one 典型 **~0.5–1 GB**（含内嵌存储）；外部存储另计 |
| **持久化依赖** | **PostgreSQL（必）+ Redis（必）** + 可选 ClickHouse/S3 | **无强依赖**：JSONL 文件或 SQLite 单文件，可轮转 | 非生产用内嵌存储（内存/badger，**重启丢数**）；生产需 Elasticsearch/ClickHouse/Cassandra |
| **月维护动作** | 版本升级（web+worker 同发+DB migration）、PG 备份/恢复演练、Redis 持久化调优 | collector 配置更新、sink 轮转/压实；无 DB 备份 | 版本升级、存储保留期/压实；内嵌模式无备份 |
| **为 span 而生的程度** | 通用 LLM 观测（trace/event/score），非 span 专用 | 传输/汇聚层，任何 OTLP 数据 | **分布式追踪原生**（span 第一公民） |

## 二、决策（运营成本决定性）

**选：OTel Collector + 轻 sink + 座舱渲染。**

- **最轻**：1 进程、~100–200MB、零持久化强依赖、月维护最低。对比 Langfuse（≥4 进程 / ≥4GB / PG+Redis 强依赖）与 Jaeger（单进程但 ~0.5–1GB + 内嵌存储无耐久）。
- **与 S10 契合**：S10 的 ceremony 四点 span 与引擎动词 span 走标准 **OTLP** → Collector → sink；座舱渲染复用既有 cockpit 读面，不加新 UI 进程。
- Jaeger 虽 span 原生，但其运营成本（内嵌存储重启丢数 / 生产要外部存储）超过 Collector+sink；Langfuse 最重，仅当需要 LLM 级 eval/score 面板时才值，本平台 S10 只埋 span，不需要。
- 说明：Collector 是传输层，sink 形态（JSONL 文件 / SQLite）由 PoC 首版定为**文件 JSONL**（零额外进程、可轮转、可被座舱只读 tail）。

## 三、PoC 可执行清单（VM 姿势沿 CONF-007：绑 127.0.0.1，仅 SSH 隧道）

> 实操（下载/起服务/落 systemd）归审查层；以下为可执行清单，逐项可核。

1. **安装**：VM `tcrn-platform-dev` 落 OTel Collector 单二进制（Linux amd64，官方 release，钉版本并记 sha256）。
2. **systemd 单元** `tcrn-otel-collector`（`/etc/systemd/system/`）：`ExecStart=.../otelcol-contrib --config /etc/tcrn-otel/config.yaml`，`Restart=always`。只读服务，无特权。
3. **config.yaml**：
   - `receivers.otlp`：`grpc` 绑 `127.0.0.1:4317`、`http` 绑 `127.0.0.1:4318`（**仅回环**，与 cockpit 同 CONF-007 姿势；不绑 0.0.0.0）。
   - `processors.batch`：批量批处理。
   - `exporters`：文件 exporter 写 `/srv/tcrn/otel/data/spans.jsonl`；配轮转（大小/日期触发，保留 N 份）。**禁任何载荷内容外的 exporter**（隐私自查：sink 只收 span 结构，无链正文）。
   - `service.pipelines.traces`：otlp → batch → file。
4. **数据目录**：`/srv/tcrn/otel/data/`（0700，owner tcrn-otel 用户）；轮转脚本或日志轮转系统管旧文件。
5. **座舱渲染**：`tcrn-aos-cockpit` 增只读端点（或独立静态页）tail 最近 span（读 `/srv/tcrn/otel/data/spans.jsonl`），不写。绑 `127.0.0.1`，仅 SSH 隧道可达。
6. **隧道**：`ssh -L 4318:127.0.0.1:4318 tcrn-platform-dev` 以向 Collector OTLP http 发测试 span；座舱渲染经既有隧道姿势。
7. **验证**（三条，红绿皆备）：
   - 绿：发一条测试 OTLP span → sink 文件出现该 span 记录 → 座舱端点能列出。
   - 绿：`systemctl is-active tcrn-otel-collector` = active。
   - 红：Collector 未运行时发 span → 发端报连接拒绝（证明「没收到」可被观测，不是静默）。
8. **收尾**：重启 VM 后服务自启（`systemctl enable`）；`journalctl -u tcrn-otel-collector` 无错误。

## 四、来源

- Langfuse 官方推荐 sizing（≥2 CPU / ≥4 GB 全部容器；web+worker 两容器）：[langfuse.com self-hosting containers](https://langfuse.com/self-hosting/deployment/infrastructure/containers)
- Jaeger 部署形态（all-in-one 单二进制 / 生产外部存储）：[jaegertracing.io 1.76 deployment](https://www.jaegertracing.io/docs/1.76/deployment/)、[Jaeger 2.1 architecture](https://www.jaegertracing.io/docs/2.1/architecture/)
- OTel Collector 轻量单二进制（Edge 对比）：[OneUptime: Compare OpenTelemetry Collector vs Fluent Bit](https://OneUptime.com/blog/post/2026-02-06-compare-opentelemetry-collector-vs-fluent-bit/view)
- CONF-007 D7：座舱/cockpit 绑 127.0.0.1 仅 SSH 隧道（平台 CLAUDE.md §三.4）

## 证据包

`tcrn-workflow/docs/reports/init-018/S9/`：`spike.md`（本文档）、`commands.md`、`notes.md`、`payloads/`。
