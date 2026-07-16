import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-int-trace-${k}`) },
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

describe('Integration: Insight trace collection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('TraceCollector startSpan returns span with id and name', async () => {
    const { TraceCollector } = await import('../../electron/insight/TraceCollector')
    const tc = TraceCollector.getInstance()
    const span = tc.startSpan({ name: 'test.span', attrs: { key: 'val' } })
    expect(span.id).toBeTruthy()
    expect(span.name).toBe('test.span')
    expect(span.startMs).toBeGreaterThan(0)
  })

  it('TraceCollector endSpan sets endMs', async () => {
    const { TraceCollector } = await import('../../electron/insight/TraceCollector')
    const tc = TraceCollector.getInstance()
    const span = tc.startSpan({ name: 'end.span' })
    tc.endSpan(span, 'ok')
    expect(span.endMs).toBeGreaterThanOrEqual(span.startMs)
    expect(span.attrs.result).toBe('ok')
  })

  it('TraceCollector getSpans returns active spans', async () => {
    const { TraceCollector } = await import('../../electron/insight/TraceCollector')
    const tc = TraceCollector.getInstance()
    const before = tc.getSpans().length
    tc.startSpan({ name: 'active.1' })
    tc.startSpan({ name: 'active.2' })
    const after = tc.getSpans().length
    expect(after - before).toBe(2)
  })

  it('TraceCollector getSpans can filter by name', async () => {
    const { TraceCollector } = await import('../../electron/insight/TraceCollector')
    const tc = TraceCollector.getInstance()
    tc.startSpan({ name: 'unique-tag-x9z' })
    const r = tc.getSpans({ name: 'unique-tag-x9z' })
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r.every(s => s.name === 'unique-tag-x9z')).toBe(true)
  })
})
