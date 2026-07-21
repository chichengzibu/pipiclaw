/**
 * PiPiClaw - 模型状态管理 (Pinia Store)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

export type ProviderType = 'openai' | 'anthropic' | 'deepseek' | 'azure' | 'ollama' | 'custom' | 'openrouter' | 'volc_ark';

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
  connected?: boolean;
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
  baseUrlMapping?: Record<string, string>;
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
  baseUrlMapping?: Record<string, string>;
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
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    timeout: 60000,
    maxRetries: 3
  },
  volc_ark: {
    name: '火山引擎',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    timeout: 60000,
    maxRetries: 3,
    baseUrlMapping: {
      'default': '/api/v3',
      'coding': '/api/coding/v3'
    }
  }
};

export const useModelsStore = defineStore('models', () => {
  const providers = ref<ProviderConfig[]>([]);
  const providerTemplates = ref<Array<{ name: string; type: string; defaultConfig: Partial<ProviderConfig> }>>([]);
  const loading = ref(false);
  const testingProviders = ref<Set<string>>(new Set());
  const syncingProviders = ref<Set<string>>(new Set());
  const fetchingProviders = ref<Set<string>>(new Set());

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

  async function fetchProviderTemplates(): Promise<void> {
    try {
      console.log('ModelsStore - 开始调用 getTemplates');
      const result = await (window as any).electronAPI?.models?.getTemplates();
      console.log('ModelsStore - getTemplates 返回结果:', result);
      
      if (result?.success && result.data && result.data.length > 0) {
        providerTemplates.value = result.data;
        console.log('ModelsStore - providerTemplates 已更新:', providerTemplates.value);
      } else {
        // 回退到本地默认配置
        console.log('ModelsStore - 后端未返回模板数据，使用本地默认配置');
        const defaultTemplates = Object.entries(PROVIDER_DEFAULTS).map(([type, defaults]) => ({
          name: defaults.name || type,
          type: type as ProviderType,
          defaultConfig: {
            name: defaults.name,
            type: type as ProviderType,
            baseUrl: defaults.baseUrl,
            timeout: defaults.timeout,
            maxRetries: defaults.maxRetries
          }
        }));
        providerTemplates.value = defaultTemplates;
        console.log('ModelsStore - 使用本地默认模板:', providerTemplates.value);
      }
    } catch (err) {
      console.error('获取模型提供商模板失败:', err);
      
      // 出错时也回退到本地默认配置
      const defaultTemplates = Object.entries(PROVIDER_DEFAULTS).map(([type, defaults]) => ({
        name: defaults.name || type,
        type: type as ProviderType,
        defaultConfig: {
          name: defaults.name,
          type: type as ProviderType,
          baseUrl: defaults.baseUrl,
          timeout: defaults.timeout,
          maxRetries: defaults.maxRetries
        }
      }));
      providerTemplates.value = defaultTemplates;
      console.log('ModelsStore - 出错，使用本地默认模板:', providerTemplates.value);
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
      // 深拷贝对象，避免 Vue 响应式对象无法被 Electron IPC 序列化
      const clonedData = JSON.parse(JSON.stringify(data));
      const result = await (window as any).electronAPI?.models?.add({
        ...clonedData,
        models: (clonedData as any).models || [] // 保持传入的模型，而不是清空
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
      // 深拷贝对象，避免 Vue 响应式对象无法被 Electron IPC 序列化
      const clonedUpdates = JSON.parse(JSON.stringify(updates));
      console.log('[Models] updateProvider - id:', id);
      console.log('[Models] updateProvider - updates (safe):', {
        name: clonedUpdates.name,
        type: clonedUpdates.type,
        enabled: clonedUpdates.enabled,
        timeout: clonedUpdates.timeout,
        maxRetries: clonedUpdates.maxRetries
      });
      const result = await (window as any).electronAPI?.models?.update(id, clonedUpdates);
      if (result?.success && result.data) {
        console.log('[Models] updateProvider - result data (safe):', {
          id: result.data.id,
          name: result.data.name,
          type: result.data.type,
          enabled: result.data.enabled
        });
        const index = providers.value.findIndex(p => p.id === id);
        if (index !== -1) {
          providers.value[index] = result.data;
          console.log('[Models] updateProvider - updated provider at index', index);
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

  async function fetchModels(providerId: string): Promise<{ success: boolean; models: ModelInfo[]; error?: string }> {
    fetchingProviders.value.add(providerId);
    try {
      const result = await (window as any).electronAPI?.models?.fetch(providerId);
      if (result?.success) {
        await fetchProviders();
        return { success: true, models: result.data || [] };
      }
      return { success: false, models: [], error: result?.error };
    } catch (err) {
      console.error('拉取模型列表失败:', err);
      return { success: false, models: [], error: String(err) };
    } finally {
      fetchingProviders.value.delete(providerId);
    }
  }

  function isTesting(providerId: string): boolean {
    return testingProviders.value.has(providerId);
  }

  function isSyncing(providerId: string): boolean {
    return syncingProviders.value.has(providerId);
  }

  function isFetching(providerId: string): boolean {
    return fetchingProviders.value.has(providerId);
  }

  function getProviderById(id: string): ProviderConfig | undefined {
    return providers.value.find(p => p.id === id);
  }

  async function addModelToProvider(
    providerId: string,
    modelId: string,
    modelName?: string,
    capabilities?: string[]
  ): Promise<boolean> {
    loading.value = true;
    try {
      console.log('[Models] addModelToProvider - providerId:', providerId);
      console.log('[Models] addModelToProvider - modelId:', modelId);
      const provider = providers.value.find(p => p.id === providerId);
      if (!provider) {
        ElMessage.error('提供商不存在');
        return false;
      }

      console.log('[Models] addModelToProvider - current provider models:', provider.models);

      // 检查模型ID是否已存在
      const existingModel = provider.models.find(m => m.id === modelId);
      if (existingModel) {
        ElMessage.warning('该模型ID已存在');
        return false;
      }

      // 创建新模型，确保包含所有必要字段
      const newModel: ModelInfo = {
        id: modelId,
        name: modelName || modelId,
        provider: providerId,
        capabilities: capabilities || ['chat'],
        description: '手动添加的模型',
        disabled: false
      };

      console.log('[Models] addModelToProvider - new model:', newModel);

      // 更新提供商模型列表
      const updatedModels = [...provider.models, newModel];

      // 创建完整的 provider 对象进行更新，确保数据能被正确序列化
      const updatedProvider = {
        ...provider,
        models: updatedModels
      };

      console.log('[Models] addModelToProvider - updated provider:', updatedProvider);

      // 深拷贝对象，避免 Vue 响应式对象无法被 Electron IPC 序列化
      const clonedProvider = JSON.parse(JSON.stringify(updatedProvider));
      const result = await updateProvider(providerId, clonedProvider);

      if (result) {
        console.log('[Models] addModelToProvider - success!');
        // 重新获取 providers 列表以确保数据同步
        await fetchProviders();
        return true;
      }
      return false;
    } catch (err) {
      console.error('添加模型失败:', err);
      ElMessage.error('添加模型失败');
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    providers,
    providerTemplates,
    loading,
    testingProviders,
    syncingProviders,
    fetchingProviders,
    enabledProviders,
    disabledProviders,
    enabledCount,
    totalCount,
    fetchProviders,
    fetchProviderTemplates,
    getProvider,
    addProvider,
    updateProvider,
    deleteProvider,
    toggleProvider,
    testProvider,
    syncOllamaModels,
    fetchModels,
    isTesting,
    isSyncing,
    isFetching,
    getProviderById,
    addModelToProvider
  };
});
