# P0 安全基线数字 (改前)

| 套件 | 数字 | 状态 |
|---|---|---|
| Vitest | **902/916 pass = 98.47%** | ✅ (4 fail files, 14 fail tests) |
| Build (vite) | dist-electron/main.js + dist/index.html 生成 | ✅ |
| Build (electron-builder) | Setup.exe 重新打包 | ⚠️ 跑超时 (上次 Setup.exe 88.89 MB @ 10:33) |
| Smoke | (smoke-test.mjs 未跑基线,跟随回归) | - |
| User-Journey Ollama | **31/31 pass** | ✅ |

## Vitest 失败明细 (4 file / 14 tests)
- `tests/integration/routes-render.test.ts`: 11/11 fail (需 dev server 5173,本环境未启)
- `tests/unit/stores/permissions.test.ts`: 1 fail
- `tests/unit/views/Permissions.test.ts`: 1 fail
- `tests/unit/views/Settings.test.ts`: 1 fail
- 1 unhandled error: `tests/unit/views/ImManagement.test.ts` (Warning icon mock 缺)
- 耗时 42.64s

## Build 状态
- Vite: ✅ (renderer assets 40+, main.js 477.99 KB, preload.js 18.71 KB)
- Electron-builder: ⚠️ timeout 480s 没完成,上一次 Setup.exe 是 88.89 MB @ 2026-08-05 10:33
- 注意: 4.3.0-Setup.exe 已存在, baseline 阶段不需要重打验证,vite 产物足够支撑 e2e 跑

## Ollama Baseline 详情
- 总耗时: ~145s
- Chat LLM 真链路: 128s (首 chunk 检测到生成中状态, 但 streaming counter 偏 null — 已知逻辑缺陷, 不影响 PASS)
- 14 路由全可达, Skills 603 元素, Theme 切换 OK, CommandPalette 正常
- 截图: user-journey-ollama/01-dashboard.png ~ 09-help.png
