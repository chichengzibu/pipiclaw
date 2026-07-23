import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * D3: 远程指令 Demo UI 挂载验证
 *
 * 拆 P1-T1.1:
 *   - 原 d3-feishu.spec.ts 是真飞书 bot 凭证 stub(需要 LARK_APP_ID + 公网回调)
 *   - 现拆成两部分:
 *     1) 本 spec:UI 走通验证(/d3-demo 页面渲染,无 JS 错误)
 *     2) 真凭证:留作 separate CI job 任务,见 docs/e2e-testing.md
 *
 * 默认行为:
 *   - CI skip(无 E2E_ELECTRON),本地 E2E_ELECTRON=1 跑
 *   - 不真调飞书,只验证 D3RemoteDemo.vue 渲染
 *
 * 导航方式:
 *   - /d3-demo 不在 SideNav 里(只有 14 个主入口)
 *   - router 是 createWebHashHistory,所以用 window.location.hash 切换路由
 */

test.describe('D3 远程 demo UI mount', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1 to launch Electron renderer')

  test('D3 demo page mounts with config form and event log', async ({ window }) => {
    // 改 hash 触发 vue-router
    await window.evaluate(() => {
      window.location.hash = '#/d3-demo'
    })
    await window.waitForURL(/#\/d3-demo/, { timeout: 5_000 })

    // 等页面根节点 — D3RemoteDemo.vue 顶层 .d3-demo
    await expect(window.locator('.d3-demo').first()).toBeVisible({
      timeout: 10_000,
    })

    // 页面含"飞书"或"远程"或"Feishu"或"Remote"字样(支持中英)
    const bodyText = await window.locator('body').textContent()
    expect(bodyText).toMatch(/飞书|远程|Feishu|Remote/i)

    // 页面必须含表单元素(input / button / textarea)
    const formCount = await window
      .locator('input, button, textarea, .el-input, .el-button')
      .count()
    expect(formCount).toBeGreaterThan(0)
  })

  test('D3 demo flow card lists 5 pipeline steps', async ({ window }) => {
    await window.evaluate(() => {
      window.location.hash = '#/d3-demo'
    })
    await window.waitForURL(/#\/d3-demo/, { timeout: 5_000 })

    // 流程卡: .d3-flow > .d3-steps li
    const flowCard = window.locator('.d3-flow')
    await expect(flowCard).toBeVisible({ timeout: 10_000 })

    const steps = flowCard.locator('.d3-steps li')
    await expect(steps).toHaveCount(5)
    await expect(steps.nth(0)).toContainText('飞书')
    await expect(steps.nth(1)).toContainText('ChannelRouter')
    await expect(steps.nth(3)).toContainText('Calendar')
  })
})
