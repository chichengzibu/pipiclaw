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

import { CapabilityRegistry } from '../../electron/contracts/CapabilityRegistry'

describe('CapabilityRegistry smoke', () => {
  it('singleton returns same instance', () => {
    const a = CapabilityRegistry.getInstance()
    const b = CapabilityRegistry.getInstance()
    expect(a).toBe(b)
  })

  it('register a domain and resolve its capability', () => {
    const reg = CapabilityRegistry.getInstance()
    reg.register({
      id: 'smoke.dom',
      name: 'Smoke',
      version: '0.0.1',
      capabilities: [{ id: 'smoke.cap', name: 'cap', version: '0.0.1' }],
    } as any)
    const cap = reg.resolve('smoke.cap')
    expect(cap).toBeDefined()
    expect((cap as any).id).toBe('smoke.cap')
  })

  it('listDomains returns registered domains', () => {
    const reg = CapabilityRegistry.getInstance()
    reg.register({
      id: 'smoke.list.dom',
      name: 'L',
      version: '1',
      capabilities: [{ id: 'smoke.list.cap', name: 'c', version: '1' }],
    } as any)
    const domains = reg.listDomains() as any[]
    const ids = domains.map((d) => d.id)
    expect(ids).toContain('smoke.list.dom')
  })
})