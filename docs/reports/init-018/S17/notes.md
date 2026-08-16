# S17 · archify 低本吸收（四道审查 + 试用 + digest 钉扎）

> 执行层 agent:deepseek-v4-flash · 2026-08-05。依据 sourcing-and-vetting-convention 四道审查。skill 载荷全文已通读（`archify/SKILL.md` 7929 bytes, metadata version 2.13）。

## 一、四道审查（全部通过）

| 审查 | 结论 | 证据 |
| --- | --- | --- |
| **许可证** | ✅ MIT | `gh repo view tt-a1i/archify` → `licenseInfo.key = "mit"`；`archify/LICENSE` = MIT（双版权：tt-a1i + Cocoon AI 原版） |
| **供应链** | ✅ 活跃 + 无依赖 | 9131 星（载荷记 9047）；updated 2026-08-04（活跃）；`package.json` deps `{}`/devDeps 0——CLI 无依赖、自包含，无供应链暴露面 |
| **防幻觉包名** | ✅ 实名核验 | `gh repo view` 实测存在（name/description/license/stars 全为 registry 实答，非记忆） |
| **运营成本** | ✅ 低 | 单 Node CLI（`node bin/archify.mjs`），无安装、无常驻、无持久化；试用即一次生成。符合 S9 型「运营成本为决定性审查」口径 |

## 二、digest 钉扎纳入（合格 → 钉扎）

- skill 载荷钉扎：`archify/SKILL.md` sha256 `4946d2fb2af9cb84461b1b98b732b44833e6a1ceaebfe8cd9e9d9ca4e939e12e`（7929 bytes, version 2.13）。
- 源仓 HEAD 钉扎：`19213e107f47733132e8958dd78f3a7fb8c6e225`（2026-08-05 浅克隆）。
- 归档：`docs/reports/init-018/S17/pinned-digest.json`。

> ### 订正（2026-08-05，核验层 · TCRN-CROSS-INC-038）：本节标题的「纳入」名不副实——**钉的是一件没装的东西**
>
> 原文保留可见。复核：`INC-038/recheck.sh` 第 7 节。
>
> **实测**：`archify` **不在本平台任何 skills 目录**。
>
> - `<平台根>/.claude/skills/` 名册：`animation-vocabulary`、`apple-design`、`emil-design-eng`、
>   `find-animation-opportunities`、`improve-animations`、`review-animations`、`tcrn-workflow-helper`
>   （外加两份 EMIL 许可/来源文本）——**无 archify**。
> - `~/.claude/skills/` 名册：`code-quality-review`、`owasp-security`——**无 archify**。
> - 全平台 `find -maxdepth 6 -iname 'archify*'`（排除 `node_modules`）：**零命中**。
> - 它实际只存在于 **`/tmp/archify-trial`**（= `<local-private-tmp>/archify-trial`，`SKILL.md` 在
>   `/tmp/archify-trial/archify/SKILL.md`）。第三节的试用（`node bin/archify.mjs …`）就跑在那里。
>   那是 **OS 临时目录**，随时可被系统清理；本单归档的 digest 一旦失去这份副本，
>   只能回源仓重新取来核对。
>
> **正确表述**：archify **已核验（四道审查全过）+ 已钉 digest，但尚未安装**。
> 本单交付的是一份**采纳资格的凭据**（四道审查记录 + `pinned-digest.json` + 一次隔离试用的产物），
> 不是一次安装。「纳入」在本平台的既有用法指的是**装进 skills 目录、被会话真实加载**，
> 本单没有做到那一步，也不应被读作做到了。
>
> **安装是后续动作，尚未有人办**，其内容至少包括：
> 1. 决定安装位置（平台根 `<平台根>/.claude/skills/` 还是用户级 `~/.claude/skills/`）——
>    平台根是本平台既有惯例（`tcrn-workflow-helper` 即在此），用户级会越出平台边界；
> 2. 从**钉扎的 HEAD**（`19213e10…`）取件，而不是从 `/tmp/archify-trial` 那份可能已被清理的副本；
> 3. 安装后**重新核对** `SKILL.md` 的 sha256 与 `pinned-digest.json` 一致（钉扎只有在装好之后
>    被复核，才开始承担「检测版本漂移」的职责；现在它守的是一个不在场的对象）；
> 4. 归审查层裁定是否采纳、以及采纳后由谁负责随版本重钉（第四节风险笔记第 2 条已提出）。

## 三、试用：三层流水线架构图（成功）

- spec：`outputs/tcrn-init018-three-layer.architecture.json`（sha256 `038609f9…`）。
- deliver 产出自包含 HTML：`outputs/tcrn-init018-three-layer-pipeline.html`（603,144 bytes，sha256 `09c25596…`）。
- 校验：9/9 artifact checks 全绿（single_svg/finite_svg/orthogonal_arrows/label_route_clearance/relationship_crossings/relationship_corridors/container_border_runs/route_rhythm/legend_clearance）。
- 两次迭代：首跑 1 处边穿组件（verification→review 穿越 execution）+ 标签重叠 → 按 skill 的「改判定证红」引导改布局（反馈边走顶、执行层在底）→ 通过。这正是 archify 的价值（布局可机器校验）。

## 四、风险笔记（诚实标注）

1. **skill 内置 CLI 的二进制字节未被平台独立审计**——四道审查覆盖许可证/供应链/包名/运营成本，未逐行审 CLI 源码；钉扎了 digest 后任何版本漂移可被检测（与 helper 的「重钉即发布」同理）。如需更严，审查层可加源码审计。
2. **repo 是活的**（updated 2026-08-04）——钉扎的 HEAD 会过时；采纳后按需随版本升级重钉（保留旧 digest 作记录）。
3. **架构图是试用产物**，非平台正式文档；正式使用若需，由审查层裁定纳入位置。

## 结论

**合格 → 钉扎纳入 + 试用成功。** 交付：pinned-digest.json + 架构图 HTML + 四道审查记录。

> **订正（2026-08-05，核验层 · INC-038）**：结论应改读为
> **「合格 → 已核验 + 已钉 digest + 隔离试用成功；尚未安装」**。
> archify 不在平台任何 skills 目录（实测见第二节订正块），试用跑在 `/tmp/archify-trial`。
> 「纳入」一词在本平台指装进 skills 目录并被会话加载，本单未到那一步；
> 安装是后续动作，其步骤列在第二节订正块。

## 证据包

`docs/reports/init-018/S17/`：`notes.md`（本文档）、`pinned-digest.json`、`outputs/tcrn-init018-three-layer-pipeline.html`、`outputs/tcrn-init018-three-layer.architecture.json`、`commands.md`、`payloads/`。
