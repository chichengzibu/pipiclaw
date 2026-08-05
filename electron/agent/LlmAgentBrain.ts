/**
 * PiPiClaw - LlmAgentBrain v0.1 (M1)
 *
 * 真 tool call loop, 跟 ClaudeCode 对齐:
 *   - LLM 收到 user prompt + 5 tools (Read/Edit/Bash/Glob/Grep) schema
 *   - 模型决定调 tool → 我们解析 tool_calls → 跑工具 → 把 result 写回 messages
 *   - 循环 max 10 轮直到 LLM 给出无 tool_calls 的 final answer
 *   - 流式: LlmClient.streamChat 逐 chunk, 通过 LlmAgentBrainEventBus 推到 IPC
 *
 * 接入 ChatManager: ChatManager.registerAgent(LlmAgentBrain.getInstance())
 *   - 在 dispatchToAgent() 里 ctx.conversationId 传进来, 我们维护 per-conversation multi-turn state
 *   - 但 v0.1 我们用 call 模式: 每次 think() 都是独立一次 multi-turn run, 由 ChatManager 决定何时调
 */
import { LogManager } from '../core/LogManager'
import { LlmClient } from '../llm/LlmClient'
import { BUILTIN_TOOLS, toolsToLlmSchema } from './tools'
import type { PiPiTool, ToolExecResult } from './tools'
import type { LlmMessage, LlmToolCall, LlmStreamChunk } from '../llm/types'
import type { AgentBrain, AgentContext, Decision, ToolCall, ToolResult, SubTask, SubAgent } from '../contracts/types'

const MAX_ITERATIONS = 10
const DEFAULT_MODEL = 'qwen3.5:9b' // M1 v0.1 default: 本地 ollama, tool-capable

const SYSTEM_PROMPT = `你是 PiPiClaw 代码助手 (M1 v0.1), 跟 ClaudeCode 一样能用 5 个工具:
- Read: 读文件 (file_path, encoding?)
- Edit: 精确编辑文件 (file_path, old_string, new_string, replace_all?)
- Bash: 跑命令 (command, args?, cwd?, timeout_ms?)
- Glob: 文件匹配 (pattern, cwd?)
- Grep: 内容搜索 (pattern, cwd?, include?)

工作准则:
1. 优先用工具拿真实数据, 不要靠记忆编
2. Edit 工具要求 old_string 唯一, 不唯一就报错让你加上下文
3. Bash 走白名单, 不在白名单的命令会拒绝
4. 任务完成直接给最终答复, 不要无谓地继续调工具
5. 答复简洁, 中文, 1-3 句能说清就不啰嗦
6. 路径默认是 sandbox 内 (用户数据隔离), 不要试图读 ~/.ssh 或 C:\\Windows`

/** 单次 think run 的事件回调 (供 IPC / ChatManager 订阅) */
export type LlmAgentEvent =
  | { type: 'run_start'; runId: string; prompt: string; tools: string[] }
  | { type: 'iteration'; runId: string; iter: number; message: string }
  | { type: 'tool_call'; runId: string; iter: number; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; runId: string; iter: number; name: string; ok: boolean; result: string; error?: string; durationMs: number }
  | { type: 'content_delta'; runId: string; iter: number; delta: string; accumulated: string }
  | { type: 'thinking_delta'; runId: string; iter: number; delta: string; accumulated: string }
  | { type: 'final_answer'; runId: string; content: string; iterations: number; totalDurationMs: number }
  | { type: 'run_error'; runId: string; error: string; iterations: number; totalDurationMs: number }
  | { type: 'run_aborted'; runId: string; iterations: number }

export type LlmAgentEventHandler = (e: LlmAgentEvent) => void

class LlmAgentBrainEventBus {
  private static instance: LlmAgentBrainEventBus
  private handlers: Set<LlmAgentEventHandler> = new Set()
  private constructor() {}
  static getInstance(): LlmAgentBrainEventBus {
    if (!LlmAgentBrainEventBus.instance) LlmAgentBrainEventBus.instance = new LlmAgentBrainEventBus()
    return LlmAgentBrainEventBus.instance
  }
  subscribe(h: LlmAgentEventHandler): () => void {
    this.handlers.add(h)
    return () => this.handlers.delete(h)
  }
  emit(e: LlmAgentEvent): void {
    for (const h of Array.from(this.handlers)) {
      try { h(e) } catch { /* noop */ }
    }
  }
}

export const LlmAgentBrainEvents = LlmAgentBrainEventBus.getInstance()

/** run 状态机 (供 agent:abort IPC 用) */
interface RunState {
  runId: string
  aborted: boolean
  controller: AbortController
}

export class LlmAgentBrain implements AgentBrain {
  private static instance: LlmAgentBrain
  private log = LogManager.getInstance()
  private llm = LlmClient.getInstance()
  private tools: Map<string, PiPiTool> = new Map()
  /** runId → state */
  private runs: Map<string, RunState> = new Map()

  private constructor() {
    // 注册 5 工具
    for (const t of BUILTIN_TOOLS) this.tools.set(t.metadata.name, t)
    this.log.info(`LlmAgentBrain v0.1 初始化: ${this.tools.size} tools`)
  }

  public static getInstance(): LlmAgentBrain {
    if (!LlmAgentBrain.instance) LlmAgentBrain.instance = new LlmAgentBrain()
    return LlmAgentBrain.instance
  }

  /** 列已注册 tool 的 metadata (供 agent:list-tools IPC 用) */
  listTools(): Array<{ name: string; description: string; parameters: Record<string, unknown>; requiresPermission: boolean }> {
    return Array.from(this.tools.values()).map(t => ({
      name: t.metadata.name,
      description: t.metadata.description,
      parameters: t.metadata.parametersJson,
      requiresPermission: t.metadata.requiresPermission,
    }))
  }

  /** 中止 run */
  abortRun(runId: string): boolean {
    const s = this.runs.get(runId)
    if (!s) return false
    s.aborted = true
    s.controller.abort()
    return true
  }

  /** list active runs (供 IPC 调试) */
  listActiveRuns(): string[] {
    return Array.from(this.runs.keys())
  }

  /**
   * 跑一次 multi-turn tool call loop.
   * @param prompt 用户输入
   * @param opts.runId 可选, 默认自动生成
   * @param opts.model 覆盖默认模型
   * @param opts.provider 覆盖 provider (默认 ollama → openai-compatible)
   * @param opts.tools tool 名白名单, 默认全部 5 个
   * @param opts.maxIterations 覆盖默认 10
   * @param opts.systemPrompt 覆盖默认 system prompt
   * @returns final answer + 总迭代数 + 总耗时
   */
  async run(prompt: string, opts: {
    runId?: string
    model?: string
    provider?: 'openai' | 'openai-compatible' | 'anthropic' | 'zhipu'
    tools?: string[]
    maxIterations?: number
    systemPrompt?: string
    apiBaseUrl?: string
  } = {}): Promise<{ runId: string; content: string; iterations: number; totalDurationMs: number; toolCalls: Array<{ name: string; ok: boolean; durationMs: number }> }> {
    const runId = opts.runId ?? `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const controller = new AbortController()
    const state: RunState = { runId, aborted: false, controller }
    this.runs.set(runId, state)

    const startMs = Date.now()
    const maxIter = opts.maxIterations ?? MAX_ITERATIONS
    const systemPrompt = opts.systemPrompt ?? SYSTEM_PROMPT
    const selectedToolNames = opts.tools ?? Array.from(this.tools.keys())
    const selectedTools = selectedToolNames
      .map(n => this.tools.get(n))
      .filter((t): t is PiPiTool => !!t)
    const toolCallsLog: Array<{ name: string; ok: boolean; durationMs: number }> = []

    LlmAgentBrainEvents.emit({ type: 'run_start', runId, prompt, tools: selectedToolNames })

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]
    const llmSchema = toolsToLlmSchema(selectedTools)

    let finalContent = ''
    let iterations = 0
    try {
      for (let iter = 1; iter <= maxIter; iter++) {
        if (state.aborted) {
          LlmAgentBrainEvents.emit({ type: 'run_aborted', runId, iterations: iter - 1 })
          this.runs.delete(runId)
          return { runId, content: finalContent, iterations: iter - 1, totalDurationMs: Date.now() - startMs, toolCalls: toolCallsLog }
        }
        iterations = iter
        LlmAgentBrainEvents.emit({ type: 'iteration', runId, iter, message: `第 ${iter}/${maxIter} 轮` })

        // 调 LLM (流式), 聚合 tool_calls + final content
        const result = await this.callLlmOnce(messages, llmSchema, iter, runId, controller.signal, {
          provider: opts.provider,
          model: opts.model ?? DEFAULT_MODEL,
        })

        // 把 assistant message 回写
        const assistantMsg: LlmMessage = { role: 'assistant', content: result.content }
        if (result.toolCalls.length > 0) assistantMsg.toolCalls = result.toolCalls
        if (result.reasoning) assistantMsg.reasoningContent = result.reasoning
        messages.push(assistantMsg)

        if (result.toolCalls.length === 0) {
          // 没有 tool call → final answer
          finalContent = result.content
          break
        }

        // 跑每个 tool, 把 result 写回 messages
        for (const tc of result.toolCalls) {
          if (state.aborted) break
          const tool = this.tools.get(tc.function.name)
          if (!tool) {
            const errResult = `unknown tool: ${tc.function.name}`
            LlmAgentBrainEvents.emit({ type: 'tool_result', runId, iter, name: tc.function.name, ok: false, result: '', error: errResult, durationMs: 0 })
            messages.push({ role: 'tool', content: `Error: ${errResult}`, toolCallId: tc.id })
            continue
          }
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(tc.function.arguments || '{}')
          } catch (e) {
            const errResult = `arguments JSON parse error: ${(e as Error).message}`
            LlmAgentBrainEvents.emit({ type: 'tool_result', runId, iter, name: tc.function.name, ok: false, result: '', error: errResult, durationMs: 0 })
            messages.push({ role: 'tool', content: `Error: ${errResult}`, toolCallId: tc.id })
            continue
          }
          LlmAgentBrainEvents.emit({ type: 'tool_call', runId, iter, name: tc.function.name, args })
          const tStart = Date.now()
          let exec: ToolExecResult
          try {
            exec = await tool.execute(args)
          } catch (e) {
            exec = { ok: false, result: '', error: `tool execution threw: ${(e as Error).message}` }
          }
          const durationMs = Date.now() - tStart
          toolCallsLog.push({ name: tc.function.name, ok: exec.ok, durationMs })
          LlmAgentBrainEvents.emit({ type: 'tool_result', runId, iter, name: tc.function.name, ok: exec.ok, result: exec.result, error: exec.error, durationMs })
          // tool 消息: OpenAI 格式用 content 字段, 部分 provider 也会读 name
          const toolContent = exec.ok ? exec.result : `Error: ${exec.error ?? 'unknown'}`
          messages.push({ role: 'tool', content: toolContent, toolCallId: tc.id })
        }
      }

      if (!finalContent && iterations >= maxIter) {
        // 超过 max 轮, 取最后一轮 assistant content
        const lastAssistant = messages.filter(m => m.role === 'assistant').pop()
        finalContent = lastAssistant?.content ?? ''
        LlmAgentBrainEvents.emit({ type: 'run_error', runId, error: `超过 max iterations (${maxIter}), 强制结束`, iterations, totalDurationMs: Date.now() - startMs })
      }

      const totalDurationMs = Date.now() - startMs
      LlmAgentBrainEvents.emit({ type: 'final_answer', runId, content: finalContent, iterations, totalDurationMs })
      this.runs.delete(runId)
      return { runId, content: finalContent, iterations, totalDurationMs, toolCalls: toolCallsLog }
    } catch (e) {
      const totalDurationMs = Date.now() - startMs
      const errMsg = e instanceof Error ? e.message : String(e)
      LlmAgentBrainEvents.emit({ type: 'run_error', runId, error: errMsg, iterations, totalDurationMs })
      this.runs.delete(runId)
      throw e
    }
  }

  /** 调一次 LLM, 聚合 stream chunks → { content, reasoning, toolCalls, error } */
  private async callLlmOnce(
    messages: LlmMessage[],
    llmSchema: ReturnType<typeof toolsToLlmSchema>,
    iter: number,
    runId: string,
    signal: AbortSignal,
    opts: { provider?: 'openai' | 'openai-compatible' | 'anthropic' | 'zhipu'; model: string }
  ): Promise<{ content: string; reasoning: string; toolCalls: LlmToolCall[]; error?: string }> {
    const req = {
      model: opts.model,
      messages,
      tools: llmSchema,
      toolChoice: 'auto' as const,
      provider: opts.provider,
    }
    let content = ''
    let reasoning = ''
    const toolAcc: Map<number, LlmToolCall> = new Map()
    try {
      for await (const chunk of this.llm.streamChat(req, signal)) {
        const ch = chunk as LlmStreamChunk
        if (ch.type === 'content' && ch.delta) {
          content = ch.accumulated?.content ?? content + ch.delta
          LlmAgentBrainEvents.emit({ type: 'content_delta', runId, iter, delta: ch.delta, accumulated: content })
        } else if (ch.type === 'thinking' && ch.delta) {
          reasoning = ch.accumulated?.reasoning ?? reasoning + ch.delta
          LlmAgentBrainEvents.emit({ type: 'thinking_delta', runId, iter, delta: ch.delta, accumulated: reasoning })
        } else if (ch.type === 'tool_call' && ch.toolCall) {
          toolAcc.set(toolAcc.size, ch.toolCall)
        } else if (ch.type === 'error') {
          throw new Error(ch.error ?? 'unknown stream error')
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        // 用户中止
      } else {
        throw e
      }
    }
    // 防御: 空响应 + 没 tool call → 至少把 content 设为空字符串, LLM 下一轮会想办法
    if (!content && toolAcc.size === 0) {
      this.log.warn(`LlmAgentBrain: iter ${iter} 完全空响应, 继续 next iter 兜底`)
    }
    return {
      content,
      reasoning,
      toolCalls: Array.from(toolAcc.values()),
    }
  }

  // ======== AgentBrain interface 兼容 (旧 ChatManager.registerAgent 走 dispatchToAgent) ========

  async think(ctx: AgentContext): Promise<Decision> {
    const content = typeof ctx.content === 'string' ? ctx.content : ''
    if (!content) {
      return { action: 'reply', payload: { text: '', model: '', durationMs: 0 } }
    }
    try {
      const r = await this.run(content)
      return { action: 'reply', payload: { text: r.content, model: 'agent-v0.1', durationMs: r.totalDurationMs, iterations: r.iterations, toolCalls: r.toolCalls } }
    } catch (e) {
      this.log.warn('LlmAgentBrain.think: fallback stub', e)
      return { action: 'reply', payload: { text: `[LlmAgentBrain error] ${(e as Error).message}`, model: 'agent-v0.1-stub', durationMs: 0 } }
    }
  }

  async call(tool: ToolCall): Promise<ToolResult> {
    const t = this.tools.get(tool.name)
    if (!t) return { ok: false, error: `unknown tool: ${tool.name}` }
    try {
      const r = await t.execute(tool.args)
      return { ok: r.ok, data: r.result, error: r.error }
    } catch (e) {
      return { ok: false, error: String((e as Error).message) }
    }
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
    this.log.debug(`LlmAgentBrain.restore called (no-op in v0.1)`)
  }
}
