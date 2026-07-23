import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * 诊断测试: 打印 SideNav 实际渲染的导航项
 *
 * 用途: 当 SideNav 文字变更(中英/i18n 调整)时,验证选择器是否需要更新
 *
 * 用法:
 *   E2E_ELECTRON=1 npx playwright test tests/e2e/diag-sidenav.spec.ts
 *
 * P1-T1.1: 跳到 describe 级,确保 E2E_ELECTRON 未设时也能正常 skip
 * (原在 test 体内 skip,但 fixture 在 skip 之前就抛错了)
 */
test.describe('SideNav diagnostic', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('dump SideNav items', async ({ window }) => {
    await window.waitForSelector('a.nav-item', { timeout: 10_000 })
    const items = await window.locator('a.nav-item').allTextContents()
     
    console.log('=== Nav items ===')
    for (const t of items) {
       
      console.log(`  "${t.trim()}"`)
    }
     
    console.log('=== End ===')
    expect(items.length).toBeGreaterThan(0)
  })
})
