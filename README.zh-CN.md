<p align="center">
  <img src="docs/brand/tcrn-aos-impression.png" alt="TCRN AOS 产品印象图" width="720" />
</p>

<h1 align="center">TCRN AOS</h1>

<p align="center">
  Agent Operations System：面向代理协作工作的本地优先运营骨架，用于工作记录、证明、评审和受边界约束的只读回看。
</p>

<p align="center">
  <a href="README.md">English</a>
  · <a href="README.zh-CN.md">简体中文</a>
  · <a href="README.ja.md">日本語</a>
  · <a href="README.ko.md">한국어</a>
  · <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://github.com/tpmoonchefryan/TCRN-AOS"><img alt="GitHub repository" src="https://img.shields.io/badge/GitHub-TCRN--AOS-24292f" /></a>
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-5865d8" />
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-3c873a" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-local%20packages-3178c6" />
  <img alt="Local first, no live dispatch" src="https://img.shields.io/badge/posture-local--first%20%2F%20no%20live%20dispatch-4f46e5" />
</p>

## 这是什么

TCRN AOS（Agent Operations System）是一个本地优先的代理运营系统。它把协作工作建模为项目、倡议、史诗、故事级票据、分配、证据链接、闸门工作单、评论和审计事件，并通过受限的 MCP 风格方法和浏览器回看界面提供可审阅的协调记录。

这个仓库面向公开源码审阅和本地实验。它不是托管服务，不是自主派发系统，也不表示任何 TCRN 产品里程碑、运行时、发布、面向所有者的工作流或最终验收状态已经完成。

## 本地优先边界

- AOS 将运营证明数据保存在本地 SQLite 数据库或内存存储中。
- 运行时 profile root 必须显式配置，并在 SQLite 打开前验证 owner marker。
- 浏览器回看仅限于 `/api/work/readback` 的票据和审计视图。
- MCP transport 方法使用 allowlist；通用网关、原始数据库导出和 live dispatch 表面刻意不存在。
- 审计和 receipt payload 以元数据为主，并会遮蔽敏感细节。
- Codex adapter 证明路径默认为 dry-run/no-send，除非单独评审并接受 live-dispatch lane。
- Workflow 治理、线程 registry 真相、发布权限和 Owner Intent gate 不属于本仓库权限范围。

## 架构

```text
apps/
  api/       本地 HTTP shell 和浏览器安全回看 facade
  web/       静态 React work/readback shell
packages/
  domain/    AOS 记录、store、policy、idempotency 和 redaction
  db/        SQLite repository、migration、runtime profile validation
  mcp-gateway/
             领域方法 dispatcher 和方法级 idempotency
  mcp-server/
             本地 JSON-line stdio/runtime transport
  adapter-codex/
             Dry-run Codex dispatch 和 terminal-return ingestion helper
scripts/     证明、验证、smoke 和 source-export helper
docs/        架构、安全、运行时和证明说明
```

## 要求与快速开始

需要 Node.js（兼容 `packageManager` 字段）、`pnpm`，以及同级的 `TCRN-Design-System` checkout，因为本包使用本地 file 依赖。

```text
TCRN Platform/
  TCRN-AOS/
  TCRN-Design-System/
```

```sh
pnpm install
pnpm build
pnpm verify:fast
pnpm service:start
```

本地服务只提供静态 shell 和 API 回看；它不会启动远程运行时、外部队列、live thread dispatch、发布流程或 Owner Intent executor。

## 常用命令

```sh
pnpm typecheck
pnpm test
pnpm verify:fast
pnpm verify
pnpm audit:licenses
pnpm source-export:proof
pnpm service:smoke
```

## 安全与隐私姿态

- 不要提交 SQLite 运行时数据库、原始 DB dump、凭证、私有证据 payload、本机绝对路径 dump、浏览器/keychain 材料、shell history 或原始扫描器输出。
- 公开源码导出会按构造排除本地 evidence receipts 和生成的运行时 artifacts。
- 敏感内容检查存在于 domain redaction helper 和 source-export/publication proof 脚本中。
- Runtime profile validation 会在 SQLite 打开前拒绝不安全 root、symlink、traversal、stale marker 和非 direct-child 数据库路径。
- 公开 GitHub 发布应使用经过清理的 current-tree export；除非本地历史已被单独证明安全，否则不要镜像 legacy local history。

## 文档

- [Architecture](docs/architecture.md)
- [Security boundaries](docs/security-boundaries.md)
- [Persistent runtime storage prerequisite](docs/persistent-runtime-storage-prerequisite.md)
- [Source export prerequisite](docs/source-export-prerequisite.md)
- [Gateway adapter proof](docs/gateway-adapter-proof.md)
- [Runtime proof](docs/runtime-proof.md)

## 许可证

Apache-2.0。见 [LICENSE](LICENSE)。
