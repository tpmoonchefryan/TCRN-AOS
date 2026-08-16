# STORY-170 收口 —— 存量补票:INC-041 四代办

签发:执行层 agent:fable · 2026-08-05 · TCRN-CROSS-INIT-019 派工批次 1
**红线:本单只补票,不执行那四件事。** 补票 = 把每件从散文变成可验收的单,写清五要素(尤其生效证据命令)。

## 补票清单(四件)

### 170.1 S4.2 Codex 侧应用三个 MCP 服务器增量 diff
- **红线**:编辑 `~/.codex/config.toml` 属用户级配置,须经 Owner 批准;parity 白名单只许收缩不许扩张。
- **文件指针**:`~/.codex/config.toml`(`[mcp_servers.*]`);diff 由 `TCRN-AOS/deploy/aos-local-client/parity-proof.mjs`(STORY-146 S4)生成。
- **验证命令**:`pnpm --dir TCRN-AOS parity:proof` 绿,且 `codegraph-ds`/`codegraph-aos`/`tcrn-workflow-aos-read` 三条白名单条目被删除(收缩)。
- **收口动作**:白名单删除三条 → `parity:proof` 仍绿。
- **生效证据命令**:三个服务器在 Codex 侧 `status` 实测可用(`~/.codex/config.toml` 生效后各起一次),
  且 `parity:proof` 在白名单收缩后仍 `PARITY_VERIFIED`。

### 170.2 STORY-144 enforce 切换
- **红线**:必须排除 `probe:true` 记录;观察窗自 2026-08-05 重置起算。
- **文件指针**:`tcrn-workflow/scripts/ssh-write-observer.mjs`(enforce 开关);`docs/reports/init-019/S165/criteria.md`。
- **验证命令**:与 STORY-165 合流。
- **收口动作**:判据成文待 Owner 确认后切换。
- **生效证据命令**:同 165.2——切换后拦截一次真实误用并可回退(拦截记录的 reason code 可见)。

### 170.3 S154 archify 安装
- **红线**:安装产物 sha256 必须与钉扎一致;装进平台 skills 名册。
- **文件指针**:平台 `.claude/skills/` 与安装脚本。
- **验证命令**:`shasum -a 256 <安装产物>` 与钉扎比对。
- **收口动作**:安装完成且名册可见。
- **生效证据命令**:安装后重算 sha256 与钉扎一致,且在 skills 名册里可见(`ls .claude/skills/ | grep archify`)。

### 170.4 otel-spans 接线
- **红线**:隐私门对该 sink 必须 exit 0(span 不含宿主路径/凭据)。
- **文件指针**:引擎 span 发射器 + sink;`TCRN-AOS/deploy/aos-local-client/ceremony-spans.mjs`。
- **验证命令**:`pnpm --dir TCRN-AOS test`(ceremony-spans 测试)绿。
- **收口动作**:sink 出现 verb span。
- **生效证据命令**:引擎跑一次真动词(经仪式)后 sink 里出现该 verb 的 span,且隐私门对该 sink exit 0。

## 已提交
- 本 notes(补票单)在 `docs/reports/init-019/S170/`(随 INC-042 入库)。
