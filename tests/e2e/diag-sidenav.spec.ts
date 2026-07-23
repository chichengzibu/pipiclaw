import { test, shouldRunElectronE2E } from './helpers/electron-app'

test('dump SideNav items', async ({ window }) => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  await window.waitForSelector('a.nav-item', { timeout: 10_000 })
  const items = await window.locator('a.nav-item').allTextContents()
  console.log('=== Nav items ===')
  for (const t of items) console.log(`  "${t.trim()}"`)
  console.log('=== End ===')
})
