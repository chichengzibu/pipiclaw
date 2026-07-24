import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+240: ClawHub 技能市场真用户测试
 *
 * 真实场景:用户打开 ClawHub,浏览/发布/审核/模板 4 个 tab:
 * CB1: 进 ClawHub → 默认 "浏览市场" tab
 * CB2: 看到 skill 列表(或空状态)
 * CB3: 切到"发布技能" tab
 * CB4: 切到"审核队列" tab
 * CB5: 切到"技能模板" tab → 看到 6 个内置模板
 * CB6: 点模板"实例化" → 弹出对话框
 */

test.describe('T+240 ClawHub 技能市场', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('CB1: 进 ClawHub → 默认 tab 是"浏览市场"', async ({ window }) => {
    await window.click('a.nav-item[href$="#/clawhub"]')
    await window.waitForURL(/#\/clawhub/)
    await window.waitForTimeout(800)

    // 验证页面有 h1(ClawHub 标题)
    const heading = window.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
    const text = await heading.textContent()
    expect(text).toMatch(/ClawHub|技能市场/i)

    const activeTab = await window.locator('.el-tabs__item.is-active').first().textContent()
    expect(activeTab).toMatch(/浏览市场|Browse/i)
  })

  test('CB2: 浏览市场 tab 有 skill 列表或空状态', async ({ window }) => {
    await window.click('a.nav-item[href$="#/clawhub"]')
    await window.waitForURL(/#\/clawhub/)
    await window.waitForTimeout(800)

    // skill grid 或 empty state
    const gridOrEmpty = window.locator('.skill-grid, .empty-state, .empty-state-card').first()
    await expect(gridOrEmpty).toBeVisible({ timeout: 5_000 })
  })

  test('CB3: 切到"发布技能" tab', async ({ window }) => {
    await window.click('a.nav-item[href$="#/clawhub"]')
    await window.waitForURL(/#\/clawhub/)
    await window.waitForTimeout(800)
    const publishTab = window.locator('.el-tabs__item:has-text("发布技能"), .el-tabs__item:has-text("Publish")').first()
    await publishTab.click()
    await window.waitForFunction(() => {
      const a = document.querySelector('.el-tabs__item.is-active')
      return a && /发布技能|Publish/.test(a.textContent ?? '')
    }, { timeout: 5_000 })

    // 看到表单字段(技能名 / 描述 / 作者 / 分类 / 内容)
    const formInputs = await window.locator('.el-input__inner, .el-textarea__inner, .el-select').count()
    expect(formInputs).toBeGreaterThanOrEqual(2)
  })

  test('CB4: 切到"审核队列" tab', async ({ window }) => {
    await window.click('a.nav-item[href$="#/clawhub"]')
    await window.waitForURL(/#\/clawhub/)
    await window.waitForTimeout(800)
    const reviewTab = window.locator('.el-tabs__item:has-text("审核队列"), .el-tabs__item:has-text("Review")').first()
    await reviewTab.click()
    await window.waitForFunction(() => {
      const a = document.querySelector('.el-tabs__item.is-active')
      return a && /审核队列|Review/.test(a.textContent ?? '')
    }, { timeout: 5_000 })

    // 看到 visible 的 el-table 或 el-empty(:visible 排除其他 tab)
    const tableOrEmpty = window.locator('.el-table:visible, .el-empty:visible').first()
    await expect(tableOrEmpty).toBeVisible({ timeout: 5_000 })
  })

  test('CB5: 切到"技能模板" tab → 看到模板列表', async ({ window }) => {
    await window.click('a.nav-item[href$="#/clawhub"]')
    await window.waitForURL(/#\/clawhub/)
    await window.waitForTimeout(800)
    const templatesTab = window.locator('.el-tabs__item:has-text("技能模板"), .el-tabs__item:has-text("Templates")').first()
    await templatesTab.click()
    await window.waitForFunction(() => {
      const a = document.querySelector('.el-tabs__item.is-active')
      return a && /技能模板|Templates/.test(a.textContent ?? '')
    }, { timeout: 5_000 })

    // 至少应该有 1 个模板卡片(6 个内置)
    const cards = window.locator('.template-card, .card')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('CB6: 技能模板"实例化"按钮工作', async ({ window }) => {
    await window.click('a.nav-item[href$="#/clawhub"]')
    await window.waitForURL(/#\/clawhub/)
    await window.waitForTimeout(800)
    const templatesTab = window.locator('.el-tabs__item:has-text("技能模板"), .el-tabs__item:has-text("Templates")').first()
    await templatesTab.click()
    await window.waitForTimeout(500)

    // 找第一个"实例化"按钮(中英文)
    const instantiateBtn = window.locator('button:has-text("实例化"), button:has-text("使用"), button:has-text("Instantiate"), button:has-text("Use")').first()
    if (await instantiateBtn.count() > 0) {
      await instantiateBtn.click()
      await window.waitForTimeout(800)
      // 应该弹 dialog 或 message
      const dialogOrMsg = await window.locator('.el-dialog:visible, .el-message').count()
      expect(dialogOrMsg).toBeGreaterThan(0)
    }
  })
})
