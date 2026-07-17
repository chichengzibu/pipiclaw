import { LogManager } from '../core/LogManager'
import { LlmClient } from '../llm/LlmClient'
import type { AgentBrain, AgentContext, Decision, ToolCall, ToolResult, SubTask, SubAgent } from '../contracts/types'

/**
 * W14: LlmAgentBrain — 用 LlmClient 完成 think / call / spawn 的 AgentBrain 实现。
 * 提供给 ChatManager.registerAgent() 使用;若 LLM 不可用则 fallback 到 stub-style 行为。
 */
export class LlmAgentBrain implements AgentBrain {
  private static instance: LlmAgentBrain
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): LlmAgentBrain {
    if (!LlmAgentBrain.instance) LlmAgentBrain.instance = new LlmAgentBrain()
    return LlmAgentBrain.instance
  }

  async think(ctx: AgentContext): Promise<Decision> {
    const content = typeof ctx.content === 'string'
      ? ctx.content
      : `[context keys=${Object.keys(ctx).join(',')}]`
    const llm = LlmClient.getInstance()
    const res = await llm.complete(content, {
      system: '你是 PiPiClaw 智能助手,根据用户问题给出简洁 (1-3 句) 中文回复。',
      maxTokens: 512,
      temperature: 0.7,
    })
    if (!res.ok) {
      this.log.warn(`LlmAgentBrain.think: fallback stub (reason=${res.error})`)
      return { action: 'reply', payload: { text: `[LlmAgentBrain stub] ${content.slice(0, 80)}` } }
    }
    return { action: 'reply', payload: { text: res.content, model: res.model, durationMs: res.durationMs } }
  }

  async call(tool: ToolCall): Promise<ToolResult> {
    const llm = LlmClient.getInstance()
    const prompt = `Tool call name=${tool.name} args=${JSON.stringify(tool.args).slice(0, 400)}\n请输出 1-3 句工具结果描述。`
    const res = await llm.complete(prompt, { maxTokens: 256, temperature: 0.5 })
    if (!res.ok) {
      return { ok: false, error: res.error ?? 'llm unavailable' }
    }
    return { ok: true, data: { text: res.content, model: res.model, tool: tool.name } }
  }

  async spawn(subtask: SubTask): Promise<SubAgent> {
    const id = `llm-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.log.info(`LlmAgentBrain.spawn: ${id} (${subtask.instruction.slice(0, 40)})`)
    return { id, brain: this }
  }

  async checkpoint(): Promise<string> {
    return `llm-brain-${Date.now()}`
  }

  async restore(_id: string): Promise<void> {
    this.log.debug(`LlmAgentBrain.restore called (no-op in W14 stub)`)
  }
}
