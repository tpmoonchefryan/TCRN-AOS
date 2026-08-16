# S11 notes — STORY-151 · 成本归因

执行层 agent:deepseek-v4-flash · 2026-08-05。

## 结果

- **解析器** `scripts/token-attribution.mjs`：读 host 会话 JSONL，提取 input/output/cache_creation/cache_read 逐消息、逐模型、逐会话聚合；gap（unparseable/missingUsage/missingModel/incompleteUsage）逐条如实记录，禁静默上限。实测本平台 73 会话全部可解析。
- **关联规则**：层 = `message.model`（执行=deepseek-v4-flash / 审查=claude-fable-5 / 核验=claude-opus-5）；样本集 = 正文含 "INIT-018" 的 6 会话。
- **首份报表**：INIT-018 三层成本——执行层 in 3.59M/out 1.27M/cacheR 416M；审查层 out 1.77M/cacheR 132M；核验层 19 消息小样本。cache_read 主导（551M vs 非缓存 6.6M）。

## 关键读数

- 1M 上下文 + prompt 缓存使 cache_read 主导成本；只看 input/output 会低估执行层两个数量级。
- 执行层重输入（读上下文），审查层重输出（产长文），核验层低频（事后审计）。

## 缺口如实标注

- 样本口径=含 "INIT-018" 串的会话；按 STORY 名单独开的不在此样本（如实注明，非静默上限）。
- cache_creation 样本全 0（parser 如实记录）；synthetic 模型 1 条 0 token 排除。

  > **订正（2026-08-05，核验层 · INC-038）**：「样本全 0」不成立。同目录早 18.2 秒落盘的
  > `init018-attribution.json` 逐模型行自记非零，样本合计 **5,840,169**
  > （执行层 `deepseek-v4-flash` = 0；审查层 `claude-fable-5` = 5,731,295；
  > 核验层 `claude-opus-5` = 108,874）。解析器没丢——丢在报表侧手工归并的 `byLayer`
  > 只搬了 input/output/cacheRead/msgs/sessions 五个键，没搬 `cacheCreation`；
  > 本条与 `report.md` 第 4 条是读那张缺列的表写出来的。全文与复核命令见
  > `report.md` 的订正块与 `docs/reports/init-018/INC-038/`。
  > 「全 0」只对执行层成立。
- 单会话不按 Init 内外拆分（转录无此边界标记）。

## 证据包

- `commands.md`、`notes.md`、`report.md`、`init018-attribution.json`、`payloads/`。
