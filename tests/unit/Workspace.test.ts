import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-ws-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { WorkspaceManager } from '../../electron/sandbox/workspace'

describe('WorkspaceManager', () => {
  let wm: WorkspaceManager

  beforeEach(() => {
    vi.clearAllMocks()
    wm = WorkspaceManager.getInstance()
  })

  it('getInstance returns singleton', () => {
    expect(WorkspaceManager.getInstance()).toBe(wm)
  })

  it('createWorkspace returns a workspace with id and hostPath', () => {
    const ws = wm.createWorkspace({ name: 'project-1' })
    expect(ws.id).toBeTruthy()
    expect(ws.hostPath).toContain(ws.id)
    expect(ws.containerPath).toBe('/mnt/data')
  })

  it('createWorkspace creates host directory on disk', () => {
    const ws = wm.createWorkspace({ name: 'check-fs' })
    expect(fs.existsSync(ws.hostPath)).toBe(true)
  })

  it('getWorkspace returns existing workspace', () => {
    const ws = wm.createWorkspace({ name: 'lookup' })
    const got = wm.getWorkspace(ws.id)
    expect(got?.id).toBe(ws.id)
  })

  it('getWorkspace returns undefined for unknown id', () => {
    expect(wm.getWorkspace('nonexistent')).toBeUndefined()
  })

  it('listWorkspaces returns workspaces sorted by createdAt desc', () => {
    const a = wm.createWorkspace({ name: 'first' })
    const b = wm.createWorkspace({ name: 'second' })
    const list = wm.listWorkspaces()
    expect(list[0].id).toBe(b.id)
    expect(list[1].id).toBe(a.id)
  })

  it('deleteWorkspace removes it from list', () => {
    const ws = wm.createWorkspace({ name: 'to-delete' })
    const ok = wm.deleteWorkspace(ws.id)
    expect(ok).toBe(true)
    expect(wm.getWorkspace(ws.id)).toBeUndefined()
  })

  it('hostToContainer returns /mnt/data', () => {
    const ws = wm.createWorkspace({ name: 'h2c' })
    const cp = wm.hostToContainer(ws.id, '/some/file')
    expect(cp).toBe('/mnt/data/some/file')
  })

  it('containerToHost returns the workspace hostPath', () => {
    const ws = wm.createWorkspace({ name: 'c2h' })
    const hp = wm.containerToHost(ws.id, '/mnt/data/file.txt')
    expect(hp).toBe(path.join(ws.hostPath, 'file.txt'))
  })
})
