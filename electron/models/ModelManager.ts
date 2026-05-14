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
import { ProviderConfig, ModelInfo, ModelTestResult, PROVIDER_DEFAULTS } from './ModelProvider';

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

  public getTemplates(): Array<{ name: string; type: string; defaultConfig: Partial<ProviderConfig> }> {
    const templates = Object.entries(PROVIDER_DEFAULTS).map(([type, config]) => ({
      name: config.name || type,
      type: type,
      defaultConfig: config
    }));
    this.log.info('获取模型提供商模板', { count: templates.length });
    return templates;
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
    this.log.info('添加模型提供商', { providerName: provider.name });
    return provider;
  }

  public updateProvider(id: string, updates: Partial<ProviderConfig>): ProviderConfig | null {
    const updated = this.config.updateProvider(id, updates);
    if (updated) {
      this.log.info('更新模型提供商', { providerName: updated.name });
    }
    return updated;
  }

  public deleteProvider(id: string): boolean {
    const provider = this.config.getProvider(id);
    if (provider) {
      const deleted = this.config.deleteProvider(id);
      if (deleted) {
        this.log.info('删除模型提供商', { providerName: provider.name });
      }
      return deleted;
    }
    return false;
  }

  public setProviderEnabled(id: string, enabled: boolean): boolean {
    const result = this.config.setProviderEnabled(id, enabled);
    if (result) {
      this.log.info('设置提供商启用状态', { providerId: id, enabled });
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

  public async fetchModels(providerId: string): Promise<{ success: boolean; models: ModelInfo[]; error?: string }> {
    const provider = this.config.getProvider(providerId);
    if (!provider) {
      return { success: false, models: [], error: 'Provider not found' };
    }

    const isVolcEngine = provider.type === 'volc_ark' || provider.baseUrl?.includes('volces.com');

    if (isVolcEngine) {
      try {
        const url = this.buildUrl(provider.baseUrl || '', '/models');
        const protocol = url.protocol === 'https:' ? https : http;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${provider.apiKey || ''}`
        };

        const result = await this.makeHttpRequest(protocol, url, 'GET', headers, undefined, provider.timeout || 60000);

        if (result.success && result.data?.data) {
          const models: ModelInfo[] = result.data.data.map((m: any) => ({
            id: m.id,
            name: m.id,
            provider: providerId,
            capabilities: ['chat'],
            description: m.description || ''
          }));
          this.config.updateProvider(providerId, { models });
          return { success: true, models };
        } else {
          return {
            success: false,
            models: [],
            error: result.error || '获取模型列表失败，请手动添加模型。'
          };
        }
      } catch (error: any) {
        this.log.warn('火山引擎模型获取失败', { error: error.message });
        return {
          success: false,
          models: [],
          error: '获取模型列表失败，请手动添加模型。'
        };
      }
    }

    if (provider.type === 'ollama') {
      const models = await this.syncOllamaModels(providerId);
      return { success: true, models };
    }

    try {
      const url = this.buildUrl(provider.baseUrl || '', '/v1/models');
      const protocol = url.protocol === 'https:' ? https : http;
      const headers: Record<string, string> = {};
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const result = await this.makeHttpRequest(protocol, url, 'GET', headers, undefined, provider.timeout || 60000);

      if (result.success && result.data?.data) {
        const models: ModelInfo[] = result.data.data.map((m: any) => ({
          id: m.id,
          name: m.id,
          provider: providerId,
          capabilities: ['chat'],
          description: m.description || ''
        }));
        this.config.updateProvider(providerId, { models });
        return { success: true, models };
      } else {
        return { success: false, models: [], error: result.error || 'Failed to fetch models' };
      }
    } catch (error: any) {
      return { success: false, models: [], error: error.message };
    }
  }

  private buildUrl(baseUrl: string, path: string): URL {
    let cleanBaseUrl = baseUrl;
    if (cleanBaseUrl.endsWith('/')) {
      cleanBaseUrl = cleanBaseUrl.slice(0, -1);
    }
    let cleanPath = path;
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }
    return new URL(`${cleanBaseUrl}/${cleanPath}`);
  }

  private async makeHttpRequest(
    protocol: typeof https | typeof http,
    url: URL,
    method: string,
    headers: Record<string, string>,
    body?: any,
    timeout?: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      const requestTimeout = timeout || 30000;
      const timeoutHandle = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, requestTimeout);

      const options: http.RequestOptions = {
        method,
        headers
      };

      // 请求前详细日志
      const sanitizedHeaders = { ...headers };
      if (sanitizedHeaders['Authorization']) {
        const authParts = sanitizedHeaders['Authorization'].split(' ');
        if (authParts.length === 2 && authParts[0].toLowerCase() === 'bearer') {
          const token = authParts[1];
          sanitizedHeaders['Authorization'] = `Bearer ${token.substring(0, 8)}...`;
        }
      }
      if (sanitizedHeaders['x-api-key']) {
        const token = sanitizedHeaders['x-api-key'];
        sanitizedHeaders['x-api-key'] = `${token.substring(0, 8)}...`;
      }
      if (sanitizedHeaders['api-key']) {
        const token = sanitizedHeaders['api-key'];
        sanitizedHeaders['api-key'] = `${token.substring(0, 8)}...`;
      }

      this.log.info('发起 HTTP 请求', {
        method,
        url: url.toString(),
        headers: sanitizedHeaders
      });

      const req = protocol.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeoutHandle);
          
          // 响应后详细日志 - 打印完整原始响应体
          this.log.info('收到 HTTP 响应', {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            rawBody: data
          });

          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: parsed });
            } else {
              let errorMsg = `HTTP ${res.statusCode}`;
              if (parsed.error?.message) errorMsg = parsed.error.message;
              else if (parsed.error?.type) errorMsg = `${parsed.error.type}: ${parsed.error.message || ''}`;
              resolve({ success: false, error: errorMsg });
            }
          } catch (error: any) {
            this.log.error('JSON 解析失败', { 
              errorMessage: error.message,
              errorStack: error.stack,
              rawBody: data 
            });
            resolve({ success: false, error: 'Invalid response format' });
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutHandle);
        this.log.error('HTTP 请求错误', { error: error.message });
        resolve({ success: false, error: error.message });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  private async makeTestRequest(
    provider: ProviderConfig,
    modelId?: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    const isVolcEngine = provider.type === 'volc_ark' || provider.baseUrl?.includes('volces.com');

    if (isVolcEngine) {
      // 火山引擎特殊处理
      const testModelId = modelId || provider.defaultModel || (provider.models && provider.models.length > 0 ? provider.models[0].id : undefined);
      
      if (!testModelId) {
        return {
          success: false,
          error: '请先在编辑中填写模型 ID'
        };
      }

      try {
        const url = this.buildUrl(provider.baseUrl || '', '/chat/completions');
        const protocol = url.protocol === 'https:' ? https : http;
        // 标准的 Bearer Token 鉴权，不做任何编码
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey || ''}`
        };
        const body = {
          model: testModelId,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        };

        // 发送请求前的关键日志
        this.log.info('[火山引擎] 发送请求前', {
          url: url.toString(),
          method: 'POST',
          testModelId,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey ? (provider.apiKey.substring(0, 8) + '...') : 'empty'}`
          },
          body
        });

        const result = await this.makeHttpRequest(protocol, url, 'POST', headers, body, provider.timeout || 30000);

        // 收到响应后的关键日志
        this.log.info('[火山引擎] 收到响应', {
          success: result.success,
          data: result.data,
          error: result.error
        });

        if (result.success) {
          this.log.info('[火山引擎] 连接测试成功');
          return { success: true, response: 'Connection successful' };
        } else {
          this.log.error('[火山引擎] 连接测试失败', { error: result.error });
          return { success: false, error: result.error };
        }
      } catch (error: any) {
        this.log.error('[火山引擎] 连接测试异常', { error: error.message, stack: error.stack });
        return { success: false, error: error.message };
      }
    }

    switch (provider.type) {
      case 'ollama': {
        try {
          const url = this.buildUrl(provider.baseUrl || '', '/api/tags');
          const protocol = url.protocol === 'https:' ? https : http;
          const result = await this.makeHttpRequest(protocol, url, 'GET', {}, undefined, provider.timeout || 30000);
          if (result.success) {
            return { success: true, response: 'Ollama service is running' };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }

      case 'openai':
      case 'deepseek':
      case 'volc_ark':
      case 'openrouter':
      case 'custom': {
        try {
          const url = this.buildUrl(provider.baseUrl || '', '/v1/models');
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {};
          if (provider.apiKey) {
            headers['Authorization'] = `Bearer ${provider.apiKey}`;
          }
          const result = await this.makeHttpRequest(protocol, url, 'GET', headers, undefined, provider.timeout || 30000);
          if (result.success) {
            return { success: true, response: 'Connection successful' };
          } else if (result.error?.includes('401')) {
            return { success: false, error: 'Invalid API key' };
          } else if (result.error?.includes('403')) {
            return { success: false, error: 'Access forbidden' };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error: any) {
          if (error.message?.includes('ECONNREFUSED')) {
            return { success: false, error: 'Connection refused, please check if service is running' };
          } else if (error.message?.includes('ENOTFOUND')) {
            return { success: false, error: 'Host not found, please check the base URL' };
          } else {
            return { success: false, error: error.message };
          }
        }
      }

      case 'anthropic': {
        try {
          const url = this.buildUrl(provider.baseUrl || '', '/v1/messages');
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey || '',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          };
          const body = {
            model: modelId || provider.defaultModel || 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hello' }]
          };
          const result = await this.makeHttpRequest(protocol, url, 'POST', headers, body, provider.timeout || 30000);
          if (result.success) {
            return { success: true, response: 'Connection successful' };
          } else if (result.error?.includes('401')) {
            return { success: false, error: 'Invalid API key' };
          } else if (result.error?.includes('403')) {
            return { success: false, error: 'Access forbidden' };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error: any) {
          if (error.message?.includes('ECONNREFUSED')) {
            return { success: false, error: 'Connection refused, please check if service is running' };
          } else if (error.message?.includes('ENOTFOUND')) {
            return { success: false, error: 'Host not found, please check the base URL' };
          } else {
            return { success: false, error: error.message };
          }
        }
      }

      case 'azure': {
        try {
          const deploymentName = provider.deploymentName || modelId || provider.defaultModel || 'gpt-4';
          const url = this.buildUrl(provider.baseUrl || '', `/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || '2024-02-01'}`);
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'api-key': provider.apiKey || ''
          };
          const body = {
            model: deploymentName,
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 10
          };
          const result = await this.makeHttpRequest(protocol, url, 'POST', headers, body, provider.timeout || 30000);
          if (result.success) {
            return { success: true, response: 'Connection successful' };
          } else if (result.error?.includes('401')) {
            return { success: false, error: 'Invalid API key' };
          } else if (result.error?.includes('404')) {
            return { success: false, error: 'Deployment not found, please check deployment name' };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error: any) {
          if (error.message?.includes('ECONNREFUSED')) {
            return { success: false, error: 'Connection refused, please check if service is running' };
          } else if (error.message?.includes('ENOTFOUND')) {
            return { success: false, error: 'Host not found, please check the base URL' };
          } else {
            return { success: false, error: error.message };
          }
        }
      }

      default:
        return { success: false, error: `Unsupported provider type: ${provider.type}` };
    }
  }

  public async syncOllamaModels(providerId: string): Promise<ModelInfo[]> {
    const provider = this.config.getProvider(providerId);
    if (!provider || provider.type !== 'ollama') {
      return [];
    }

    try {
      const url = this.buildUrl(provider.baseUrl || '', '/api/tags');
      const protocol = url.protocol === 'https:' ? https : http;
      const result = await this.makeHttpRequest(protocol, url, 'GET', {}, undefined, provider.timeout || 30000);
      if (result.success && result.data?.models) {
        const models: ModelInfo[] = result.data.models.map((m: any) => ({
          id: m.name,
          name: m.name,
          provider: providerId,
          capabilities: ['chat'],
          contextWindow: m.size ? Math.round(m.size / 1024 / 1024 / 1024 * 10) * 1024 * 1024 * 1024 / 2 : undefined,
          description: m.details?.parameter_size || ''
        }));
        this.config.updateProvider(providerId, { models });
        return models;
      }
      return [];
    } catch {
      return [];
    }
  }

  public destroy(): void {
    ModelManager.instance = null as any;
  }
}
