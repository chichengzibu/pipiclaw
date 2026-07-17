export type LlmProvider = 'openai' | 'anthropic' | 'zhipu'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  /** 强制用哪个 provider */
  provider?: LlmProvider
}

export interface LlmResponse {
  ok: boolean
  provider: LlmProvider
  content: string
  model: string
  /** token 数 */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  /** ms */
  durationMs: number
  error?: string
}

export interface LlmConfig {
  provider: LlmProvider
  apiKey: string
  /** 默认模型(由 provider 决定) */
  defaultModel?: string
  /** API base URL(可选,默认走官方) */
  apiBaseUrl?: string
  enabled: boolean
  updatedAt: number
}

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  zhipu: 'glm-4-flash',
}

export const DEFAULT_API_BASE: Record<LlmProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
}
