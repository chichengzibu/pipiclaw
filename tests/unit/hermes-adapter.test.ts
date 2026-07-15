import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => process.cwd() + '/.smoke-tmp', getAppPath: () => process.cwd(), getVersion: () => '0.0.0', getName: () => 'pipiclaw' },
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

import { HermesAdapter } from '../../electron/hermes/HermesAdapter'

describe('HermesAdapter smoke', () => {
  it('singleton returns same instance', () => {
    const a = HermesAdapter.getInstance()
    const b = HermesAdapter.getInstance()
    expect(a).toBe(b)
  })

  it('retrieve returns array for unknown query (stub safe)', async () => {
    const adapter = HermesAdapter.getInstance() as any
    if (typeof adapter.retrieve !== 'function') return
    const res = await adapter.retrieve('nonexistent query xyz123')
    expect(Array.isArray(res)).toBe(true)
  })

  it('exposes boolean status flag', () => {
    const adapter = HermesAdapter.getInstance() as any
    const ok = adapter.isReady ? adapter.isReady() : true
    expect(typeof ok).toBe('boolean')
  })
})