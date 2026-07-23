import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-whatsapp-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P1-02: WhatsApp 通道真实集成测试
 *
 * 用 mock fetch 模拟 WhatsApp Business Cloud API
 */

import { WhatsAppChannel } from '../../electron/channel/WhatsAppChannel'

let mockFetch: any

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response
}

describe('P1-02: WhatsAppChannel.validateToken', () => {
  it('GET /{phone-id} 返回 200 + 标记 verified', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123456', accessToken: 'tok' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ id: '123456' }))
    const r = await ch.validateToken()
    expect(r.verified).toBe(true)
    expect(r.phoneNumberId).toBe('123456')
  })

  it('未配置 → 抛错', async () => {
    const ch = new WhatsAppChannel()
    await expect(ch.validateToken()).rejects.toThrow(/未配置/)
  })

  it('400 透传 error', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123', accessToken: 'bad' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: { message: 'bad' } }, 400))
    await expect(ch.validateToken()).rejects.toThrow(/token 校验失败/)
  })
})

describe('P1-02: WhatsAppChannel.send', () => {
  it('POST /{phone-id}/messages with Bearer token + 标准 payload', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123456', accessToken: 'tok' })
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        messaging_product: 'whatsapp',
        contacts: [{ input: '8613800000000', wa_id: '8613800000000' }],
        messages: [{ id: 'wamid.abc123' }],
      }),
    )
    const r = await ch.send({
      id: 'm1',
      text: 'hello',
      channel: 'whatsapp',
      from: 'piPiClaw',
      to: '8613800000000',
      ts: Date.now(),
    } as any)
    expect(r.messageId).toBe('wamid.abc123')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v20.0/123456/messages')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '8613800000000',
      type: 'text',
      text: { body: 'hello' },
    })
  })

  it('未配置 → 抛错', async () => {
    const ch = new WhatsAppChannel()
    await expect(
      ch.send({ id: 'm', text: 'x', channel: 'whatsapp', from: 'me', to: '86138', ts: 0 } as any),
    ).rejects.toThrow(/未配置/)
  })

  it('to 为空 → 抛错', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123', accessToken: 'tok' })
    await expect(
      ch.send({ id: 'm', text: 'x', channel: 'whatsapp', from: 'me', to: '', ts: 0 } as any),
    ).rejects.toThrow(/phone number.*不能为空/)
  })

  it('响应无 messageId → 抛错', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123', accessToken: 'tok' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ messages: [] }))
    await expect(
      ch.send({ id: 'm', text: 'x', channel: 'whatsapp', from: 'me', to: '86138', ts: 0 } as any),
    ).rejects.toThrow(/无 messageId/)
  })
})

describe('P1-02: WhatsAppChannel.markAsRead', () => {
  it('POST 标记 read + message_id', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123', accessToken: 'tok' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true }))
    await ch.markAsRead('wamid.abc')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v20.0/123/messages')
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.abc',
    })
  })

  it('status 默认 read,可指定 delivered', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '123', accessToken: 'tok' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true }))
    await ch.markAsRead('wamid.xyz', 'delivered')
    const [, init] = mockFetch.mock.calls[0]
    expect(JSON.parse(init.body).status).toBe('delivered')
  })
})

describe('P1-02: WhatsAppChannel.healthCheck', () => {
  it('未配置 → unhealthy', async () => {
    const ch = new WhatsAppChannel()
    const h = await ch.healthCheck()
    expect(h.healthy).toBe(false)
  })

  it('valid 配置 → healthy + phoneNumberId 详情', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '999', accessToken: 'tok' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ id: '999' }))
    const h = await ch.healthCheck()
    expect(h.healthy).toBe(true)
    expect((h as any).details.phoneNumberId).toBe('999')
  })

  it('token 错 → unhealthy + error', async () => {
    const ch = new WhatsAppChannel()
    ch.setConfig({ phoneNumberId: '999', accessToken: 'bad' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: {} }, 401))
    const h = await ch.healthCheck()
    expect(h.healthy).toBe(false)
    expect(h.error).toContain('token 校验失败')
  })
})
