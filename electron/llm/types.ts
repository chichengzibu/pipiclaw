export type LlmProvider = 'openai' | 'anthropic' | 'zhipu'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** tool 消息:对应 tool_call_id */
  toolCallId?: string
  /** assistant 消息:由模型产生的 tool_calls 记录(用于上下文) */
  toolCalls?: LlmToolCall[]
}

/** OpenAI 风格 tool 定义 */
export interface LlmTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

/** 模型产出的工具调用 */
export interface LlmToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    /** JSON-encoded 字符串 */
    arguments: string
  }
}

export interface LlmRequest {
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  /** 强制用哪个 provider */
  provider?: LlmProvider
  /** 工具定义(OpenAI 风格) */
  tools?: LlmTool[]
  /** 强制工具选择:auto / none / { type: 'function', function: { name } } */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  /** Ollama 兼容:关闭 thinking 模式(qwen3 / deepseek-r1 等) */
  think?: boolean
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
  /** 工具调用(模型决定要调的工具) */
  toolCalls?: LlmToolCall[]
  /** thinking 内容(qwen3 / o1 / deepseek-r1 等,UI 可选显示) */
  reasoning?: string
  /** finish_reason:'stop' / 'length' / 'tool_calls' / 'content_filter' */
  finishReason?: string
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
