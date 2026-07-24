import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class OpenAiAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE.openai
    const model = req.model || config.defaultModel || DEFAULT_MODELS.openai
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 4096,
          // Ollama 兼容:允许透传 think 参数(默认 false,关闭 thinking mode)
          ...((req as any).think !== undefined ? { think: (req as any).think } : {}),
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, provider: 'openai', content: '', model, durationMs: Date.now() - startMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data: any = await res.json()
      const msg = data.choices?.[0]?.message
      let content = msg?.content ?? ''
      // 修复:Qwen3 / DeepSeek-R1 等 thinking 模型,content 可能为空,实际答案在 reasoning 字段
      // 触发条件:content 空 + reasoning 有内容 + finish_reason='length'(被 thinking 耗光 token)
      if (!content && msg?.reasoning) {
        content = msg.reasoning
        this.log.debug(`OpenAI adapter: content 空,fallback 到 reasoning (model=${model})`)
      }
      return {
        ok: true,
        provider: 'openai',
        content,
        model,
        durationMs: Date.now() - startMs,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        // 扩展:把 reasoning 单独暴露,UI 可选择是否显示
        ...(msg?.reasoning ? { reasoning: msg.reasoning } : {}),
      }
    } catch (e) {
      return { ok: false, provider: 'openai', content: '', model, durationMs: Date.now() - startMs, error: String(e) }
    }
  }
}
