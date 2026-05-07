/**
 * PiPiClaw - 网关配置管理（修复版）
 * 
 * 职责：
 * 1. 网关配置的读写和持久化
 * 2. 和ConfigStore打通，实现配置热更新
 * 3. 默认值管理
 * 4. 移除对不存在的openclaw.mjs文件依赖
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

// ========== 类型定义（内联，避免Vite解析.d.ts问题）==========

export interface GatewayStoredConfig {
  autoStart: boolean;
  defaultPort: number;
  timeout: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customArgs: string[];
}

export const DEFAULT_GATEWAY_CONFIG: GatewayStoredConfig = {
  autoStart: true,
  defaultPort: 18789,
  timeout: 60000,
  logLevel: 'info',
  customArgs: []
};

// ========== GatewayConfig 类 ==========

import { LogManager } from '../core/LogManager';

export class GatewayConfig {
  private static instance: GatewayConfig;
  private log = LogManager.getInstance();
  private configPath: string;
  private config: GatewayStoredConfig;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'gateway-config.json');
    this.config = this.loadConfig();
    this.log.info('GatewayConfig 初始化完成');
  }

  public static getInstance(): GatewayConfig {
    if (!GatewayConfig.instance) {
      GatewayConfig.instance = new GatewayConfig();
    }
    return GatewayConfig.instance;
  }

  private loadConfig(): GatewayStoredConfig {
    try {
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.log.info('网关配置加载成功', { path: this.configPath });
        return { ...DEFAULT_GATEWAY_CONFIG, ...parsed };
      } else {
        this.config = { ...DEFAULT_GATEWAY_CONFIG };
        this.saveConfig();
        this.log.info('使用默认网关配置', { path: this.configPath });
        return this.config;
      }
    } catch (error) {
      this.log.error('网关配置加载失败，使用默认配置', error);
      return { ...DEFAULT_GATEWAY_CONFIG };
    }
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, data, 'utf-8');
      this.log.debug('网关配置已保存', { path: this.configPath });
    } catch (error) {
      this.log.error('网关配置保存失败', error);
    }
  }

  public getConfig(): GatewayStoredConfig {
    return { ...this.config };
  }

  public get<K extends keyof GatewayStoredConfig>(key: K): GatewayStoredConfig[K] {
    return this.config[key];
  }

  public set<K extends keyof GatewayStoredConfig>(
    key: K, 
    value: GatewayStoredConfig[K]
  ): void {
    this.config[key] = value;
    this.saveConfig();
    this.log.info(`网关配置更新: ${key} = ${JSON.stringify(value)}`);
  }

  public setAll(config: Partial<GatewayStoredConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    this.log.info('网关配置批量更新', config);
  }

  // ========== 移除对不存在文件的依赖 ==========

  public isOpenClawExists(): boolean {
    // 现在我们使用内置的OpenClawServer，不再依赖外部文件
    // 始终返回true
    this.log.debug('OpenClaw服务检查: 使用内置服务，无需外部文件');
    return true;
  }

  public getOpenClawPath(): string {
    // 不再返回外部文件路径
    const isDev = !app.isPackaged;
    const basePath = isDev ? app.getAppPath() : process.resourcesPath || app.getAppPath();
    const dummyPath = join(basePath, 'openclaw', 'openclaw.mjs');
    this.log.debug('OpenClaw路径(已过时，使用内置服务)', { path: dummyPath });
    return dummyPath;
  }

  // ========== 其他配置获取方法 ==========

  public getNodePath(): string {
    return process.execPath;
  }

  public getTimeout(): number {
    return this.config.timeout || 60000;
  }

  public getDefaultPort(): number {
    return this.config.defaultPort || 18789;
  }

  public isAutoStart(): boolean {
    return this.config.autoStart !== false;
  }

  public reset(): void {
    this.config = { ...DEFAULT_GATEWAY_CONFIG };
    this.saveConfig();
    this.log.info('网关配置已重置为默认值');
  }

  public destroy(): void {
    GatewayConfig.instance = null as any;
  }
}
