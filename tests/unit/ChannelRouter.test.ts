import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-channelrouter-test') },
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

/**
 * P2-01: ChannelRouter.send (IM 消息快捷回复)
 *
 * 验证 ChannelRouter:
 * - send 不存在的 channel → ok=false
 * - send 成功 → 调 channel.send + 发布 im:channel:send:ok
 * - send 失败 → 调 channel.send + 发布 im:channel:send:fail
 * - register / unregister / listMetadata
 */

import { ChannelRouter } from '../../electron/channel/ChannelRouter'
import { EventBus } from '../../electron/runtime/bridge/EventBus'
import type { Channel, ChannelMessage } from '../../electron/contracts/types'
import type { ChannelMetadata, ChannelKind } from '../../electron/channel/ChannelTypes'

function makeStubChannel(id: string, sendImpl?: (msg: ChannelMessage) => Promise<void>): Channel {
  return {
    id,
    send: sendImpl ?? (async () => {}),
    onMessage: () => ({ dispose: () => {} }),
    healthCheck: async () => ({ healthy: true }),
  }
}

function makeMeta(id: string, kind: ChannelKind = 'im-feishu'): Omit<ChannelMetadata, 'createdAt'> {
  return { id, kind, displayName: id, enabled: true, priority: 50, configRef: `cfg-${id}` }
}

describe('P2-01: ChannelRouter.send IM 消息快捷回复', () => {
  beforeEach(() => {
    ;(ChannelRouter as unknown as { instance: ChannelRouter | null }).instance = null
    EventBus.getInstance().clear()
  })

  it('singleton', () => {
    const a = ChannelRouter.getInstance()
    const b = ChannelRouter.getInstance()
    expect(a).toBe(b)
  })

  it('send 不存在的 channel → 返回 ok=false 错误信息', async () => {
    const router = ChannelRouter.getInstance()
    const result = await router.send('im-ghost', { to: 'u1', text: 'hi' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('send 成功 → 调 channel.send 并发布 im:channel:send:ok 事件', async () => {
    const sendSpy = vi.fn(async () => {})
    const router = ChannelRouter.getInstance()
    const channel = makeStubChannel('im-feishu-1', sendSpy)
    router.register(channel, makeMeta('im-feishu-1', 'im-feishu'))

    const busSpy = vi.fn()
    EventBus.getInstance().subscribe('im:channel:send:ok', busSpy)

    const result = await router.send('im-feishu-1', { to: 'user-1', text: 'Hello' })
    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledOnce()
    expect(sendSpy).toHaveBeenCalledWith({ to: 'user-1', text: 'Hello' })

    // 事件稍后触发,等 microtask flush
    await new Promise((r) => setTimeout(r, 0))
    expect(busSpy).toHaveBeenCalled()
    const callArg = busSpy.mock.calls[0][0] as { channelId: string }
    expect(callArg.channelId).toBe('im-feishu-1')
  })

  it('send 失败 → 返回 ok=false + 发布 im:channel:send:fail 事件', async () => {
    const sendSpy = vi.fn(async () => {
      throw new Error('网络超时')
    })
    const router = ChannelRouter.getInstance()
    const channel = makeStubChannel('im-dingtalk-1', sendSpy)
    router.register(channel, makeMeta('im-dingtalk-1', 'im-dingtalk'))

    const busSpy = vi.fn()
    EventBus.getInstance().subscribe('im:channel:send:fail', busSpy)

    const result = await router.send('im-dingtalk-1', { to: 'u2', text: 'ping' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('网络超时')

    await new Promise((r) => setTimeout(r, 0))
    expect(busSpy).toHaveBeenCalled()
    const callArg = busSpy.mock.calls[0][0] as { channelId: string; error: string }
    expect(callArg.channelId).toBe('im-dingtalk-1')
    expect(callArg.error).toContain('网络超时')
  })

  it('P3-04: send 失败 → 重试 3 次后失败 (maxAttempts 边界)', async () => {
    const sendSpy = vi.fn(async () => {
      throw new Error('503 service unavailable')
    })
    const router = ChannelRouter.getInstance()
    router.register(makeStubChannel('im-retry-1', sendSpy), makeMeta('im-retry-1', 'im-feishu'))

    const result = await router.send('im-retry-1', { to: 'u', text: 'hi' })
    expect(result.ok).toBe(false)
    expect(sendSpy).toHaveBeenCalledTimes(3) // RetryPolicy maxAttempts=3
  }, 30000) // 重试延迟 ~1s+2s+4s 需 7s

  it('P3-04: send 第 2 次成功 → 立即返回 ok=true,不重试', async () => {
    let count = 0
    const sendSpy = vi.fn(async () => {
      count++
      if (count < 2) throw new Error('network blip') // 'network' → transient → retryable
      return undefined
    })
    const router = ChannelRouter.getInstance()
    router.register(makeStubChannel('im-retry-2', sendSpy), makeMeta('im-retry-2', 'im-feishu'))

    const result = await router.send('im-retry-2', { to: 'u', text: 'hi' })
    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(2)
  }, 30000)

  it('register / unregister / listMetadata 生命周期', () => {
    const router = ChannelRouter.getInstance()
    router.register(makeStubChannel('im-tg-1'), makeMeta('im-tg-1', 'im-telegram'))
    router.register(makeStubChannel('im-tg-2'), makeMeta('im-tg-2', 'im-telegram'))
    expect(router.listMetadata()).toHaveLength(2)
    expect(router.get('im-tg-1')).toBeDefined()
    expect(router.unregister('im-tg-1')).toBe(true)
    expect(router.get('im-tg-1')).toBeUndefined()
    expect(router.listMetadata()).toHaveLength(1)
  })

  it('listByKind 按通道种类过滤', () => {
    const router = ChannelRouter.getInstance()
    router.register(makeStubChannel('im-feishu-1'), makeMeta('im-feishu-1', 'im-feishu'))
    router.register(makeStubChannel('im-dingtalk-1'), makeMeta('im-dingtalk-1', 'im-dingtalk'))
    router.register(makeStubChannel('im-feishu-2'), makeMeta('im-feishu-2', 'im-feishu'))
    const feishu = router.listByKind('im-feishu')
    expect(feishu).toHaveLength(2)
    expect(feishu.every((m) => m.kind === 'im-feishu')).toBe(true)
  })

  it('重复 register 同一个 channelId → 覆盖 + 警告', () => {
    const router = ChannelRouter.getInstance()
    router.register(makeStubChannel('im-feishu-1'), makeMeta('im-feishu-1', 'im-feishu'))
    router.register(makeStubChannel('im-feishu-1'), makeMeta('im-feishu-1', 'im-feishu'))
    expect(router.listMetadata()).toHaveLength(1)
  })

  it('健康检查所有 channel', async () => {
    const router = ChannelRouter.getInstance()
    router.register(
      makeStubChannel('im-healthy', async () => {}),
      makeMeta('im-healthy', 'im-feishu'),
    )
    router.register(
      {
        id: 'im-bad',
        send: async () => {},
        onMessage: () => ({ dispose: () => {} }),
        healthCheck: async () => ({ healthy: false, error: 'token 失效' }),
      },
      makeMeta('im-bad', 'im-dingtalk'),
    )
    const health = await router.healthCheckAll()
    expect(health['im-healthy']?.healthy).toBe(true)
    expect(health['im-bad']?.healthy).toBe(false)
    expect(health['im-bad']?.error).toBe('token 失效')
  })

  it('send 多个连续消息 → 每次都正确调用 channel.send', async () => {
    const sendSpy = vi.fn(async () => {})
    const router = ChannelRouter.getInstance()
    router.register(makeStubChannel('im-feishu-1', sendSpy), makeMeta('im-feishu-1', 'im-feishu'))

    const r1 = await router.send('im-feishu-1', { to: 'u1', text: 'msg 1' })
    const r2 = await router.send('im-feishu-1', { to: 'u2', text: 'msg 2' })
    const r3 = await router.send('im-feishu-1', { to: 'u3', text: 'msg 3' })

    expect(r1.ok && r2.ok && r3.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(3)
  })
})
