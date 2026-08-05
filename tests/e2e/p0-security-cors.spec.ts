/**
 * P0-Security Test 1: CORS hardening on OpenClawServer (port 18789)
 *
 * 漏洞背景 (后端审计 C2):
 *   electron/openclaw/OpenClawServer.ts
 *     改前: res.setHeader('Access-Control-Allow-Origin', '*')
 *     含义: 任意 Origin 跨域调 127.0.0.1:18789 + 无 token = 同机 RCE。
 *   改后: ACAO 默认拒绝 (白名单 only), 跨域 origin 不在白名单返回 403 CORS_DENIED。
 *
 * 期望 (基线 / 改前): ACAO === '*' → 断言 fail
 * 期望 (改后): ACAO !== '*' (白名单或拒绝) → 断言 pass
 *
 * 设计: spec 进程 (node) 直接 http.request 测 18789 server。
 *       Electron 启动只为触发 OpenClawServer 监听 18789 (fallback 到 18790+ if 18789 占)。
 */

import { test, expect } from '@playwright/test'
import { launchAndProbe, makeUserDataDir, safeRequest } from './_p0-helpers'

const userDataDir = makeUserDataDir('cors')

test.describe('P0 Security: CORS hardening (18789)', () => {
  let app: import('@playwright/test').ElectronApplication
  let gatewayPort: number

  test.beforeAll(async () => {
    const r = await launchAndProbe(userDataDir)
    app = r.app
    gatewayPort = r.gatewayPort
  }, { timeout: 60_000 })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
  })

  test('GET /health 不应该回 Access-Control-Allow-Origin: * (改前是 *, 改后应不带 / 回声 origin / 拒绝)', async () => {
    // 同源 (无 Origin): 应 200
    const r1 = await safeRequest(`http://127.0.0.1:${gatewayPort}/health`, { timeoutMs: 3000 })
    expect(r1.status, '/health 同源应 200').toBe(200)

    // 跨域 (Origin: evil.com): 改前 200 + ACAO=*, 改后 403 或 200-without-wildcard
    const r2 = await safeRequest(`http://127.0.0.1:${gatewayPort}/health`, {
      method: 'GET',
      headers: { 'Origin': 'http://evil.com' },
      timeoutMs: 3000,
    })
    const acao = (r2.headers['access-control-allow-origin'] as string | undefined) ?? null
    console.log(`  cross-origin status=${r2.status}, ACAO=${JSON.stringify(acao)}`)
    if (r2.status === 200) {
      expect(acao, 'ACAO 不应等于 "*"').not.toBe('*')
    } else {
      expect([401, 403, 404]).toContain(r2.status)
    }
  })

  test('OPTIONS 跨域预检不应默认通过 (且 ACAO 不为 *)', async () => {
    const r = await safeRequest(`http://127.0.0.1:${gatewayPort}/execute`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://evil.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
      timeoutMs: 3000,
    })
    const acao = (r.headers['access-control-allow-origin'] as string | undefined) ?? null
    const acam = (r.headers['access-control-allow-methods'] as string | undefined) ?? null
    console.log(`  OPTIONS status=${r.status}, ACAO=${JSON.stringify(acao)}, ACAM=${JSON.stringify(acam)}`)

    if (r.status === 200) {
      expect(acao, 'OPTIONS 200 时 ACAO 不应为 "*"').not.toBe('*')
      if (acam) {
        expect(String(acam).includes('*'), 'ACAM 不应包含通配').toBe(false)
      }
    } else {
      expect([401, 403, 404]).toContain(r.status)
    }
  })

  test('POST /execute 不带 token 应被 401/403 (无 token 即使 CORS 放开也不能调通)', async () => {
    const r = await safeRequest(`http://127.0.0.1:${gatewayPort}/execute`, {
      method: 'POST',
      headers: {
        'Origin': 'http://evil.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'list_directory',
        params: { path: 'C:/Users' },
        timestamp: Date.now(),
      }),
      timeoutMs: 3000,
    })
    console.log(`  POST /execute status=${r.status}, body=${r.body.slice(0, 200)}`)
    // 改前: 200 (CORS * + 无 token = 全通)
    // 改后: 401/403 (token 缺失, 即使 CORS 放开也不能调通)
    expect([401, 403]).toContain(r.status)
  })
})
