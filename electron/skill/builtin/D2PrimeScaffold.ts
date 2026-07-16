/**
 * PiPiClaw - Skill / D2PrimeScaffold (W11.5)
 *
 * D2-Prime 项目骨架搭建 demo(旗舰 demo):
 *   用户输入 prompt → AI 解析 → 自动选模板 → 沙盒脚手架 → 端口转发 → 预览
 *
 * 流程:
 * 1. 解析 prompt(走 SandboxBuilder 选模板 + 建 workspace + 写文件)
 * 2. SandboxLifecycle.touch(workspaceId)
 * 3. 判断前端/后端模板:
 *    - 前端类(vite-react-ts / nextjs-app) → WebContainerRunner.boot + mount
 *    - 后端类(fastapi / go-http) → docker stub(W11)
 * 4. PortForwarder.forwardPort(template.devPort)
 * 5. 返回 forwardId + url 供 renderer iframe 预览
 *
 * W11 阶段:所有运行步骤 stub,只 log.warn
 * W12+ 接真实 docker / WebContainer 启动
 */

import { LogManager } from '../../core/LogManager'
import { SandboxBuilder } from '../../sandbox/SandboxBuilder'
import { SandboxLifecycle } from '../../sandbox/SandboxLifecycle'
import { PortForwarder } from '../../sandbox/PortForwarder'
import { WebContainerRunner } from '../../sandbox/WebContainerRunner'
import { EventBus } from '../../runtime/bridge/EventBus'

export const D2_PRIME_SKILL_NAME = 'd2:prime-scaffold'

export interface D2PrimeInput {
  /** 用户自然语言,例如 "做一个 Vite + React + TS 博客" */
  prompt: string
  /** 是否走 WebContainer (前端类项目默认 true) */
  useWebContainer?: boolean
}

export interface D2PrimeResult {
  ok: boolean
  workspaceId?: string
  templateId?: string
  fileCount?: number
  forwardId?: string
  forwardUrl?: string
  /** 预计启动时间(W11 stub,前端类 30s / 后端类 5min) */
  estimatedStartSeconds?: number
  durationMs: number
  error?: string
}

/**
 * D2PrimeScaffold: D2-Prime 项目骨架搭建 demo(旗舰)
 */
export async function runD2Prime(input: D2PrimeInput): Promise<D2PrimeResult> {
  const log = LogManager.getInstance()
  const builder = SandboxBuilder.getInstance()
  const lifecycle = SandboxLifecycle.getInstance()
  const forwarder = PortForwarder.getInstance()
  const wc = WebContainerRunner.getInstance()
  const startMs = Date.now()

  try {
    log.info(`D2PrimeScaffold: ${input.prompt.slice(0, 60)}`)

    const buildResult = await builder.build({ prompt: input.prompt })
    if (!buildResult.ok || !buildResult.workspace || !buildResult.template) {
      return { ok: false, durationMs: Date.now() - startMs, error: buildResult.error ?? 'build failed' }
    }

    lifecycle.touch(buildResult.workspace.id)

    const isFrontend = ['vite-react-ts', 'nextjs-app'].includes(buildResult.template.id)
    const useWebContainer = input.useWebContainer ?? isFrontend

    const forwardResult = forwarder.forwardPort(buildResult.template.devPort, buildResult.workspace.id)
    if (!forwardResult.ok || !forwardResult.entry) {
      return { ok: false, workspaceId: buildResult.workspace.id, templateId: buildResult.template.id, fileCount: buildResult.fileCount, durationMs: Date.now() - startMs, error: forwardResult.error }
    }

    let estimatedStartSeconds = 0
    if (useWebContainer) {
      const boot = await wc.boot()
      await wc.mount(buildResult.workspace.id)
      estimatedStartSeconds = 30
      log.info(`D2PrimeScaffold: WebContainer boot=${boot.stub} mount=${buildResult.workspace.id}`)
    } else {
      estimatedStartSeconds = 300
      log.info(`D2PrimeScaffold: docker stub for ${buildResult.template.id}`)
    }

    void EventBus.getInstance().publish('d2-prime:scaffolded', {
      workspaceId: buildResult.workspace.id,
      templateId: buildResult.template.id,
      fileCount: buildResult.fileCount,
      useWebContainer,
      forwardUrl: forwardResult.entry.url,
    })

    return {
      ok: true,
      workspaceId: buildResult.workspace.id,
      templateId: buildResult.template.id,
      fileCount: buildResult.fileCount,
      forwardId: forwardResult.entry.id,
      forwardUrl: forwardResult.entry.url,
      estimatedStartSeconds,
      durationMs: Date.now() - startMs,
    }
  } catch (e) {
    log.error('D2PrimeScaffold: 失败', e)
    return { ok: false, durationMs: Date.now() - startMs, error: String(e) }
  }
}

export const d2PrimeSkillHandler = {
  name: D2_PRIME_SKILL_NAME,
  description: 'D2-Prime 旗舰 demo:30s 内出预览',
  requiresPermission: true,
  async execute(args: D2PrimeInput) {
    return runD2Prime(args)
  },
}

/** W11.5 wire:由 main.ts 调用,把 D2-Prime skill 注册到 SkillRuntime */
export function registerD2PrimeSkill(): void {
  const { SkillRuntime } = require('../../runtime/skill/SkillRuntime')
  SkillRuntime.getInstance().register({
    name: D2_PRIME_SKILL_NAME,
    description: 'D2-Prime 项目骨架搭建(P7 旗舰)',
    handler: async (args: any) => runD2Prime(args as D2PrimeInput),
  })
}