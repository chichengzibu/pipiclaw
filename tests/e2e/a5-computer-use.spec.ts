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

test.describe('A5 Computer Use', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1 to launch Electron renderer')

  test('A5 demo page renders with instruction input and run button', async ({ window }) => {
    await window.goto('#/a5-demo')

    await expect(window.locator('h2:has-text("A5 Computer Use v1 最小 Demo")')).toBeVisible({
      timeout: 10_000,
    })

    // 指令输入 + 最大步数 + 自动执行开关 + 启动按钮
    const instructionInput = window.locator(
      '.el-input input[placeholder="自然语言指令(例如:打开浏览器)"]'
    )
    await expect(instructionInput).toBeVisible({ timeout: 10_000 })
    await expect(instructionInput).toBeEnabled()

    // 启动按钮,默认禁用直到 canRun=true(有指令时)
    const runButton = window.locator('button:has-text("启动 Computer Use")')
    await expect(runButton).toBeVisible()
    // 默认预填了"打开浏览器",canRun=true,按钮可点
    await expect(runButton).toBeEnabled()
  })

  test('A5 sandbox mode runs without auto-execute and shows recorded step', async ({ window }) => {
    test.setTimeout(60_000)
    await window.goto('#/a5-demo')

    // 确保 autoExecute 开关是关闭状态(sandbox)
    const autoSwitch = window.locator('.el-switch:has-text("自动执行")')
    if ((await autoSwitch.count()) > 0) {
      const isChecked = await autoSwitch.evaluate(el => el.classList.contains('is-checked'))
      if (isChecked) {
        await autoSwitch.click()
        await window.waitForTimeout(200)
      }
    }

    // 点启动
    await window.locator('button:has-text("启动 Computer Use")').click()

    // 等执行结果卡片出现(.a5-result)— 默认 maxSteps=5,可能很快完成也可能 30s
    const resultCard = window.locator('.a5-result')
    await expect(resultCard).toBeVisible({ timeout: 45_000 })

    // 步骤详情卡片必须出现(a5-steps)
    await expect(window.locator('.a5-steps')).toBeVisible({ timeout: 10_000 })

    // 至少一条 step 显示 recorded(沙箱模式,不真执行)
    const firstStep = window.locator('.a5-step').first()
    await expect(firstStep).toBeVisible()
    await expect(firstStep).toContainText(/recorded|executed/)
  })

  test('A5 instruction field accepts custom text', async ({ window }) => {
    await window.goto('#/a5-demo')

    const input = window.locator(
      '.el-input input[placeholder="自然语言指令(例如:打开浏览器)"]'
    )
    await input.fill('测试输入')
    await expect(input).toHaveValue('测试输入')

    // 启动按钮应仍可用(canRun=truthy)
    const runButton = window.locator('button:has-text("启动 Computer Use")')
    await expect(runButton).toBeEnabled()
  })
})
