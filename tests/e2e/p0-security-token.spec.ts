/**
 * P0-Security Test 2: Token 鉴权 on OpenClawServer (port 18789)
 *
 * 漏洞背景 (后端审计 C2):
 *   改前: /execute 端点无任何鉴权, 任何能访问 127.0.0.1:18789 的进程都能跑任意 operation。
 *   改后: 启动时生成 256-bit 随机 token → safeStorage 加密存 userData/openclaw-token.json。
 *          非 /health 端点要求 Authorization: Bearer <token> 或 X-OpenClaw-Token: <token>。
 *
 * 期望 (基线 / 改前): 无 token POST /execute → 200 (洞)
 * 期望 (改后): 无 token → 401, 有 token → 200
 *
 * Token 获取: 通过 IPC `gateway:auth-token` (backend 暴露)。
 *   - baseline: preload 没暴露, 拿不到 → "有 token" test skip
 *   - 改后: 如果暴露, 跑 "有 token" test 200 验证
 */

import { test, expect } from '@playwright/test'
import { launchAndProbe, makeUserDataDir, safeRequest, fetchTokenFromMain } from './_p0-helpers'

const userDataDir = makeUserDataDir('token')

test.describe('P0 Security: Token 鉴权 (18789)', () => {
  let app: import('@playwright/test').ElectronApplication
  let win: import('@playwright/test').Page
  let gatewayPort: number
  let token: string | null = null

  test.beforeAll(async () => {
    const r = await launchAndProbe(userDataDir)
    app = r.app
    win = r.win
    gatewayPort = r.gatewayPort

    // 尝试通过 IPC 拿 token — 后端改后应暴露 `gateway:auth-token`
    try {
      const t = await win.evaluate(async () => {
        // 1) 优先: 试探 electronAPI.openclaw.* 有没有 getAuthToken / token
        const api: any = (window as any).electronAPI
        const candidates = [
          () => api?.openclaw?.getAuthToken?.(),
          () => api?.openclaw?.getToken?.(),
          () => api?.gateway?.getAuthToken?.(),
          () => api?.getAuthToken?.(),
        ]
        for (const c of candidates) {
          try {
            const r = await c()
            if (r?.success && r?.data?.token) return r.data.token
            if (typeof r === 'string' && r.length > 0) return r
          } catch {}
        }
        return null
      })
      token = t
    } catch (e) {
      console.log(`  token IPC probe failed: ${e}`)
    }

    // 2) fallback: 通过主进程 app.evaluate 拿 OpenClawServer.getAuthToken()
    if (!token) {
      token = await fetchTokenFromMain(app)
    }
    console.log(`  token: ${token ? token.slice(0, 8) + '...' : 'null (3 个 test 中 2/3 将 skip)'}`)
  }, { timeout: 60_000 })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
  })

  test('无 token POST /execute 应被 401 UNAUTHORIZED', async () => {
    const r = await safeRequest(`http://127.0.0.1:${gatewayPort}/execute`, {
      method: 'POST',
      headers: {
        'Origin': 'http://127.0.0.1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'list_directory',
        params: { path: '.' },
        timestamp: Date.now(),
      }),
      timeoutMs: 3000,
    })
    console.log(`  no-token POST /execute status=${r.status}, body=${r.body.slice(0, 200)}`)
    // 改前: 200 (洞)
    // 改后: 401 UNAUTHORIZED
    expect(r.status, '无 token POST /execute 应被 401').toBe(401)
    // 也可断言 errorCode 是 UNAUTHORIZED
    if (r.body) {
      try {
        const j = JSON.parse(r.body)
        if (j.errorCode) {
          expect(j.errorCode, 'errorCode 应是 UNAUTHORIZED').toBe('UNAUTHORIZED')
        }
      } catch {}
    }
  })

  test('有 token POST /execute 应 200 (仅在 backend 暴露 token IPC 时跑)', async () => {
    test.skip(!token, 'backend 尚未通过 IPC 暴露 token, 跳过 "有 token 200" 测试')

    const r = await safeRequest(`http://127.0.0.1:${gatewayPort}/execute`, {
      method: 'POST',
      headers: {
        'Origin': 'http://127.0.0.1',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        operation: 'list_directory',
        params: { path: '.' },
        timestamp: Date.now(),
      }),
      timeoutMs: 5000,
    })
    console.log(`  with-token POST /execute status=${r.status}, body=${r.body.slice(0, 200)}`)
    expect([200, 500], '有 token 应到达 gateway 业务层 (200 成功 或 500 业务错误)').toContain(r.status)
  })

  test('错误 token POST /execute 应 401', async () => {
    test.skip(!token, 'backend 尚未通过 IPC 暴露 token, 跳过 "错误 token" 测试')

    const r = await safeRequest(`http://127.0.0.1:${gatewayPort}/execute`, {
      method: 'POST',
      headers: {
        'Origin': 'http://127.0.0.1',
        'Content-Type': 'application/json',
        'X-OpenClaw-Token': 'wrong-token-xxxxxx',
      },
      body: JSON.stringify({
        operation: 'list_directory',
        params: { path: '.' },
        timestamp: Date.now(),
      }),
      timeoutMs: 3000,
    })
    console.log(`  wrong-token POST /execute status=${r.status}`)
    expect(r.status, '错误 token 应 401').toBe(401)
  })
})
