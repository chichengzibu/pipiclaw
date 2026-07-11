/**
 * PiPiClaw - Agent / PromptBuilder (W5.2.4)
 *
 * Assembles the system + user prompt fragments that AgentThinking feeds to the LLM.
 * W5 ships hard-coded Chinese prompts; W6 lets users customise from Settings.
 */

import { LogManager } from '../core/LogManager'
import { AgentConfig } from './AgentConfig'
import type { ThinkingContext } from './AgentTypes'

export class PromptBuilder {
  private static instance: PromptBuilder
  private log = LogManager.getInstance()
  private config = AgentConfig.getInstance()

  private constructor() {}

  public static getInstance(): PromptBuilder {
    if (!PromptBuilder.instance) PromptBuilder.instance = new PromptBuilder()
    return PromptBuilder.instance
  }

  buildSystemPrompt(): string {
    const cfg = this.config.get()
    return `你是 PiPiClaw Agent,一个本地化桌面 AI 助手。
规则:
1. 优先用本地工具完成用户请求;能不联网就不联网。
2. 思考分 4 步: analysis (分析) / decision (决策) / critique (自检) / synthesis (综合)。
3. 工具调用必须符合 ToolRegistry 暴露的 schema,没注册的工具禁止调用。
4. 中文输出。
5. 子任务派生不超过 ${cfg.maxSubAgentDepth} 层(防递归)。
6. 思考不要超过 ${cfg.maxThinkingSteps} 步。`
  }

  buildUserPrompt(ctx: ThinkingContext): string {
    let prompt = `# 用户最新消息\n\n${ctx.userMessage}\n\n`
    if (ctx.history.length > 0) {
      prompt += `# 思考历史(最近 ${ctx.history.length} 步)\n\n`
      for (const step of ctx.history.slice(-5)) {
        prompt += `- [${step.dimension}] ${step.content.slice(0, 100)}\n`
      }
      prompt += '\n'
    }
    if (ctx.memoryFacts.length > 0) {
      prompt += `# 关联记忆(${ctx.memoryFacts.length} 条)\n\n`
      for (const m of ctx.memoryFacts.slice(0, 5)) {
        prompt += `- ${m}\n`
      }
      prompt += '\n'
    }
    if (ctx.availableTools.length > 0) {
      prompt += `# 可用工具\n\n`
      for (const t of ctx.availableTools) {
        prompt += `- ${t.name}: ${t.description}\n`
      }
    }
    return prompt
  }
}