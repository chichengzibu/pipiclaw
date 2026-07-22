import { defineConfig } from '@playwright/test'

/**
 * PiPiClaw Playwright 配置
 *
 * ⚠️ 重要:本项目是 Electron 桌面应用,Renderer 由 Electron 主进程拉起,
 * 不能用 webServer + chromium 项目。Specs 通过 _electron API 直接驱动
 * Electron 进程,Window 是其渲染进程。每个 spec 自管 electron.launch。
 *
 * 用法(本地):
 *   npx playwright test                                  # 跑全部 active spec
 *   npx playwright test --project=electron              # 走 electron project
 *   npx playwright test tests/e2e/chat-agent.spec.ts     # 单个 spec
 *   npx playwright test --list                          # 只列 spec,不启动 Electron
 *
 * CI 行为:
 *   - Electron 启动需要 5-15s,容器内需要 --no-sandbox
 *   - 4 个核心 spec 通过 test.skip(!process.env.E2E_ELECTRON) 防御性跳过
 *     默认不在 CI 跑(E2E_ELECTRON=1 才跑)
 *   - 7 个 placeholder spec 永远 skip(需要真 LLM / Docker / 飞书凭证)
 *   - 跑前确保 `npm run build` 生成了 dist-electron/main.js
 */

/**
 * Electron 真实入口(打包后 vite-plugin-electron 产出)
 * Specs 通过 _electron.launch({ args: [..., mainEntry] }) 引用此路径
 * 未直接 import,仅作文档注释,实际 path 由 specs 内联
 */
// const mainEntry = 'dist-electron/main.js'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 0 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e-report' }]]
    : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'electron',
      // 不通过全局 use.baseURL — electron renderer 由 file:// 加载 dist/index.html
      // 每个 spec 自己用 _electron.launch({ args: [..., mainEntry] })
      testMatch: /.*\.spec\.ts/,
    },
  ],
  // 显式不开 webServer — Electron 用 _electron API 自管进程生命周期
  webServer: undefined,
})
