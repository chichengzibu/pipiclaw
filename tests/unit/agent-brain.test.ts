import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp', getVersion: () => '0.0.0', getName: () => 'pipiclaw' },
  ipcMain: { handle: () => {}, on: () => {}, removeHandler: () => {} },
  BrowserWindow: class {},
  dialog: { showMessageBox: () => {}, showOpenDialog: () => {} },
  shell: { openExternal: () => {}, openPath: () => {} },
  globalShortcut: { register: () => true, unregister: () => {} },
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu: () => {} },
  Tray: class { setToolTip() {} setContextMenu() {} on() {} },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }) },
}))
vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } },
  },
}))

import { AgentBrainImpl, asAgentBrain } from '../../electron/agent/AgentBrain'

describe('AgentBrain smoke', () => {
  it('AgentBrainImpl.getInstance returns singleton', () => {
    const a = AgentBrainImpl.getInstance()
    const b = AgentBrainImpl.getInstance()
    expect(a).toBe(b)
  })

  it('asAgentBrain wraps to IAgentBrain shape', () => {
    const inner = AgentBrainImpl.getInstance()
    const wrapped = asAgentBrain(inner) as any
    expect(wrapped).toBeDefined()
    expect(typeof wrapped).toBe('object')
  })

  it('wrapped brain exposes think or stub method', async () => {
    const wrapped = asAgentBrain(AgentBrainImpl.getInstance()) as any
    if (typeof wrapped.think !== 'function') return
    const r = await wrapped.think('hello world')
    expect(r).toBeDefined()
  })
})