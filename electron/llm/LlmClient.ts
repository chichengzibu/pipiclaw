/**
 * PiPiClaw - LLM 统一客户端 (M1 v0.1 合并 ModelManager 后)
 *
 * 统一接口: chat / streamChat / complete (兼容 LlmAgentBrain 老调用).
 * 4 个 provider: openai / anthropic / zhipu / openai-compatible (deepseek/ollama/volc/openrouter/custom/azure-via-openai).
 *
 * 跟旧 ModelManager 的边界:
 *   - LlmClient 负责: 实际 chat / stream (旧 ModelManager 没这能力, 是 stub)
 *   - ModelManager (保留): provider CRUD + test/ping + model list (UI model mgmt 用)
 *   - ChatManager: 流式路径切到 LlmClient.streamChat
 */
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { LlmConfigStore } from './LlmConfigStore'
import { OpenAiAdapter } from './adapters/openai'
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible'
import { AnthropicAdapter } from './adapters/anthropic'
import { ZhipuAdapter } from './adapters/zhipu'
import type { LlmRequest, LlmResponse, LlmProvider, LlmStreamChunk, LlmMessage } from './types'

export class LlmClient {
  private static instance: LlmClient
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private configStore = LlmConfigStore.getInstance()
  private openai = new OpenAiAdapter()
  private compat = new OpenAiCompatibleAdapter()
  private anthropic = new AnthropicAdapter()
  private zhipu = new ZhipuAdapter()

  private constructor() {}

  public static getInstance(): LlmClient {
    if (!LlmClient.instance) LlmClient.instance = new LlmClient()
    return LlmClient.instance
  }

  /**
   * chat 主入口: 自动选启用的 provider, 若没指定则取 LlmConfigStore.getActive().
   * provider 字段值: openai / anthropic / zhipu / openai-compatible.
   */
  async chat(req: LlmRequest): Promise<LlmResponse> {
    const provider = req.provider ?? this.configStore.getActive()?.provider
    if (!provider) {
      return { ok: false, provider: 'openai', content: '', model: req.model, durationMs: 0, error: 'no LLM provider configured (set via LlmConfig UI)' }
    }
    const config = this.configStore.get(provider)
    if (!config?.enabled || !config.apiKey) {
      return { ok: false, provider, content: '', model: req.model, durationMs: 0, error: `provider ${provider} not enabled or apiKey missing` }
    }
    void this.bus.publish('llm:request', { provider, model: req.model, msgCount: req.messages.length })
    const response = provider === 'openai' ? await this.openai.chat(config, req)
      : provider === 'openai-compatible' ? await this.compat.chat(config, req)
      : provider === 'anthropic' ? await this.anthropic.chat(config, req)
      : await this.zhipu.chat(config, req)
    void this.bus.publish(response.ok ? 'llm:response' : 'llm:error', { provider, model: response.model, durationMs: response.durationMs })
    return response
  }

  /**
   * 流式 chat: 逐 chunk yield LlmStreamChunk. 由 streamChat() 接 signal 取消.
   * 当前只 openai / openai-compatible 支持 SSE 流式; anthropic / zhipu 暂走非流式 fallback.
   */
  async *streamChat(req: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmStreamChunk> {
    const provider = req.provider ?? this.configStore.getActive()?.provider
    if (!provider) {
      yield { type: 'error', error: 'no LLM provider configured', provider: 'openai', model: req.model }
      return
    }
    const config = this.configStore.get(provider)
    if (!config?.enabled || !config.apiKey) {
      yield { type: 'error', error: `provider ${provider} not enabled or apiKey missing`, provider, model: req.model }
      return
    }
    void this.bus.publish('llm:request', { provider, model: req.model, msgCount: req.messages.length, stream: true })

    if (provider === 'openai') {
      yield* this.openai.streamChat(config, req, signal)
      return
    }
    if (provider === 'openai-compatible') {
      yield* this.compat.streamChat(config, req, signal)
      return
    }
    // anthropic / zhipu: 暂走非流式 chat 然后 yield 一次性 chunk (后续 M2 接 SSE)
    const res = provider === 'anthropic' ? await this.anthropic.chat(config, req) : await this.zhipu.chat(config, req)
    if (!res.ok) {
      yield { type: 'error', error: res.error, provider, model: res.model }
      return
    }
    if (res.content) {
      yield { type: 'content', delta: res.content, accumulated: { content: res.content, reasoning: res.reasoning ?? '' }, provider, model: res.model }
    }
    if (res.toolCalls && res.toolCalls.length > 0) {
      for (const tc of res.toolCalls) {
        yield { type: 'tool_call', toolCall: tc, accumulated: { content: res.content, reasoning: res.reasoning ?? '' }, provider, model: res.model }
      }
    }
    if (res.usage) {
      yield { type: 'usage', usage: res.usage, accumulated: { content: res.content, reasoning: res.reasoning ?? '' }, provider, model: res.model }
    }
    yield { type: 'done', finishReason: res.finishReason, accumulated: { content: res.content, reasoning: res.reasoning ?? '' }, provider, model: res.model }
  }

  /** 简单文本补全(无 messages 历史,只有 user prompt) */
  async complete(prompt: string, opts: { provider?: LlmProvider; system?: string; maxTokens?: number; temperature?: number } = {}): Promise<LlmResponse> {
    const messages: LlmMessage[] = []
    if (opts.system) messages.push({ role: 'system', content: opts.system })
    messages.push({ role: 'user', content: prompt })
    return this.chat({ model: '', messages, provider: opts.provider, maxTokens: opts.maxTokens, temperature: opts.temperature })
  }
}
