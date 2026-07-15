/**
 * PiPiClaw - SandboxBuilder(W10.1)
 *
 * 职责:
 * 1. 根据用户 prompt 选择模板(regex 匹配 / 显式指定 / 默认 vite-react-ts)
 * 2. 通过 WorkspaceManager 建 workspace
 * 3. 把模板的初始文件写入 workspace host path
 *
 * W10 阶段:只做模板选择 + 文件写入,不真跑 docker run
 * W11+ 阶段:与 WebContainerRunner / PortForwarder 接通
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { WorkspaceManager, Workspace } from './workspace'
import { ALL_TEMPLATES, viteReactTs, TemplateConfig } from './templates'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface BuildOptions {
  /** 用户自然语言描述 */
  prompt: string
  /** 显式指定模板(默认自动 regex 匹配) */
  templateId?: TemplateConfig['id']
  /** workspace 名(可选) */
  workspaceName?: string
}

export interface BuildResult {
  ok: boolean
  workspace?: Workspace
  template?: TemplateConfig
  /** 模板选择依据(自动匹配 or 显式指定) */
  templateReason: 'auto-regex' | 'explicit' | 'default' | 'none'
  /** 写入的文件数 */
  fileCount?: number
  durationMs: number
  error?: string
}

/**
 * SandboxBuilder 单例:根据用户 prompt 选择模板 + 写入 workspace
 */
export class SandboxBuilder {
  private static instance: SandboxBuilder
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private workspaceManager = WorkspaceManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxBuilder {
    if (!SandboxBuilder.instance) SandboxBuilder.instance = new SandboxBuilder()
    return SandboxBuilder.instance
  }

  /** 选模板(regex 匹配 / 显式指定 / 默认 vite-react-ts) */
  selectTemplate(prompt: string, explicitId?: TemplateConfig['id']): { template: TemplateConfig | undefined; reason: BuildResult['templateReason'] } {
    if (explicitId) {
      const t = ALL_TEMPLATES.find(x => x.id === explicitId)
      if (t) return { template: t, reason: 'explicit' }
    }
    for (const t of ALL_TEMPLATES) {
      for (const trig of t.triggers) {
        try {
          const re = new RegExp(trig, 'i')
          if (re.test(prompt)) return { template: t, reason: 'auto-regex' }
        } catch {
          continue
        }
      }
    }
    return { template: viteReactTs, reason: 'default' }
  }

  /** 主入口:build = 选模板 + 建 workspace + 写文件 */
  async build(opts: BuildOptions): Promise<BuildResult> {
    const startMs = Date.now()
    try {
      const sel = this.selectTemplate(opts.prompt, opts.templateId)
      if (!sel.template) {
        return { ok: false, templateReason: 'none', durationMs: Date.now() - startMs, error: 'no template matched' }
      }
      const template = sel.template

      const workspace = this.workspaceManager.createWorkspace({
        name: opts.workspaceName ?? `ws-${template.id}-${randomUUID().slice(0, 6)}`,
        type: 'project',
      })

      let fileCount = 0
      for (const file of template.files) {
        const filePath = path.join(workspace.hostPath, file.path)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, file.content, 'utf-8')
        fileCount += 1
      }

      this.log.info(`SandboxBuilder: ${template.id} → workspace ${workspace.id} (${fileCount} files, ${sel.reason})`)
      void this.bus.publish('sandbox:build:completed', { workspaceId: workspace.id, templateId: template.id, fileCount, reason: sel.reason })

      return {
        ok: true,
        workspace,
        template,
        templateReason: sel.reason,
        fileCount,
        durationMs: Date.now() - startMs,
      }
    } catch (e) {
      this.log.error('SandboxBuilder: build failed', e)
      return { ok: false, templateReason: 'none', durationMs: Date.now() - startMs, error: String(e) }
    }
  }

  /** 列出所有可用模板 */
  listTemplates(): TemplateConfig[] {
    return [...ALL_TEMPLATES]
  }
}