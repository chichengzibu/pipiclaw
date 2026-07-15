import { describe, it, expect, beforeEach, vi } from 'vitest'

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

import { EventBus } from '../../electron/runtime/bridge/EventBus'

describe('EventBus smoke', () => {
  beforeEach(() => {
    EventBus.getInstance().reset()
  })

  it('subscribes and delivers payload', async () => {
    const bus = EventBus.getInstance()
    const received: unknown[] = []
    bus.subscribe('topic.a', (p) => {
      received.push(p)
    })
    await bus.publish('topic.a', { hello: 'world' }, 'smoke')
    expect(received).toHaveLength(1)
    expect((received[0] as any).hello).toBe('world')
  })

  it('records history with id and timestamp', async () => {
    const bus = EventBus.getInstance()
    await bus.publish('topic.history', 1)
    await bus.publish('topic.history', 2)
    const hist = bus.historyOf('topic.history')
    expect(hist.length).toBe(2)
    expect(hist[0].topic).toBe('topic.history')
    expect(typeof hist[0].id).toBe('string')
    expect(typeof hist[0].timestamp).toBe('number')
  })

  it('unsubscribe stops delivery', async () => {
    const bus = EventBus.getInstance()
    let count = 0
    const off = bus.subscribe('topic.off', () => {
      count++
    })
    await bus.publish('topic.off', 1)
    off()
    await bus.publish('topic.off', 2)
    expect(count).toBe(1)
  })

  it('publish with no subscribers is a no-op', async () => {
    const bus = EventBus.getInstance()
    await expect(bus.publish('topic.empty', 'x')).resolves.toBeUndefined()
  })
})