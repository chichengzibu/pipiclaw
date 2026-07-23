import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-router-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P0-04: 路由规则 matchRule
 *
 * 验证 IMMessageRouter:
 * - addRule / removeRule / listRules
 * - matchRule 按 priority 排序 + regex trigger
 * - 启用/禁用规则
 * - 非法 regex 不抛
 */

import { IMMessageRouter } from '../../electron/channel/IMMessageRouter'

describe('P0-04: IMMessageRouter 路由规则', () => {
  beforeEach(() => {
    ;(IMMessageRouter as unknown as { instance: IMMessageRouter | null }).instance = null
  })

  it('singleton', () => {
    const a = IMMessageRouter.getInstance()
    const b = IMMessageRouter.getInstance()
    expect(a).toBe(b)
  })

  it('初始 listRules 为空', () => {
    const r = IMMessageRouter.getInstance()
    expect(r.listRules()).toEqual([])
  })

  it('addRule 后 listRules 包含', () => {
    const r = IMMessageRouter.getInstance()
    r.addRule({
      id: 'r1',
      trigger: '日程|schedule',
      targetChannel: 'im-feishu' as any,
      targetUserId: 'u1',
      priority: 50,
      enabled: true,
    })
    expect(r.listRules().length).toBe(1)
  })

  it('removeRule 删掉', () => {
    const r = IMMessageRouter.getInstance()
    r.addRule({ id: 'r1', trigger: 'a', targetChannel: 'im-feishu' as any, targetUserId: 'u', priority: 1, enabled: true })
    expect(r.removeRule('r1')).toBe(true)
    expect(r.removeRule('nonexistent')).toBe(false)
    expect(r.listRules().length).toBe(0)
  })

  it('matchRule 按 priority 倒序匹配', async () => {
    const r = IMMessageRouter.getInstance()
    r.addRule({ id: 'low', trigger: '.*', targetChannel: 'im-telegram' as any, targetUserId: 'tg', priority: 1, enabled: true })
    r.addRule({ id: 'high', trigger: '日程', targetChannel: 'im-feishu' as any, targetUserId: 'feishu', priority: 100, enabled: true })
    const decision = await r.handleIncoming('ch1', 'im-feishu' as any, {
      id: 'm1',
      text: '今天日程',
      channel: 'im-feishu',
      from: 'u1',
      to: 'piPiClaw',
      ts: Date.now(),
    } as any)
    expect(decision.matchedRule?.id).toBe('high')
  })

  it('disabled 规则不匹配', async () => {
    const r = IMMessageRouter.getInstance()
    r.addRule({ id: 'r1', trigger: '日程', targetChannel: 'im-feishu' as any, targetUserId: 'u', priority: 50, enabled: false })
    const decision = await r.handleIncoming('ch1', 'im-feishu' as any, {
      id: 'm1', text: '今天日程', channel: 'im-feishu', from: 'u1', to: 'piPiClaw', ts: Date.now(),
    } as any)
    expect(decision.matchedRule).toBeUndefined()
  })

  it('非法 regex 不抛,跳过该规则', async () => {
    const r = IMMessageRouter.getInstance()
    r.addRule({ id: 'bad', trigger: '[unclosed', targetChannel: 'im-feishu' as any, targetUserId: 'u', priority: 50, enabled: true })
    const decision = await r.handleIncoming('ch1', 'im-feishu' as any, {
      id: 'm1', text: 'hello', channel: 'im-feishu', from: 'u1', to: 'piPiClaw', ts: Date.now(),
    } as any)
    expect(decision.allowed).toBe(true)
  })

  it('无匹配规则 → rejectReason no matching route rule', async () => {
    const r = IMMessageRouter.getInstance()
    const decision = await r.handleIncoming('ch1', 'im-feishu' as any, {
      id: 'm1', text: 'no trigger', channel: 'im-feishu', from: 'u1', to: 'piPiClaw', ts: Date.now(),
    } as any)
    expect(decision.rejectReason).toContain('no matching route rule')
  })
})
