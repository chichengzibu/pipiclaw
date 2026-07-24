import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse, LlmToolCall } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class OpenAiAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE.openai
    const model = req.model || config.defaultModel || DEFAULT_MODELS.openai
    try {
      // 构造请求体
      const body: Record<string, unknown> = {
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 4096,
      }
      // 透传 tools(OpenAI 风格)
      if (req.tools && req.tools.length > 0) {
        body.tools = req.tools
        if (req.toolChoice) body.tool_choice = req.toolChoice
      }
      // Ollama 兼容:关闭 thinking 模式
      if (req.think !== undefined) {
        body.think = req.think
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errText = await res.text()
        return {
          ok: false,
          provider: 'openai',
          content: '',
          model,
          durationMs: Date.now() - startMs,
          error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
        }
      }
      const data: any = await res.json()
      const choice = data.choices?.[0]
      const msg = choice?.message
      const finishReason: string | undefined = choice?.finish_reason
      let content = msg?.content ?? ''

      // 解析 tool_calls(OpenAI 格式)
      const toolCalls: LlmToolCall[] | undefined = msg?.tool_calls
        ? msg.tool_calls.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '',
            },
          }))
        : undefined

      // 修复:thinking 模型 content 空时,fallback 到 reasoning
      if (!content && msg?.reasoning) {
        content = msg.reasoning
        this.log.debug(`OpenAI adapter: content 空,fallback 到 reasoning (model=${model})`)
      }
      // 边缘 case:content 空 + tool_calls 也没有 + reasoning 也没有
      if (!content && !toolCalls?.length) {
        this.log.warn(`OpenAI adapter: 完全空响应 (model=${model}, finish=${finishReason})`)
      }

      return {
        ok: true,
        provider: 'openai',
        content,
        model,
        durationMs: Date.now() - startMs,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
        ...(msg?.reasoning ? { reasoning: msg.reasoning } : {}),
        ...(finishReason ? { finishReason } : {}),
      }
    } catch (e) {
      return {
        ok: false,
        provider: 'openai',
        content: '',
        model,
        durationMs: Date.now() - startMs,
        error: String(e),
      }
    }
  }
}
