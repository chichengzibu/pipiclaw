import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BrowserWindow } from 'electron'

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

  // ============ Phase 3 Task 1: 真 LLM SSE 增量推送测试 ============

  describe('broadcastStreamChunk IPC (Phase 3 Task 1)', () => {
    let mockSend: ReturnType<typeof vi.fn>
    let mockWindow: { isDestroyed: ReturnType<typeof vi.fn>; webContents: { send: ReturnType<typeof vi.fn> } }

    beforeEach(() => {
      mockSend = vi.fn()
      mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: { send: mockSend },
      }
      vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([mockWindow] as any)
    })

    it('broadcastStreamChunk sends chat:streamUpdate IPC with delta + type', () => {
      ;(cm as any).broadcastStreamChunk('conv-1', 'msg-1', 'hello', 'content')
      expect(mockSend).toHaveBeenCalledWith('chat:streamUpdate', {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        delta: 'hello',
        type: 'content',
      })
    })

    it('broadcastStreamChunk supports thinking delta type', () => {
      ;(cm as any).broadcastStreamChunk('conv-1', 'msg-1', 'reasoning...', 'thinking')
      expect(mockSend).toHaveBeenCalledWith('chat:streamUpdate', {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        delta: 'reasoning...',
        type: 'thinking',
      })
    })

    it('broadcastStreamChunk emits per-chunk without throttling (true per-token)', () => {
      const deltas = ['He', 'llo', ' ', 'world', '!']
      deltas.forEach(d => {
        ;(cm as any).broadcastStreamChunk('conv-1', 'msg-1', d, 'content')
      })
      expect(mockSend).toHaveBeenCalledTimes(deltas.length)
      // 验证每个 delta 都按顺序独立发送
      deltas.forEach((d, i) => {
        expect(mockSend).toHaveBeenNthCalledWith(i + 1, 'chat:streamUpdate', {
          conversationId: 'conv-1',
          messageId: 'msg-1',
          delta: d,
          type: 'content',
        })
      })
    })

    it('broadcastStreamChunk skips destroyed windows', () => {
      vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([
        { isDestroyed: () => true, webContents: { send: mockSend } } as any,
        mockWindow as any,
      ])
      ;(cm as any).broadcastStreamChunk('conv-1', 'msg-1', 'x', 'content')
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('broadcastStreamChunk + broadcastMessage both fire (compat layer)', () => {
      // 模拟 stream 方法内同时调用 broadcastMessage + broadcastStreamChunk
      const conv = cm.createConversation({ title: 'stream-test' })
      const message = cm.config.createStreamingMessage(conv.id, { role: 'assistant' })
      ;(cm as any).broadcastMessage(conv.id, message)
      ;(cm as any).broadcastStreamChunk(conv.id, message.id, 'tok', 'content')
      // 两条独立 IPC
      const channels = mockSend.mock.calls.map(c => c[0])
      expect(channels).toContain('chat:onMessage')
      expect(channels).toContain('chat:streamUpdate')
    })
  })
})
