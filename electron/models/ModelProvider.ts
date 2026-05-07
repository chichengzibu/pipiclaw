/**
 * PiPiClaw - 模型提供商类型定义
 */

export type ProviderType = 'openai' | 'anthropic' | 'deepseek' | 'azure' | 'ollama' | 'custom' | 'openrouter';

export type ModelCapability = 'chat' | 'completion' | 'embedding' | 'vision' | 'function';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  maxTokens?: number;
  contextWindow?: number;
  inputCost?: number;
  outputCost?: number;
  description?: string;
  disabled?: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  organization?: string;
  deploymentName?: string;
  apiVersion?: string;
  models: ModelInfo[];
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ModelTestResult {
  success: boolean;
  latency?: number;
  response?: string;
  error?: string;
}

export interface ProviderFormData {
  name: string;
  type: ProviderType;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  organization: string;
  deploymentName: string;
  apiVersion: string;
  timeout: number;
  maxRetries: number;
  models: Omit<ModelInfo, 'provider'>[];
}

export const PROVIDER_DEFAULTS: Record<ProviderType, Partial<ProviderConfig>> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    timeout: 60000,
    maxRetries: 3
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    timeout: 60000,
    maxRetries: 3
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    timeout: 60000,
    maxRetries: 3
  },
  azure: {
    name: 'Azure OpenAI',
    baseUrl: 'https://{resource}.openai.azure.com',
    timeout: 60000,
    maxRetries: 3
  },
  ollama: {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    timeout: 30000,
    maxRetries: 2
  },
  custom: {
    name: 'Custom Provider',
    baseUrl: '',
    timeout: 60000,
    maxRetries: 3
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    timeout: 60000,
    maxRetries: 3
  }
};

export const PROVIDER_ICONS: Record<ProviderType, string> = {
  openai: '🤖',
  anthropic: '🧠',
  deepseek: '🔮',
  azure: '☁️',
  ollama: '🦙',
  custom: '⚙️',
  openrouter: '🌐'
};
