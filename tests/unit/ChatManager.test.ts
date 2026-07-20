import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((key: string) => `/tmp/pipiclaw-chat-${key}`),
    on: vi.fn(),
    off: vi.fn(),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: {},
  shell: {},
}))

vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } },
  },
}))

import { ChatManager } from '../../electron/chat/ChatManager'

describe('ChatManager', () => {
  let cm: ChatManager

  beforeEach(() => {
    vi.clearAllMocks()
    ChatManager.destroy()
    cm = ChatManager.getInstance()
  })

  it('getInstance returns singleton', () => {
    const a = ChatManager.getInstance()
    const b = ChatManager.getInstance()
    expect(a).toBe(b)
  })

  it('createConversation returns a conversation with id', () => {
    const conv = cm.createConversation({ title: 'test-1' })
    expect(conv).toBeDefined()
    expect(conv.id).toBeTruthy()
  })

  it('getConversation returns existing conversation', () => {
    const conv = cm.createConversation({ title: 'lookup' })
    const got = cm.getConversation(conv.id)
    expect(got?.id).toBe(conv.id)
  })

  it('getConversation returns undefined for unknown id', () => {
    const got = cm.getConversation('nonexistent-id')
    expect(got).toBeUndefined()
  })

  it('subscribeStream returns Disposable with dispose fn', () => {
    const unsub = cm.subscribeStream(() => {})
    expect(typeof unsub.dispose).toBe('function')
    unsub.dispose()
  })

  it('_emitStreamChunk notifies all subscribers', () => {
    let count = 0
    const unsub = cm.subscribeStream(() => { count += 1 })
    ;(cm as any)._emitStreamChunk({ conversationId: 'c1', content: 'hello', type: 'text' })
    ;(cm as any)._emitStreamChunk({ conversationId: 'c1', content: 'world', type: 'text' })
    expect(count).toBe(2)
    unsub.dispose()
  })

  it('dispose removes the subscriber from streamHandlers', () => {
    let count = 0
    const unsub = cm.subscribeStream(() => { count += 1 })
    ;(cm as any)._emitStreamChunk({ conversationId: 'x', content: 'a', type: 'text' })
    unsub.dispose()
    ;(cm as any)._emitStreamChunk({ conversationId: 'x', content: 'b', type: 'text' })
    expect(count).toBe(1)
  })
})
