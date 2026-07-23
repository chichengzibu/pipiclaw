import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 共享 Electron Fixture
 *
 * 用法:
 *   import { test, expect } from './helpers/electron-app'
 *
 *   test('my scenario', async ({ electronApp, window }) => {
 *     await window.click('text=对话')
 *     ...
 *   })
 *
 * 默认行为:
 * - 启动 dist-electron/main.js(vite-plugin-electron 产物)
 * - 工作目录为仓库根(相对 __dirname 解析)
 * - 启动时加 --no-sandbox,Windows / Linux CI 容器需要
 * - 超时 30s(electron 冷启动 5-15s,首窗加载再加 3-5s)
 * - P0-T0.4: 默认 fresh=true,每次测试用全新 userData 目录,
 *   避免 localStorage / ConfigStore 跨测试污染
 *
 * 跳过策略:
 * - E2E_ELECTRON=1 才跑(默认 CI 不跑,本地手动跑)
 * - 必须先 build:`npm run build` 生成 dist-electron/main.js
 */

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const mainEntry = path.join(repoRoot, 'dist-electron', 'main.js')

export const shouldRunElectronE2E = !!process.env.E2E_ELECTRON

// 跨测试共享一个 fresh userData 目录(同一 spec 内复用,跨 spec 隔离)
const sharedUserDataDir = shouldRunElectronE2E
  ? mkdtempSync(join(tmpdir(), 'pipiclaw-e2e-'))
  : ''

export const test = base.extend<{
  electronApp: ElectronApplication
  window: Page
  freshUserData: string
}>({
  // 暴露当前 spec 的 userData 路径,供需要直接读 localStorage 的测试用
  freshUserData: async ({}, use) => {
    await use(sharedUserDataDir)
  },

  electronApp: async ({}, use) => {
    if (!shouldRunElectronE2E) {
      throw new Error(
        'E2E_ELECTRON is not set. Set E2E_ELECTRON=1 to run real Electron e2e.'
      )
    }

    const app = await electron.launch({
      args: [mainEntry, '--no-sandbox'],
      cwd: repoRoot,
      // P0-T0.4: userData 用临时目录,跨 spec 隔离,localStorage 干净
      userDataDir: sharedUserDataDir,
      env: {
        ...process.env,
        // 强制 WindowManager 走 prod 路径(loadFile dist/index.html),
        // 否则会去找 vite dev server (localhost:5173)
        PIPICLAW_E2E: '1',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      },
      timeout: 30_000,
    })

    await use(app)
    await app.close().catch(() => {})
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    // 等 Vue 应用挂载 (#app 节点出现 + 端到端 PINIA 初始化)
    await window.waitForSelector('#app', { timeout: 15_000 })
    // 默认跳到 /dashboard。给 router 一拍时间切到目标
    await window.waitForTimeout(500)
    await use(window)
  },
})

// 测试套件结束后清理临时目录
if (shouldRunElectronE2E) {
  process.on('exit', () => {
    try {
      rmSync(sharedUserDataDir, { recursive: true, force: true })
    } catch {
      // best-effort
    }
  })
}

export { expect } from '@playwright/test'
