# INIT-020 第四轮验收落地报告 — Codex

> 2026-08-07。依据 `AUTHORIZATION-2026-08-07-qa4-owner.md` 执行 A/B；没有执行 C 的远端推送。本文记录实际执行结果，不把 dry-run、候选历史或未获授权的发布写成已完成。

## 结论

Owner 授权范围内的落地已完成：权威链补挂、knowledge-rebase、投影与读面复核、回执卫生分类、Workflow 候选历史隐私重写、tag 重铸、0.11.8 P8/release gate、引擎部署和最终 QA4 复核均为绿。远端 push / public publication 仍按授权明确停在 C 停止点。

## A — 链、知识、投影和回执

- Cross chain 从 v2260 / `fedff97fd96aa6284b95fd23b7fe24ddfc68d308f4b68cc5da3f8b284a8f7e62` 前进至 v2264 / `4822fa897ab6d757c90f434a3bc187328f8df6cdb33cd6f2b23679adec699282`。
- 四条真实 `work-annotate` 已经由 ceremony 写入，record IDs 为 `work:102ca7701ff4ad32349a551a`、`work:77adddf2447eb8fb417fd7f7`、`work:5f61ec8a573bf92f38e64d7`、`work:702e68f743721fbc7d9e45fb`；四条 actor 均为 `agent:gpt-5-codex`，四条 readback 均为 `READBACK_MATCHES_FULL_VALUE`。原始 receipt：`evidence/mcp-ceremony-write/receipts/2026-08-07T11-23-15-840Z-9d9997-cross-project.json`。
- 同一次真实 ceremony 完成 knowledge-rebase：marker v100 → v101，reason `KNOWLEDGE_STORE_REBASED`。
- cockpit 生成戳为 `2026-08-07T11:24:06Z`，cross v2264；五分区版本为 cross/DS/TMS/AOS/Joi = 2264/983/229/1048/586。`ship-web.mjs` dry-run 与实际 ship 均通过 `TRANSFER_LEDGERS_EQUAL`，实际 ledger 为 14 files、fileSetDigest `646cab444821c363f47b7127bc63ff90bfc3bcfbbb5f2717edf5e34afb886844`。
- 最终 `pnpm projection-freshness:proof` 为 `PROJECTION_FRESHNESS_OK`：knowledge fresh、web fresh、codegraph fresh；codegraph 唯一的 added=1 是生成投影/未追踪残留，未被误判为源代码滞后。`pnpm read-face:freshness` 读取实际 HTTP 供给字节为 fresh，observedAt `2026-08-07T12:29:37Z`，served cross v2264，findings=[]。
- `pnpm receipt-hygiene:proof` 为 `RECEIPT_HYGIENE_VERIFIED`，扫描 169 件、`problems: []`。10 个历史红见证没有覆盖或手工拼接：7 个归为 `historical-null-head-witness`，3 个归为 `payload-as-receipt-witness`；原始字节移至 `evidence/mcp-ceremony-write/witnesses/`，分类与 bytes/SHA-256 清单见 `evidence/mcp-ceremony-write/witness-classification-2026-08-07-qa4.json`。

## B — Workflow 候选历史、发布门和部署

- 候选目录：`<local-home>/.tcrn-workflow/candidates/qa4-inc098-O0SToT`。最终实现提交为 `23b04ff`，release metadata-only 提交为 `7751bec`；`v0.11.8` annotated tag 精确指向 `7751bec7ee8f4ab90a5454f3e62665e44fb709ee`。
- `v0.11.0`–`v0.11.7` 已在 privacy-clean candidate history 上重铸为 annotated tags，并恢复 v0.11.3 的 explanatory note 形状；v0.11.8 也只在本地候选树创建。
- `pnpm verify:history` → `HISTORY_CLEAN`（root `5a7cc1f5cfca22bb3b7cd12a0476817355b517f9`，283 commits，0 reflog residue）；`pnpm verify:privacy` → `PRIVACY_SOURCE_CLEAN`（full history/archive scanned，sourceFiles=423）。历史中已无旧 host/path/IP 或旧 fixture 口令；新 fixture 口令只经环境参数注入，且在原始提交历史中查不到。
- 最终 `pnpm verify:p8` → `P8_WORKFLOW_RC_VERIFIED`，`pnpm release:preflight --tag v0.11.8` → `RELEASE_TAG_PREFLIGHT_VERIFIED`；P8 basis 与 tag commit 均为 `7751bec7ee8f4ab90a5454f3e62665e44fb709ee`，release commit 只含 CHANGELOG、release note 和 package manifests。
- 最终验证：Workflow 全套 `999` tests 通过，PG 串行套件 `19/19` 通过；P8 source archive 可重建且 privacy clean。
- 本机 governed copy 已保留可恢复备份：`<local-home>/.tcrn-workflow/tcrn-workflow.bak-qa4-20260807T120000Z`。安装副本已更新到 v0.11.8/tag anchor，`deploy/aos-engine-host/apply.mjs` 完成引擎收敛；`pnpm engine-host:verify` 为 `AOS_HOST_ENGINE_MATCHES_GOVERNED_COPY`，version/tag=0.11.8、local/remote=472 files、mismatched/missing/extra 均为 0，CLI=106，receipt 为 `evidence/aos-engine-host-deploy.json`。

## 停止点与工作树边界

- 没有 `git push`、没有 remote tag publication、没有 `--all`/`--mirror`；C 仍需单独授权。
- `TCRN-AOS` 原有 dirty worktree 未做 blanket commit/reset；本轮只保留必要的 manifest、projection-freshness、receipt-hygiene、witness classification、engine deploy receipt 和本报告变化，其他用户文件未覆盖。
- `tcrn-workflow` 原仓库未发布；候选树是本轮历史重写和 release gate 的隔离承载体。
