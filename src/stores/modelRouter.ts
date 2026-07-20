/**
 * PiPiClaw - 智能模型路由状态管理
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useModelsStore } from '@/stores/models';

export interface ModelRule {
  id: string;
  name: string;
  description: string;
  condition: 'simple' | 'complex' | 'code' | 'multimodal';
}

const DEFAULT_RULES: ModelRule[] = [
  {
    id: 'simple',
    name: '简单问答',
    description: '简单问候、日常对话',
    condition: 'simple'
  },
  {
    id: 'complex',
    name: '复杂推理',
    description: '深度思考、复杂问题',
    condition: 'complex'
  },
  {
    id: 'code',
    name: '代码生成',
    description: '写代码、代码审查',
    condition: 'code'
  },
  {
    id: 'multimodal',
    name: '多模态理解',
    description: '图片理解、文档解析',
    condition: 'multimodal'
  }
];

export const useModelRouterStore = defineStore('modelRouter', () => {
  const isAutoMode = ref(false);
  const rules = ref<ModelRule[]>(DEFAULT_RULES);
  
  const modelsStore = useModelsStore();

  function toggleAutoMode(): void {
    isAutoMode.value = !isAutoMode.value;
  }

  function setAutoMode(enabled: boolean): void {
    isAutoMode.value = enabled;
  }

  function updateRule(ruleId: string, updates: Partial<ModelRule>): void {
    const index = rules.value.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      rules.value[index] = { ...rules.value[index], ...updates };
    }
  }

  function analyzeMessageComplexity(content: string, hasAttachments: boolean): 'simple' | 'complex' | 'code' | 'multimodal' {
    if (hasAttachments) {
      return 'multimodal';
    }

    const codeKeywords = ['代码', '写', '生成', '函数', '类', 'Python', 'Java', 'JavaScript', '爬虫', 'CRUD'];
    const hasCode = codeKeywords.some(keyword => content.includes(keyword));
    if (hasCode) {
      return 'code';
    }

    const complexKeywords = ['分析', '推理', '思考', '为什么', '如何', '解释', '方案', '计划', '设计'];
    const hasComplex = complexKeywords.some(keyword => content.includes(keyword));
    if (hasComplex || content.length > 200) {
      return 'complex';
    }

    return 'simple';
  }

  function getModelForMessage(_content: string, _hasAttachments: boolean): { providerId: string; modelId: string } | null {
    const enabledProviders = modelsStore.enabledProviders;
    
    // 筛选出可用的提供商：有API配置且有可用模型
    const availableProviders = enabledProviders.filter(provider => {
      const hasAvailableModels = provider.models.some(m => !m.disabled && m.connected !== false);
      const hasConfig = !!provider.apiKey || provider.type === 'ollama'; // Ollama不需要API key
      return hasAvailableModels && hasConfig;
    });

    if (availableProviders.length === 0) {
      return null;
    }

    // 使用第一个可用的 provider 和其第一个可用 model
    const defaultProvider = availableProviders[0];
    const defaultModel = defaultProvider.models.find(m => !m.disabled && m.connected !== false);
    
    if (!defaultModel) {
      return null;
    }

    return { providerId: defaultProvider.id, modelId: defaultModel.id };
  }

  return {
    isAutoMode,
    rules,
    toggleAutoMode,
    setAutoMode,
    updateRule,
    analyzeMessageComplexity,
    getModelForMessage
  };
});