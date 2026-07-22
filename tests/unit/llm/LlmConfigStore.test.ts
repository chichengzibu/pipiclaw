import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const TEST_USER_DATA = '/tmp/pipiclaw-llmconfig-test'

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
      decryptString: vi.fn((buf: Buffer) => xorTransform(buf).toString('utf-8')),
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

async function freshStore() {
  const { LlmConfigStore } = await import('../../../electron/llm/LlmConfigStore')
  ;(LlmConfigStore as any).instance = null
  return LlmConfigStore.getInstance()
}

describe('LlmConfigStore', () => {
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

  it('getInstance returns singleton', async () => {
    const { LlmConfigStore } = await import('../../../electron/llm/LlmConfigStore')
    ;(LlmConfigStore as any).instance = null
    const a = LlmConfigStore.getInstance()
    const b = LlmConfigStore.getInstance()
    expect(a).toBe(b)
  })

  it('set creates a new entry with provider defaults', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-test', enabled: true })
    const got = s.get('openai')
    expect(got).toBeDefined()
    expect(got?.provider).toBe('openai')
    expect(got?.apiKey).toBe('sk-test')
    expect(got?.enabled).toBe(true)
    expect(typeof got?.updatedAt).toBe('number')
  })

  it('set merges patch into existing config without losing fields', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-1', enabled: true, defaultModel: 'gpt-4o' })
    s.set('openai', { apiKey: 'sk-2' })
    const got = s.get('openai')
    expect(got?.apiKey).toBe('sk-2')
    expect(got?.enabled).toBe(true)
    expect(got?.defaultModel).toBe('gpt-4o')
  })

  it('list returns all configured providers', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-1', enabled: true })
    s.set('anthropic', { apiKey: 'sk-ant', enabled: false })
    s.set('zhipu', { apiKey: 'zhipu-key', enabled: true })
    expect(s.list()).toHaveLength(3)
  })

  it('getActive returns first enabled provider with apiKey', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-1', enabled: false })
    s.set('anthropic', { apiKey: 'sk-ant', enabled: true })
    s.set('zhipu', { apiKey: 'zhipu-key', enabled: true })
    const active = s.getActive()
    expect(active?.provider).toBe('anthropic')
  })

  it('getActive ignores providers without apiKey even if enabled', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: '', enabled: true })
    s.set('anthropic', { apiKey: 'sk-ant', enabled: true })
    const active = s.getActive()
    expect(active?.provider).toBe('anthropic')
  })

  it('getActive returns undefined when nothing is enabled', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-1', enabled: false })
    expect(s.getActive()).toBeUndefined()
  })

  it('remove deletes config and persists; returns true on hit, false on miss', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-1', enabled: true })
    expect(s.remove('openai')).toBe(true)
    expect(s.get('openai')).toBeUndefined()
    expect(s.remove('openai')).toBe(false)
  })

  it('persists encrypted JSON to disk under userData', async () => {
    const s = await freshStore()
    s.set('openai', { apiKey: 'sk-persist', enabled: true })
    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)
    const raw = fs.readFileSync(encPath, 'utf-8')
    expect(raw).not.toContain('sk-persist')
    expect(raw).not.toContain('openai')
  })

  it('loads previously persisted configs on second instantiation', async () => {
    const s1 = await freshStore()
    s1.set('anthropic', { apiKey: 'sk-ant-2', enabled: true })
    s1.set('zhipu', { apiKey: 'zhipu-2', enabled: false })

    const s2 = await freshStore()
    expect(s2.list()).toHaveLength(2)
    expect(s2.get('anthropic')?.apiKey).toBe('sk-ant-2')
    expect(s2.get('zhipu')?.enabled).toBe(false)
  })

  it('falls back to plain JSON when safeStorage unavailable', async () => {
    const electron = await import('electron')
    ;(electron.safeStorage.isEncryptionAvailable as any).mockReturnValue(false)

    const s = await freshStore()
    s.set('openai', { apiKey: 'plain-key', enabled: true })

    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)
    const raw = fs.readFileSync(encPath, 'utf-8')
    expect(raw).toContain('plain-key')

    ;(electron.safeStorage.isEncryptionAvailable as any).mockReturnValue(true)
  })

  it('migrates legacy plaintext file to encrypted storage', async () => {
    const legacyPath = path.join(TEST_USER_DATA, 'llm-config.json')
    fs.mkdirSync(TEST_USER_DATA, { recursive: true })
    const legacy = [
      { provider: 'openai' as const, apiKey: 'legacy-key', enabled: true, updatedAt: 100 },
    ]
    fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2))

    const s = await freshStore()
    expect(s.get('openai')?.apiKey).toBe('legacy-key')
    expect(fs.existsSync(legacyPath)).toBe(false)
    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    expect(fs.existsSync(encPath)).toBe(true)
  })

  it('handles missing legacy file gracefully (no crash)', async () => {
    const s = await freshStore()
    expect(s.list()).toHaveLength(0)
    expect(s.getActive()).toBeUndefined()
  })

  it('corrupted file does not crash and results in empty config', async () => {
    fs.mkdirSync(TEST_USER_DATA, { recursive: true })
    const encPath = path.join(TEST_USER_DATA, 'llm-config.json.enc')
    fs.writeFileSync(encPath, Buffer.from('not-valid-encrypted-bytes'))

    const s = await freshStore()
    expect(s.list()).toHaveLength(0)
  })

  it('storePath is under userData/llm-config.json.enc', async () => {
    const s = await freshStore()
    expect((s as any).storePath).toBe(path.join(TEST_USER_DATA, 'llm-config.json.enc'))
  })
})