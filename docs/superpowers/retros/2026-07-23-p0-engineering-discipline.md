# P0 工程纪律 Phase Retro (2026-07-23)

## 摘要

P0 (3-5 天预估) **单 session 内完成**。修复了 v3.0.0 GA 时漏掉的几个核心 bug,把"主导航 broken 还能 release"的口子堵上了。

## 完成情况

| Task | 状态 | 耗时 |
|---|---|---|
| T0.1 推送 174 commit | ⏸️ 阻塞(需 GitHub PAT) | — |
| T0.2 提交 9 个 fix 文件 | ✅ 5 个 commits 提完 | 30 min |
| T0.3 CI hard-fail build | ✅ 加 2 守卫(CSP + icons) | 20 min |
| T0.4 e2e fresh userData | ✅ 每次 run 临时目录 | 15 min |
| T0.5 png2icons devDep | ✅ 从 --no-save 转正 | 5 min |
| T0.6 RELEASE_CHECKLIST.md | ✅ 7 步必过清单 | 20 min |
| P0 验收(全量测试 + build) | ✅ 全过 | 10 min |

总耗时 ~1.5 小时(单 session,实际工作,不含阻塞的 T0.1)。

## 关键 commit

1. `1e0c385` fix(release) SideNav icons + CSP + WindowManager: bring v3.0.0 to actually working
2. `81fe090` test(e2e) locale-aware selectors + PIPICLAW_E2E env + new UI smoke tests
3. `56f66a7` chore(icons) regenerate icons via png2icons, add 7 multi-size PNGs
4. `7164495` chore(repo) remove tracked debug.log
5. `22a73c6` docs(plan) 100% product completion roadmap P0-P6, target v4.0.0
6. `2b88dd6` ci(workflow) add 2 guards to prevent v3.0.0 SideNav broken regression
7. `142d049` test(e2e) fresh userData dir per playwright run
8. `793f5f9` docs(release) RELEASE_CHECKLIST.md + fix docs/release/ gitignore

## 修复的 4 个隐藏 bug

1. **SideNav 不可见**: element-plus icons 没全局注册 → `<component :is="iconName">` 渲染失败
2. **Vue 运行时被 CSP 拦**: index.html script-src 缺 `'unsafe-eval'` → `new Function()` 抛错
3. **WindowManager 走错路径**: e2e 模式下 `!app.isPackaged` 为 true → 找 vite dev server → 崩
4. **侧栏塌缩**: SideNav 没 min-width → 窗口被压时折叠

## 工程质量层加固

- **CI 双守卫**: 验证 CSP + icons,任何 release 漏掉图标注册或 CSP fix 都会 hard-fail
- **fresh userData**: e2e 不再受 localStorage 污染
- **locale-aware**: 测试不硬编码中文,任何语言都过
- **RELEASE_CHECKLIST**: 7 步必过,带历史 case 提醒

## Known Limitations / Carryover

- T0.1 推送 174 commit 阻塞:需用户在本地配 GitHub PAT 后手动 push
  (helper 在 .git/config 里)
- macOS / Linux 实际 build 还没在 CI 上跑过(windows-latest 跑通)
- 6 个 placeholder e2e spec(D2-Prime / D3 / Insight)继续 skip(需要 docker/飞书凭证)

## 下一步:P1

进入 P1: 14 个 nav route × 7 个 sandbox template 全跑通,所有 placeholder spec 转真测或删除。

参考: [2026-07-23-100pct-product-completion-plan.md](../plans/2026-07-23-100pct-product-completion-plan.md)
