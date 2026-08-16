# S1.4 归档只读解锁配方（unlock runbook）

> 关联 TCRN-CROSS-STORY-139（S1 控制树本机写保护）。执行层 agent:deepseek-v4-flash · 2026-08-05。
>
> **警告**：`.tcrn-workspace/` 下五个归档分区目录已 `chflags -R uchg`（user immutable）。
> 这是**刻意**的只读加固（MIN-012「只读留存」裁定 + S1 写保护），不是事故。
> 本文件只在确实需要改动归档内容时使用——正常只读（`ls`/`status`/取证）不需要解锁。
> 改完记得重新加锁。

## 哪些被锁（且仅这些）

```
.tcrn-workspace/TCRN-AOS
.tcrn-workspace/cross-project
.tcrn-workspace/TCRN-Design-System
.tcrn-workspace/TCRN-TMS
.tcrn-workspace/Joi-Button
```

四个 `*-shadow` 目录与 `release-trust/` **没有**被锁——shadow 是本机活链（fallback 缓冲），
释放其只读会挡住合法写。

## 解锁（改内容前必做）

```bash
cd "<local-platform-root>"
for d in TCRN-AOS cross-project TCRN-Design-System TCRN-TMS Joi-Button; do
  chflags -R nouchg ".tcrn-workspace/$d"
done
# 验证：ls -lO .tcrn-workspace/ | grep -v shadow   # 五个归档目录的旗标列应回到 "-"
```

## 改完重新加锁（必须，否则写保护失效）

```bash
cd "<local-platform-root>"
for d in TCRN-AOS cross-project TCRN-Design-System TCRN-TMS Joi-Button; do
  chflags -R uchg ".tcrn-workspace/$d"
done
# 验证：ls -lO .tcrn-workspace/ | grep -v shadow   # 五个归档目录的旗标列应出现 "uchg"
```

## 判定

| 状态 | 期望 |
| --- | --- |
| 加锁后 | 五个归档目录（含递归文件）旗标列 `uchg`；`touch <归档内任意路径>` 报 `Operation not permitted`；`ls`/只读不受影响 |
| 解锁后 | 五个归档目录旗标列 `-`；写操作恢复 |

## 为什么可以安全解锁（边界）

`uchg` 只拦「修改/删除/改名」，不拦「读」。归档的真值在 VM（本机全部 `WORKSPACE_RELOCATION_VACATED`，
引擎只读动词都拒），解锁只服务于取证/回退轴上的手动操作，不会复活任何活链。
