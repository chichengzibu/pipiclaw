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
          max_tokens: req.maxTokens ?? 2048,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, provider: 'openai', content: '', model, durationMs: Date.now() - startMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data: any = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''
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
      }
    } catch (e) {
      return { ok: false, provider: 'openai', content: '', model, durationMs: Date.now() - startMs, error: String(e) }
    }
  }
}
