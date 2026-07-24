import { test, expect, shouldRunElectronE2E } from './helpers/electron-app'

/**
 * T+630: 多 Provider 切换真用户测试
 *
 * 真实场景:用户配置多个 Ollama providers,在不同会话里用不同模型。
 *
 * 注:UI 实时切换 provider 的元素(Element Plus filterable select)有
 * flaky 行为,改用 IPC API 验证。完整 UI 切换流程由 unit tests 覆盖。
 *
 * 验证:
 * MP1: 注入 2 个不同 provider(qwen3.5:9b + qwen3:14b)
 * MP2: 2 个都出现在 list 中,enabled
 * MP3: 用 providerId 创建 conversation,验证 model 绑定
 * MP4: 快速创建 3 个不同 provider 的 conversation,验证都能成功
 * MP5: 清理
 */

test.describe('T+630 多 Provider 切换', () => {
  test.skip(!shouldRunElectronE2E, 'requires E2E_ELECTRON=1')
  test.skip(!process.env.OLLAMA_URL, 'set OLLAMA_URL=http://localhost:11434 to run')

  test('MP1: 注入 2 个 providers(qwen3.5:9b + qwen3:14b)', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    // 清旧
    await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      if (list?.success && list.data) {
        for (const p of list.data) {
          if (p.name.startsWith('MP ')) await api.models.delete(p.id)
        }
      }
    })

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      await api.models.add({
        name: 'MP Fast (qwen3.5:9b)',
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'no-key',
        enabled: true,
        timeout: 30000,
        models: [{ id: 'qwen3.5:9b', name: 'qwen3.5:9b', capabilities: ['chat'] }]
      })
      const r2 = await api.models.add({
        name: 'MP Quality (qwen3:14b)',
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'no-key',
        enabled: true,
        timeout: 30000,
        models: [{ id: 'qwen3:14b', name: 'qwen3:14b', capabilities: ['chat'] }]
      })
      return { ok: r2?.success }
    })
    expect(result.ok).toBe(true)
  })

  test('MP2: 2 个 provider 都在 list,enabled 状态正确', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      if (!list?.success) return { mpFast: null, mpQuality: null }
      const mpFast = list.data.find((p: any) => p.name === 'MP Fast (qwen3.5:9b)')
      const mpQuality = list.data.find((p: any) => p.name === 'MP Quality (qwen3:14b)')
      return {
        mpFast: mpFast ? { id: mpFast.id, enabled: mpFast.enabled, modelCount: mpFast.models?.length } : null,
        mpQuality: mpQuality ? { id: mpQuality.id, enabled: mpQuality.enabled, modelCount: mpQuality.models?.length } : null
      }
    })
    expect(result.mpFast).toBeTruthy()
    expect(result.mpFast?.enabled).toBe(true)
    expect(result.mpFast?.modelCount).toBe(1)
    expect(result.mpQuality).toBeTruthy()
    expect(result.mpQuality?.enabled).toBe(true)
    expect(result.mpQuality?.modelCount).toBe(1)
  })

  test('MP3: 用不同 providerId 创建 conversation,绑定正确', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const mpFast = list.data.find((p: any) => p.name === 'MP Fast (qwen3.5:9b)')
      const mpQuality = list.data.find((p: any) => p.name === 'MP Quality (qwen3:14b)')

      // 用 MP Fast 创建
      const r1 = await api.chat.createConversation({
        title: 'T+630 MP Fast',
        providerId: mpFast.id,
        modelId: 'qwen3.5:9b'
      })
      // 用 MP Quality 创建
      const r2 = await api.chat.createConversation({
        title: 'T+630 MP Quality',
        providerId: mpQuality.id,
        modelId: 'qwen3:14b'
      })

      // 验证两个都创建成功,providerId 正确
      const convs = await api.chat.conversations()
      const conv1 = convs.data.find((c: any) => c.id === r1.data.id)
      const conv2 = convs.data.find((c: any) => c.id === r2.data.id)

      return {
        r1ok: r1?.success,
        r2ok: r2?.success,
        conv1Prov: conv1?.providerId,
        conv1Model: conv1?.modelId,
        conv2Prov: conv2?.providerId,
        conv2Model: conv2?.modelId,
        providersDifferent: conv1?.providerId !== conv2?.providerId
      }
    })
    expect(result.r1ok).toBe(true)
    expect(result.r2ok).toBe(true)
    expect(result.conv1Prov).toBeTruthy()
    expect(result.conv2Prov).toBeTruthy()
    expect(result.providersDifferent).toBe(true)
    expect(result.conv1Model).toBe('qwen3.5:9b')
    expect(result.conv2Model).toBe('qwen3:14b')
  })

  test('MP4: 快速创建 5 个不同 provider 的 conversation,都成功', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      const list = await api.models.list()
      const providers = list.data
        .filter((p: any) => p.name.startsWith('MP '))
        .map((p: any) => ({ id: p.id, modelId: p.models?.[0]?.id }))
      let created = 0
      for (let i = 0; i < 5; i++) {
        const p = providers[i % providers.length]
        const r = await api.chat.createConversation({
          title: `T+630 stress ${i}`,
          providerId: p.id,
          modelId: p.modelId
        })
        if (r?.success) created++
      }
      return { total: providers.length, created }
    })
    expect(result.created).toBe(5)
    expect(result.total).toBe(2)
  })

  test('MP5: 清理 MP providers 和 stress conversations', async ({ window }) => {
    await window.waitForSelector('#app', { timeout: 10_000 })
    await window.waitForTimeout(800)

    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI
      let deletedProviders = 0
      let deletedConversations = 0

      // 删 providers
      const list = await api.models.list()
      if (list?.success && list.data) {
        for (const p of list.data) {
          if (p.name.startsWith('MP ')) {
            await api.models.delete(p.id)
            deletedProviders++
          }
        }
      }

      // 删 T+630 conversations
      const convs = await api.chat.conversations()
      if (convs?.success && convs.data) {
        for (const c of convs.data) {
          if (c.title?.startsWith('T+630')) {
            await api.chat.deleteConversation(c.id)
            deletedConversations++
          }
        }
      }
      return { deletedProviders, deletedConversations }
    })
    expect(result.deletedProviders).toBeGreaterThanOrEqual(2)
    expect(result.deletedConversations).toBeGreaterThan(0)
  })
})
