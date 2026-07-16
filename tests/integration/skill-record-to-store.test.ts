import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-int-skill-${k}`) },
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

describe('Integration: Skill record → store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SkillEffectivenessTracker records then persists stats', async () => {
    const { SkillEffectivenessTracker } = await import('../../electron/learning/SkillEffectivenessTracker')
    ;(SkillEffectivenessTracker as any).instance = undefined
    const tracker = SkillEffectivenessTracker.getInstance()
    tracker.record({ skillName: 'int.skill', ts: 1, durationMs: 100, success: true })
    tracker.record({ skillName: 'int.skill', ts: 2, durationMs: 200, success: false })
    tracker.record({ skillName: 'int.skill', ts: 3, durationMs: 50, success: true })
    const stats = tracker.getStats('int.skill')
    expect(stats?.calls).toBe(3)
    expect(stats?.successes).toBe(2)
    expect(stats?.failures).toBe(1)
  })

  it('SkillEffectivenessTracker distinct skills are tracked separately', async () => {
    const { SkillEffectivenessTracker } = await import('../../electron/learning/SkillEffectivenessTracker')
    ;(SkillEffectivenessTracker as any).instance = undefined
    const t = SkillEffectivenessTracker.getInstance()
    t.record({ skillName: 'a.skill', ts: 1, durationMs: 10, success: true })
    t.record({ skillName: 'b.skill', ts: 1, durationMs: 20, success: false })
    expect(t.getStats('a.skill')?.calls).toBe(1)
    expect(t.getStats('b.skill')?.calls).toBe(1)
    expect(t.listAllStats().length).toBeGreaterThanOrEqual(2)
  })

  it('recommendRollback reuses getStats threshold of 3 calls', async () => {
    const { SkillEffectivenessTracker } = await import('../../electron/learning/SkillEffectivenessTracker')
    ;(SkillEffectivenessTracker as any).instance = undefined
    const t = SkillEffectivenessTracker.getInstance()
    expect(t.recommendRollback('nope.skill')).toBe(false)
    t.record({ skillName: 'nope.skill', ts: 1, durationMs: 10, success: false })
    t.record({ skillName: 'nope.skill', ts: 2, durationMs: 10, success: false })
    expect(t.recommendRollback('nope.skill')).toBe(false)
    t.record({ skillName: 'nope.skill', ts: 3, durationMs: 10, success: false })
    expect(t.recommendRollback('nope.skill')).toBe(true)
  })
})
