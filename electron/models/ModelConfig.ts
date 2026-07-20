/**
 * PiPiClaw - 模型配置管理器
 * 
 * 职责：
 * 1. 模型配置的持久化存储
 * 2. 提供配置的读取、写入接口
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { LogManager } from '../core/LogManager';
import { ProviderConfig } from './ModelProvider';

export class ModelConfig {
  private static instance: ModelConfig;
  private log = LogManager.getInstance();
  private configPath: string;
  private providers: Map<string, ProviderConfig> = new Map();

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'models.json');
    this.loadConfig();
  }

  public static getInstance(): ModelConfig {
    if (!ModelConfig.instance) {
      ModelConfig.instance = new ModelConfig();
    }
    return ModelConfig.instance;
  }

  private loadConfig(): void {
    try {
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.providers.clear();
        for (const provider of parsed.providers || []) {
          this.providers.set(provider.id, provider);
        }
        this.log.info('模型配置加载成功', { count: this.providers.size });
      } else {
        this.initDefaultProviders();
        this.saveConfig();
        this.log.info('初始化默认模型配置');
      }
    } catch (error) {
      this.log.error('模型配置加载失败', error);
      this.initDefaultProviders();
    }
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify({
        version: app.getVersion(),
        providers: Array.from(this.providers.values())
      }, null, 2);
      writeFileSync(this.configPath, data, 'utf-8');
      this.log.debug('模型配置已保存');
    } catch (error) {
      this.log.error('模型配置保存失败', error);
    }
  }

  private initDefaultProviders(): void {
    this.providers.clear();
    
    const openaiProvider: ProviderConfig = {
      id: 'provider_openai_default',
      name: 'OpenAI',
      type: 'openai',
      enabled: false,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'provider_openai_default',
          capabilities: ['chat', 'vision'],
          contextWindow: 128000,
          description: '最新最强多模态模型'
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'provider_openai_default',
          capabilities: ['chat', 'vision'],
          contextWindow: 128000,
          description: '高速低成本GPT-4'
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'provider_openai_default',
          capabilities: ['chat'],
          contextWindow: 16385,
          description: '快速响应模型'
        }
      ],
      defaultModel: 'gpt-4o',
      timeout: 60000,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const anthropicProvider: ProviderConfig = {
      id: 'provider_anthropic_default',
      name: 'Anthropic',
      type: 'anthropic',
      enabled: false,
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: '',
      models: [
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4',
          provider: 'provider_anthropic_default',
          capabilities: ['chat', 'vision'],
          contextWindow: 200000,
          description: '平衡性能与成本'
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'provider_anthropic_default',
          capabilities: ['chat', 'vision'],
          contextWindow: 200000,
          description: '快速精准'
        },
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          provider: 'provider_anthropic_default',
          capabilities: ['chat', 'vision'],
          contextWindow: 200000,
          description: '最强推理能力'
        }
      ],
      defaultModel: 'claude-sonnet-4-20250514',
      timeout: 60000,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const deepseekProvider: ProviderConfig = {
      id: 'provider_deepseek_default',
      name: 'DeepSeek',
      type: 'deepseek',
      enabled: false,
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      models: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          provider: 'provider_deepseek_default',
          capabilities: ['chat'],
          contextWindow: 64000,
          description: '通用对话模型'
        },
        {
          id: 'deepseek-coder',
          name: 'DeepSeek Coder',
          provider: 'provider_deepseek_default',
          capabilities: ['completion'],
          contextWindow: 64000,
          description: '代码专用模型'
        }
      ],
      defaultModel: 'deepseek-chat',
      timeout: 60000,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const ollamaProvider: ProviderConfig = {
      id: 'provider_ollama_default',
      name: 'Ollama',
      type: 'ollama',
      enabled: true,
      baseUrl: 'http://localhost:11434',
      models: [], // 空模型列表，从 Ollama API 动态获取
      defaultModel: undefined,
      timeout: 30000,
      maxRetries: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.providers.set(openaiProvider.id, openaiProvider);
    this.providers.set(anthropicProvider.id, anthropicProvider);
    this.providers.set(deepseekProvider.id, deepseekProvider);
    this.providers.set(ollamaProvider.id, ollamaProvider);
  }

  public getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  public getProvider(id: string): ProviderConfig | undefined {
    return this.providers.get(id);
  }

  public addProvider(config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): ProviderConfig {
    const id = `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const provider: ProviderConfig = {
      ...config,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.providers.set(id, provider);
    this.saveConfig();
    return provider;
  }

  public updateProvider(id: string, updates: Partial<ProviderConfig>): ProviderConfig | null {
    const provider = this.providers.get(id);
    if (!provider) {
      return null;
    }

    const updated: ProviderConfig = {
      ...provider,
      ...updates,
      id: provider.id,
      createdAt: provider.createdAt,
      updatedAt: Date.now()
    };

    this.providers.set(id, updated);
    this.saveConfig();
    return updated;
  }

  public deleteProvider(id: string): boolean {
    const deleted = this.providers.delete(id);
    if (deleted) {
      this.saveConfig();
    }
    return deleted;
  }

  public getEnabledProviders(): ProviderConfig[] {
    return this.getAllProviders().filter(p => p.enabled);
  }

  public getProviderModels(providerId: string): ProviderConfig['models'] {
    const provider = this.providers.get(providerId);
    return provider?.models || [];
  }

  public setProviderEnabled(id: string, enabled: boolean): boolean {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }
    provider.enabled = enabled;
    provider.updatedAt = Date.now();
    this.saveConfig();
    return true;
  }

  public destroy(): void {
    ModelConfig.instance = null as any;
  }
}
