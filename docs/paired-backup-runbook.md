# 配对备份运行手册（域库 + 受治链）

> 治理记录：`TCRN-AOS-STORY-020` 交付物 · 裁定依据 `minutes:3a0d27be789cadb0ccb353c1`
> （部署与真值拓扑，「备份分层配对快照」）。
>
> **2026-07-30 按新拓扑重写（`TCRN-AOS-INC-045`）。** 配对的规则一字未改；改的是两半住在
> 哪里。STORY-131 把链迁到 VM，STORY-132 把域库随常驻座舱迁了过去，本文按迁完之后的样子
> 重写，并在末尾逐条记下旧腿的残余适用性分析。
>
> 脚本：`deploy/aos-resident-cockpit/paired-backup.mjs`（仪式）+
> `deploy/aos-resident-cockpit/vm-take-pair.mjs`（在 VM 上取那一对）。
> 引擎侧的链恢复手册在 `tcrn-workflow/docs/architecture/backup-restore-runbook.md`，
> 本文不重复它。

## 一句话

域库与受治链只有成对才有用，所以它们**在同一台机器上、同一瞬刻**一起取，且两半互相以摘要
指名；单独一半不是可恢复的备份。异地副本由**本机拉取**落到 VM 之外。

## 拓扑（2026-07-30，已成事实）

| 东西 | 在哪 |
| --- | --- |
| 受治链（真值根） | `tcrn-platform-dev:/srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace` |
| 见证目录（工作区根的**兄弟**，绝不在其内） | `…/TCRN-AOS/attestations` |
| 域库（`domain.db`，不可重建） | `tcrn-platform-dev:/srv/tcrn/aos-cockpit/data/domain.db` |
| 引擎 | `tcrn-platform-dev:/srv/tcrn/engine/tcrn-workflow`（v0.9.0） |
| **主**配对目录 | `tcrn-platform-dev:/srv/tcrn/backups/pairs/<instant>/` |
| **异地**配对目录 | 本机 `~/OneDrive/Github/tcrn-aos-paired-backups/<instant>/` |

本机 `.tcrn-workspace/TCRN-AOS/workspace` 已 vacated（完好、保留、不删），本机
`~/.tcrn-aos/domain.db` 是归档（旁有 `RELOCATED-TO-VM.json` 哨兵）。**两者都还在原地**，
这正是下面「两半是否活着」那道判据存在的理由。

## 为什么必须配对

域库存的是**注解**，主键是链上的记录 id；链存的是那些 id 指向的记录。把域库快照和一小时
前的链快照放在一起恢复，得到的是一堆挂在「恢复后的链从未听说过的记录 id」上的注解——读
起来像数据损坏，而不像一对不匹配的快照。

时间戳本身不足以证明配对：同一秒写下的两个文件仍然不能证明它们属于同一对。所以
`pair-manifest.json` 里两半各带对方的摘要（`pairing.domainSnapshotDigest` /
`domainExportDigest` / `chainManifestDigest` / `chainHeadEventHash` /
`attestationSetDigest`），恢复时先读它，按摘要认定这份域库快照是对着哪一份链快照取的。

### INC-045 到底坏在哪（值得记住的那一层）

坏的不是「一次备份失败了」，而是**两半分居两宿主之后，「配对」根本无法取到**——跨网络在
两个时刻读到的两半，是同一个目录里的两份快照。而且它**不会报错**：迁移之后两半在本机都
还存在（vacated 的工作区、带哨兵的归档库），旧命令会继续产出**每个文件都完好、两半都已
死**的「配对」，然后轮换把最后一份活的删掉给它腾地方。

所以本轮加的第一道判据不是「文件在不在」，而是**每一半是不是活的那一半**，且各问各自的
权威：链问**引擎**（迁走的地址答 `WORKSPACE_RELOCATION_VACATED`，那是迁移在生效），
域库问**归档哨兵**（哨兵在侧即说明那个文件是归档，不是座舱在写的那份）。

## 命令

```bash
pnpm paired:backup                 # 取一对、拉到异地、两侧各判一次、轮换
pnpm paired:backup-if-due          # 调度器用:异地那份过期才动手
pnpm paired:backup-verify-offsite  # 只重证最新那份异地副本
pnpm paired:backup-verify ~/OneDrive/Github/tcrn-aos-paired-backups/<pairDir>
node scripts/backup-due-alert.mjs  # 到期告警(零依赖,无须 build)
```

`--if-due` 判的是**异地那份**的年龄——VM 整台丢了要靠它恢复，所以那才是要紧的数。
**不到期时退出码 0**：「不到期」是正确结果，不是失败；否则调度器会在两次备份之间的每一次
运行都报警。间隔默认 24 小时（`AOS_BACKUP_INTERVAL_HOURS`），保留默认 5 份
（`AOS_BACKUP_RETENTION`，主与异地各保留 5）。

## 谁发起，为什么（两个问题，两个答案）

**那一对在 VM 上取。** 两半都在那儿，而两个证明各自都需要一件同住那儿的东西：
`snapshot-verify` 要引擎，恢复演练要域库运行时。这正是 MIN-011 保留 VM 引擎的那个常规用途
——**远端可恢复性可自证**，证明就发生在字节所在之处，而不是从远处断言。跨网络读一个活的
SQLite 文件，还会正好撞上本手册早已禁止的撕裂页风险。

**仪式与异地拷贝都由本机发起。** 凭据不对称是安全属性，而且它没有变：本机持钥匙，VM 只有
`authorized_keys`、不持有任何能回到本机的东西。**持有凭据的一方发起。** 真值在本机时这
意味着 push；真值到了远端，同一条不变式就意味着 **pull**。两个方向都不在任何一侧新增密钥。

`vm-take-pair.mjs` 的字节**经 ssh stdin 流式送到 VM 执行**，不落地安装：跑的就是仓库里
那份字节，没有第二份可漂移的副本，也没有哪个 `--delete` 能把它删掉。回执记下所送程序的
sha256。

> ⚠ 配置以 **base64** 传参，不是装饰。ssh 会把远端 argv 用空格拼起来交给**远端登录
> shell**，一个 JSON 参数在那边会被重新解析：`{"workspace":"/srv/…","engine":"/srv/…"}`
> 是一次花括号展开，第一次尝试时程序收到的是引号被吃掉的 `workspace:/srv/…`。

## ⚠ 必读前置：知识库高水位必须追平链头

`snapshot-manifest` 在知识库 marker 的 `eventHighWaterDigest` 落后于链头时以
`KNOWLEDGE_HIGH_WATER_MISMATCH` fail-closed。而这正是**每一次受治写入之后的常态**：写入
推进链头，知识库 marker 只在 `knowledge-rebase` 时才前移。

它失败的方式格外容易误判：同一时刻 `status` 与 `validate` 都报 `ok`，只有
`snapshot-manifest` 非零退出，且只打印一个 reason code、不给补救办法。运维看到的画面是
「链是健康的，备份工具坏了」——于是去查备份工具，而真正要做的是追平知识库。

引擎 fail-closed 是对的：手册的 lockstep 原则要求两者一起恢复，跨越不匹配的一对去描述
快照，等于描述一份没人能恢复的东西。

补救是**一次受治写入，仪式不会代做**（它把这条命令原文写进 `lockstep.remedy`）：

```bash
ssh -n tcrn-platform-dev "node /srv/tcrn/engine/tcrn-workflow/scripts/tcrn-workflow.mjs \
  knowledge-rebase --workspace /srv/tcrn/governance/tcrn-workspace/TCRN-AOS/workspace \
  --expected-version <marker.version> --at <instant>"
```

**2026-07-30 实测**：新拓扑首跑即撞上这一条——marker 停在 `bac1be07…`（version 14，上一
次本机配对时的链头），链头已是 `5200f632…`（version 838）。仪式以
`knowledge_high_water_behind_chain_head` 拒绝、`transfer` 未发生、并打印上面这条命令；
`knowledge-rebase --expected-version 14` 返回 `KNOWLEDGE_STORE_REBASED`（version 15，
高水位追平且**链头未前移**），随后取对一次成。

仪式会把它产出的**最近一次 fail-closed 拒绝**单独存档（`paired-backup-last-refusal`），
成功的运行**不清除它**——否则满足了前置条件的那一跑，会顺手删掉唯一记着「它确实拒绝过」
的东西。

## 每一半到底证到了什么

| 半边 | 取法 | 证据 |
| --- | --- | --- |
| 域库 | 逻辑导出**先**取，物理快照**后**取（`VACUUM INTO` + `PRAGMA integrity_check`） | `integrityCheck.ok` + `snapshotDigest`；活库另报一次 `liveIntegrityCheck` |
| 链 | `snapshot-manifest` → 拷贝 `.tcrn-workflow` → `snapshot-verify` | `SNAPSHOT_VERIFIED` |
| 见证 | 逐文件字节拷 + 集合摘要 | `attestations.setDigest`，另报 `orphanReceipts` / `filenameMismatches` |
| 恢复演练 | 导出重放进一个全新的库，**逐表两个读者各数一次** | 每族 `exported == restored == restoredSqlCount` |

两处顺序不可改：

- **manifest 必须先取**，因为它排除了持有中的 lease 子树，只与 lease 释放之后取的拷贝匹配。
- **逻辑导出必须先于文件摘要**：打开一个 SQLite 库可能动到它的字节，摘要必须算在真正要传
  的那份上（迁移那一步付过的学费）。

物理副本走引擎自有路径而**不是** `copyFile`：拷贝一个活的 SQLite 文件——而这一份是活的，
常驻座舱在写它——可能抓到一组撕裂页，且只在日后读取时才失败；在这里还会整个漏掉 WAL。

恢复演练的第二个判据（表上直接 `COUNT(*)`）不是重复：导出比对是同一条代码路径读自己，
`exportAll` 若静默漏掉一族，两侧会一致同意并保持绿。**判据两侧必须能够不同。**

### 见证目录的真实强度

`tcrn.time-attestation.v1` 是**建议性且未认证**的。引擎刻意把 `--attest-dir` 要求解析到
工作区根之外，正是为了让这些收据永远不会被误当成工作区内的受证物；引擎**不发布**它的
校验器。每份收据说的是「在 observedAt，本机时钟在提交该 eventHash 的事件时读到这个值」。

它是**顺序的旁证**，不是「某个声称的瞬刻被谁见证过」的证明。备份它保住的是旁证，不会把
旁证升级成证明。

能在本地检的只有一件事，仪式检了：每份收据的 `eventHash` 是否对应快照中真实存在的事件。
对不上的收据不是关于这条链的证据，而是一个「恢复之后看起来像证据」的文件。**只报不拦**
——孤立收据不会损坏链，为一份收据判整个备份失败，是拿真备份去换一个装饰性的不变式。
事件哈希从**副本**里读（`snapshot-verify` 已证副本与源逐字节相同），因为副本才是恢复时
真正拿到的东西。

**这个目录里不止一种收据，计数器必须说清（2026-07-30 修）。** 首次按新拓扑取对时
`orphanReceipts` 与 `filenameMismatches` 都恒为 2，查下去是 STORY-131 写的两份
`tcrn.relocation-attestation.v1`（stage `adopted` / `vacated`）——它们没有 `eventHash`、
按 relocation id 命名，本就不该按「文件名等于事件哈希」去判。**一个永远不为零的计数器，
读者会学会跳过它**，而那正是一份真的孤立收据溜过去的方式。所以现在按 `schemaVersion`
分类计数（`byKind`），孤立与文件名判据**只作用于 `tcrn.time-attestation.v1`**，两种都不认
的收据按名字列出而不是并进某个数。修后实测：632 时间见证 + 2 迁置见证，孤立 0、文件名不符
0，字节集合摘要不变。

## 异地方向（重定：MIN-007 D9 的残余情形转为现行）

**MIN-007 D9 当时裁的是 push**：真值在本机、VM 是异地，本机经既有 SSH 推送。同一份裁定
把「VM 拉」的方向保持未接线，并把 `pullContract` 的判据**原样保留**，理由写在当时的文本
里：「若未来改拉，契约与判据一字不改」。

真值已迁至 VM，于是那条**残余情形成了现行情形**，而 `export-manifest.json` 里的
`pullContract` 四条判据**一个字都没有改**就直接生效：

```
fetch every path in `files` and compare sha256 before trusting any of it
that check needs nothing but python3/sha256 -- no engine, no repository checkout
the puller needs no credential for the source machine beyond read access to these bytes
this manifest does not itself authenticate the source: it detects corruption and truncation, not substitution
```

不变式不是「push」，而是「**只有本机持有能跨越两机的凭据，故跨机传输一律由本机发起**」。
方向随真值的位置翻转，凭据不对称一字未动。

异地腿逐步：

1. 本机 `rsync --archive --delete tcrn-platform-dev:<pairDir>/ <本机 pairDir>/`
   ——连接由持钥匙的一侧打开，VM 不发起任何东西、也不新增任何东西。
2. **两侧各用自己的工具对自己的字节算逐文件摘要**，按路径全值双向比对（缺、多、不符三类
   分列），并比 `fileSetDigest`。判据不是「传输命令退出 0」。
3. 本机**用自己的引擎与自己的 `DomainStore` 重新判一次整对**：重算每个摘要（不是回读
   manifest 里的声明）、重跑 `snapshot-verify`、重跑恢复演练。远端说它成对是一次读数；
   本机在自己那份字节上重新判，才是第二次。
4. 一个**异地主机必须不同于真值主机**的判据。旧拓扑下这不可能误判（真值在本机、副本去
   VM）；新拓扑下取对的那台就是持真值的那台，所以这道判据的两侧真的可能相等。

**天花板变了，如实记下**：真值在本机时，远端是「有 node、没引擎、没检出」的 VM，字节完整
性可证、可恢复性不可证。现在引擎与链同住，**主侧自证可恢复性**，异地侧再用**第二套引擎**
独立证一遍——同一批字节上，可恢复性在**两台机器**各证一次。

仍未升级的限界：manifest **不认证来源**。能同时改写一侧副本并应答本次 ssh 会话的对手仍可
伪造一致。本腿检出的是损坏、截断，以及「相对另一侧记录被替换」，不多不少。

## 造红（判据写完必须真的去红一次）

仪式**每次运行**都做这几件事，不是一次性检查：

| 红 | 怎么造 | 期望 |
| --- | --- | --- |
| 旧路径必须拒绝 | 直接跑 `node scripts/paired-backup.mjs` | `topology_relocated_this_mode_is_retired`，退出码非零，并给出替代命令 |
| 摘要对不上字节 | VM 上一份**一次性副本**里翻转 `domain/domain.db` 的一个字节（长度不变，是替换不是截断） | `PAIR_DOMAIN_DIGEST_MISMATCH` |
| **INC-045 本身的条件** | 一次性副本里把 `pair-manifest.json` 的 `halves.domain.host` 改成另一台机器，其余文件全部完好 | `PAIR_HALVES_ON_DIFFERENT_HOSTS` |

一次性副本落在 `/srv/tcrn/scratch-inc045-red-<pid>`，回收写在同一个函数里，并以**路径是否
还存在**（而不是「删除命令退出 0」）验证。远端改动一律经 `node -`，不经 shell——ssh 的
远端 argv 会被远端 shell 重新解析，一个被引号规则悄悄改错的造红步骤，会把绿判据报成红、
或者更糟，把红判据报成绿。

纯判据（`deploy/aos-resident-cockpit/resident-predicates.mjs`）另有 19 道自动化测试，
其中十余道是红：两半不同宿主、两半都不是活的、非同刻、跨对拼装（每个文件都完好）、
四种摘要各自不符、链未验证、演练失败、空 manifest 不得空绿、异地与真值同机。

## 恢复

**仪式不恢复任何东西。** 它证明每一半**能**恢复（域库半边把导出重放进一个全新的库并两个
读者各数一次；链半边由 `snapshot-verify` 对字节拷贝报 `SNAPSHOT_VERIFIED`），那是**演练**，
不是恢复。

链的恢复是**同路径唯一**且由运维驱动的，按引擎手册走。两条铁律：同路径恢复；工作区日志
与知识库必须齐步——单独恢复日志会得到 `KNOWLEDGE_HIGH_WATER_MISMATCH`。

投影库**刻意不在备份里**：它从链重建，从不恢复。O3 事件镜像同样刻意不备（MIN-007）——
它是派生仪器，第二份可恢复的链历史副本会造成没人能裁的分叉。

## 轮换

只在新的一对自证通过之后才轮换，先旧后新，并把删掉的目录名字写进回执。**坏备份永远不会
成为好备份被删的理由。** 主侧轮换只作用于 `/srv/tcrn/backups/pairs/`，因此碰不到
`/srv/tcrn/backups/2026-07-28T13-29-29Z`——那是旧方向下从本机推上来的那一份，作为历史保留。

## 旧腿的残余适用性分析（`docs/harness-constraint-convention.md`）

四个旧模式逐一问过「它的成立条件是否仍对某类受支持的宿主成立」，答案与处置：

| 旧模式 | 成立条件 | 现状 | 处置 |
| --- | --- | --- | --- |
| `scripts/paired-backup.mjs --verify <pairDir>` | 只需要一个配对目录，从未提及两半住哪 | **仍完全成立** | **逐字保留、不设门**，且它就是异地侧每次用来重证的那个命令（仪式每跑一次都调它一次，`LEGACY_VERIFY_STILL_APPLICABLE`） |
| `scripts/backup-due-alert.mjs` | 读最新一对 `pair-manifest.json` 的 `pairedAt`（**从不读目录 mtime**：OneDrive 同步会改写 mtime） | **仍完全成立**——它看的正是拉回来的异地副本 | 未改动；2026-07-30 实测对新拉的一对答 `fresh` / 退出码 0 |
| `scripts/paired-backup.mjs`（默认取对） | 两半都在本机 | 两半都已迁走，且**都还在原地**故不会自然报错 | **条件化拒绝**（不是删除）：`topology_relocated_this_mode_is_retired`，指名新命令 |
| `--push-vm` / `--verify-remote` | 真值在本机、VM 是异地、以本机记录为基线 | 前提反转 | **条件化拒绝**；其**判据**（传前先自证、无引擎的远端 sha256 校验、抽样对照另一侧记录、旁车回执红绿都写）被新的拉取腿逐条复用 |

没有删除任何一段：AOS 之外没有第二个消费者（这两个脚本的分区默认、域库、落盘位置都是
AOS 专属），但静默移除会让下一个运维读到一份指名着已不存在命令的手册，所以这些模式留在
原地、自己回答自己。

## 落盘位置

- 主配对目录：`tcrn-platform-dev:/srv/tcrn/backups/pairs/<instant>/`（交付物，保留）
- 异地配对目录：`~/OneDrive/Github/tcrn-aos-paired-backups/<instant>/`
  （`AOS_PAIRED_BACKUP_DEST` 可改）
- 回执：`evidence/aos-paired-backup-new-topology.json`
- 每对约 1.9 MB / 660 文件（2026-07-30 实测；见证目录随链增长）

快照目标不得落在任何 git 工作树内，引擎会拒绝——已提交的备份字节是一次事后删除无法挽回的
隐私泄漏。仪式把治理树、引擎与部署运行时也一并交给引擎的这道判据，所以一对配对目录也
不可能落进控制树里。

## 静态加密与密钥归属（两案成文，未实施，待 Owner 择）

现状如实：两段落盘（VM `/srv/tcrn/backups/pairs/`、本机 OneDrive 目录）均为**明文**，
内容含链事件全文与域库注解。传输段已有通道加密（ssh），本节只谈**静态**字节。以下两案按
MIN-007 D9 要求成文呈同门裁定，**未实施任何一案**。

### 案 A：专用 age 身份（X25519）

| 项 | 内容 |
| --- | --- |
| 加密 | 传输前对整对 `age -r <recipient>`（tar 后整体加密），密文落两段 |
| 密钥归属 | **Owner 持唯一 identity（私钥），离线保存**；本机与 VM 只存 recipient（公钥） |
| 恢复演练 | 每次演练必含解密步：`age -d -i <identity>` 后再走既有重证；**演练失败即密钥流失预警** |
| 得 | 备份机密性与两台机器的沦陷都解耦 |
| 失 | 新增一件必须由人保管的密钥材料；identity 丢 = 全部历史备份不可读 |

### 案 B：复用既有 SSH ed25519 密钥作 age recipient

| 项 | 内容 |
| --- | --- |
| 加密 | `age -R <本机 ssh 公钥>`；解密用同一把 SSH 私钥 |
| 密钥归属 | 随既有 SSH 密钥，**本机持有**，零新增材料 |
| 得 | 零新增密钥管理；接线最短 |
| 失 | 备份机密性与本机 SSH 密钥同命——**本机沦陷则备份同时失密**，而本机沦陷恰是异地备份要防的场景之一；SSH 密钥轮换须连带重加密历史备份 |

两案共同的连带改动（择案时一并定）：export-manifest 判据改为对**密文**摘要，或密文内层
保留明文 manifest；若连主侧也加密，到期告警读不到明文 `pair-manifest.json`，判据须随案
调整。

**未实施，待 Owner 择。** 择案后另开工作项实施：加密接线、恢复演练（含解密）入本手册、
失败路径造红。

## 「非配对」临时纪律：已撤销

INC-045 立单时同时立了一条临时纪律：**在配对前提恢复之前，每次备份须如实标注「非配对」**，
并写明了它自己的解除判据——域库随 S132 的 VM 常驻座舱迁至 VM、配对备份在新拓扑下重新接线
并实证一次同刻配对与恢复演练。

自 **2026-07-30T00:22:25Z** 起解除。解除不是一句声明：仪式里那道判据
（`judgeUnpairedDisciplineRetired`）从本次运行**自己的判词**推导，五个条件（两半同机／
整对已证／同刻且交叉引用成立／演练通过／异地副本落在真值主机之外）任一为红，纪律继续
生效。

INC-045 之前取的那些「非配对」标注**保持原样**——它们当时是对的。
