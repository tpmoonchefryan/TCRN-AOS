# S5.1 — promptfoo 包元数据与选定版本

执行层 agent:deepseek-v4-flash · 2026-08-05。

## npm view 原始输出（存档于本目录 npm-view-raw.txt）

```
name = 'promptfoo'
version = '0.121.20'
license = 'MIT'
maintainers = [ sklein12, mdangelo, ianw, justinbeckwith, faizanminhas ]
```

## 选定版本：`0.121.20`（当前 latest，钉死）

理由：
- **最新 latest**，`npm view` 实测返回（防幻觉包名审查：名称/版本/许可证/维护者均为 registry 实答，非记忆）。
- **MIT 许可证**——平台外采四道审查（许可证/供应链/防幻觉包名/运营成本）的许可证一关通过。
- 安装为 `devDependency`，钉住精确版本（项目 `.npmrc` 的 `save-exact=true` 即精确钉版）。
- 仅用于**离线** `echo` provider 确定性断言 smoke（S5.2/5.3），不接任何真实 API key、不发任何网络模型调用，供应链暴露面仅限安装时的依赖解析。

## 注：安装输出

`pnpm add -D promptfoo@0.121.20` → `devDependencies: + promptfoo 0.121.20`（共 +686 包）。
伴随警告：3 个 deprecated 子依赖（boolean/glob/node-domexception）、若干 peer 提示、`@openai/codex` 下载一次重试（最终成功）、ignored build scripts（pnpm 默认策略，非阻断）。
