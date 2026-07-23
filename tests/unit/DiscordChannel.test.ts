import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-discord-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P1-01: Discord 通道真实集成测试
 *
 * 用 mock fetch 模拟 Discord REST API,验证:
 * - validateToken
 * - send
 * - listMessages + lastSeenMessageId 追踪
 * - pollMessages 触发 onMessage 回调
 * - healthCheck
 */

import { DiscordChannel } from '../../electron/channel/DiscordChannel'

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

describe('P1-01: DiscordChannel.validateToken', () => {
  it('200 返回 user 对象', async () => {
    const channel = new DiscordChannel()
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: '111', username: 'TestBot', discriminator: '0000', bot: true }),
    )
    const user = await channel.validateToken('valid-token')
    expect(user.id).toBe('111')
    expect(user.bot).toBe(true)
  })

  it('401 抛错', async () => {
    const channel = new DiscordChannel()
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ message: 'Unauthorized' }, 401))
    await expect(channel.validateToken('bad-token')).rejects.toThrow(/token 校验失败/)
  })

  it('fetch URL 用 Bot prefix', async () => {
    const channel = new DiscordChannel()
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: '1', username: 'b', discriminator: '0', bot: true }),
    )
    await channel.validateToken('my-token')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://discord.com/api/v10/users/@me')
    expect(init.headers.Authorization).toBe('Bot my-token')
  })

  it('apiBaseUrl 可自定义(测试环境)', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 't', apiBaseUrl: 'http://localhost:9999/api/v10' })
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: '1', username: 'b', discriminator: '0', bot: true }),
    )
    await channel.validateToken('t')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:9999/api/v10/users/@me')
  })
})

describe('P1-01: DiscordChannel.send', () => {
  it('POST 到 /channels/{id}/messages + Bearer Bot', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: 'msg-1', channel_id: 'ch-1', content: 'hi', author: { id: 'b', username: 'b', bot: true }, timestamp: '2025-01-01' }),
    )
    const r = await channel.send({
      id: 'm1',
      text: 'hello',
      channel: 'discord',
      from: 'piPiClaw',
      to: 'ch-123456',
      ts: Date.now(),
    } as any)
    expect(r.messageId).toBe('msg-1')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://discord.com/api/v10/channels/ch-123456/messages')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bot tk')
    expect(JSON.parse(init.body)).toEqual({ content: 'hello' })
  })

  it('未配置 token 抛错', async () => {
    const channel = new DiscordChannel()
    await expect(
      channel.send({ id: 'm', text: 'x', channel: 'discord', from: 'me', to: 'ch', ts: 0 } as any),
    ).rejects.toThrow(/token 未配置/)
  })

  it('msg.to 为空抛错', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    await expect(
      channel.send({ id: 'm', text: 'x', channel: 'discord', from: 'me', to: '', ts: 0 } as any),
    ).rejects.toThrow(/channelId.*不能为空/)
  })

  it('429 抛错(透传状态码)', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ message: 'rate limited' }, 429))
    await expect(
      channel.send({ id: 'm', text: 'x', channel: 'discord', from: 'me', to: 'ch-1', ts: 0 } as any),
    ).rejects.toThrow(/HTTP 429/)
  })
})

describe('P1-01: DiscordChannel.listMessages', () => {
  it('GET /channels/{id}/messages + limit 参数', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse([
        { id: 'm1', channel_id: 'ch', content: 'a', author: { id: 'u', username: 'u', bot: false }, timestamp: '2025-01-01' },
      ]),
    )
    const msgs = await channel.listMessages('ch-123', 50)
    expect(msgs.length).toBe(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/channels/ch-123/messages')
    expect(url).toContain('limit=50')
  })

  it('limit 超过 100 截断到 100', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse([]))
    await channel.listMessages('ch', 999)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('limit=100')
  })

  it('lastSeenMessageId 记录最新消息 ID', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse([
        { id: 'm-NEW', channel_id: 'ch', content: 'newest', author: { id: 'u', username: 'u', bot: false }, timestamp: '2025-01-02' },
        { id: 'm-OLD', channel_id: 'ch', content: 'older', author: { id: 'u', username: 'u', bot: false }, timestamp: '2025-01-01' },
      ]),
    )
    await channel.listMessages('ch')
    // 第二次轮询:应该带 after=m-NEW
    mockFetch.mockResolvedValueOnce(mockJsonResponse([]))
    await channel.listMessages('ch')
    const url2 = mockFetch.mock.calls[1][0]
    expect(url2).toContain('after=m-NEW')
  })

  it('未配置 token 抛错', async () => {
    const channel = new DiscordChannel()
    await expect(channel.listMessages('ch-1')).rejects.toThrow(/token 未配置/)
  })
})

describe('P1-01: DiscordChannel.pollMessages', () => {
  it('触发 onMessage 回调,跳过 bot 消息', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    const handler = vi.fn()
    channel.onMessage(handler)
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse([
        { id: 'm1', channel_id: 'ch', content: 'hello', author: { id: 'u', username: 'u', bot: false }, timestamp: '2025-01-01' },
        { id: 'm2', channel_id: 'ch', content: 'bot-skip', author: { id: 'b', username: 'b', bot: true }, timestamp: '2025-01-01' },
      ]),
    )
    const count = await channel.pollMessages('ch-1')
    expect(count).toBe(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].text).toBe('hello')
    expect(handler.mock.calls[0][0].from).toBe('u')
  })

  it('无消息时返回 0', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'tk' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse([]))
    const count = await channel.pollMessages('ch-1')
    expect(count).toBe(0)
  })
})

describe('P1-01: DiscordChannel.healthCheck', () => {
  it('无 token 返回 healthy=false', async () => {
    const channel = new DiscordChannel()
    const h = await channel.healthCheck()
    expect(h.healthy).toBe(false)
    expect(h.error).toContain('no bot token')
  })

  it('token 有效 → healthy=true + user 详情', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'valid' })
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ id: '999', username: 'MyBot', discriminator: '0', bot: true }),
    )
    const h = await channel.healthCheck()
    expect(h.healthy).toBe(true)
    expect((h as any).details.username).toBe('MyBot')
  })

  it('token 无效 → healthy=false + error', async () => {
    const channel = new DiscordChannel()
    channel.setConfig({ botToken: 'bad' })
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ message: 'Invalid' }, 401))
    const h = await channel.healthCheck()
    expect(h.healthy).toBe(false)
    expect(h.error).toContain('token 校验失败')
  })
})
