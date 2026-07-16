import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-int-c2a2-${k}`) },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}))

vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: {
      file: { resolvePathFn: () => {}, maxSize: 0, format: '', level: 'info' },
      console: { level: 'info', format: '' },
    },
  },
}))

describe('Integration: Channel → Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ChannelRouter.getInstance returns singleton', async () => {
    const { ChannelRouter } = await import('../../electron/channel/ChannelRouter')
    const a = ChannelRouter.getInstance()
    const b = ChannelRouter.getInstance()
    expect(a).toBe(b)
  })

  it('ChannelRouter returns undefined for unknown channel id', async () => {
    const { ChannelRouter } = await import('../../electron/channel/ChannelRouter')
    const router = ChannelRouter.getInstance()
    const ch = router.get('nonexistent-channel-id')
    expect(ch).toBeUndefined()
  })

  it('ChannelRouter send to unknown channel returns ok=false', async () => {
    const { ChannelRouter } = await import('../../electron/channel/ChannelRouter')
    const router = ChannelRouter.getInstance()
    const r = await router.send('nonexistent', { from: 'u', content: 'ping', ts: Date.now() })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/not found/)
  })

  it('ChannelRouter listMetadata is empty array initially or has entries', async () => {
    const { ChannelRouter } = await import('../../electron/channel/ChannelRouter')
    const router = ChannelRouter.getInstance()
    const list = router.listMetadata()
    expect(Array.isArray(list)).toBe(true)
  })
})
