# S15 — hot-path context byte baseline

> **单位是字节（bytes），不是 token。** token 数依赖模型与分词器，字节数是廉价、稳定、与机型无关的基线。
> 复测口径见 [remeasure-policy.md](remeasure-policy.md)。

Measured: `2026-08-04T17:10:18.253Z`

| scope | bytes |
| --- | --- |
| platform root CLAUDE.md | 18829 |
| repo CLAUDE.md (TCRN-TMS) | 5550 |
| repo CLAUDE.md (TCRN-Design-System) | 8479 |
| repo CLAUDE.md (TCRN-AOS) | 8880 |
| repo CLAUDE.md (tcrn-workflow) | 7347 |
| repo CLAUDE.md (tcrn-workflow-helper) | absent |
| auto-memory index (MEMORY.md) | 11904 |
| platform .mcp.json | 1490 |

**合计（在场文件）**：62479 bytes
