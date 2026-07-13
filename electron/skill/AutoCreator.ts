import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'
import { SkillSigner } from './SkillSigner'
import { SkillVersioning } from './SkillVersioning'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface SkillDraft {
  id: string
  name: string
  description: string
  content: string
  triggers: string[]
  source: 'recording' | 'conversation' | 'template'
  createdAt: number
}

export interface AutoCreatorInput {
  triggerPhrase: string
  steps: string
  skillName?: string
}

/**
 * AutoCreator: 把用户输入(录屏转写 / 对话描述)生成 SKILL.md。
 * W6 阶段:基于模板填充,不调 LLM(W7 接 ChatManager 流让 LLM 生成 body)
 */
export class AutoCreator {
  private static instance: AutoCreator
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private signer = SkillSigner.getInstance()
  private versioning = SkillVersioning.getInstance()

  private constructor() {}

  public static getInstance(): AutoCreator {
    if (!AutoCreator.instance) AutoCreator.instance = new AutoCreator()
    return AutoCreator.instance
  }

  async createSkill(input: AutoCreatorInput): Promise<SkillDraft> {
    const id = randomUUID().slice(0, 8)
    const name = input.skillName ?? this.slugify(input.triggerPhrase)
    const description = input.triggerPhrase
    const triggers = input.triggerPhrase.split(/[,，;；]/).map(t => t.trim()).filter(Boolean)

    const content = this.renderTemplate(name, description, triggers, input.steps)

    const draft: SkillDraft = {
      id,
      name,
      description,
      content,
      triggers,
      source: 'recording',
      createdAt: Date.now(),
    }

    this.signer.sign(name, content)
    this.versioning.record(name, content, '1.0.0', `AutoCreator W6: from trigger "${input.triggerPhrase.slice(0, 30)}"`)

    void this.bus.publish('skill:auto-created', { id, name })
    this.log.info(`AutoCreator: ${name} 草稿生成`)
    return draft
  }

  async saveDraftToDisk(draft: SkillDraft): Promise<string> {
    const skillsDir = path.join(app.getPath('userData'), 'skills', draft.name)
    if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true })
    const filePath = path.join(skillsDir, 'SKILL.md')
    fs.writeFileSync(filePath, draft.content, 'utf-8')
    this.log.info(`AutoCreator: ${draft.name} 已保存 ${filePath}`)
    return filePath
  }

  private renderTemplate(name: string, description: string, triggers: string[], steps: string): string {
    const triggerLines = triggers.map(t => `  - "${t}"`).join('\n')
    const triggerHintLines = triggers.map(t => `- 用户说"${t}"时`).join('\n')
    return [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      'version: 1.0.0',
      'triggers:',
      triggerLines,
      'inputs:',
      '  - name: text',
      '    type: string',
      '    description: 用户输入文本',
      'outputs:',
      '  - name: result',
      '    type: string',
      '    description: skill 执行结果',
      '---',
      '',
      `# ${name}`,
      '',
      description,
      '',
      '## When to use this skill',
      '',
      triggerHintLines,
      '',
      '## Steps',
      '',
      steps,
      '',
      '## Implementation notes',
      '',
      '(W6 stub: 内容来自 AutoCreator 模板,W7+ 由 LLM 根据对话/录屏生成 step-by-step 实现)',
      '',
    ].join('\n')
  }

  private slugify(text: string): string {
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
    return slug || 'skill-' + randomUUID().slice(0, 4)
  }
}