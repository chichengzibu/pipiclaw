import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-dd-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

import { DockerDetector } from '../../electron/sandbox/dockerDetector'

describe('DockerDetector', () => {
  let detector: DockerDetector

  beforeEach(() => {
    vi.clearAllMocks()
    detector = DockerDetector.getInstance()
  })

  it('getInstance returns singleton', () => {
    expect(DockerDetector.getInstance()).toBe(detector)
  })

  it('detect returns a result with platform set', async () => {
    const r = await detector.detect()
    expect(r).toBeDefined()
    expect(['darwin', 'linux', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix']).toContain(r.platform)
  })

  it('detect returns one of 6 valid statuses', async () => {
    const r = await detector.detect()
    expect([
      'available',
      'available-no-compose',
      'not-installed',
      'daemon-down',
      'permission-denied',
      'unsupported',
    ]).toContain(r.status)
  })

  it('detect on win32 returns unsupported', async () => {
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    try {
      const r = await detector.detect()
      expect(r.status).toBe('unsupported')
      expect(r.error).toMatch(/Windows/)
    } finally {
      Object.defineProperty(process, 'platform', { value: original })
    }
  })

  it('installUrlFor returns a URL string for current platform', () => {
    const url = (detector as any).installUrlFor(process.platform)
    expect(typeof url).toBe('string')
    expect(url).toMatch(/^https?:\/\//)
  })

  it('checkHealth returns boolean', async () => {
    const ok = await detector.checkHealth()
    expect(typeof ok).toBe('boolean')
  })
})
