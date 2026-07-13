import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { createHash } from 'node:crypto'

export interface SkillVersionInfo {
  skillName: string
  version: string
  hash: string
  createdAt: number
  changelog?: string
}

/**
 * SkillVersioning: 跟踪 skill 每次更新的版本号 + 内容 hash。
 * W6 简化:不真的做 git 集成,只在内存记录,userData/skill-versions.json 后续接入。
 */
export class SkillVersioning {
  private static instance: SkillVersioning
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private versions: Map<string, SkillVersionInfo[]> = new Map()

  private constructor() {}

  public static getInstance(): SkillVersioning {
    if (!SkillVersioning.instance) SkillVersioning.instance = new SkillVersioning()
    return SkillVersioning.instance
  }

  record(skillName: string, content: string, version?: string, changelog?: string): SkillVersionInfo {
    const existing = this.versions.get(skillName) ?? []
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16)
    const nextVersion = version ?? this.bumpVersion(existing)
    const info: SkillVersionInfo = { skillName, version: nextVersion, hash, createdAt: Date.now(), changelog }
    existing.push(info)
    this.versions.set(skillName, existing)
    this.log.info(`SkillVersioning: ${skillName} ${nextVersion} (${hash})`)
    void this.bus.publish('skill:versioned', { skillName, version: nextVersion, hash })
    return info
  }

  history(skillName: string): SkillVersionInfo[] {
    return [...(this.versions.get(skillName) ?? [])]
  }

  latest(skillName: string): SkillVersionInfo | undefined {
    const h = this.versions.get(skillName)
    return h?.[h.length - 1]
  }

  rollback(skillName: string, targetHash: string): boolean {
    const history = this.versions.get(skillName) ?? []
    const target = history.find(v => v.hash === targetHash)
    if (!target) return false
    this.log.info(`SkillVersioning: ${skillName} 标记回滚到 ${target.version}`)
    void this.bus.publish('skill:rollback', { skillName, target: targetHash })
    return true
  }

  private bumpVersion(existing: SkillVersionInfo[]): string {
    if (existing.length === 0) return '1.0.0'
    const latest = existing[existing.length - 1].version
    const m = latest.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!m) return '1.0.0'
    return `${m[1]}.${m[2]}.${parseInt(m[3]) + 1}`
  }
}