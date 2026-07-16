import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-int-d2-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: {
      file: { resolvePathFn: () => {}, maxSize: 0, format: '', level: 'info' },
      console: { level: 'info', format: '' },
    },
  },
}))

describe('Integration: D2-Prime scaffold end-to-end', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SandboxBuilder.build returns ok with workspace and files written', async () => {
    const { SandboxBuilder } = await import('../../electron/sandbox/SandboxBuilder')
    const { WorkspaceManager } = await import('../../electron/sandbox/workspace')
    const builder = SandboxBuilder.getInstance()
    const ws = WorkspaceManager.getInstance().createWorkspace({ name: 'd2-prime-e2e' })
    const result = await builder.build({ prompt: '做一个 vite blog', workspaceName: ws.name })
    expect(result.ok).toBe(true)
    expect(result.workspace).toBeDefined()
    expect(result.fileCount).toBeGreaterThan(0)
    expect(result.template).toBeDefined()
  })

  it('explicit template selection wins over auto regex', async () => {
    const { SandboxBuilder } = await import('../../electron/sandbox/SandboxBuilder')
    const result = await SandboxBuilder.getInstance().build({
      prompt: '做一个 next 博客',
      templateId: 'vite-react-ts',
    })
    expect(result.templateReason).toBe('explicit')
    expect(result.template?.id).toBe('vite-react-ts')
  })

  it('SandboxBuilder selectTemplate nextjs prompt picks nextjs template', async () => {
    const { SandboxBuilder } = await import('../../electron/sandbox/SandboxBuilder')
    const sel = SandboxBuilder.getInstance().selectTemplate('做一个 nextjs 全栈项目')
    expect(sel.reason).toBe('auto-regex')
    expect(sel.template?.id).toBe('nextjs-app')
  })

  it('SandboxBuilder unsupported prompt defaults to vite-react-ts', async () => {
    const { SandboxBuilder } = await import('../../electron/sandbox/SandboxBuilder')
    const sel = SandboxBuilder.getInstance().selectTemplate('做点啥没提及任何模板')
    expect(sel.reason).toBe('default')
    expect(sel.template?.id).toBe('vite-react-ts')
  })
})
