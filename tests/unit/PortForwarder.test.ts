import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-pf-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { PortForwarder } from '../../electron/sandbox/PortForwarder'

describe('PortForwarder', () => {
  let pf: PortForwarder

  beforeEach(() => {
    vi.clearAllMocks()
    pf = PortForwarder.getInstance()
  })

  it('getInstance returns singleton', () => {
    expect(PortForwarder.getInstance()).toBe(pf)
  })

  it('forwardPort returns ok with entry', () => {
    const r = pf.forwardPort(3000, 'ws-1')
    expect(r.ok).toBe(true)
    expect(r.entry?.containerPort).toBe(3000)
    expect(r.entry?.hostPort).toBeGreaterThan(0)
    expect(r.entry?.url).toMatch(/^http:\/\/localhost:\d+$/)
    expect(r.entry?.workspaceId).toBe('ws-1')
  })

  it('forwardPort allocates distinct host ports', () => {
    const a = pf.forwardPort(3000)
    const b = pf.forwardPort(3001)
    expect(a.entry?.hostPort).not.toBe(b.entry?.hostPort)
  })

  it('listForwarded returns all entries', () => {
    pf.forwardPort(3000)
    pf.forwardPort(5173)
    const all = pf.listForwarded()
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  it('getForward returns existing entry by id', () => {
    const r = pf.forwardPort(8080)
    const got = pf.getForward(r.entry!.id)
    expect(got?.id).toBe(r.entry!.id)
  })

  it('getForward returns undefined for unknown id', () => {
    const got = pf.getForward('nonexistent')
    expect(got).toBeUndefined()
  })

  it('closeForward removes entry from list', () => {
    const r = pf.forwardPort(9000)
    const ok = pf.closeForward(r.entry!.id)
    expect(ok).toBe(true)
    expect(pf.getForward(r.entry!.id)).toBeUndefined()
  })

  it('proxyRequest forwards via real fetch with mocked target', async () => {
    // mock global fetch,目标服务返回 200 + html
    const fetchMock = vi.fn(async () => new Response('<html><body>real target</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    ;(global as any).fetch = fetchMock
    const r = pf.forwardPort(5500, 'ws-proxy-1')
    expect(r.ok).toBe(true)
    const pr = await pf.proxyRequest(r.entry!.id, { method: 'GET', url: '/index', headers: {} })
    expect(pr.statusCode).toBe(200)
    expect(pr.body).toContain('real target')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const called = fetchMock.mock.calls[0][0] as string
    expect(called).toMatch(/^http:\/\/localhost:\d+\/index$/)
    delete (global as any).fetch
  })

  it('proxyRequest returns 502 when target fetch throws', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    ;(global as any).fetch = fetchMock
    const r = pf.forwardPort(5501, 'ws-proxy-2')
    const pr = await pf.proxyRequest(r.entry!.id, { method: 'GET', url: '/', headers: {} })
    expect(pr.statusCode).toBe(502)
    expect(pr.body).toContain('proxy error')
    delete (global as any).fetch
  })
})
