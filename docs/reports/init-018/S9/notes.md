# S9 notes — STORY-149 · 观测选型 spike

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- 三候选运营成本对比（spike.md 表）：Langfuse 自托管（≥4 进程 / ≥4GB / PG+Redis 强依赖）＞ Jaeger all-in-one（单进程 ~0.5-1GB，内嵌存储重启丢数，生产需外部存储）＞ **OTel Collector + 轻 sink + 座舱渲染（1 进程 ~100-200MB / 零持久化强依赖）**。
- **决策（运营成本决定性）**：选 OTel Collector + 文件 JSONL sink + 座舱渲染。与 S10 契合（OTLP span 标准）；Jaeger 虽 span 原生但运营成本更高；Langfuse 仅当要 LLM eval/score 面板才值，S10 不需要。
- **PoC 可执行清单**已出（spike.md 第三节）：VM 沿 CONF-007 绑 127.0.0.1 仅 SSH 隧道；systemd 单元 + config.yaml（otlp receiver 回环 + batch + 文件 exporter + 轮转）；座舱只读渲染；三条验证（绿×2 + 红×1）。**VM 起服务实操归审查层**。

## 边界与诚实标注

- 内存/进程数字为典型自托管量级，来源见 spike.md 第四节（Langfuse 官方 sizing / Jaeger 官方 deployment / OTel Collector 对比）。版本号未钉——PoC 清单要求审查层安装时记 sha256。
- spike 是**选型建议**，不是已落地服务；S10 埋点按此 sink 形态设计。

## 证据包

- `commands.md`、`notes.md`、`spike.md`、`payloads/`。
