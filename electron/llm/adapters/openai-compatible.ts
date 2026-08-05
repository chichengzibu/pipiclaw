/**
 * PiPiClaw - OpenAI-compatible adapter (M1 v0.1)
 *
 * 复用 OpenAI 协议但 baseUrl + model 来自 LlmConfig.
 * 覆盖: deepseek / ollama (via /v1/chat/completions) / volc_ark / openrouter / custom.
 */
import { LogManager } from '../../core/LogManager'
import type { LlmConfig, LlmRequest, LlmResponse, LlmToolCall, LlmStreamChunk } from '../types'
import { DEFAULT_API_BASE, DEFAULT_MODELS } from '../types'

export class OpenAiCompatibleAdapter {
  private log = LogManager.getInstance()

  async chat(config: LlmConfig, req: LlmRequest): Promise<LlmResponse> {
    const startMs = Date.now()
    const baseUrl = (config.apiBaseUrl || DEFAULT_API_BASE['openai-compatible']).replace(/\/+$/, '')
    const model = req.model || config.defaultModel || DEFAULT_MODELS['openai-compatible']
    try {
      const body: Record<string, unknown> = {
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 4096,
      }
      if (req.tools && req.tools.length > 0) {
        body.tools = req.tools
        if (req.toolChoice) body.tool_choice = req.toolChoice
      }
      if (req.think !== undefined) {
        body.think = req.think
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errText = await res.text()
        return {
          ok: false,
          provider: 'openai-compatible',
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
      const reasoning = msg?.reasoning ?? msg?.reasoning_content ?? ''

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

      if (!content && reasoning) {
        content = reasoning
        this.log.debug(`openai-compatible: content 空,fallback 到 reasoning (model=${model})`)
      }
      if (!content && !toolCalls?.length) {
        this.log.warn(`openai-compatible: 完全空响应 (model=${model}, finish=${finishReason})`)
      }

      return {
        ok: true,
        provider: 'openai-compatible',
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
        ...(reasoning ? { reasoning } : {}),
        ...(finishReason ? { finishReason } : {}),
      }
    } catch (e) {
      return {
        ok: false,
        provider: 'openai-compatible',
        content: '',
        model,
        durationMs: Date.now() - startMs,
        error: String(e),
      }
    }
  }

  /**
   * 流式 (OpenAI-compatible SSE). 协议同 OpenAI.
   * 适用于: ollama (via /v1/chat/completions, 0.5.0+ 支持 stream), deepseek, volc_ark, openrouter, custom.
   */
  async *streamChat(config: LlmConfig, req: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmStreamChunk> {
    const baseUrl = (config.apiBaseUrl || DEFAULT_API_BASE['openai-compatible']).replace(/\/+$/, '')
    const model = req.model || config.defaultModel || DEFAULT_MODELS['openai-compatible']
    const body: Record<string, unknown> = {
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    }
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools
      if (req.toolChoice) body.tool_choice = req.toolChoice
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
    let res: Response
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      } as RequestInit)
    } catch (e) {
      yield { type: 'error', error: String(e), provider: 'openai-compatible', model }
      return
    }
    if (!res.ok || !res.body) {
      const errText = res.body ? await res.text() : res.statusText
      yield { type: 'error', error: `HTTP ${res.status}: ${errText.slice(0, 200)}`, provider: 'openai-compatible', model }
      return
    }
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let accContent = ''
    let accReasoning = ''
    const toolAcc: Map<number, { id: string; name: string; args: string }> = new Map()
    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
    let finalFinish: string | undefined
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const dataStr = trimmed.slice(5).trim()
          if (dataStr === '[DONE]') continue
          let data: any
          try { data = JSON.parse(dataStr) } catch { continue }
          const choice = data.choices?.[0]
          const delta = choice?.delta ?? {}
          if (delta.content) {
            accContent += delta.content
            yield { type: 'content', delta: delta.content, accumulated: { content: accContent, reasoning: accReasoning }, provider: 'openai-compatible', model }
          }
          const reasoningChunk = delta.reasoning ?? delta.reasoning_content
          if (reasoningChunk) {
            accReasoning += reasoningChunk
            yield { type: 'thinking', delta: reasoningChunk, accumulated: { content: accContent, reasoning: accReasoning }, provider: 'openai-compatible', model }
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0
              const prev = toolAcc.get(idx) ?? { id: '', name: '', args: '' }
              if (tc.id) prev.id = tc.id
              if (tc.function?.name) prev.name = tc.function.name
              if (tc.function?.arguments) prev.args += tc.function.arguments
              toolAcc.set(idx, prev)
            }
          }
          if (choice?.finish_reason) finalFinish = choice.finish_reason
          if (data.usage) {
            finalUsage = {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          }
        }
      }
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError') {
        yield { type: 'error', error: 'aborted', provider: 'openai-compatible', model }
      } else {
        yield { type: 'error', error: String(e), provider: 'openai-compatible', model }
      }
      return
    }
    for (const [, t] of toolAcc) {
      if (t.id && t.name) {
        const toolCall: LlmToolCall = { id: t.id, type: 'function', function: { name: t.name, arguments: t.args } }
        yield { type: 'tool_call', toolCall, accumulated: { content: accContent, reasoning: accReasoning }, provider: 'openai-compatible', model }
      }
    }
    if (finalUsage) {
      yield { type: 'usage', usage: finalUsage, accumulated: { content: accContent, reasoning: accReasoning }, provider: 'openai-compatible', model }
    }
    yield { type: 'done', finishReason: finalFinish, accumulated: { content: accContent, reasoning: accReasoning }, provider: 'openai-compatible', model }
  }
}
