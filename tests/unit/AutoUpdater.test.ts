import { describe, it, expect, vi, beforeEach } from 'vitest'

const { autoUpdaterListeners, ipcHandlers, appGetVersionMock, dialogShowMessageBox, webContentsSend, windowIsDestroyed } = vi.hoisted(() => {
  const listeners: Record<string, Array<(arg: any) => void>> = {}
  const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
  const appGetVersionMock = vi.fn(() => '2.0.3')
  const dialogShowMessageBox = vi.fn().mockResolvedValue({ response: 0 })
  const webContentsSend = vi.fn()
  const windowIsDestroyed = vi.fn(() => false)
  return { autoUpdaterListeners: listeners, ipcHandlers: handlers, appGetVersionMock, dialogShowMessageBox, webContentsSend, windowIsDestroyed }
})

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn((event: string, listener: (arg: any) => void) => {
      if (!autoUpdaterListeners[event]) autoUpdaterListeners[event] = []
      autoUpdaterListeners[event].push(listener)
    }),
    checkForUpdates: vi.fn().mockResolvedValue({ updateInfo: { version: '2.1.0' } }),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: true,
  },
}))

vi.mock('electron', () => ({
  app: { getVersion: appGetVersionMock },
  ipcMain: {
    handle: vi.fn((channel: string, handler: any) => {
      ipcHandlers[channel] = handler
    }),
  },
  BrowserWindow: {},
  dialog: { showMessageBox: dialogShowMessageBox },
}))

vi.mock('../../electron/core/LogManager', () => ({
  LogManager: {
    getInstance: () => ({
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    }),
  },
}))

import { AutoUpdater } from '../../electron/core/AutoUpdater'

function makeMockWindow(): any {
  return {
    isDestroyed: windowIsDestroyed,
    webContents: { send: webContentsSend },
  }
}

function getListener(event: string) {
  const arr = autoUpdaterListeners[event] || []
  if (arr.length === 0) throw new Error(`no listener registered for ${event}`)
  return arr[arr.length - 1]
}

describe('AutoUpdater', () => {
  beforeEach(() => {
    Object.keys(autoUpdaterListeners).forEach((k) => delete autoUpdaterListeners[k])
    Object.keys(ipcHandlers).forEach((k) => delete ipcHandlers[k])
    appGetVersionMock.mockClear()
    appGetVersionMock.mockReturnValue('2.0.3')
    dialogShowMessageBox.mockClear()
    dialogShowMessageBox.mockResolvedValue({ response: 0 })
    webContentsSend.mockClear()
    windowIsDestroyed.mockClear()
    windowIsDestroyed.mockReturnValue(false)
    // ensure skip flag is set so we don't get background timers in tests
    process.env.PIPICLAW_SKIP_UPDATE_CHECK = '1'
  })

  it('initialize registers listeners and 4 IPC handlers', () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)

    expect(autoUpdaterListeners['update-available']).toBeDefined()
    expect(autoUpdaterListeners['update-downloaded']).toBeDefined()
    expect(autoUpdaterListeners['error']).toBeDefined()

    expect(Object.keys(ipcHandlers).sort()).toEqual(
      ['autoUpdater:check', 'autoUpdater:download', 'autoUpdater:getVersion', 'autoUpdater:install'],
    )
  })

  it('update-available event sends payload to webContents', () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    getListener('update-available')({ version: '2.1.0', releaseDate: '2026-07-22', releaseNotes: 'patch' })
    expect(webContentsSend).toHaveBeenCalledWith('autoUpdater:onUpdateAvailable', {
      version: '2.1.0',
      releaseDate: '2026-07-22',
      releaseNotes: 'patch',
    })
  })

  it('update-downloaded event triggers dialog and quitAndInstall when user clicks restart', async () => {
    const win = makeMockWindow()
    const updater = new AutoUpdater()
    updater.initialize(win)
    getListener('update-downloaded')({ version: '2.1.0' })
    expect(webContentsSend).toHaveBeenCalledWith('autoUpdater:onUpdateDownloaded', { version: '2.1.0' })
    // dialog is async; flush microtasks
    await Promise.resolve()
    await Promise.resolve()
    expect(dialogShowMessageBox).toHaveBeenCalled()
    const quitAndInstall = (await import('electron-updater')).autoUpdater.quitAndInstall as any
    expect(quitAndInstall).toHaveBeenCalled()
  })

  it('autoUpdater:check handler returns success with version', async () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    const handler = ipcHandlers['autoUpdater:check']
    const result = await handler({}, undefined)
    expect(result.success).toBe(true)
    expect(result.data.version).toBe('2.1.0')
  })

  it('autoUpdater:download handler invokes downloadUpdate', async () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    const handler = ipcHandlers['autoUpdater:download']
    const result = await handler({}, undefined)
    expect(result.success).toBe(true)
    const dl = (await import('electron-updater')).autoUpdater.downloadUpdate as any
    expect(dl).toHaveBeenCalled()
  })

  it('autoUpdater:install handler invokes quitAndInstall', () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    const handler = ipcHandlers['autoUpdater:install']
    const result = handler({}, undefined)
    expect(result.success).toBe(true)
  })

  it('autoUpdater:check returns failure when checkForUpdates throws', async () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    const { autoUpdater } = await import('electron-updater')
    ;(autoUpdater.checkForUpdates as any).mockRejectedValueOnce(new Error('boom'))
    const handler = ipcHandlers['autoUpdater:check']
    const result = await handler({}, undefined)
    expect(result.success).toBe(false)
    expect(result.error).toContain('boom')
  })

  it('autoUpdater:getVersion returns app.getVersion()', () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    const handler = ipcHandlers['autoUpdater:getVersion']
    const result = handler({}, undefined)
    expect(result.success).toBe(true)
    expect(result.data).toBe('2.0.3')
    expect(appGetVersionMock).toHaveBeenCalled()
  })

  it('error event sends payload to webContents', () => {
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    getListener('error')(new Error('network failure'))
    expect(webContentsSend).toHaveBeenCalledWith('autoUpdater:onError', { message: 'Error: network failure' })
  })

  it('skips webContents send when window is destroyed', () => {
    windowIsDestroyed.mockReturnValue(true)
    const win = makeMockWindow()
    new AutoUpdater().initialize(win)
    getListener('update-available')({ version: '2.1.0' })
    expect(webContentsSend).not.toHaveBeenCalled()
  })
})
