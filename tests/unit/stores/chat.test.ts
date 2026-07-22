import { describe, it, expect, beforeEach, vi } from 'vitest'

// element-plus ElMessage 在 jsdom 下没有样式挂载点,用 mock 隔离
vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

import { setActivePinia, createPinia } from 'pinia'

const { api } = vi.hoisted(() => {
  const api: any = {}
  api.models = {
    list: vi.fn(),
    get: vi.fn(),
    getTemplates: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
    test: vi.fn(),
    syncOllama: vi.fn(),
    fetch: vi.fn(),
  }
  api.chat = {
    conversations: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    archiveConversation: vi.fn(),
    pinConversation: vi.fn(),
    sendMessage: vi.fn(),
    stopGeneration: vi.fn(),
    continueGeneration: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getLastModel: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onConversationUpdate: vi.fn(() => () => {}),
    onStreamUpdate: vi.fn(() => () => {}),
  }
  api.permissions = {
    list: vi.fn(),
    active: vi.fn(),
    get: vi.fn(),
    setActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateRule: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    check: vi.fn(),
  }
  api.schedule = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
    history: vi.fn(),
    execute: vi.fn(),
    cancel: vi.fn(),
  }
  api.gateway = {
    status: vi.fn(),
    logs: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    config: { get: vi.fn(), set: vi.fn() },
    onStatusChange: vi.fn(() => () => {}),
    onLog: vi.fn(() => () => {}),
  }
  ;(globalThis as any).window = (globalThis as any).window || {}
  ;(globalThis as any).window.electronAPI = api
  return { api }
})

import { useChatStore, type Conversation, type ChatMessage } from '../../../src/stores/chat'

const now = 1700000000000

const makeConv = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  title: '测试会话',
  messages: [],
  createdAt: now,
  updatedAt: now,
  status: 'active',
  pinned: false,
  ...overrides,
})

describe('useChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 不 resetAllMocks,因为 onMessage 的 mock 实现包含返回值
    vi.clearAllMocks()
  })

  it('initializes with empty conversations and default settings', () => {
    const store = useChatStore()
    expect(store.conversations).toEqual([])
    expect(store.currentConversationId).toBeNull()
    expect(store.currentConversation).toBeUndefined()
    expect(store.settings.temperature).toBe(0.7)
    expect(store.settings.maxTokens).toBe(4096)
    expect(store.loading).toBe(false)
    expect(store.sending).toBe(false)
    expect(store.activeConversations).toEqual([])
    expect(store.pinnedConversations).toEqual([])
    expect(store.recentConversations).toEqual([])
    expect(store.archivedConversations).toEqual([])
    expect(store.searchResults).toEqual([])
    expect(store.lastProviderId).toBeNull()
    expect(store.lastModelId).toBeNull()
    expect(store.selectedConversations).toEqual([])
    expect(store.quotedMessage).toBeNull()
    expect(store.executingTask).toBe(false)
    expect(store.isGenerating).toBe(false)
  })

  it('fetchConversations loads conversation list', async () => {
    const store = useChatStore()
    const convs = [makeConv(), makeConv({ id: 'conv-2', title: '第二个' })]
    api.chat.conversations.mockResolvedValue({ success: true, data: convs })
    await store.fetchConversations()
    expect(store.conversations.length).toBe(2)
    expect(store.loading).toBe(false)
  })

  it('fetchConversations handles failure with empty list', async () => {
    const store = useChatStore()
    api.chat.conversations.mockResolvedValue({ success: false, error: 'fail' })
    await store.fetchConversations()
    expect(store.conversations).toEqual([])
  })

  it('fetchConversations catches thrown error', async () => {
    const store = useChatStore()
    api.chat.conversations.mockRejectedValue(new Error('Boom'))
    await store.fetchConversations()
    expect(store.conversations).toEqual([])
  })

  it('fetchConversations handles null result', async () => {
    const store = useChatStore()
    api.chat.conversations.mockResolvedValue(null)
    await store.fetchConversations()
    expect(store.conversations).toEqual([])
  })

  it('getConversation caches new conversation', async () => {
    const store = useChatStore()
    const conv = makeConv()
    api.chat.getConversation.mockResolvedValue({ success: true, data: conv })
    const got = await store.getConversation('conv-1')
    expect(got).toEqual(conv)
    expect(store.conversations).toContainEqual(conv)
  })

  it('getConversation updates existing entry', async () => {
    const store = useChatStore()
    const old = makeConv({ title: '旧' })
    store.conversations = [old]
    const updated = makeConv({ title: '新' })
    api.chat.getConversation.mockResolvedValue({ success: true, data: updated })
    const got = await store.getConversation('conv-1')
    expect(got).toEqual(updated)
    expect(store.conversations[0]).toEqual(updated)
  })

  it('getConversation returns null on failure', async () => {
    const store = useChatStore()
    api.chat.getConversation.mockResolvedValue({ success: false })
    const got = await store.getConversation('missing')
    expect(got).toBeNull()
  })

  it('createConversation inserts at head and selects it', async () => {
    const store = useChatStore()
    const existing = makeConv({ id: 'conv-existing', title: '已有' })
    store.conversations = [existing]
    const created = makeConv({ id: 'conv-new', title: '新建' })
    api.chat.createConversation.mockResolvedValue({ success: true, data: created })
    api.chat.updateConversation.mockResolvedValue({ success: true, data: created })
    const got = await store.createConversation({ title: '新建' })
    expect(got).toEqual(created)
    expect(store.conversations[0]).toEqual(created)
    expect(store.currentConversationId).toBe('conv-new')
  })

  it('createConversation merges lastModel into payload', async () => {
    const store = useChatStore()
    store.lastProviderId = 'prov-1'
    store.lastModelId = 'model-1'
    const created = makeConv({ id: 'conv-new', providerId: 'prov-1', modelId: 'model-1' })
    api.chat.createConversation.mockResolvedValue({ success: true, data: created })
    api.chat.updateConversation.mockResolvedValue({ success: true, data: created })
    await store.createConversation({ title: 'X' })
    expect(api.chat.createConversation).toHaveBeenCalledWith({
      title: 'X',
      providerId: 'prov-1',
      modelId: 'model-1',
    })
  })

  it('createConversation returns null on failure', async () => {
    const store = useChatStore()
    api.chat.createConversation.mockResolvedValue({ success: false, error: 'no' })
    const got = await store.createConversation({ title: 'X' })
    expect(got).toBeNull()
    expect(store.conversations.length).toBe(0)
  })

  it('updateConversation replaces existing entry', async () => {
    const store = useChatStore()
    const old = makeConv({ title: '旧' })
    store.conversations = [old]
    const updated = makeConv({ title: '新', pinned: true })
    api.chat.updateConversation.mockResolvedValue({ success: true, data: updated })
    const ok = await store.updateConversation('conv-1', { pinned: true })
    expect(ok).toBe(true)
    expect(store.conversations[0]).toEqual(updated)
  })

  it('updateConversation returns false on failure', async () => {
    const store = useChatStore()
    api.chat.updateConversation.mockResolvedValue({ success: false })
    const ok = await store.updateConversation('conv-1', { pinned: true })
    expect(ok).toBe(false)
  })

  it('deleteConversation removes and reassigns current', async () => {
    const store = useChatStore()
    store.conversations = [makeConv({ id: 'a' }), makeConv({ id: 'b' })]
    store.currentConversationId = 'a'
    api.chat.deleteConversation.mockResolvedValue({ success: true })
    const ok = await store.deleteConversation('a')
    expect(ok).toBe(true)
    expect(store.conversations.map(c => c.id)).toEqual(['b'])
    expect(store.currentConversationId).toBe('b')
  })

  it('deleteConversation sets null when last removed', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    store.currentConversationId = 'conv-1'
    api.chat.deleteConversation.mockResolvedValue({ success: true })
    const ok = await store.deleteConversation('conv-1')
    expect(ok).toBe(true)
    expect(store.currentConversationId).toBeNull()
  })

  it('deleteConversation returns false on failure', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    api.chat.deleteConversation.mockResolvedValue({ success: false })
    const ok = await store.deleteConversation('conv-1')
    expect(ok).toBe(false)
    expect(store.conversations.length).toBe(1)
  })

  it('archiveConversation updates status to archived', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    const archived = makeConv({ status: 'archived' })
    api.chat.archiveConversation.mockResolvedValue({ success: true, data: archived })
    const ok = await store.archiveConversation('conv-1')
    expect(ok).toBe(true)
    expect(store.conversations[0].status).toBe('archived')
    expect(store.archivedConversations.length).toBe(1)
    expect(store.activeConversations.length).toBe(0)
  })

  it('pinConversation toggles pinned state', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    const pinned = makeConv({ pinned: true })
    api.chat.pinConversation.mockResolvedValue({ success: true, data: pinned })
    const ok = await store.pinConversation('conv-1', true)
    expect(ok).toBe(true)
    expect(store.conversations[0].pinned).toBe(true)
    expect(store.pinnedConversations.length).toBe(1)
  })

  it('unarchiveConversation sets status back to active', async () => {
    const store = useChatStore()
    store.conversations = [makeConv({ status: 'archived' })]
    const active = makeConv({ status: 'active' })
    api.chat.updateConversation.mockResolvedValue({ success: true, data: active })
    const ok = await store.unarchiveConversation('conv-1')
    expect(ok).toBe(true)
    expect(store.conversations[0].status).toBe('active')
    expect(api.chat.updateConversation).toHaveBeenCalledWith('conv-1', { status: 'active' })
  })

  it('batchDeleteConversations removes all', async () => {
    const store = useChatStore()
    store.conversations = [makeConv({ id: 'a' }), makeConv({ id: 'b' }), makeConv({ id: 'c' })]
    store.selectedConversations = ['a', 'b', 'c']
    api.chat.deleteConversation.mockResolvedValue({ success: true })
    const ok = await store.batchDeleteConversations(['a', 'b'])
    expect(ok).toBe(true)
    expect(store.conversations.length).toBe(1)
    expect(store.conversations[0].id).toBe('c')
    expect(store.selectedConversations).toEqual([])
  })

  it('batchDeleteConversations returns false on partial failure', async () => {
    const store = useChatStore()
    store.conversations = [makeConv({ id: 'a' }), makeConv({ id: 'b' })]
    api.chat.deleteConversation.mockImplementation((id: string) => {
      return Promise.resolve({ success: id === 'a' })
    })
    const ok = await store.batchDeleteConversations(['a', 'b'])
    expect(ok).toBe(false)
    expect(store.conversations.length).toBe(1)
  })

  it('quoteMessage / clearQuotedMessage manage quoted message', () => {
    const store = useChatStore()
    const msg: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'quoted',
      timestamp: now,
      status: 'sent',
    }
    store.quoteMessage(msg)
    expect(store.quotedMessage).toEqual(msg)
    store.clearQuotedMessage()
    expect(store.quotedMessage).toBeNull()
  })

  it('searchKeyword and searchResults filter by title and message content', () => {
    const store = useChatStore()
    const a = makeConv({ id: 'a', title: 'OpenAI 配置', messages: [] })
    const b = makeConv({ id: 'b', title: '闲聊', messages: [
      { id: 'm1', role: 'user', content: '今天聊聊 GPT-4', timestamp: now, status: 'sent' },
    ] })
    store.conversations = [a, b]
    store.setSearchKeyword('gpt')
    expect(store.searchResults.map(c => c.id)).toEqual(['b'])
    store.setSearchKeyword('配置')
    expect(store.searchResults.map(c => c.id)).toEqual(['a'])
    store.setSearchKeyword('')
    expect(store.searchResults).toEqual([])
  })

  it('toggleConversationSelection toggles selection membership', () => {
    const store = useChatStore()
    store.toggleConversationSelection('a')
    expect(store.selectedConversations).toEqual(['a'])
    store.toggleConversationSelection('b')
    expect(store.selectedConversations).toEqual(['a', 'b'])
    store.toggleConversationSelection('a')
    expect(store.selectedConversations).toEqual(['b'])
  })

  it('clearConversationSelection empties the list', () => {
    const store = useChatStore()
    store.selectedConversations = ['a', 'b']
    store.clearConversationSelection()
    expect(store.selectedConversations).toEqual([])
  })

  it('selectAllConversations sets selection to provided ids', () => {
    const store = useChatStore()
    store.selectAllConversations(['a', 'b', 'c'])
    expect(store.selectedConversations).toEqual(['a', 'b', 'c'])
  })

  it('selectConversation updates currentConversationId', () => {
    const store = useChatStore()
    store.conversations = [makeConv({ id: 'a' }), makeConv({ id: 'b' })]
    store.selectConversation('b')
    expect(store.currentConversationId).toBe('b')
    expect(store.currentConversation?.id).toBe('b')
  })

  it('currentProviderId / currentModelId fall back to last-used', () => {
    const store = useChatStore()
    store.lastProviderId = 'p1'
    store.lastModelId = 'm1'
    store.conversations = [makeConv({ providerId: 'p2', modelId: 'm2' })]
    store.currentConversationId = 'conv-1'
    expect(store.currentProviderId).toBe('p2')
    expect(store.currentModelId).toBe('m2')

    store.conversations = [makeConv({ providerId: undefined, modelId: undefined })]
    expect(store.currentProviderId).toBe('p1')
    expect(store.currentModelId).toBe('m1')
  })

  it('addMessageLocally / updateMessageLocally / removeMessageLocally operate on messages', () => {
    const store = useChatStore()
    const conv = makeConv()
    store.conversations = [conv]
    const msg: ChatMessage = {
      id: 'm1',
      role: 'user',
      content: 'hi',
      timestamp: now,
      status: 'sent',
    }
    store.addMessageLocally('conv-1', msg)
    expect(store.conversations[0].messages.length).toBe(1)
    store.updateMessageLocally('conv-1', 'm1', { content: 'hello' })
    expect(store.conversations[0].messages[0].content).toBe('hello')
    store.removeMessageLocally('conv-1', 'm1')
    expect(store.conversations[0].messages.length).toBe(0)
  })

  it('replaceMessageId swaps a temp message id with real id', () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    store.addMessageLocally('conv-1', {
      id: 'tmp_1',
      role: 'assistant',
      content: 'x',
      timestamp: now,
      status: 'streaming',
    })
    store.replaceMessageId('conv-1', 'tmp_1', 'real_1')
    expect(store.conversations[0].messages[0].id).toBe('real_1')
  })

  it('fetchSettings updates settings from electronAPI', async () => {
    const store = useChatStore()
    api.chat.getSettings.mockResolvedValue({
      success: true,
      data: { temperature: 0.9, maxTokens: 2048, topP: 0.8, frequencyPenalty: 0.1, presencePenalty: 0.2 },
    })
    await store.fetchSettings()
    expect(store.settings.temperature).toBe(0.9)
    expect(store.settings.maxTokens).toBe(2048)
  })

  it('updateSettings merges on success', async () => {
    const store = useChatStore()
    api.chat.updateSettings.mockResolvedValue({
      success: true,
      data: { temperature: 0.5, maxTokens: 4096, topP: 1.0, frequencyPenalty: 0.0, presencePenalty: 0.0 },
    })
    const ok = await store.updateSettings({ temperature: 0.5 })
    expect(ok).toBe(true)
    expect(store.settings.temperature).toBe(0.5)
  })

  it('setCurrentModel updates conversation and last-used', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    store.currentConversationId = 'conv-1'
    api.chat.updateConversation.mockResolvedValue({
      success: true,
      data: makeConv({ providerId: 'p', modelId: 'm' }),
    })
    const ok = await store.setCurrentModel('p', 'm')
    expect(ok).toBe(true)
    expect(store.lastProviderId).toBe('p')
    expect(store.lastModelId).toBe('m')
  })

  it('fetchLastModel loads from electronAPI', async () => {
    const store = useChatStore()
    api.chat.getLastModel.mockResolvedValue({
      success: true,
      data: { providerId: 'last-p', modelId: 'last-m' },
    })
    await store.fetchLastModel()
    expect(store.lastProviderId).toBe('last-p')
    expect(store.lastModelId).toBe('last-m')
  })

  it('activeConversations and recentConversations split correctly', () => {
    const store = useChatStore()
    store.conversations = [
      makeConv({ id: 'a', status: 'active', pinned: false }),
      makeConv({ id: 'b', status: 'active', pinned: true }),
      makeConv({ id: 'c', status: 'archived' }),
    ]
    expect(store.activeConversations.map(c => c.id)).toEqual(['a', 'b'])
    expect(store.pinnedConversations.map(c => c.id)).toEqual(['b'])
    expect(store.recentConversations.map(c => c.id)).toEqual(['a'])
    expect(store.archivedConversations.map(c => c.id)).toEqual(['c'])
  })

  it('initialize loads data and registers listeners', () => {
    const store = useChatStore()
    api.chat.conversations.mockResolvedValue({ success: true, data: [] })
    api.chat.getSettings.mockResolvedValue({
      success: true,
      data: { temperature: 0.7, maxTokens: 4096, topP: 1.0, frequencyPenalty: 0.0, presencePenalty: 0.0 },
    })
    api.chat.getLastModel.mockResolvedValue({ success: true, data: { providerId: 'p', modelId: 'm' } })
    store.initialize()
    expect(api.chat.conversations).toHaveBeenCalledTimes(1)
    expect(api.chat.getSettings).toHaveBeenCalledTimes(1)
    expect(api.chat.getLastModel).toHaveBeenCalledTimes(1)
    expect(api.chat.onMessage).toHaveBeenCalledTimes(1)
    expect(api.chat.onConversationUpdate).toHaveBeenCalledTimes(1)
    expect(api.chat.onStreamUpdate).toHaveBeenCalledTimes(1)
  })

  it('cancelExecuteTask resets all task flags', () => {
    const store = useChatStore()
    store.executingTask = true
    store.isGenerating = true
    store.pendingTaskPlan = { planId: 'p', instruction: 'x', steps: [], riskLevel: 'low' }
    store.cancelExecuteTask()
    expect(store.executingTask).toBe(false)
    expect(store.isGenerating).toBe(false)
    expect(store.pendingTaskPlan).toBeNull()
  })

  it('confirmExecuteTask flips showTaskConfirmDialog and sets executingTask', async () => {
    const store = useChatStore()
    store.pendingTaskPlan = { planId: 'p1', instruction: 'do', steps: [], riskLevel: 'low' }
    store.showTaskConfirmDialog = true
    await store.confirmExecuteTask()
    expect(store.executingTask).toBe(true)
    expect(store.showTaskConfirmDialog).toBe(false)
  })

  it('confirmExecuteTask is a no-op when no pending plan', async () => {
    const store = useChatStore()
    store.showTaskConfirmDialog = true
    await store.confirmExecuteTask()
    expect(store.executingTask).toBe(false)
    expect(store.showTaskConfirmDialog).toBe(true)
  })

  it('sendMessage adds user + assistant placeholders and calls electronAPI', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    store.currentConversationId = 'conv-1'
    api.chat.sendMessage.mockResolvedValue({ success: true })
    const ok = await store.sendMessage('hello world', 'prov-1', 'model-1')
    expect(ok).toBe(true)
    expect(api.chat.sendMessage).toHaveBeenCalledWith('conv-1', 'hello world', 'prov-1', 'model-1')
    expect(store.conversations[0].messages.length).toBe(2)
    expect(store.conversations[0].messages[0].role).toBe('user')
    expect(store.conversations[0].messages[1].role).toBe('assistant')
    expect(store.conversations[0].messages[1].status).toBe('streaming')
    expect(store.sending).toBe(false)
    expect(store.isGenerating).toBe(false)
  })

  it('sendMessage returns false and shows ElMessage when already sending', async () => {
    const store = useChatStore()
    store.sending = true
    const ok = await store.sendMessage('hi')
    expect(ok).toBe(false)
    expect(api.chat.sendMessage).not.toHaveBeenCalled()
  })

  it('sendMessage creates a new conversation when none selected', async () => {
    const store = useChatStore()
    const created = makeConv({ id: 'auto' })
    api.chat.createConversation.mockResolvedValue({ success: true, data: created })
    api.chat.updateConversation.mockResolvedValue({ success: true, data: created })
    api.chat.sendMessage.mockResolvedValue({ success: true })
    await store.sendMessage('hi', 'p', 'm')
    expect(api.chat.createConversation).toHaveBeenCalled()
    expect(api.chat.sendMessage).toHaveBeenCalledWith('auto', 'hi', 'p', 'm')
  })

  it('sendMessage marks assistant as error on electronAPI failure', async () => {
    const store = useChatStore()
    store.conversations = [makeConv()]
    store.currentConversationId = 'conv-1'
    api.chat.sendMessage.mockResolvedValue({ success: false, error: 'network' })
    const ok = await store.sendMessage('hi', 'p', 'm')
    expect(ok).toBe(false)
    const assistant = store.conversations[0].messages.find(m => m.role === 'assistant')!
    expect(assistant.status).toBe('error')
    expect(assistant.error).toBe('network')
    expect(store.sending).toBe(false)
  })

  it('stopGeneration marks streaming assistant message as stopped', async () => {
    const store = useChatStore()
    store.conversations = [{
      ...makeConv(),
      messages: [
        { id: 'u1', role: 'user', content: 'hi', timestamp: now, status: 'sent' },
        { id: 'a1', role: 'assistant', content: 'partial...', timestamp: now, status: 'streaming' },
      ],
    }]
    store.currentConversationId = 'conv-1'
    api.chat.stopGeneration.mockResolvedValue({ success: true })
    await store.stopGeneration()
    expect(api.chat.stopGeneration).toHaveBeenCalledWith('conv-1')
    expect(store.conversations[0].messages[1].status).toBe('stopped')
    expect(store.isGenerating).toBe(false)
    expect(store.sending).toBe(false)
  })

  it('stopGeneration is no-op when no current conversation', async () => {
    const store = useChatStore()
    await store.stopGeneration()
    expect(api.chat.stopGeneration).not.toHaveBeenCalled()
  })

  it('continueGeneration rejects when last message is not assistant', async () => {
    const store = useChatStore()
    store.conversations = [{
      ...makeConv(),
      messages: [{ id: 'u1', role: 'user', content: 'hi', timestamp: now, status: 'sent' }],
    }]
    store.currentConversationId = 'conv-1'
    await store.continueGeneration()
    expect(api.chat.continueGeneration).not.toHaveBeenCalled()
  })

  it('continueGeneration calls electronAPI for assistant tail', async () => {
    const store = useChatStore()
    store.conversations = [{
      ...makeConv(),
      messages: [{ id: 'a1', role: 'assistant', content: 'partial', timestamp: now, status: 'stopped' }],
    }]
    store.currentConversationId = 'conv-1'
    api.chat.continueGeneration.mockResolvedValue({ success: true })
    await store.continueGeneration()
    expect(api.chat.continueGeneration).toHaveBeenCalledWith('conv-1')
    expect(store.sending).toBe(true)
  })

  it('handleMessageEvent appends new assistant message and auto-generates title', () => {
    const store = useChatStore()
    // 抓取 initialize 注册的 onMessage 回调
    let onMessageCb: any = null
    api.chat.onMessage.mockImplementation((cb: any) => { onMessageCb = cb; return () => {} })
    store.initialize()
    expect(onMessageCb).not.toBeNull()
    store.conversations = [{
      ...makeConv(),
      messages: [
        { id: 'u1', role: 'user', content: '什么是 TypeScript?', timestamp: now, status: 'sent' },
      ],
    }]
    const assistantMsg: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: 'TS 是 JS 的超集',
      timestamp: now,
      status: 'streaming',
    }
    onMessageCb({ conversationId: 'conv-1', message: assistantMsg })
    expect(store.conversations[0].messages.length).toBe(2)
    expect(store.conversations[0].title).toBe('什么是 TypeScript?')
    expect(store.sending).toBe(false)
  })

  it('handleMessageEvent updates existing message in place', () => {
    const store = useChatStore()
    let onMessageCb: any = null
    api.chat.onMessage.mockImplementation((cb: any) => { onMessageCb = cb; return () => {} })
    store.initialize()
    store.conversations = [{
      ...makeConv(),
      messages: [
        { id: 'u1', role: 'user', content: 'hi', timestamp: now, status: 'sent' },
        { id: 'a1', role: 'assistant', content: 'partial', timestamp: now, status: 'streaming' },
      ],
    }]
    const updated: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: 'partial complete',
      timestamp: now,
      status: 'sent',
    }
    onMessageCb({ conversationId: 'conv-1', message: updated })
    expect(store.conversations[0].messages[1].content).toBe('partial complete')
    expect(store.conversations[0].messages[1].status).toBe('sent')
  })

  it('handleMessageEvent skips when conversation not found', () => {
    const store = useChatStore()
    let onMessageCb: any = null
    api.chat.onMessage.mockImplementation((cb: any) => { onMessageCb = cb; return () => {} })
    store.initialize()
    onMessageCb({
      conversationId: 'missing',
      message: { id: 'm1', role: 'assistant', content: 'x', timestamp: now, status: 'streaming' },
    })
    expect(store.conversations.length).toBe(0)
  })

  it('handleConversationUpdate replaces existing entry', () => {
    const store = useChatStore()
    let onConvCb: any = null
    api.chat.onConversationUpdate.mockImplementation((cb: any) => { onConvCb = cb; return () => {} })
    store.initialize()
    store.conversations = [makeConv({ title: '旧' })]
    const updated = makeConv({ title: '新', pinned: true })
    onConvCb({ conversation: updated })
    expect(store.conversations[0].title).toBe('新')
    expect(store.conversations[0].pinned).toBe(true)
  })

  it('editAndResendMessage returns false when conversation missing', async () => {
    const store = useChatStore()
    const ok = await store.editAndResendMessage('m1', 'new content')
    expect(ok).toBe(false)
  })

  // ============ Phase 3 Task 1: 流式分块累积测试 ============

  it('handleStreamChunkEvent accumulates content deltas into existing message', () => {
    const store = useChatStore()
    let onStreamCb: any = null
    api.chat.onStreamUpdate.mockImplementation((cb: any) => { onStreamCb = cb; return () => {} })
    store.initialize()
    expect(onStreamCb).not.toBeNull()

    // 准备一个流式 assistant 消息
    store.conversations = [{
      ...makeConv(),
      messages: [
        { id: 'u1', role: 'user', content: 'hi', timestamp: now, status: 'sent' },
        { id: 'a1', role: 'assistant', content: '', timestamp: now, status: 'streaming' },
      ],
    }]

    // 模拟 5 个增量逐 token 到达
    const deltas = ['He', 'llo', ' ', 'wor', 'ld']
    deltas.forEach(d => {
      onStreamCb({ conversationId: 'conv-1', messageId: 'a1', delta: d, type: 'content' })
    })

    expect(store.conversations[0].messages[1].content).toBe('Hello world')
    expect(store.conversations[0].messages[1].status).toBe('streaming')
  })

  it('handleStreamChunkEvent routes thinking deltas to msg.thinking', () => {
    const store = useChatStore()
    let onStreamCb: any = null
    api.chat.onStreamUpdate.mockImplementation((cb: any) => { onStreamCb = cb; return () => {} })
    store.initialize()

    store.conversations = [{
      ...makeConv(),
      messages: [
        { id: 'a1', role: 'assistant', content: '', thinking: '', timestamp: now, status: 'streaming' },
      ],
    }]

    onStreamCb({ conversationId: 'conv-1', messageId: 'a1', delta: '思考 ', type: 'thinking' })
    onStreamCb({ conversationId: 'conv-1', messageId: 'a1', delta: '过程...', type: 'thinking' })
    onStreamCb({ conversationId: 'conv-1', messageId: 'a1', delta: 'Hi', type: 'content' })

    expect(store.conversations[0].messages[0].thinking).toBe('思考 过程...')
    expect(store.conversations[0].messages[0].content).toBe('Hi')
  })

  it('handleStreamChunkEvent is a no-op for unknown conversationId or messageId', () => {
    const store = useChatStore()
    let onStreamCb: any = null
    api.chat.onStreamUpdate.mockImplementation((cb: any) => { onStreamCb = cb; return () => {} })
    store.initialize()
    store.conversations = [makeConv()]
    expect(() => onStreamCb({ conversationId: 'missing', messageId: 'a1', delta: 'x', type: 'content' })).not.toThrow()
    expect(() => onStreamCb({ conversationId: 'conv-1', messageId: 'missing', delta: 'x', type: 'content' })).not.toThrow()
    expect(store.conversations[0].messages.length).toBe(0)
  })

  it('editAndResendMessage returns false when message is not user role', async () => {
    const store = useChatStore()
    store.conversations = [{
      ...makeConv(),
      messages: [{ id: 'm1', role: 'assistant', content: 'hi', timestamp: now, status: 'sent' }],
    }]
    store.currentConversationId = 'conv-1'
    const ok = await store.editAndResendMessage('m1', 'new')
    expect(ok).toBe(false)
  })

  it('editAndResendMessage sends a new request and removes old assistant tail', async () => {
    const store = useChatStore()
    store.conversations = [{
      ...makeConv(),
      messages: [
        { id: 'u1', role: 'user', content: 'orig', timestamp: now, status: 'sent' },
        { id: 'a1', role: 'assistant', content: 'old reply', timestamp: now, status: 'sent' },
      ],
    }]
    store.currentConversationId = 'conv-1'
    api.chat.sendMessage.mockResolvedValue({ success: true })
    const ok = await store.editAndResendMessage('u1', 'updated')
    expect(ok).toBe(true)
    expect(store.conversations[0].messages[0].content).toBe('updated')
    // 原 assistant 已被 splice,新 placeholder 已添加
    expect(store.conversations[0].messages.length).toBe(2)
    expect(store.conversations[0].messages[1].role).toBe('assistant')
    expect(store.conversations[0].messages[1].status).toBe('streaming')
    expect(api.chat.sendMessage).toHaveBeenCalled()
  })

  it('editAndResendMessage marks error when sendMessage fails', async () => {
    const store = useChatStore()
    store.conversations = [{
      ...makeConv(),
      messages: [{ id: 'u1', role: 'user', content: 'orig', timestamp: now, status: 'sent' }],
    }]
    store.currentConversationId = 'conv-1'
    api.chat.sendMessage.mockResolvedValue({ success: false, error: 'fail' })
    const ok = await store.editAndResendMessage('u1', 'updated')
    expect(ok).toBe(false)
    const assistant = store.conversations[0].messages[store.conversations[0].messages.length - 1]
    expect(assistant.status).toBe('error')
    expect(assistant.error).toBe('fail')
  })

  it('selectConversation triggers updateConversation when model missing', async () => {
    const store = useChatStore()
    store.lastProviderId = 'last-p'
    store.lastModelId = 'last-m'
    store.conversations = [makeConv({ providerId: undefined, modelId: undefined })]
    api.chat.updateConversation.mockResolvedValue({
      success: true,
      data: makeConv({ providerId: 'last-p', modelId: 'last-m' }),
    })
    store.selectConversation('conv-1')
    // 等异步 update 完成
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(api.chat.updateConversation).toHaveBeenCalled()
  })

  it('setCurrentModel returns false when no current conversation', async () => {
    const store = useChatStore()
    const ok = await store.setCurrentModel('p', 'm')
    expect(ok).toBe(false)
  })
})