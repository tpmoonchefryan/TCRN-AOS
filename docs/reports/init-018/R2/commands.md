# R2 commands — STORY-138 · R2 ship-web 轻量船运（可原样重跑）

执行层 agent:deepseek-v4-flash · 2026-08-05。全部命令自 `TCRN-AOS` 仓根起。

## 链上开工/收口（§5 仪式，cross-project 分区）

```bash
cd "<local-platform-root>/TCRN-AOS"
node deploy/aos-local-client/ceremony.mjs --payload docs/reports/init-018/R2/payloads/activate.json --partition cross-project --dry-run
node deploy/aos-local-client/ceremony.mjs --payload docs/reports/init-018/R2/payloads/activate.json --partition cross-project --receipt docs/reports/init-018/R2/payloads/activate.receipt.json
# 收口载荷 docs/reports/init-018/R2/payloads/close.json（同法）
```

## 代码改动

新增：
- `deploy/aos-resident-cockpit/ship-web.mjs` — R2 船运。前置（`apps/web/dist` 存在且 bundle 带 generatedAt 戳）→ 从已建产物装配 web 根（`renderAosShellHtml({path:"/"})` + 每 MODULE_VIEWS 路由壳 + 复制 dist 的 bundle/品牌 svg）→ rsync 至 `VM_WEB` → 两侧各用自家 node 算逐文件 sha256 账本 → 双向全值比对 → JSON 报告。`--dry-run` 全程不触网。主机名/远端路径全部从 `manifest.mjs`（`VM_HOST`/`VM_WEB`/`MODULE_VIEWS`）导入。
- `deploy/aos-resident-cockpit/ship-web.test.mjs` — 9 个 `node --test` 用例（真实装配 + 注入远端侧）。
- `package.json` `test` 追加 `deploy/aos-resident-cockpit/ship-web.test.mjs`。

## 前置（重建数据使实跑交付最新快照）

```bash
pnpm cockpit:data            # 投影 5 链 → apps/web/src/cockpit-data.generated.ts
pnpm build                   # cockpit:data 内部 build 在数据前，需补跑让新数据进 bundle
node -e 'const s=require("fs").readFileSync("apps/web/dist/assets/aos-client.js","utf8").match(/generatedAt["\x27]?\s*:\s*["\x27](\d{4}-\d{2}-\d{2}T[^"\x27]{1,40})/); console.log(s?.[1])'
# 期望 = 16:34:57Z（新于 VM 现役 16:05:45Z）
```

## 测试（绿含账本不等红测）

```bash
node --test deploy/aos-resident-cockpit/ship-web.test.mjs    # 9/9 pass
```

## --dry-run（不触网）

```bash
node deploy/aos-resident-cockpit/ship-web.mjs --dry-run
# exit 0 · DRY_RUN_NO_NETWORK · stagingRootMode 755 · wouldSync 14 文件 7.6MB → /srv/tcrn/aos-cockpit/runtime/web
```

## 实跑（红线 #2 白名单②授权）

```bash
node deploy/aos-resident-cockpit/ship-web.mjs
# exit 0 · TRANSFER_LEDGERS_EQUAL · 14/14 双向全等，两侧 fileSetDigest=0deaa96a…（acceptance 证据）
```

## 事故与修复（实跑 #1 引入，必须留档）

```bash
ssh tcrn-platform-dev "ls -ld /srv/tcrn/aos-cockpit/runtime/web"
# 实跑 #1 后为 drwx------ ryanlan（mkdtempSync 0700 经 rsync --archive 的 --perms 传播）
# read face 进程以无特权用户 aosread 运行 → 无法遍历 → 全路径 HTTP 404（freshness 门 exit 2）
ssh tcrn-platform-dev "chmod 755 /srv/tcrn/aos-cockpit/runtime/web"
node deploy/aos-resident-cockpit/ship-web.mjs    # 修复后重跑，远端维持 0755
node scripts/read-face-freshness.mjs             # exit 0 · verdict fresh · generatedAt 16:34:57Z
```

## 归档输出（R2/outputs/）

| 文件 | 内容 |
| --- | --- |
| `dry-run.json` | --dry-run 报告（stagingRootMode 755） |
| `real-run-fixed.json` | 修复后实跑，账本双向全等（acceptance 证据） |
| `real-run-first-0700-incident.json` | 首跑实跑（账本同样全等，但传播 0700 权限致 read face 404） |
| `test-output.txt` | `node --test` 9/9 绿 |
