# PiPiClaw 文档中心

> 这是 PiPiClaw 项目所有文档的统一入口。仓库内文档目录,GitHub Pages 可直接渲染。
> GA 前如有需要再迁到 Docusaurus / VitePress(本目录结构与 frontmatter 已是兼容写法)。

## 📖 用户文档

面向终端用户 — 想用 PiPiClaw 解决问题的人从这里开始。

- [新手入门](user-guide/getting-started.md) — 5 分钟快速上手
- [用户手册](user-guide/user-guide.md) — 8 个能力域的 How-to
- [常见问题 FAQ](user-guide/faq.md) — 15+ 高频问题
- [故障排查](user-guide/troubleshooting.md) — 按错误类别定位

## 🛠 开发者文档

面向贡献者 / 集成方 — 想理解或扩展 PiPiClaw 内部实现的人。

- [架构总览](architecture/overview.md) — 技术栈 + 模块图
- [IPC 协议](architecture/ipc.md) — 主进程 ↔ 渲染端 100+ handler 全表
- [扩展开发](architecture/extension.md) — 如何添加新 provider / channel / view

## 📋 实施 / 复盘

项目历史决策的可追溯档案。

- [plans/](../superpowers/plans/) — 实施计划(W2 ~ Phase 5)
- [retros/](../superpowers/retros/) — 阶段复盘(每个 phase 一份)
- [specs/](../superpowers/specs/) — 设计规格
- [CHANGELOG 索引](../CHANGELOG-INDEX.md) — retro / plan / spec 总入口

## 🚀 发布 / 性能

- [CHANGELOG](../../CHANGELOG.md) — 每个版本的变更日志
- [性能基准](../perf/baseline.md) — bundle / IPC surface 现状
- [E2E 测试说明](../e2e-testing.md) — Playwright + Electron 真 E2E 指南

## 🤝 贡献

- [贡献者指南](contributing.md) — 如何提 PR / 报 bug / 贡献 skill

---

## 文档导航约定

- 仓库根目录 `/` 即 `docs/site/` 的父目录
- 所有相对路径以 `docs/site/` 为基准
- 中文优先(产品用户群是中国开发者);英文版留待 Phase 6 GA
- Markdown 文件保持 GitHub-flavored + CommonMark 兼容
- 表格 / 列表 / 代码块样式参考各文件已使用的惯例

## 完整性测试

文档结构由 `tests/unit/docs-structure.test.ts` 守护:

- `docs/site/README.md` 必须存在且 ≥ 200 字
- 用户指南 4 文件必须存在且非空
- 架构文档 3 文件必须存在且非空
- FAQ 必须 ≥ 15 个 Q
- 用户手册必须覆盖 8 个能力域关键词

运行:

```bash
npx vitest run tests/unit/docs-structure.test.ts
```