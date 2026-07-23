import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * P1-T1.3: 14 个 nav route 各开一次,无 JS 错误
 *
 * 每个路由:
 * 1. 启动后通过 SideNav 进入
 * 2. 等 1.5s 加载
 * 3. 任何 console.error / pageerror 都算 fail
 * 4. 验证页面有 .page-container / .main-content 等根元素
 *
 * 这能 catch:
 * - 路由 hook 错误
 * - 子组件 mount 时崩
 * - async data load 失败
 */

test.describe('All 14 nav routes load without JS errors', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  // 14 个 nav route
  const routes: Array<{ path: string; navText: string; expect: RegExp | string }> = [
    { path: '/dashboard', navText: 'Dashboard', expect: /首页|Dashboard/i },
    { path: '/chat', navText: 'AI Chat', expect: /对话|Chat/i },
    { path: '/skills', navText: 'Skills', expect: /技能|Skills/i },
    { path: '/settings', navText: 'Settings', expect: /设置|Settings/i },
    { path: '/help', navText: 'Help', expect: /帮助|Help/i },
    { path: '/models', navText: 'Models', expect: /模型|Models/i },
    { path: '/permissions', navText: 'Permissions', expect: /权限|Permissions/i },
    { path: '/plugin-market', navText: 'Plugin Market', expect: /插件|Plugin/i },
    { path: '/remote-control', navText: 'Remote Control', expect: /远程|Remote/i },
    { path: '/schedule', navText: 'Schedule', expect: /计划|Schedule/i },
    { path: '/skill-market', navText: 'Skill Market', expect: /技能市场|Skill Market/i },
    { path: '/tasks', navText: 'Automation Tasks', expect: /自动化任务|Automation/i },
    { path: '/d1-demo', navText: 'D1 Screenshot', expect: /截屏|D1/i },
    { path: '/d5-demo', navText: 'D5 Recording', expect: /录屏|D5/i },
  ]

  for (const route of routes) {
    test(`route ${route.path} (${route.navText}) loads cleanly`, async ({ window }) => {
      // 收集所有 console error
      const errors: string[] = []
      window.on('console', (msg) => {
        if (msg.type() === 'error') {
          // 忽略 favicon 404
          const text = msg.text()
          if (!text.includes('favicon') && !text.includes('Autofill.enable')) {
            errors.push(text)
          }
        }
      })
      window.on('pageerror', (err) => {
        errors.push(`[pageerror] ${err.message}`)
      })

      // 通过 SideNav 点击进入(测试 SideNav → router 完整链路)
      // 用正则匹配 nav text,因为可能是中英文
      const navLink = window.locator(`a.nav-item[href$="${route.path}"]`)
      await expect(navLink).toBeVisible({ timeout: 5_000 })
      await navLink.click()
      await window.waitForURL(new RegExp(route.path.replace('/', '\\/') + '$'))

      // 等页面加载
      await window.waitForTimeout(1500)

      // 验证 URL 正确
      const url = new URL(window.url())
      expect(url.hash).toContain(route.path)

      // 验证页面有内容(.main-content 是 AppLayout 的主区域)
      const mainContent = window.locator('main.main-content, .main-content, [class*="page-"]').first()
      await expect(mainContent).toBeVisible({ timeout: 3_000 })

      // 验证页面包含预期文本
      const bodyText = await window.locator('body').textContent()
      expect(bodyText).toMatch(route.expect)

      // 验证没有 console error
      if (errors.length > 0) {
        throw new Error(`Console errors on ${route.path}:\n${errors.join('\n')}`)
      }
    })
  }
})
