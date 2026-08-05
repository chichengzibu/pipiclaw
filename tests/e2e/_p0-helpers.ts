/**
 * P0-Security e2e 测试公共 helpers
 */
import { _electron as electron, type ElectronApplication } from '@playwright/test'
import path from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'

const repoRoot = path.resolve(__dirname, '..', '..')
const mainEntry = path.join(repoRoot, 'dist-electron', 'main.js')

/** 给定 spec 名字, 生成 fresh userData 目录, 避免跨 spec 污染 */
export function makeUserDataDir(tag: string): string {
  return mkdtempSync(join(tmpdir(), `pipiclaw-p0-${tag}-`))
}

/** 用 node http.request 测 server, 不抛错, 返回 {status, headers, body} */
export function safeRequest(urlStr: string, opts: {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
} = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve) => {
    let url: URL
    try {
      url = new URL(urlStr)
    } catch (e) {
      resolve({ status: 0, headers: {}, body: 'URL_PARSE: ' + String(e) })
      return
    }
    const req = http.request({
      method: opts.method ?? 'GET',
      hostname: url.hostname,
      port: Number(url.port),
      path: url.pathname + url.search,
      headers: { Connection: 'close', ...(opts.headers || {}) },
      timeout: opts.timeoutMs ?? 2000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf-8'),
      }))
    })
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: 'REQ_ERROR: ' + (e.code ?? e.message) }))
    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

/** 探测 OpenClawServer 真实端口 (18789 可能被 svchost 占, fallback 到 18790+) */
export async function probeGateway(): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < 20_000) {
    for (let p = 18789; p <= 18899; p++) {
      const r = await safeRequest(`http://127.0.0.1:${p}/health`, { timeoutMs: 500 })
      if (r.status === 200) {
        try {
          const j = JSON.parse(r.body)
          if (j?.success && j?.data?.status === 'ok') {
            return p
          }
        } catch {}
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('OpenClawServer 20s 内未在 18789-18899 找到健康端点')
}

/**
 * 启动 fresh Electron 并探测 OpenClawServer 端口。
 * 包含 env 注入 (PIPICLAW_E2E=1 强制 prod 路径)。
 */
export async function launchAndProbe(userDataDir: string, extraEnv: Record<string, string> = {}): Promise<{ app: ElectronApplication; win: import('@playwright/test').Page; gatewayPort: number }> {
  const app = await electron.launch({
    // args 顺序: Electron 自身开关 → main entry
    args: [`--user-data-dir=${userDataDir}`, '--no-sandbox', mainEntry],
    cwd: repoRoot,
    userDataDir,
    env: { ...process.env, PIPICLAW_E2E: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: '1', ...extraEnv },
    timeout: 30_000,
  })
  const win = await app.firstWindow({ timeout: 30_000 })
  await win.waitForLoadState('domcontentloaded')
  await win.waitForSelector('#app', { timeout: 15_000 })
  const gatewayPort = await probeGateway()
  return { app, win, gatewayPort }
}

/**
 * 从主进程 (esbuild bundled main.js) 拿 OpenClawServer 鉴权 token。
 * esbuild 把 OpenClawServer 编译为顶层 const `_OpenClawServer`, evaluate 跑在 main.js scope 共享。
 */
export async function fetchTokenFromMain(app: ElectronApplication): Promise<string | null> {
  try {
    return await app.evaluate((): string | null => {
      // @ts-ignore
      const Cls = (typeof _OpenClawServer !== 'undefined') ? _OpenClawServer : null
      if (Cls && typeof Cls.getInstance === 'function') {
        const inst = Cls.getInstance()
        if (inst && typeof inst.getAuthToken === 'function') {
          return inst.getAuthToken()
        }
      }
      return null
    })
  } catch (e) {
    console.log(`  fetchTokenFromMain failed: ${e}`)
    return null
  }
}
