import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/pipiclaw-imconfig-test'),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s, 'utf-8')),
    decryptString: vi.fn((b: Buffer) => b.toString('utf-8')),
  },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P0-01: IM 通道配置存储
 *
 * 验证 IMConfigStore 增删改查 + 持久化到 userData/im-config.json.enc。
 */

import { IMConfigStore } from '../../electron/channel/IMConfigStore'

const TEST_USER_DATA = '/tmp/pipiclaw-imconfig-test'

describe('P0-01: IMConfigStore 通道配置存储', () => {
  beforeEach(() => {
    ;(IMConfigStore as unknown as { instance: IMConfigStore | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton returns same instance', () => {
    const a = IMConfigStore.getInstance()
    const b = IMConfigStore.getInstance()
    expect(a).toBe(b)
  })

  it('初始 list() 返回空数组', () => {
    const store = IMConfigStore.getInstance()
    expect(store.list()).toEqual([])
  })

  it('set 后 get 能取到', () => {
    const store = IMConfigStore.getInstance()
    store.set('feishu', { appId: 'cli_xxx', appSecret: 'secret', enabled: true })
    const cfg = store.get('feishu')
    expect(cfg).toBeDefined()
    expect(cfg!.appId).toBe('cli_xxx')
    expect(cfg!.appSecret).toBe('secret')
    expect(cfg!.enabled).toBe(true)
    expect(cfg!.channelKind).toBe('feishu')
  })

  it('set 多次相同 channelKind,后者覆盖前者', () => {
    const store = IMConfigStore.getInstance()
    store.set('telegram', { botToken: 'token-1' })
    store.set('telegram', { botToken: 'token-2', enabled: true })
    const cfg = store.get('telegram')
    expect(cfg!.botToken).toBe('token-2')
    expect(cfg!.enabled).toBe(true)
  })

  it('set 时若不传 channelKind,会自动填上', () => {
    const store = IMConfigStore.getInstance()
    store.set('discord', { botToken: 'abc' })
    const cfg = store.get('discord')
    expect(cfg!.channelKind).toBe('discord')
  })

  it('list 返回所有已配置的 channel,顺序不固定', () => {
    const store = IMConfigStore.getInstance()
    store.set('feishu', { appId: 'a' })
    store.set('telegram', { botToken: 't' })
    store.set('slack', { botToken: 's' })
    const all = store.list()
    expect(all.length).toBe(3)
    const kinds = all.map((c) => c.channelKind).sort()
    expect(kinds).toEqual(['feishu', 'slack', 'telegram'])
  })

  it('remove 删掉后 get 返回 undefined', () => {
    const store = IMConfigStore.getInstance()
    store.set('qq', { appId: 'q' })
    expect(store.remove('qq')).toBe(true)
    expect(store.get('qq')).toBeUndefined()
  })

  it('remove 不存在的 channel 返回 false', () => {
    const store = IMConfigStore.getInstance()
    expect(store.remove('nonexistent')).toBe(false)
  })

  it('updatedAt 每次 set 都更新', async () => {
    const store = IMConfigStore.getInstance()
    store.set('feishu', { appId: 'a' })
    const t1 = store.get('feishu')!.updatedAt
    await new Promise((r) => setTimeout(r, 5))
    store.set('feishu', { appId: 'a2' })
    const t2 = store.get('feishu')!.updatedAt
    expect(t2).toBeGreaterThan(t1)
  })

  it('enabled 默认 false', () => {
    const store = IMConfigStore.getInstance()
    store.set('wechat-work', { corpId: 'ww' })
    expect(store.get('wechat-work')!.enabled).toBe(false)
  })

  it('7 个 channel 各 set 后 list 长度 = 7', () => {
    const store = IMConfigStore.getInstance()
    const kinds = ['feishu', 'dingtalk', 'wechat-work', 'telegram', 'slack', 'discord', 'whatsapp', 'qq', 'lark', 'rocket', 'wechat']
    kinds.forEach((k) => store.set(k as any, { appId: k }))
    expect(store.list().length).toBe(kinds.length)
  })
})

describe('P0-01: IMConfigStore 持久化到磁盘', () => {
  beforeEach(() => {
    ;(IMConfigStore as unknown as { instance: IMConfigStore | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('set 后文件落到 userData/im-config.json.enc', () => {
    const store = IMConfigStore.getInstance()
    store.set('feishu', { appId: 'a', appSecret: 'b' })
    const storePath = `${TEST_USER_DATA}/im-config.json.enc`
    expect(fs.existsSync(storePath)).toBe(true)
  })

  it('重新 getInstance 后,数据从磁盘恢复', () => {
    const store1 = IMConfigStore.getInstance()
    store1.set('telegram', { botToken: 'persist-token', enabled: true })
    ;(IMConfigStore as unknown as { instance: IMConfigStore | null }).instance = null
    const store2 = IMConfigStore.getInstance()
    const cfg = store2.get('telegram')
    expect(cfg).toBeDefined()
    expect(cfg!.botToken).toBe('persist-token')
    expect(cfg!.enabled).toBe(true)
  })

  it('restart 后 list 返回相同数据', () => {
    const store1 = IMConfigStore.getInstance()
    store1.set('discord', { botToken: 'd' })
    store1.set('slack', { botToken: 's' })
    ;(IMConfigStore as unknown as { instance: IMConfigStore | null }).instance = null
    const store2 = IMConfigStore.getInstance()
    const kinds = store2.list().map((c) => c.channelKind).sort()
    expect(kinds).toEqual(['discord', 'slack'])
  })

  it('remove 后,重启也不再恢复', () => {
    const store1 = IMConfigStore.getInstance()
    store1.set('qq', { appId: 'q' })
    store1.remove('qq')
    ;(IMConfigStore as unknown as { instance: IMConfigStore | null }).instance = null
    const store2 = IMConfigStore.getInstance()
    expect(store2.get('qq')).toBeUndefined()
  })
})
