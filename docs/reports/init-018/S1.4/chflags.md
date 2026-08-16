# S1.4 归档只读加固 — chflags uchg

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 改动

对 `.tcrn-workspace/` 下五个**归档**分区目录递归施加 `chflags -R uchg`（user immutable）：

```
TCRN-AOS · cross-project · TCRN-Design-System · TCRN-TMS · Joi-Button
```

**未**触及四个 `*-shadow`（本机活链，必须保持可写）与 `release-trust/`。

## 命令

```bash
cd "<local-platform-root>"
for d in TCRN-AOS cross-project TCRN-Design-System TCRN-TMS Joi-Button; do
  chflags -R uchg ".tcrn-workspace/$d"
done
ls -lO .tcrn-workspace/ | grep -v shadow   # 五个归档目录旗标列出现 uchg
```

## 验证（红测通过）

- 加锁后 `ls -lO`：五归档目录（含递归文件）旗标列 `uchg`。
- 写保护红测：`touch .tcrn-workspace/TCRN-AOS/evidence-locator/write-probe.txt`
  → `touch: Operation not permitted`（exit 1）。只读不受影响。
- `chflags` 前现状存档于本目录 `state-before.txt`（旗标列全 `-`）。

## 解锁配方

见 `TCRN-AOS/docs/reports/init-018/S1.4/unlock-runbook.md`（`chflags -R nouchg` 解锁，改完重新加锁，附判定表）。

## 边界

`uchg` 只拦修改/删除/改名，不拦读。归档真值在 VM（本机全 vacated），加锁只服务取证/回退，不复活活链。
