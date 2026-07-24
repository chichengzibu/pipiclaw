import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+540: Settings 模型管理完整 CRUD 真用户测试
 *
 * 真实场景:用户在 Settings → Models:
 * CR1: 添加 provider → list 中出现
 * CR2: toggle provider on/off(开关切换)
 * CR3: 编辑 provider 改名(name 改了 list 显示新名)
 * CR4: 删除 provider(确认 → list 中消失)
 * CR5: 重新添加同名 provider(不会冲突)
 *
 * 全部用 IPC 注入(避免表单填写 flaky)
 */

test.describe('T+540 Settings 模型管理完整 CRUD', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')

  test('CR1: 注入 provider → list 看到', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // 通过 IPC 注入
    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      // 清旧
      const listRes = await api.models.list()
      if (listRes?.success && listRes.data) {
        for (const p of listRes.data) {
          if (p.name === 'CR Test Provider') await api.models.delete(p.id)
        }
      }
      const r = await api.models.add({
        name: 'CR Test Provider',
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'no-key',
        enabled: true,
        timeout: 30000,
        models: [{ id: 'qwen3.5:9b', name: 'qwen3.5:9b', capabilities: ['chat'] }]
      })
      return r?.success
    })
    expect(result).toBe(true)

    // 验证 list API 看到
    const list = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const r = await api.models.list()
      return r?.data?.map((p: any) => p.name) || []
    })
    expect(list).toContain('CR Test Provider')
  })

  test('CR2: toggle provider off → list 显示 disabled', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // toggle off
    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const p = list?.data?.find((x: any) => x.name === 'CR Test Provider')
      if (!p) return { ok: false, err: 'no provider' }
      const r = await api.models.toggle(p.id, false)
      return { ok: r?.success, enabled: false }
    })
    expect(result.ok).toBe(true)

    // 验证 list 看到 disabled
    const provider = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      return list?.data?.find((x: any) => x.name === 'CR Test Provider')
    })
    expect(provider?.enabled).toBe(false)

    // toggle on (恢复)
    const result2 = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const p = list?.data?.find((x: any) => x.name === 'CR Test Provider')
      const r = await api.models.toggle(p.id, true)
      return r?.success
    })
    expect(result2).toBe(true)
  })

  test('CR3: edit provider 改名 → list 显示新名', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const p = list?.data?.find((x: any) => x.name === 'CR Test Provider')
      if (!p) return { ok: false, err: 'no provider' }
      const r = await api.models.update(p.id, { name: 'CR Test Provider (Renamed)' })
      return r?.success
    })
    expect(result).toBe(true)

    // 验证 list 看到新名
    const names = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      return list?.data?.map((x: any) => x.name) || []
    })
    expect(names).toContain('CR Test Provider (Renamed)')
    expect(names).not.toContain('CR Test Provider')
  })

  test('CR4: delete provider → list 不再看到', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const p = list?.data?.find((x: any) => x.name === 'CR Test Provider (Renamed)')
      if (!p) return { ok: false, err: 'no provider' }
      const r = await api.models.delete(p.id)
      return r?.success
    })
    expect(result).toBe(true)

    // 验证 list 不再看到
    const names = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      return list?.data?.map((x: any) => x.name) || []
    })
    expect(names).not.toContain('CR Test Provider (Renamed)')
    expect(names).not.toContain('CR Test Provider')
  })

  test('CR5: 重新添加同名 → list 看到新条目', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const r = await api.models.add({
        name: 'CR Test Provider',
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'no-key',
        enabled: true,
        timeout: 30000,
        models: [{ id: 'qwen3.5:9b', name: 'qwen3.5:9b', capabilities: ['chat'] }]
      })
      return r?.success
    })
    expect(result).toBe(true)

    // 验证看到
    const list = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const r = await api.models.list()
      return r?.data?.filter((x: any) => x.name === 'CR Test Provider').length || 0
    })
    expect(list).toBe(1)
  })

  test('CR6: 编辑 provider 改 baseUrl → list 看到新 URL', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const p = list?.data?.find((x: any) => x.name === 'CR Test Provider')
      if (!p) return { ok: false, err: 'no provider' }
      const newUrl = 'http://192.168.99.99:11434/v1' // 假 URL,验证 update
      const r = await api.models.update(p.id, { baseUrl: newUrl })
      return { ok: r?.success, newUrl, gotUrl: r?.data?.baseUrl }
    })
    expect(result.ok).toBe(true)
    expect(result.gotUrl).toBe(result.newUrl)
  })

  test('CR7: 删除所有 CR provider,清理', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      let count = 0
      if (list?.success && list.data) {
        for (const p of list.data) {
          if (p.name.startsWith('CR Test Provider') || p.name.startsWith('CR Test Provider (Renamed)')) {
            await api.models.delete(p.id)
            count++
          }
        }
      }
      return { deleted: count }
    })
    expect(result.deleted).toBeGreaterThan(0)
  })
})
