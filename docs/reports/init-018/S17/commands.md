# S17 commands — STORY-154 · archify 低本吸收

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 链上开工/收口（§5 仪式）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S17/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload ../tcrn-workflow/docs/reports/init-018/S17/payloads/activate.json --partition cross-project --receipt ../tcrn-workflow/docs/reports/init-018/S17/payloads/activate.receipt.json
# 收口载荷 ../tcrn-workflow/docs/reports/init-018/S17/payloads/close.json（同法）
```

## 实名核验 + 通读 + 试用（隔离，scratch 克隆）

```bash
gh repo view tt-a1i/archify --json name,licenseInfo,stargazerCount,updatedAt   # MIT / 9131 星 / 活跃
git clone --depth 1 https://github.com/tt-a1i/archify /tmp/archify-trial      # scratch 试用，不污染平台
cd /tmp/archify-trial/archify
node bin/archify.mjs doctor                                                     # 全绿，无依赖
node bin/archify.mjs validate architecture <spec.json> --quality showcase --json   # 9/9 checks
node bin/archify.mjs deliver architecture <spec.json> <out.html> --quality showcase --json  # 产 HTML + sha256
```

## 钉扎 digest

`docs/reports/init-018/S17/pinned-digest.json`：SKILL.md sha256 `4946d2fb…`（v2.13）+ repo HEAD `19213e10…` + 试用 spec/artifact sha256。

## 归档输出

| 文件 | 内容 |
| --- | --- |
| `docs/reports/init-018/S17/notes.md` | 四道审查 + 风险笔记 + 结论 |
| `docs/reports/init-018/S17/pinned-digest.json` | digest 钉扎 |
| `docs/reports/init-018/S17/outputs/tcrn-init018-three-layer-pipeline.html` | 三层流水线架构图（试用产物） |
| `docs/reports/init-018/S17/outputs/tcrn-init018-three-layer.architecture.json` | 架构 spec |
| `docs/reports/init-018/S17/payloads/` | 仪式载荷与回执 |
