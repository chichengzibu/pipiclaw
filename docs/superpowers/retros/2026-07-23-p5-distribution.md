# P5 分发与支持 Phase Retro (2026-07-23)

**整合到** `2026-07-23-v4-100pct.md` 的 P5 段。

## 摘要

P5 重点 T5.4(CrashReport 收集器)完成。T5.1(code signing)/ T5.2(真自动更新 pipeline)/ T5.3(macOS+Linux CI)/ T5.5(文档视频)/ T5.6(营销物料)需外部资源(EV cert, GitHub token, CI runner)留后续。

## 关键产出

- `electron/insight/CrashReport.ts` + `tests/unit/CrashReport.test.ts`(11 test)
  - process 级 uncaughtException + unhandledRejection 监听
  - JSON 落盘 userData/crash-reports/ 带完整 metadata
  - IPC 暴露 4 个 channel(crash:list / get / clear / count)
  - preload 暴露 `window.electronAPI.taskLog.crashList/...`
- 已有 AutoUpdater(`electron/core/AutoUpdater.ts`)完整单测覆盖

## 已有但需外部资源的

- AutoUpdater 完整集成 + 单测覆盖,差 GitHub Releases pipeline 触发
- electron-builder.json5 已配 mac (x64+arm64) + linux (x64 AppImage)
- 缺 EV certificate + 真 latest.yml

## 留 follow-up

- T5.1 code signing(EV cert)
- T5.2 .github/workflows/release.yml(tag 触发 build + upload .exe + latest.yml)
- T5.3 macOS runner + Linux runner
- T5.5 5 分钟上手视频 + troubleshooting 30 条 + FAQ 50 条
- T5.6 hero GIF + 截图集 + README 重写
- T5.4 集成 UI:Settings → "反馈" 按钮 → 自动 attach crash 报告

完整 P0-P5 总收尾见 `2026-07-23-v4-100pct.md`。
