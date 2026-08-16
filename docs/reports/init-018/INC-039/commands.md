# INC-039 证据 — 可原样重跑

工作目录 `TCRN-AOS`。

## 缺陷复现(修复前的世界,用真实历史字节)
```bash
git -C "../TCRN-TMS" show HEAD~1:CLAUDE.md | grep -c "| \`local\` |"   # 1 = 被提交的记录曾断言 home=local
```

## 修复一:提交两份 CLAUDE.md
```bash
git -C "../TCRN-TMS" show HEAD:CLAUDE.md | grep -c "| `local` |"              # 0
git -C "../TCRN-Design-System" show HEAD:CLAUDE.md | grep -c "| `local` |"    # 0
```

## 修复二:判据覆盖「被提交的版本」
```bash
node deploy/aos-local-client/doc-topology-proof.mjs   # DOC_TOPOLOGY_IN_SYNC, 含 COMMITTED_CLAIMS_MATCH_THE_TREE
```

## 红侧(喂修复前的真实提交字节)
见 outputs/committed-claims-red.json:`COMMITTED_CLAIMS_DIVERGE_FROM_THE_TREE`,点名 `TCRN-TMS/CLAUDE.md`。

## 已声明的天花板
平台根不是 git 仓库,其 5 份文档报为 `tracked:false`(如实记录,非静默放过)。
