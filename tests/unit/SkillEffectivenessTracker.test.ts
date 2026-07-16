import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-set-${k}`) },
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

import { SkillEffectivenessTracker } from '../../electron/learning/SkillEffectivenessTracker'

describe('SkillEffectivenessTracker', () => {
  let tracker: SkillEffectivenessTracker

  beforeEach(() => {
    vi.clearAllMocks()
    ;(SkillEffectivenessTracker as any).instance = undefined
    tracker = SkillEffectivenessTracker.getInstance()
  })

  it('getInstance returns singleton', () => {
    expect(SkillEffectivenessTracker.getInstance()).toBe(tracker)
  })

  it('record stores a call record', () => {
    tracker.record({ skillName: 'A', ts: Date.now(), durationMs: 100, success: true })
    const stats = tracker.getStats('A')
    expect(stats).toBeDefined()
    expect(stats?.calls).toBe(1)
    expect(stats?.successes).toBe(1)
    expect(stats?.failures).toBe(0)
  })

  it('getStats aggregates calls successes and failures', () => {
    tracker.record({ skillName: 'B', ts: Date.now(), durationMs: 50, success: true })
    tracker.record({ skillName: 'B', ts: Date.now(), durationMs: 50, success: false })
    tracker.record({ skillName: 'B', ts: Date.now(), durationMs: 50, success: true })
    const stats = tracker.getStats('B')
    expect(stats?.calls).toBe(3)
    expect(stats?.successes).toBe(2)
    expect(stats?.failures).toBe(1)
  })

  it('getStats returns undefined for unknown skill', () => {
    expect(tracker.getStats('never-called')).toBeUndefined()
  })

  it('avgDurationMs computed across calls', () => {
    tracker.record({ skillName: 'avg', ts: 1, durationMs: 100, success: true })
    tracker.record({ skillName: 'avg', ts: 2, durationMs: 200, success: true })
    const stats = tracker.getStats('avg')
    expect(stats?.avgDurationMs).toBe(150)
  })

  it('recommendRollback returns true for low success rate', () => {
    tracker.record({ skillName: 'rb', ts: 1, durationMs: 10, success: false })
    tracker.record({ skillName: 'rb', ts: 2, durationMs: 10, success: false })
    tracker.record({ skillName: 'rb', ts: 3, durationMs: 10, success: true })
    expect(tracker.recommendRollback('rb')).toBe(true)
  })

  it('recommendRollback returns false for healthy skill', () => {
    tracker.record({ skillName: 'good', ts: 1, durationMs: 10, success: true })
    tracker.record({ skillName: 'good', ts: 2, durationMs: 10, success: true })
    tracker.record({ skillName: 'good', ts: 3, durationMs: 10, success: true })
    expect(tracker.recommendRollback('good')).toBe(false)
  })

  it('listAllStats returns stats per unique skill', () => {
    tracker.record({ skillName: 'x', ts: 1, durationMs: 10, success: true })
    tracker.record({ skillName: 'y', ts: 1, durationMs: 10, success: true })
    const all = tracker.listAllStats()
    const names = all.map(s => s.skillName)
    expect(names).toContain('x')
    expect(names).toContain('y')
  })
})
