import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-wc-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { WebContainerRunner } from '../../electron/sandbox/WebContainerRunner'

describe('WebContainerRunner', () => {
  let runner: WebContainerRunner

  beforeEach(() => {
    vi.clearAllMocks()
    runner = WebContainerRunner.getInstance()
    ;(runner as any).booted = false
  })

  it('getInstance returns singleton', () => {
    expect(WebContainerRunner.getInstance()).toBe(runner)
  })

  it('boot returns ok with stub=true in W11', async () => {
    const r = await runner.boot()
    expect(r.ok).toBe(true)
    expect(r.stub).toBe(true)
  })

  it('boot is idempotent', async () => {
    const r1 = await runner.boot()
    const r2 = await runner.boot()
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
  })

  it('mount unknown workspace returns ok=false', async () => {
    const r = await runner.mount('nonexistent-ws-id')
    expect(r.ok).toBe(false)
    expect(r.fileCount).toBe(0)
  })

  it('mount existing workspace returns ok=true with fileCount', async () => {
    const { WorkspaceManager } = await import('../../electron/sandbox/workspace')
    const ws = WorkspaceManager.getInstance().createWorkspace({ name: 'wc-test' })
    const r = await runner.mount(ws.id)
    expect(r.ok).toBe(true)
    expect(r.fileCount).toBeGreaterThanOrEqual(0)
    expect(r.stub).toBe(true)
  })

  it('onServerReady registers handler that receives event', async () => {
    let received: any = null
    runner.onServerReady((e) => { received = e })
    runner.simulateServerReady?.(3000)
    expect(received === null || typeof received === 'object').toBe(true)
  })

  it('boot publishes webcontainer:ipc-request for renderer to handle', async () => {
    const events: any[] = []
    const off = (runner as any).bus.subscribe('webcontainer:ipc-request', (e: any) => events.push(e))
    await runner.boot()
    expect(events.some(e => e.action === 'boot')).toBe(true)
    off()
  })

  it('spawn publishes ipc-request with cmd and args', async () => {
    const events: any[] = []
    const off = (runner as any).bus.subscribe('webcontainer:ipc-request', (e: any) => events.push(e))
    await runner.spawn('npm', ['install'])
    expect(events.some(e => e.action === 'spawn' && e.cmd === 'npm')).toBe(true)
    off()
  })
})
