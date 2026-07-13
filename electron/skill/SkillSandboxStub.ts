import { LogManager } from '../core/LogManager'

export type SandboxLevel = 'none' | 'process' | 'docker' | 'webcontainer'

export interface SandboxedSkillResult {
  ok: boolean
  level: SandboxLevel
  stdout?: string
  stderr?: string
  durationMs: number
}

/**
 * SkillSandboxStub: 技能隔离执行(W6 stub)
 * W6 阶段:仅 level='none' 走主进程,W9+ 接 P7 sandbox 支持 docker / webcontainer
 */
export class SkillSandboxStub {
  private static instance: SkillSandboxStub
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SkillSandboxStub {
    if (!SkillSandboxStub.instance) SkillSandboxStub.instance = new SkillSandboxStub()
    return SkillSandboxStub.instance
  }

  async run(skillName: string, args: unknown, level: SandboxLevel = 'none'): Promise<SandboxedSkillResult> {
    const startMs = Date.now()
    this.log.debug(`SkillSandboxStub[${level}]: ${skillName}`)

    if (level !== 'none') {
      this.log.warn(`SkillSandboxStub: level ${level} 未实装,W9+ P7 接入,降级 none`)
    }

    return {
      ok: true,
      level: 'none',
      stdout: `[stub] skill ${skillName} executed with args ${JSON.stringify(args).slice(0, 100)}`,
      stderr: '',
      durationMs: Date.now() - startMs,
    }
  }
}