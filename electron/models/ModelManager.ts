/**
 * PiPiClaw - 模型管理器
 * 
 * 职责：
 * 1. 模型配置的增删改查
 * 2. 模型连接测试
 * 3. 模型列表同步
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { LogManager } from '../core/LogManager';
import { ModelConfig } from './ModelConfig';
import { ProviderConfig, ModelInfo, ModelTestResult } from './ModelProvider';

export class ModelManager {
  private static instance: ModelManager;
  private log = LogManager.getInstance();
  private config: ModelConfig;

  private constructor() {
    this.config = ModelConfig.getInstance();
  }

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  public getAllProviders(): ProviderConfig[] {
    return this.config.getAllProviders();
  }

  public getProvider(id: string): ProviderConfig | undefined {
    return this.config.getProvider(id);
  }

  public getEnabledProviders(): ProviderConfig[] {
    return this.config.getEnabledProviders();
  }

  public addProvider(data: {
    name: string;
    type: ProviderConfig['type'];
    enabled: boolean;
    baseUrl?: string;
    apiKey?: string;
    organization?: string;
    deploymentName?: string;
    apiVersion?: string;
    models?: ModelInfo[];
    defaultModel?: string;
    timeout?: number;
    maxRetries?: number;
  }): ProviderConfig {
    const provider = this.config.addProvider({
      name: data.name,
      type: data.type,
      enabled: data.enabled,
      baseUrl: data.baseUrl || '',
      apiKey: data.apiKey || '',
      organization: data.organization,
      deploymentName: data.deploymentName,
      apiVersion: data.apiVersion,
      models: data.models || [],
      defaultModel: data.defaultModel,
      timeout: data.timeout || 60000,
      maxRetries: data.maxRetries || 3
    });
    this.log.info(`添加模型提供商: ${provider.name}`);
    return provider;
  }

  public updateProvider(id: string, updates: Partial<ProviderConfig>): ProviderConfig | null {
    const updated = this.config.updateProvider(id, updates);
    if (updated) {
      this.log.info(`更新模型提供商: ${updated.name}`);
    }
    return updated;
  }

  public deleteProvider(id: string): boolean {
    const provider = this.config.getProvider(id);
    if (provider) {
      const deleted = this.config.deleteProvider(id);
      if (deleted) {
        this.log.info(`删除模型提供商: ${provider.name}`);
      }
      return deleted;
    }
    return false;
  }

  public setProviderEnabled(id: string, enabled: boolean): boolean {
    const result = this.config.setProviderEnabled(id, enabled);
    if (result) {
      this.log.info(`设置提供商 ${id} 启用状态: ${enabled}`);
    }
    return result;
  }

  public async testProvider(providerId: string, modelId?: string): Promise<ModelTestResult> {
    const provider = this.config.getProvider(providerId);
    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    if (!provider.enabled) {
      return { success: false, error: 'Provider is disabled' };
    }

    const startTime = Date.now();

    try {
      const result = await this.makeTestRequest(provider, modelId);
      return {
        success: result.success,
        latency: Date.now() - startTime,
        response: result.response,
        error: result.error
      };
    } catch (error: any) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error.message || 'Unknown error'
      };
    }
  }

  private async makeTestRequest(
    provider: ProviderConfig,
    modelId?: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout' });
      }, provider.timeout || 30000);

      let req: http.ClientRequest;

      switch (provider.type) {
        case 'ollama': {
          // Ollama: GET /api/tags 获取模型列表
          const url = new URL('/api/tags', provider.baseUrl);
          const protocol = url.protocol === 'https:' ? https : http;
          req = protocol.request(url, { method: 'GET' }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              clearTimeout(timeout);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, response: 'Ollama service is running' });
              } else {
                resolve({ success: false, error: `Service error: HTTP ${res.statusCode}` });
              }
            });
          });
          break;
        }

        case 'openai':
        case 'deepseek': {
          // 云厂商: GET /v1/models 获取模型列表
          const url = new URL('/v1/models', provider.baseUrl);
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${provider.apiKey || ''}`
          };
          req = protocol.request(url, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              clearTimeout(timeout);
              if (res.statusCode === 200) {
                resolve({ success: true, response: 'Connection successful' });
              } else if (res.statusCode === 401) {
                resolve({ success: false, error: 'Invalid API key' });
              } else if (res.statusCode === 403) {
                resolve({ success: false, error: 'Access forbidden' });
              } else {
                let errorMsg = `HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error?.message) errorMsg = parsed.error.message;
                  else if (parsed.error?.type) errorMsg = `${parsed.error.type}: ${parsed.error.message || ''}`;
                } catch {}
                resolve({ success: false, error: errorMsg });
              }
            });
          });
          break;
        }

        case 'anthropic': {
          // Anthropic: POST /messages
          const url = new URL('/v1/messages', provider.baseUrl);
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey || '',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          };
          const body = JSON.stringify({
            model: modelId || provider.defaultModel || 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          });
          req = protocol.request(url, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              clearTimeout(timeout);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, response: 'Connection successful' });
              } else if (res.statusCode === 401) {
                resolve({ success: false, error: 'Invalid API key' });
              } else if (res.statusCode === 403) {
                resolve({ success: false, error: 'Access forbidden' });
              } else {
                let errorMsg = `HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error?.message) errorMsg = parsed.error.message;
                } catch {}
                resolve({ success: false, error: errorMsg });
              }
            });
          });
          req.write(body);
          break;
        }

        case 'azure': {
          // Azure: POST 到 chat completions
          const deploymentName = provider.deploymentName || modelId || provider.defaultModel || 'gpt-4';
          const url = new URL(`/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || '2024-02-01'}`, provider.baseUrl);
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'api-key': provider.apiKey || ''
          };
          const body = JSON.stringify({
            model: deploymentName,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          });
          req = protocol.request(url, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              clearTimeout(timeout);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, response: 'Connection successful' });
              } else if (res.statusCode === 401) {
                resolve({ success: false, error: 'Invalid API key' });
              } else if (res.statusCode === 404) {
                resolve({ success: false, error: 'Deployment not found, please check deployment name' });
              } else {
                let errorMsg = `HTTP ${res.statusCode}`;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error?.message) errorMsg = parsed.error.message;
                  else if (parsed.error?.code) errorMsg = `${parsed.error.code}: ${parsed.error.message || ''}`;
                } catch {}
                resolve({ success: false, error: errorMsg });
              }
            });
          });
          req.write(body);
          break;
        }

        case 'custom': {
          // Custom: GET /v1/models
          const url = new URL('/v1/models', provider.baseUrl);
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {};
          if (provider.apiKey) {
            headers['Authorization'] = `Bearer ${provider.apiKey}`;
          }
          req = protocol.request(url, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              clearTimeout(timeout);
              if (res.statusCode === 200) {
                resolve({ success: true, response: 'Connection successful' });
              } else {
                resolve({ success: false, error: `HTTP ${res.statusCode}` });
              }
            });
          });
          break;
        }

        default:
          clearTimeout(timeout);
          resolve({ success: false, error: `Unsupported provider type: ${provider.type}` });
          return;
      }

      req.on('error', (error) => {
        clearTimeout(timeout);
        if (error.message.includes('ECONNREFUSED')) {
          resolve({ success: false, error: 'Connection refused, please check if service is running' });
        } else if (error.message.includes('ENOTFOUND')) {
          resolve({ success: false, error: 'Host not found, please check the base URL' });
        } else {
          resolve({ success: false, error: error.message });
        }
      });

      req.end();
    });
  }

  public async syncOllamaModels(providerId: string): Promise<ModelInfo[]> {
    const provider = this.config.getProvider(providerId);
    if (!provider || provider.type !== 'ollama') {
      return [];
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve([]);
      }, provider.timeout || 30000);

      http.get(`${provider.baseUrl}/api/tags`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            const parsed = JSON.parse(data);
            const models: ModelInfo[] = (parsed.models || []).map((m: any) => ({
              id: m.name,
              name: m.name,
              provider: providerId,
              capabilities: ['chat'],
              contextWindow: m.size ? Math.round(m.size / 1024 / 1024 / 1024 * 10) * 1024 * 1024 * 1024 / 2 : undefined,
              description: m.details?.parameter_size || ''
            }));
            this.config.updateProvider(providerId, { models });
            resolve(models);
          } catch {
            resolve([]);
          }
        });
      }).on('error', () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }

  public destroy(): void {
    ModelManager.instance = null as any;
  }
}
