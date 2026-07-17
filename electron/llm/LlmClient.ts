import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { LlmConfigStore } from './LlmConfigStore'
import { OpenAiAdapter } from './adapters/openai'
import { AnthropicAdapter } from './adapters/anthropic'
import { ZhipuAdapter } from './adapters/zhipu'
import type { LlmRequest, LlmResponse, LlmProvider } from './types'

export class LlmClient {
  private static instance: LlmClient
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private configStore = LlmConfigStore.getInstance()
  private openai = new OpenAiAdapter()
  private anthropic = new AnthropicAdapter()
  private zhipu = new ZhipuAdapter()

  private constructor() {}

  public static getInstance(): LlmClient {
    if (!LlmClient.instance) LlmClient.instance = new LlmClient()
    return LlmClient.instance
  }

  /**
   * chat 主入口:自动选启用的 provider,若没指定则取 LlmConfigStore.getActive()
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
      : provider === 'anthropic' ? await this.anthropic.chat(config, req)
      : await this.zhipu.chat(config, req)
    void this.bus.publish(response.ok ? 'llm:response' : 'llm:error', { provider, model: response.model, durationMs: response.durationMs })
    return response
  }

  /** 简单文本补全(无 messages 历史,只有 user prompt) */
  async complete(prompt: string, opts: { provider?: LlmProvider; system?: string; maxTokens?: number; temperature?: number } = {}): Promise<LlmResponse> {
    const messages: { role: 'system' | 'user'; content: string }[] = []
    if (opts.system) messages.push({ role: 'system', content: opts.system })
    messages.push({ role: 'user', content: prompt })
    return this.chat({ model: '', messages, provider: opts.provider, maxTokens: opts.maxTokens, temperature: opts.temperature })
  }
}
