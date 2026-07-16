import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-int-c2a-${k}`) },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  shell: {},
  dialog: {},
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

describe('Integration: Chat → Agent → Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ChatManager subscribeStream notifies on _emitStreamChunk', async () => {
    const { ChatManager } = await import('../../electron/chat/ChatManager')
    const cm = ChatManager.getInstance() as any
    let received: any = null
    const unsub = cm.subscribeStream((chunk: any) => { received = chunk })
    cm._emitStreamChunk({ conversationId: 'c1', content: 'reply-text', type: 'text' })
    expect(received?.content).toBe('reply-text')
    unsub.dispose()
  })

  it('subscribeStream dispose prevents further notifications', async () => {
    const { ChatManager } = await import('../../electron/chat/ChatManager')
    const cm = ChatManager.getInstance() as any
    let count = 0
    const unsub = cm.subscribeStream(() => { count += 1 })
    cm._emitStreamChunk({ conversationId: 'c2', content: 'one', type: 'text' })
    unsub.dispose()
    cm._emitStreamChunk({ conversationId: 'c2', content: 'two', type: 'text' })
    expect(count).toBe(1)
  })

  it('multiple subscribers all receive emit', async () => {
    const { ChatManager } = await import('../../electron/chat/ChatManager')
    const cm = ChatManager.getInstance() as any
    let a = 0
    let b = 0
    const ua = cm.subscribeStream(() => { a += 1 })
    const ub = cm.subscribeStream(() => { b += 1 })
    cm._emitStreamChunk({ conversationId: 'c3', content: 'fanout', type: 'text' })
    expect(a).toBe(1)
    expect(b).toBe(1)
    ua.dispose()
    ub.dispose()
  })

  it('ChatManager is a singleton', async () => {
    const { ChatManager } = await import('../../electron/chat/ChatManager')
    const a = ChatManager.getInstance()
    const b = ChatManager.getInstance()
    expect(a).toBe(b)
  })
})
