import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const TEST_USER_DATA = '/tmp/pipiclaw-config-enc-test'

/** XOR-with-key 简易"加密" — 模拟 safeStorage 的实际语义(密文不可读、密钥可还原) */
const ENC_KEY = 0x5a
function xorTransform(plain: Buffer): Buffer {
  return Buffer.from(plain.map((b, i) => b ^ ENC_KEY ^ (i & 0xff)))
}

vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn((key: string) => key === 'userData' ? TEST_USER_DATA : '/tmp'),
      getName: () => 'pipiclaw',
      getVersion: () => '0.0.0',
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((plain: string) => xorTransform(Buffer.from(plain, 'utf-8'))),
      decryptString: vi.fn((buf: Buffer) => {
        const out = xorTransform(buf).toString('utf-8')
        return out
      }),
    },
  }
})

vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } },
  },
}))

describe('LlmConfigStore + IMConfigStore safeStorage encryption', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('LlmConfigStore persists via safeStorage.encryptString', async () => {
    const { LlmConfigStore } = await import('../../electron/llm/LlmConfigStore')
    const store = (LlmConfigStore as any)
    store.instance = null
    const s1 = LlmConfigStore.getInstance()

    s1.set('openai', { apiKey: 'sk-test-123', enabled: true })

    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)

    const rawBuf = fs.readFileSync(encPath)
    const rawAsString = rawBuf.toString('utf-8')
    expect(rawAsString).not.toContain('sk-test-123')
    expect(rawAsString).not.toContain('openai')
    expect(rawAsString).not.toContain('apiKey')
  })

  it('LlmConfigStore loads correctly after encrypt + decrypt roundtrip', async () => {
    const { LlmConfigStore } = await import('../../electron/llm/LlmConfigStore')
    ;(LlmConfigStore as any).instance = null
    const s1 = LlmConfigStore.getInstance()
    s1.set('anthropic', { apiKey: 'sk-ant-test', enabled: true })
    s1.set('zhipu', { apiKey: 'zhipu-key', enabled: false })

    ;(LlmConfigStore as any).instance = null
    const s2 = LlmConfigStore.getInstance()
    expect(s2.list()).toHaveLength(2)
    expect(s2.get('anthropic')?.apiKey).toBe('sk-ant-test')
    expect(s2.get('zhipu')?.enabled).toBe(false)
    expect(s2.getActive()?.provider).toBe('anthropic')
  })

  it('LlmConfigStore falls back to plain when safeStorage unavailable', async () => {
    const electron = await import('electron')
    ;(electron.safeStorage.isEncryptionAvailable as any).mockReturnValue(false)

    const { LlmConfigStore } = await import('../../electron/llm/LlmConfigStore')
    ;(LlmConfigStore as any).instance = null
    const s = LlmConfigStore.getInstance()
    s.set('openai', { apiKey: 'plain-key', enabled: true })

    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)
    const raw = fs.readFileSync(encPath, 'utf-8')
    expect(raw).toContain('plain-key')

    ;(electron.safeStorage.isEncryptionAvailable as any).mockReturnValue(true)
  })

  it('LlmConfigStore migrates legacy plaintext file', async () => {
    const legacyPath = path.join(TEST_USER_DATA, 'llm-config.json')
    fs.mkdirSync(TEST_USER_DATA, { recursive: true })
    const legacy = [
      { provider: 'openai', apiKey: 'legacy-key', enabled: true, updatedAt: 100 },
    ]
    fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2))

    const { LlmConfigStore } = await import('../../electron/llm/LlmConfigStore')
    ;(LlmConfigStore as any).instance = null
    const s = LlmConfigStore.getInstance()

    expect(s.get('openai')?.apiKey).toBe('legacy-key')
    expect(fs.existsSync(legacyPath)).toBe(false)

    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)
  })

  it('IMConfigStore persists via safeStorage.encryptString', async () => {
    const { IMConfigStore } = await import('../../electron/channel/IMConfigStore')
    ;(IMConfigStore as any).instance = null
    const s1 = IMConfigStore.getInstance()

    s1.set('feishu', { appId: 'cli_test', appSecret: 'secret-value', enabled: true })

    const encPath = path.join(TEST_USER_DATA, 'im-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)

    const rawBuf = fs.readFileSync(encPath)
    const rawAsString = rawBuf.toString('utf-8')
    expect(rawAsString).not.toContain('secret-value')
    expect(rawAsString).not.toContain('feishu')
  })

  it('IMConfigStore loads correctly after encrypt + decrypt roundtrip', async () => {
    const { IMConfigStore } = await import('../../electron/channel/IMConfigStore')
    ;(IMConfigStore as any).instance = null
    const s1 = IMConfigStore.getInstance()
    s1.set('dingtalk', { appId: 'appid', appSecret: 'ding-secret', enabled: true })
    s1.set('slack', { botToken: 'xoxb-token', enabled: false })

    ;(IMConfigStore as any).instance = null
    const s2 = IMConfigStore.getInstance()
    expect(s2.list()).toHaveLength(2)
    expect(s2.get('dingtalk')?.appSecret).toBe('ding-secret')
    expect(s2.get('slack')?.botToken).toBe('xoxb-token')
  })

  it('IMConfigStore removes config', async () => {
    const { IMConfigStore } = await import('../../electron/channel/IMConfigStore')
    ;(IMConfigStore as any).instance = null
    const s = IMConfigStore.getInstance()
    s.set('feishu', { appId: 'cli_x', appSecret: 's', enabled: true })
    expect(s.remove('feishu')).toBe(true)
    expect(s.get('feishu')).toBeUndefined()
  })
})