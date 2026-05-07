/**
 * PiPiClaw - 模型状态管理 (Pinia Store)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type ProviderType = 'openai' | 'anthropic' | 'deepseek' | 'azure' | 'ollama' | 'custom';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
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
}

export const PROVIDER_DEFAULTS: Record<ProviderType, Partial<ProviderFormData>> = {
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
  }
};

export const useModelsStore = defineStore('models', () => {
  const providers = ref<ProviderConfig[]>([]);
  const loading = ref(false);
  const testingProviders = ref<Set<string>>(new Set());
  const syncingProviders = ref<Set<string>>(new Set());

  const enabledProviders = computed(() => providers.value.filter(p => p.enabled));
  const disabledProviders = computed(() => providers.value.filter(p => !p.enabled));

  const enabledCount = computed(() => enabledProviders.value.length);
  const totalCount = computed(() => providers.value.length);

  async function fetchProviders(): Promise<void> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.models?.list();
      if (result?.success && result.data) {
        providers.value = result.data;
      }
    } catch (err) {
      console.error('获取模型提供商列表失败:', err);
    } finally {
      loading.value = false;
    }
  }

  async function getProvider(id: string): Promise<ProviderConfig | null> {
    try {
      const result = await (window as any).electronAPI?.models?.get(id);
      if (result?.success && result.data) {
        return result.data;
      }
    } catch (err) {
      console.error('获取模型提供商失败:', err);
    }
    return null;
  }

  async function addProvider(data: ProviderFormData): Promise<ProviderConfig | null> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.models?.add({
        ...data,
        models: []
      });
      if (result?.success && result.data) {
        providers.value.push(result.data);
        return result.data;
      }
    } catch (err) {
      console.error('添加模型提供商失败:', err);
    } finally {
      loading.value = false;
    }
    return null;
  }

  async function updateProvider(id: string, updates: Partial<ProviderConfig>): Promise<ProviderConfig | null> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.models?.update(id, updates);
      if (result?.success && result.data) {
        const index = providers.value.findIndex(p => p.id === id);
        if (index !== -1) {
          providers.value[index] = result.data;
        }
        return result.data;
      }
    } catch (err) {
      console.error('更新模型提供商失败:', err);
    } finally {
      loading.value = false;
    }
    return null;
  }

  async function deleteProvider(id: string): Promise<boolean> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.models?.delete(id);
      if (result?.success) {
        const index = providers.value.findIndex(p => p.id === id);
        if (index !== -1) {
          providers.value.splice(index, 1);
        }
        return true;
      }
    } catch (err) {
      console.error('删除模型提供商失败:', err);
    } finally {
      loading.value = false;
    }
    return false;
  }

  async function toggleProvider(id: string, enabled: boolean): Promise<boolean> {
    try {
      const result = await (window as any).electronAPI?.models?.toggle(id, enabled);
      if (result?.success) {
        const provider = providers.value.find(p => p.id === id);
        if (provider) {
          provider.enabled = enabled;
        }
        return true;
      }
    } catch (err) {
      console.error('切换提供商状态失败:', err);
    }
    return false;
  }

  async function testProvider(providerId: string, modelId?: string): Promise<ModelTestResult | null> {
    testingProviders.value.add(providerId);
    try {
      const result = await (window as any).electronAPI?.models?.test(providerId, modelId);
      if (result?.success && result.data) {
        return result.data;
      }
    } catch (err) {
      console.error('测试模型连接失败:', err);
    } finally {
      testingProviders.value.delete(providerId);
    }
    return null;
  }

  async function syncOllamaModels(providerId: string): Promise<boolean> {
    syncingProviders.value.add(providerId);
    try {
      const result = await (window as any).electronAPI?.models?.syncOllama(providerId);
      if (result?.success) {
        await fetchProviders();
        return true;
      }
    } catch (err) {
      console.error('同步Ollama模型失败:', err);
    } finally {
      syncingProviders.value.delete(providerId);
    }
    return false;
  }

  function isTesting(providerId: string): boolean {
    return testingProviders.value.has(providerId);
  }

  function isSyncing(providerId: string): boolean {
    return syncingProviders.value.has(providerId);
  }

  function getProviderById(id: string): ProviderConfig | undefined {
    return providers.value.find(p => p.id === id);
  }

  return {
    providers,
    loading,
    testingProviders,
    syncingProviders,
    enabledProviders,
    disabledProviders,
    enabledCount,
    totalCount,
    fetchProviders,
    getProvider,
    addProvider,
    updateProvider,
    deleteProvider,
    toggleProvider,
    testProvider,
    syncOllamaModels,
    isTesting,
    isSyncing,
    getProviderById
  };
});
