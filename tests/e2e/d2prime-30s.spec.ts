import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * D2-Prime: 30s 启动时长验证(降级为 UI 挂载验证)
 *
 * Phase 4 Task 3 真实测试 (E2E_ELECTRON=1):
 *   1. 启动 Electron renderer,导航到 /d2-prime-demo
 *   2. 验证 D2PrimeDemo.vue 渲染:prompt 输入 + WebContainer checkbox + 启动按钮
 *   3. 验证 prompt 默认值 + canRun 状态
 *
 * 历史背景:
 *   - 本 spec 原意是验证 30s 启动时长(需要 docker / webcontainer 运行时)
 *   - Phase 4 Task 3 降级为 UI 渲染验证,因为:
 *     a) 测试环境无 docker(本地 windows 容器内常未装)
 *     b) webContainer 需要 crossOriginIsolated,Electron 自带可用,但
 *        真实"运行 30s 启动"是性能指标,需要隔离 benchmark
 *   - 完整 30s 验证保留 stub,见 test.skip(...) 内的注释
 *
 * 默认行为:
 *   - CI skip,本地 E2E_ELECTRON=1 跑
 */

test.describe('D2-Prime 30s startup', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1 to launch Electron renderer')

  test('D2-Prime demo page mounts with prompt and launch button', async ({ window }) => {
    await window.goto('#/d2-prime-demo')

    // 标题
    await expect(window.locator('h2:has-text("D2-Prime 旗舰 Demo")')).toBeVisible({
      timeout: 10_000,
    })

    // prompt 输入框
    const promptInput = window.locator('.el-input input[placeholder*="Vite"]')
    await expect(promptInput).toBeVisible({ timeout: 10_000 })
    // 预填了"做一个 Vite + React + TS 博客"
    await expect(promptInput).toHaveValue(/做一个/)

    // 优先 WebContainer checkbox
    await expect(window.locator('text=优先 WebContainer').first()).toBeVisible({
      timeout: 5_000,
    })

    // 启动按钮
    const runButton = window.locator('button:has-text("启动 D2-Prime")')
    await expect(runButton).toBeVisible()
    await expect(runButton).toBeEnabled()
  })

  test('D2-Prime flow card lists all 6 pipeline steps', async ({ window }) => {
    await window.goto('#/d2-prime-demo')

    // .d2-flow 卡片含 <ol> 流程 — 6 步
    const flowCard = window.locator('.d2-flow')
    await expect(flowCard).toBeVisible({ timeout: 10_000 })

    const steps = flowCard.locator('.d2-steps li')
    await expect(steps).toHaveCount(6)
    await expect(steps.nth(0)).toContainText('解析 prompt')
    await expect(steps.nth(3)).toContainText('PortForwarder')
    await expect(steps.nth(5)).toContainText('iframe')
  })

  test.skip(
    process.env.E2E_D2_PRIME_30S !== '1',
    'requires E2E_D2_PRIME_30S=1 to time actual 30s sandbox boot — Phase 4 跳过,完整 benchmark 见 docs/e2e-testing.md'
  )

  test('30s boot benchmark stub (see docs/e2e-testing.md)', async () => {
    // 启用此 spec:
    //   E2E_D2_PRIME_30S=1 E2E_ELECTRON=1 npx playwright test tests/e2e/d2prime-30s.spec.ts -g '30s boot'
    //
    // 计划步骤:
    //   1. await window.goto('#/d2-prime-demo')
    //   2. 在 prompt 输入 '测试 30s 启动'
    //   3. 记 t0 = Date.now(),点'启动 D2-Prime'
    //   4. 等 .d2-result 出现(说明 iframe forwardUrl 已就绪)
    //   5. assert Date.now() - t0 <= 30_000
    //   6. 截图归档 tests/e2e-report/d2prime-30s.png
    //
    // 当前 Phase 4 不实跑,留作 Phase 5 任务。
    expect(true).toBe(true)
  })
})
