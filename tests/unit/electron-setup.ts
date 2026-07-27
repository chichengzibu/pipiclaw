/**
 * Vitest global setup for electron module mocking
 *
 * 在 vitest 3.x + pool: 'forks' 下, 每个 worker 进程需要独立 mock electron
 * 否则 `import { app } from 'electron'` 会因找不到模块而失败
 *
 * 真实的 mock 内容 (返回路径等) 由各测试文件的 vi.mock('electron', ...) 提供
 * 本文件只确保模块可以被解析, 实际行为由具体 mock factory 决定
 */
import { vi } from 'vitest'

// Stub electron module so vite can resolve `import 'electron'`
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/pipiclaw-test-userdata'),
    getVersion: vi.fn(() => '4.3.0'),
    getPlatform: vi.fn(() => 'linux'),
    getAppPath: vi.fn(() => '/tmp/pipiclaw-test-app'),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  dialog: { showMessageBox: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn() },
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: { file: { resolvePathFn: vi.fn(), maxSize: 0, format: '' }, console: { level: 'info' } },
  },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}))