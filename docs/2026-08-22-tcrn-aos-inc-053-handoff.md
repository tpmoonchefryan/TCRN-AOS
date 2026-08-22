# AOS consumer handoff — 2026-08-22

截至 2026-08-22 实测，Design System 去产品化后公开 CSS 面只保留
`tcrnComponentCss`；AOS 的 `/assets/tcrn.css` 消费方已迁移到该导出，并与新的
`vendor/tcrn-ui-react-3.0.0.tgz` 同一次提交落地。

这不是 Design System 的失误面：移除按裁定是正确的，缺口在跨仓变更交接时没有把
已登记的 AOS 消费方一起迁移。AOS 负责自己的运行时代码、导入面和 vendored 包，
Design System 仍是 CSS 权威源。

复核命令：

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm verify
```

生效证据还需在换包后启动实例，检查 `/assets/tcrn.css` 的 `text/css` 响应，并在
真浏览器里确认徽章与正文链接仍命中组件样式；本记录不宣称部署、发布或产品验收。
