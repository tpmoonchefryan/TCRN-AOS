# S16 notes — STORY-153 · 代际复审

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- **S16.1 编目**：全平台约束/门/hook/公约 35 项（A 公约 6 + B 门 11 + C hook 4 + D 约束 14），每项列来源与成立条件。
- **S16.2 三档起草**：仍在 15 / 已消失 1 / 条件化 4。

  > **订正（2026-08-05，核验层 · INC-038）**：15 + 1 + 4 = 20 ≠ 编目总数 35，三档不分割编目。
  > 且「仍在（15）」的表头与 `catalog.md:65` 自己的列表矛盾（那行实际列了 29 项），
  > 而 **B10**（S7 黄金样本 + S6 lessons 的 CI 确定性子集，`catalog.md:31`）未入任何一档。
  > **订正为：仍在 30（含 B10）/ 已消失 1（D13）/ 条件化 4（B5、B6、B9、C2），和 = 35。**
  > 逐项名单与 B10 的归档理由见 `catalog.md` 的订正块；复核 `INC-038/recheck.sh` 第 5 节。
  - **已消失（D13）**：workflow-MCP「两侧未接」句——成立条件已消失（2026-08-05 实测两侧已接），S3 已修正，提案确认。
  - **条件化 4**：verify-s6（随场景库）、verify-otel-privacy（随 sink 就位）、parity:proof 白名单（S4.2 后收缩）、SSH observer（observe→enforce）。
- **S16.3 终稿与采纳归审查层**（MIN-058）；本单只出提案不删除。

## 说明

- 复审覆盖本平台现役约束/门/hook/公约；新增项（S2/S3/S6/S8/S10 交付的门与 hook）已入编目。
- 判定依据：成立条件是否仍对受支持用户/宿主/模型成立（harness-constraint 公约的残余适用性口径）。

## 证据包

- `commands.md`、`notes.md`、`catalog.md`、`payloads/`。
