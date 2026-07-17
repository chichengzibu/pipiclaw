import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-jr-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

vi.mock('node:child_process', () => {
  const fns: any = { execSync: vi.fn(), spawn: vi.fn() }
  return { default: fns, ...fns }
})

import { JupyterRunner } from '../../electron/sandbox/JupyterRunner'
import { execSync, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

describe('JupyterRunner', () => {
  let runner: JupyterRunner

  beforeEach(() => {
    vi.clearAllMocks()
    runner = JupyterRunner.getInstance()
    // 清空 kernel 状态避免跨 case 干扰
    for (const k of runner.listKernels()) runner.close(k.id)
  })

  it('getInstance returns singleton', () => {
    expect(JupyterRunner.getInstance()).toBe(runner)
  })

  it('isAvailable returns false when jupyter not found', () => {
    ;(execSync as any).mockImplementation(() => { throw new Error('not found') })
    const r = runner.isAvailable()
    expect(r.available).toBe(false)
  })

  it('isAvailable returns true with version when jupyter found', () => {
    ;(execSync as any).mockImplementation(() => 'jupyter core     : 4.6.3')
    const r = runner.isAvailable()
    expect(r.available).toBe(true)
    expect(r.version).toContain('jupyter')
  })

  it('startKernel allocates new kernel in idle state', () => {
    const k = runner.startKernel('ws-jr-1', 'python3')
    expect(k.status).toBe('idle')
    expect(k.language).toBe('python3')
    expect(k.id).toMatch(/^[a-f0-9]{8}$/)
  })

  it('executeCode on unknown kernel returns hasError=true', async () => {
    const r = await runner.executeCode('nope-kernel', 'print(1)')
    expect(r.ok).toBe(false)
    expect(r.hasError).toBe(true)
  })

  it('executeCode returns stub when jupyter unavailable', async () => {
    ;(runner as any).jupyterAvailable = false
    const k = runner.startKernel('ws-jr-2', 'python3')
    const r = await runner.executeCode(k.id, 'print(1)')
    expect(r.ok).toBe(true)
    expect(r.stub).toBe(true)
  })

  it('executeCode posts to jupyter server and parses response', async () => {
    ;(runner as any).jupyterAvailable = true
    ;(runner as any).serverUrl = 'http://127.0.0.1:18888'
    ;(global as any).fetch = vi.fn(async () => new Response(JSON.stringify({
      stdout: 'hello\n', stderr: '', hasError: false, executionCount: 1,
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const k = runner.startKernel('ws-jr-3', 'python3')
    const r = await runner.executeCode(k.id, 'print("hello")')
    expect(r.ok).toBe(true)
    expect(r.stdout).toBe('hello\n')
    expect(r.executionCount).toBe(1)
    expect(r.stub).toBe(false)
    delete (global as any).fetch
  })

  it('executeCode handles fetch error gracefully', async () => {
    ;(runner as any).jupyterAvailable = true
    ;(runner as any).serverUrl = 'http://127.0.0.1:18889'
    ;(global as any).fetch = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    const k = runner.startKernel('ws-jr-4', 'python3')
    const r = await runner.executeCode(k.id, 'bad code')
    expect(r.ok).toBe(false)
    expect(r.hasError).toBe(true)
    delete (global as any).fetch
  })

  it('close kernel marks status dead', () => {
    const k = runner.startKernel('ws-jr-5', 'python3')
    expect(runner.close(k.id)).toBe(true)
    expect(runner.getKernel(k.id)).toBeUndefined()
  })

  it('listKernels returns all active kernels', () => {
    runner.startKernel('ws-jr-6')
    runner.startKernel('ws-jr-7')
    expect(runner.listKernels().length).toBe(2)
  })
})