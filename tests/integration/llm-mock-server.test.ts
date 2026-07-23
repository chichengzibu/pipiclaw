import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((k: string) => `/tmp/pipiclaw-llm-mock-${k}`),
    getName: () => 'pipiclaw',
    getVersion: () => '0.0.0',
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((s: string) => Buffer.from(s, 'utf-8')),
    decryptString: vi.fn((b: Buffer) => b.toString('utf-8')),
  },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P1-T1.4: LLM 真实链路验证(用 mock LLM server)
 *
 * 验收:
 *   - 起 mock LLM server(OpenAI chat/completions 兼容)
 *   - 配置 LlmConfigStore(apiBaseUrl 指向 mock)
 *   - 调 LlmClient.chat() 真实走 fetch
 *   - 验证响应是 mock 生成的(不是 stub)
 *
 * 用途:
 *   - 证明 LLM 链路真通了(不是 "ok-openai" 这种 mock adapter)
 *   - 不依赖外网 / API key
 *   - CI 默认跑(< 5s)
 */

const MOCK_PORT = 9999
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}/v1`
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SERVER_SCRIPT = path.join(REPO_ROOT, 'scripts', 'mock-llm-server.mjs')

let serverProcess: ChildProcess | null = null
let serverReady = false

async function waitForServer(maxMs = 8000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${MOCK_PORT}/health`)
      if (res.ok) {
        serverReady = true
        return
      }
    } catch {
      // server not yet accepting
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`mock LLM server did not become ready within ${maxMs}ms`)
}

describe('P1-T1.4: LLM real-use with mock server', () => {
  beforeAll(async () => {
    // 启动 mock LLM server(后台)
    serverProcess = spawn('node', [SERVER_SCRIPT, String(MOCK_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })
    serverProcess.stdout?.on('data', (d) => {
      const s = d.toString()
      if (s.includes('listening on')) {
        serverReady = true
      }
    })
    serverProcess.stderr?.on('data', (d) => {
      console.error(`[mock-llm stderr] ${d.toString().trim()}`)
    })
    await waitForServer()
  }, 15_000)

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
      await new Promise<void>((r) => {
        serverProcess!.on('exit', () => r())
        setTimeout(() => r(), 2000)
      })
    }
  })

  beforeEach(() => {
    // 清掉 userData 防止跨测试污染
    const tmpRoot = '/tmp/pipiclaw-llm-mock-userData'
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
    // 清掉 LlmClient 单例
    serverReady = true
  })

  it('mock server /health returns ok', async () => {
    expect(serverReady).toBe(true)
    const res = await fetch(`http://127.0.0.1:${MOCK_PORT}/health`)
    expect(res.ok).toBe(true)
    const body = (await res.json()) as { status: string; requestCount: number }
    expect(body.status).toBe('ok')
  })

  it('mock server /v1/chat/completions returns OpenAI-compatible response', async () => {
    const res = await fetch(`http://127.0.0.1:${MOCK_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-mock' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello mock' }],
      }),
    })
    expect(res.ok).toBe(true)
    const body = (await res.json()) as { choices: Array<{ message: { content: string } }> }
    expect(body.choices[0].message.content).toMatch(/MOCK_LLM_OK_\d+_WITH_INPUT/)
  })

  it('LlmClient.chat() with mock apiBaseUrl returns mock-generated content (real round-trip)', async () => {
    // 动态 import 确保 vi.mock('electron') 先生效
    const { LlmClient } = await import('../../electron/llm/LlmClient')
    const { LlmConfigStore } = await import('../../electron/llm/LlmConfigStore')
    ;(LlmClient as unknown as { instance: unknown }).instance = null
    ;(LlmConfigStore as unknown as { instance: unknown }).instance = null

    const store = LlmConfigStore.getInstance()
    store.set('openai', {
      apiKey: 'sk-mock-fake',
      enabled: true,
      apiBaseUrl: MOCK_URL,
    })

    const client = LlmClient.getInstance()
    const res = await client.chat({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: '列出当前目录文件' }],
      provider: 'openai',
    })

    expect(res.ok).toBe(true)
    expect(res.provider).toBe('openai')
    expect(res.content).toMatch(/MOCK_LLM_OK_\d+_WITH_INPUT/)
    expect(res.content).toContain('列出当前目录文件')
    expect(res.durationMs).toBeGreaterThan(0)
  })

  it('LlmClient.chat() with non-existent URL returns ok=false with network error', async () => {
    const { LlmClient } = await import('../../electron/llm/LlmClient')
    const { LlmConfigStore } = await import('../../electron/llm/LlmConfigStore')
    ;(LlmClient as unknown as { instance: unknown }).instance = null
    ;(LlmConfigStore as unknown as { instance: unknown }).instance = null

    const store = LlmConfigStore.getInstance()
    store.set('openai', {
      apiKey: 'sk-mock',
      enabled: true,
      apiBaseUrl: 'http://127.0.0.1:1/v1', // 端口 1 几乎肯定无服务
    })

    const client = LlmClient.getInstance()
    const res = await client.chat({
      model: 'gpt',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
    })

    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
  })
})
