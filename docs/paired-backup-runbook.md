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

## 异地（VM）拉取

每一对里都写了 `export-manifest.json`：逐文件摘要 + `fileSetDigest`，供拉取方在信任任何
字节之前逐一比对。它检得出损坏与截断，**检不出替换**——它不认证来源。

**未接线，且刻意未接。** 约束是「VM 拉」：本机持密钥与凭据，VM 只有 `authorized_keys`，
今天它**无法**主动连回本机——这个不对称本身就是安全属性，不是待绕开的障碍。从本机推不需要
在 VM 上放新密钥，但意味着本机按计划伸手进 VM；让 VM 拉则需要 VM 持有能读本机的凭据。
哪一种可接受是**关于凭据放置的 Owner 决定**，所以脚本只把「可拉」做出来，不开路径。

2026-07-27 对真 VM（`tcrn-platform-dev`）实测过拉取契约：150 个文件全部按摘要校验通过。
同时测出了它的天花板——VM 有 node v24 但**没有引擎、没有仓库检出**，所以它能证明字节完整
到达，**不能**重跑 `snapshot-verify` 或域库恢复演练。字节完整性在那边，可恢复性只在有引擎
的宿主上。这一条写进了每份 `export-manifest.json` 的 `farSideVerification`。

## 轮换

只在新的一对自证通过之后才轮换，先旧后新，并把删掉的目录名字写进回执。**坏备份永远不会
成为好备份被删的理由。**

## 落盘位置

- 配对目录：`~/OneDrive/Github/tcrn-aos-paired-backups/<instant>/`（可用 `AOS_PAIRED_BACKUP_DEST` 改）
- 回执：`TCRN-AOS/evidence/aos-paired-backup.json`
- 每对约 583 KB / 150 文件（2026-07-27 实测）

快照目标不得落在任何 git 工作树内，引擎会拒绝——已提交的备份字节是一次事后删除无法挽回的
隐私泄漏。
