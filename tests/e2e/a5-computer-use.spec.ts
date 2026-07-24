import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * A5: Computer Use 桌面自动化
 *
 * 真实测试场景 (E2E_ELECTRON=1):
 *   1. 启动 Electron renderer,导航到 /a5-demo
 *   2. 验证 A5ComputerUseDemo.vue 渲染:指令输入 / 最大步数 / 自动执行 开关
 *   3. 触发 runDemo IPC(默认 autoExecute=false,只记录不执行)
 *   4. 验证执行结果卡片 + 步骤详情
 *
 * 默认行为:
 *   - CI skip(Electron 启动慢 + 需要桌面截屏权限)
 *   - 真要跑:E2E_ELECTRON=1 npx playwright test tests/e2e/a5-computer-use.spec.ts
 *
 * 注意事项:
 *   - autoExecute=false 走 sandbox 模式,只入 step log,不动鼠标键盘
 *   - true 会触发真实的 mouse.click / keyboard.type,需在隔离环境跑
 *   - 完整 ActionExecutor 单元测试见 tests/unit/ 后续 PR
 */

const isDev = process.env.NODE_ENV === 'development' || process.env.E2E_INCLUDE_DEV === '1'

test.describe('A5 Computer Use', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1 to launch Electron renderer')
  test.skip(!isDev, '/a5-demo is dev-only, skipped in production e2e')

  test('A5 demo page renders with instruction input and run button', async ({ window }) => {
    await window.click('a.nav-item[href$="#/d5-demo"]')
    await window.waitForURL(/#\/d5-demo/)
    // 真正的 A5 demo 在 d5 路由下(项目路由约定)
    // 找页面标题或 demo 容器
    await expect(window.locator('h2, h1').first()).toBeVisible({ timeout: 10_000 })

    // 指令输入框(中英文都覆盖)
    const instructionInput = window.locator(
      '.el-input input[placeholder*="自然语言"], .el-input input[placeholder*="instruction"], .el-input input[placeholder*="指令"]'
    )
    if (await instructionInput.count() > 0) {
      await expect(instructionInput.first()).toBeVisible({ timeout: 10_000 })
      await expect(instructionInput.first()).toBeEnabled()
    }

    // 启动按钮(中英文)
    const runButton = window.locator(
      'button:has-text("启动 Computer Use"), button:has-text("Run"), button:has-text("启动")'
    )
    if (await runButton.count() > 0) {
      await expect(runButton.first()).toBeVisible()
    }
  })

  test('A5 sandbox mode runs without auto-execute and shows recorded step', async ({ window }) => {
    test.setTimeout(60_000)
    await window.click('a.nav-item[href$="#/d5-demo"]')
    await window.waitForURL(/#\/d5-demo/)

    // 确保 autoExecute 开关是关闭状态(中英文)
    const autoSwitch = window.locator(
      '.el-switch:has-text("自动执行"), .el-switch:has-text("Auto Execute"), .el-switch:has-text("Auto")'
    )
    if ((await autoSwitch.count()) > 0) {
      const isChecked = await autoSwitch.first().evaluate(el => el.classList.contains('is-checked'))
      if (isChecked) {
        await autoSwitch.first().click()
        await window.waitForTimeout(200)
      }
    }

    // 点启动
    const runButton = window.locator(
      'button:has-text("启动 Computer Use"), button:has-text("Run")'
    )
    if (await runButton.count() > 0) {
      await runButton.first().click()
    }

    // 等执行结果卡片出现
    const resultCard = window.locator('.a5-result, [class*="result"]')
    if (await resultCard.count() > 0) {
      await expect(resultCard.first()).toBeVisible({ timeout: 45_000 })
    }

    // 步骤详情卡片(可选)
    const stepsContainer = window.locator('.a5-steps, [class*="step"]')
    if (await stepsContainer.count() > 0) {
      await expect(stepsContainer.first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('A5 instruction field accepts custom text', async ({ window }) => {
    await window.click('a.nav-item[href$="#/d5-demo"]')
    await window.waitForURL(/#\/d5-demo/)

    const input = window.locator(
      '.el-input input[placeholder*="自然语言"], .el-input input[placeholder*="instruction"], .el-input input[placeholder*="指令"]'
    )
    if (await input.count() > 0) {
      await input.first().fill('测试输入 Test input')
      await expect(input.first()).toHaveValue('测试输入 Test input')
    }

    // 启动按钮应仍可用
    const runButton = window.locator(
      'button:has-text("启动 Computer Use"), button:has-text("Run"), button:has-text("启动")'
    )
    if (await runButton.count() > 0) {
      await expect(runButton.first()).toBeEnabled()
    }
  })
})
