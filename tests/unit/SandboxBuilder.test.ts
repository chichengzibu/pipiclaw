import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-builder-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { SandboxBuilder } from '../../electron/sandbox/SandboxBuilder'

describe('SandboxBuilder', () => {
  let builder: SandboxBuilder

  beforeEach(() => {
    vi.clearAllMocks()
    builder = SandboxBuilder.getInstance()
  })

  it('getInstance returns singleton', () => {
    expect(SandboxBuilder.getInstance()).toBe(builder)
  })

  it('selectTemplate with explicit id returns reason explicit', () => {
    const sel = builder.selectTemplate('做点啥', 'vite-react-ts')
    expect(sel.reason).toBe('explicit')
    expect(sel.template?.id).toBe('vite-react-ts')
  })

  it('selectTemplate with prompt matching regex returns auto-regex', () => {
    const sel = builder.selectTemplate('做一个 nextjs 博客')
    expect(sel.reason).toBe('auto-regex')
  })

  it('selectTemplate with no match returns default vite-react-ts', () => {
    const sel = builder.selectTemplate('一段无法匹配的描述')
    expect(sel.reason).toBe('default')
    expect(sel.template?.id).toBe('vite-react-ts')
  })

  it('selectTemplate with unknown explicit id falls through to default', () => {
    const sel = builder.selectTemplate('随便', 'nonexistent-template' as any)
    expect(sel.reason).toBe('default')
  })

  it('selectTemplate fastapi trigger', () => {
    const sel = builder.selectTemplate('写一个 fastapi 后端')
    expect(sel.reason).toBe('auto-regex')
    expect(sel.template?.id).toBe('fastapi')
  })

  it('build with explicit template returns ok with fileCount > 0', async () => {
    const result = await builder.build({ prompt: 'test', templateId: 'vite-react-ts' })
    expect(result.ok).toBe(true)
    expect(result.template?.id).toBe('vite-react-ts')
    expect(result.fileCount).toBeGreaterThan(0)
    expect(result.workspace).toBeDefined()
  })
})
