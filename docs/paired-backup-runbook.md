# 配对备份运行手册（域库 + 受治链）

> 治理记录：`TCRN-AOS-STORY-020` 交付物 · 裁定依据 `minutes:3a0d27be789cadb0ccb353c1`
> （部署与真值拓扑，「备份分层配对快照」）。
>
> 脚本 `scripts/paired-backup.mjs`；引擎侧的链恢复手册在
> `tcrn-workflow/docs/architecture/backup-restore-runbook.md`，本文不重复它，只补 AOS
> 分区特有的两件事：域库与链的配对，以及见证目录。

## 一句话

`~/.tcrn-aos/domain.db` 与 `.tcrn-workspace/TCRN-AOS/` 只有成对才有用，所以它们在同一
瞬刻一起取，且互相以摘要指名；单独一半不是可恢复的备份。

## 为什么必须配对

域库存的是**注解**，主键是链上的记录 id；链存的是那些 id 指向的记录。把域库快照和一小
时前的链快照放在一起恢复，得到的是一堆挂在「恢复后的链从未听说过的记录 id」上的注解
——读起来像数据损坏，而不像一对不匹配的快照。

时间戳本身不足以证明配对：同一秒写下的两个文件仍然不能证明它们属于同一对。所以
`pair-manifest.json` 里两半各带对方的摘要（`pairing.domainSnapshotDigest` /
`pairing.chainManifestDigest` / `pairing.chainHeadEventHash`），恢复时先读它，按摘要
认定这份域库快照是对着哪一份链快照取的。

## 命令

```bash
pnpm paired:backup
```

```bash
pnpm paired:backup-if-due
```

```bash
pnpm paired:backup-verify ~/OneDrive/Github/tcrn-aos-paired-backups/<pairDir>
```

`--if-due`（即 `paired:backup-if-due`）是给调度器用的：只有当最新一对比间隔更旧才动手，
没有任何一对时视为到期。**不到期时退出码 0**——「不到期」是正确结果，不是失败；否则调度
器会在两次备份之间的每一次运行都报警。

间隔默认 24 小时，可用 `AOS_BACKUP_INTERVAL_HOURS` 改。保留默认 5 份，`AOS_BACKUP_RETENTION`。

## ⚠ 必读前置：知识库高水位必须追平链头

**这是本分区在 2026-07-27 之前从未成功快照过的原因。**

`snapshot-manifest` 在知识库 marker 的 `eventHighWaterDigest` 落后于链头时以
`KNOWLEDGE_HIGH_WATER_MISMATCH` fail-closed。而这正是**每一次受治写入之后的常态**：写入
推进链头，知识库 marker 只在 `knowledge-rebase` 时才前移。

它失败的方式格外容易误判：同一时刻 `status` 与 `validate` 都报 `ok`，只有
`snapshot-manifest` 非零退出，且只打印一个 reason code、不给补救办法。运维看到的画面是
「链是健康的，备份工具坏了」——于是去查备份工具，而真正要做的是追平知识库。

引擎 fail-closed 是对的：手册的 lockstep 原则要求两者一起恢复，跨越不匹配的一对去描述
快照，等于描述一份没人能恢复的东西。

补救（一次受治写入，**脚本不会代做**）：

```bash
node scripts/tcrn-workflow.mjs knowledge-rebase --workspace <root> --expected-version <marker.version> --at <instant>
```

`paired-backup.mjs` 每次运行前先自查这一项，不通过就以
`knowledge_high_water_behind_chain_head` 退出并在 `lockstep.remedy` 里写出上面这条命令。

## 每一半到底证到了什么

| 半边 | 取法 | 证据 |
| --- | --- | --- |
| 域库 | 引擎自有路径 `createSqlitePhysicalSnapshot`（`VACUUM INTO` + `PRAGMA integrity_check`） | `integrityCheck.ok` + `snapshotDigest`；**不是** `copyFile`——拷贝活的 SQLite 文件可能抓到一组撕裂页，而它只在日后读取时才失败 |
| 链 | `snapshot-manifest` → 拷贝 `.tcrn-workflow` → `snapshot-verify` | `SNAPSHOT_VERIFIED` |
| 见证 | 逐文件字节拷 + 集合摘要 | `attestations.setDigest`，另报 `orphanReceipts` / `filenameMismatches` |

顺序不可改：manifest 必须先取，因为它排除了持有中的 lease 子树，只与 lease 释放之后取的
拷贝匹配。

### 见证目录的真实强度

`tcrn.time-attestation.v1` 是**建议性且未认证**的。引擎刻意把 `--attest-dir` 要求解析到
工作区根之外，正是为了让这些收据永远不会被误当成工作区内的受证物；引擎**不发布**它的
校验器。每份收据说的是「在 observedAt，本机时钟在提交该 eventHash 的事件时读到这个值」。

它是**顺序的旁证**，不是「某个声称的瞬刻被谁见证过」的证明——一个未认证的本机时钟读数
做不到那件事。备份它保住的是旁证，不会把旁证升级成证明。

能在本地检的只有一件事，脚本检了：每份收据的 `eventHash` 是否对应快照中真实存在的事件。
对不上的收据不是关于这条链的证据，而是一个「恢复之后看起来像证据」的文件。**只报不拦**
——孤立收据不会损坏链，为一份收据判整个备份失败，是拿真备份去换一个装饰性的不变式。

2026-07-27 实测：133 份收据全部对应上（链上读到 296 个事件），孤立 0、文件名不符 0。
133 与 296 的差是预期的：attestation 是在本分区生命周期中途启用的。

## 恢复

**本脚本不恢复任何东西。** 它证明每一半**能**恢复（域库半边把导出重放进一个全新的库并
比对；链半边由 `snapshot-verify` 对字节拷贝报 `SNAPSHOT_VERIFIED`），那是**演练**，不是
恢复。

链的恢复是**同路径唯一**且由运维驱动的，按引擎手册走。两条铁律：同路径恢复；工作区日志
与知识库必须齐步——单独恢复日志会得到 `KNOWLEDGE_HIGH_WATER_MISMATCH`。

投影库**刻意不在备份里**：它从链重建，从不恢复。

## 异地（VM）：裁定与三条腿（MIN-007 D9）

每一对里都写了 `export-manifest.json`：逐文件摘要 + `fileSetDigest`，供接收方在信任任何
字节之前逐一比对。它检得出损坏与截断，**检不出替换**——它不认证来源。

**凭据放置已裁**（2026-07-28，MIN-007 D9）：期中（镜像段）按 **push**——本机经**既有**
SSH 通道推送，VM 仍只有 `authorized_keys`、仍不持有任何能读本机的凭据，两侧都不新增
密钥。原「VM 拉」方向保持未接线；export-manifest 的 `pullContract` 判据原样保留——残余
适用：若未来改拉，契约与判据一字不改（这也是 push 腿在 VM 上执行的正是同一判据的原因）。

2026-07-27 对真 VM（`tcrn-platform-dev`）实测过的天花板不变：VM 有 node v24 但**没有
引擎、没有仓库检出**，能证明字节完整到达，**不能**重跑 `snapshot-verify` 或域库恢复
演练。字节完整性在那边，可恢复性只在有引擎的宿主上（`farSideVerification` 照记）。

### 腿一：推送（`--push-vm`）

```bash
pnpm build && node scripts/paired-backup.mjs --push-vm
```

顺序即判据，三步不可换：

1. **先自证**：对最新一对跑与 `--verify` 相同的重证（三摘要比对 + `SNAPSHOT_VERIFIED`
   + 域库恢复演练）。不通过则**一个字节也不推**。
2. `rsync -a --delete`（走既有 ssh）至 VM `/srv/tcrn/backups/<pairId>/`。
3. 在 VM 上**无引擎**逐文件 sha256 校验——即上文 `pullContract` 的判据原文（"fetch every
   path in `files` and compare sha256 … no engine, no repository checkout"），在字节落地
   之处执行。校验对象是随字节同行的 manifest，检的是传输途中的损坏与截断；相对本机记录
   的替换由腿三检。

**失败不掩**：任一步红 = 回执红 + 退出码非零，本地对不受任何影响，照常可恢复。

回执是**旁车文件** `vm-push-receipt.json`（红绿都写，落在配对目录旁）。刻意不并入
`pair-manifest.json`：export-manifest 在取对当刻已按摘要封存了 pair-manifest 的字节，
事后把回执折进去会静默作废远端校验所依据的那条记录。旁车同样被排除在传输之外
（`--exclude`），VM 持有的恰是封存集。

VM 侧目录（`AOS_VM_BACKUP_ROOT`，默认 `/srv/tcrn/backups`）是交付物，保留不删。

2026-07-28 实测：真对 `2026-07-28T13-29-29Z` 推送后 VM 侧 365/365 文件摘要全对、
`fileSetDigestMatch` 真；造红——篡改副本自证失败 →
`local_self_verify_failed_nothing_was_pushed`，`transfer: null`，VM 上未出现任何字节。

### 腿二：到期告警（`scripts/backup-due-alert.mjs`）

```bash
node scripts/backup-due-alert.mjs   # 无须 build，零依赖
```

读最新一对 `pair-manifest.json` 里的 `pairedAt`——**从不读目录 mtime**：OneDrive 同步
会改写 mtime，mtime 记的是同步、不是备份（本手册的教训，写进了判据）。超过 间隔+宽限
（默认 24+6 小时，`AOS_BACKUP_INTERVAL_HOURS` / `AOS_BACKUP_DUE_GRACE_HOURS`）或根本
没有任何一对 → 退出码 1 并打印补救命令；新鲜 → 0。宽限的理由：这是笔记本，整夜合盖是
「迟」不是「无」。

2026-07-28 造红实测：陈旧（208.9h）→ 1 且打印 REMEDY；无任何一对 → 1；新鲜 → 0；
真实目录（3.4h）→ 0。

**不代装调度器。** Owner 自行决定是否接 launchd/cron；可用样例（自装自管）：

```
# launchd（~/Library/LaunchAgents/com.tcrn.aos.backup-due-alert.plist 的关键三项）
#   ProgramArguments: node <repo>/scripts/backup-due-alert.mjs
#   StartInterval:    3600
#   StandardErrorPath/StandardOutPath: 自选日志位置

# cron
0 * * * * cd <TCRN-AOS repo> && /usr/local/bin/node scripts/backup-due-alert.mjs || <通知渠道>
```

### 腿三：本机验签（`--verify-remote`）

```bash
pnpm build && node scripts/paired-backup.mjs --verify-remote
```

基线在**本机**，不在 VM：远端 `export-manifest.json` 须与本机那份逐字节同摘要；抽样
文件（四个承重文件恒抽——`pair-manifest.json`、`chain-snapshot-manifest.json`、
`domain/domain.db`、`domain/domain-export.json`——外加每次随机八个，抽签记入回执）在
VM 上以 `sha256sum` 计算，与**本机** manifest 记录比对。**替换检出即红。**

2026-07-28 造红实测（VM scratch 副本上）：篡改一个文件并**连伪造出自洽的 manifest**
——远端自检会照绿的那种——`--verify-remote` 仍红（`substitution_or_divergence_detected`），
因为伪造集对不上它没见过的本机记录。

既有限界照记，未升级：manifest 不认证来源；能同时改写 VM 副本**并应答本次 ssh 会话**
的对手仍可伪造一致。本腿检出的是「VM 字节相对本机记录被替换」，不多不少。

## 静态加密与密钥归属（两案成文，未实施，待 Owner 择）

现状如实：两段落盘（OneDrive 配对目录、VM `/srv/tcrn/backups/`）均为**明文**，内容含
链事件全文与域库注解。传输段已有通道加密（ssh），本节只谈**静态**字节。以下两案按
MIN-007 D9 要求成文呈同门裁定，**本 Story 不实施任何一案**。

### 案 A：专用 age 身份（X25519）

| 项 | 内容 |
| --- | --- |
| 加密 | 推送前对整对 `age -r <recipient>`（tar 后整体加密），密文落两段 |
| 密钥归属 | **Owner 持唯一 identity（私钥），离线保存**（打印件/密码管理器）；本机与 VM 只存 recipient（公钥） |
| 恢复演练 | 每次演练必含解密步：`age -d -i <identity>` 后再走既有 `--verify` 重证；**演练失败即密钥流失预警** |
| 得 | 备份机密性与两台机器的沦陷都解耦；identity 丢失前有演练兜底 |
| 失 | 新增一件必须由人保管的密钥材料；identity 丢 = 全部历史备份不可读 |

### 案 B：复用既有 SSH ed25519 密钥作 age recipient

| 项 | 内容 |
| --- | --- |
| 加密 | `age -R <本机 ssh 公钥>`（age 原生支持 ssh-ed25519 recipient）；解密用同一把 SSH 私钥 |
| 密钥归属 | 随既有 SSH 密钥，**本机持有**，零新增材料 |
| 恢复演练 | 同案 A，解密步换 `-i <ssh 私钥>` |
| 得 | 零新增密钥管理；接线最短 |
| 失 | 备份机密性与本机 SSH 密钥同命——**本机沦陷则备份同时失密**，而本机沦陷恰是异地备份要防的场景之一；SSH 密钥轮换须连带重加密历史备份 |

两案共同的连带改动（择案时一并定）：export-manifest 判据改为对**密文**摘要，或密文内层
保留明文 manifest；若连本地段也加密，腿二读不到明文 `pair-manifest.json`，告警判据须
随案调整。

**未实施，待 Owner 择。** 择案后另开工作项实施：加密接线、恢复演练（含解密）入本手册、
失败路径造红。

## 轮换

只在新的一对自证通过之后才轮换，先旧后新，并把删掉的目录名字写进回执。**坏备份永远不会
成为好备份被删的理由。**

## 落盘位置

- 配对目录：`~/OneDrive/Github/tcrn-aos-paired-backups/<instant>/`（可用 `AOS_PAIRED_BACKUP_DEST` 改）
- 推送旁车回执：`<配对目录>/vm-push-receipt.json`（红绿都写，不入传输、不入 export-manifest）
- VM 异地副本：`tcrn-platform-dev:/srv/tcrn/backups/<pairId>/`（`AOS_VM_HOST` / `AOS_VM_BACKUP_ROOT` 可改；交付物，保留）
- 回执：`TCRN-AOS/evidence/aos-paired-backup.json`；推送接线证物 `evidence/aos-backup-push-wiring-proof.json`
- 每对约 1.4 MB / 365 文件（2026-07-28 实测；attestation 目录随链增长）

快照目标不得落在任何 git 工作树内，引擎会拒绝——已提交的备份字节是一次事后删除无法挽回的
隐私泄漏。
