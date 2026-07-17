import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class AnthropicAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE.anthropic
    const model = req.model || config.defaultModel || DEFAULT_MODELS.anthropic
    try {
      // Anthropic 格式:system 单独字段 + messages [{role, content}]
      const systemMsg = req.messages.find(m => m.role === 'system')
      const msgs = req.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: systemMsg?.content,
          messages: msgs,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, provider: 'anthropic', content: '', model, durationMs: Date.now() - startMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data: any = await res.json()
      const content = data.content?.[0]?.text ?? ''
      return {
        ok: true,
        provider: 'anthropic',
        content,
        model,
        durationMs: Date.now() - startMs,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
        } : undefined,
      }
    } catch (e) {
      return { ok: false, provider: 'anthropic', content: '', model, durationMs: Date.now() - startMs, error: String(e) }
    }
  }
}
