# R2 notes — STORY-138 · R2 ship-web 轻量船运

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- 新建 `deploy/aos-resident-cockpit/ship-web.mjs`：前置 → 装配 web 根 → rsync → 双向账本 → JSON 报告；`--dry-run` 不触网；地址全从 `manifest.mjs` 导入。
- `node --test` 9/9 绿（含账本不等红测、缺文件红测、dry-run 不触网、前置失败、权限回归）。
- dry-run 存档；实跑一次 `TRANSFER_LEDGERS_EQUAL`（14 文件，两侧 fileSetDigest=`0deaa96a…`）。
- 船后对活面重跑 freshness 门：exit 0，verdict fresh，generatedAt 16:34:57Z（新于船前 16:05:45Z），shell/bundle 同戳零 findings。

## 关键设计决策：web 根 = 装配产物，不是 apps/web/dist 原样

`apps/web/dist` 是 `pnpm build` 的产物，其 `index.html` 是 `/cockpit` 产品壳（无 `data-cockpit-view`、无生成戳 prose）；真正被 cockpit 与 read face 服务的 web 根是「`renderAosShellHtml({path:"/"})` 根壳 + 每 MODULE_VIEWS 路由壳 + assets」。ship-web 按 apply.mjs 第 4 步口径从已建产物装配（省去 esbuild 重打包——build.ts 已产出 bundle），再同步。测试 `the assembled web root is the served cockpit` 专守此不变量。

## 事故（实跑 #1）：mkdtempSync 0700 经 rsync --archive 传播致 read face 全 404

- 现象：实跑后 freshness 门 exit 2（asset HTTP 404），磁盘文件在但 read face（无特权用户 `aosread`，进程 15:48 起）对根与资产全 404。
- 根因：`mkdtempSync` 建 0700 staging；`rsyncToVm` 的 `--archive` 含 `--perms`，把 0700 传播到远端 `/srv/tcrn/aos-cockpit/runtime/web`（drwx------ ryanlan），aosread 无法遍历。
- 修复：ship-web 装配后 `chmodSync(staging, 0o755)`，报告带 `stagingRootMode` 作回归锚；新增测试 `the staging root is world-traversable` 守住。远端一次 `chmod 755` 恢复后重跑确认维持 0755。
- 留档：`outputs/real-run-first-0700-incident.json`（首跑账本同样全等——证明账本等 ≠ 服务不破，权限是独立维度）。

## 范围外观察（报审查层，不动手）

- 无。

## 证据包

- `commands.md`、`outputs/`（4 文件）、`payloads/`（activate/close + 回执）。
- 链上：TCRN-CROSS-STORY-138 已置 done。
