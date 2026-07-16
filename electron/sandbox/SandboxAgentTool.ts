/**
 * PiPiClaw - SandboxAgentTool (W11.4)
 *
 * 把 p7_scaffold_project 暴露为 Agent 工具。
 *
 * 调用流程:
 * 1. acquire placeholder workspace id 资源
 * 2. 检查 network policy(若 blockAll → 拒绝)
 * 3. SandboxBuilder.build({ prompt }) → workspace
 * 4. SandboxLifecycle.touch(workspaceId)
 * 5. release placeholder + acquire 真 workspace
 * 6. 返回 BuildResult 给 Agent
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { SandboxBuilder } from './SandboxBuilder'
import { ResourceLimitsManager } from './resourceLimits'
import { NetworkPolicy } from './networkPolicy'
import { SandboxLifecycle } from './SandboxLifecycle'

export class SandboxAgentTool {
  private static instance: SandboxAgentTool
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private builder = SandboxBuilder.getInstance()
  private lifecycle = SandboxLifecycle.getInstance()
  private resourceLimits = ResourceLimitsManager.getInstance()
  private networkPolicy = NetworkPolicy.getInstance()

  private constructor() {}

  public static getInstance(): SandboxAgentTool {
    if (!SandboxAgentTool.instance) SandboxAgentTool.instance = new SandboxAgentTool()
    return SandboxAgentTool.instance
  }

  /** Tool 名 + 描述(供 AgentBrain.call 调度) */
  readonly name = 'p7_scaffold_project'
  readonly description = 'P7 沙盒项目脚手架:接受 prompt,自动选模板,生成 workspace。返回 { workspaceId, templateId, fileCount }'

  /** 工具元信息(供 Agent UI 显示) */
  readonly metadata = {
    requiresPermission: true,
    category: 'sandbox' as const,
    inputSchema: {
      prompt: { type: 'string', description: '用户自然语言描述', required: true },
      templateId: { type: 'string', description: '显式指定模板 (vite-react-ts/nextjs-app/fastapi/go-http)', required: false },
    },
  }

  /** Agent 调用入口 */
  async call(args: { prompt: string; templateId?: string }): Promise<{ ok: boolean; workspaceId?: string; templateId?: string; fileCount?: number; error?: string }> {
    this.log.info(`SandboxAgentTool.call: ${args.prompt.slice(0, 60)}`)
    const placeholderWorkspaceId = 'pending-' + Date.now()
    const acquire = this.resourceLimits.acquire(placeholderWorkspaceId)
    if (!acquire.ok) {
      return { ok: false, error: acquire.reason }
    }
    try {
      if (this.networkPolicy.isBlockAll()) {
        this.resourceLimits.release(placeholderWorkspaceId)
        return { ok: false, error: '网络被全局阻断,无法生成项目' }
      }
      const result = await this.builder.build({
        prompt: args.prompt,
        templateId: args.templateId as 'vite-react-ts' | 'nextjs-app' | 'fastapi' | 'go-http' | undefined,
      })
      if (!result.ok || !result.workspace) {
        this.resourceLimits.release(placeholderWorkspaceId)
        return { ok: false, error: result.error }
      }
      this.lifecycle.touch(result.workspace.id)
      this.resourceLimits.release(placeholderWorkspaceId)
      this.resourceLimits.acquire(result.workspace.id)
      void this.bus.publish('agent-tool:sandbox:scaffolded', { workspaceId: result.workspace.id, templateId: result.template?.id })
      return {
        ok: true,
        workspaceId: result.workspace.id,
        templateId: result.template?.id,
        fileCount: result.fileCount,
      }
    } catch (e) {
      this.resourceLimits.release(placeholderWorkspaceId)
      return { ok: false, error: String(e) }
    }
  }
}