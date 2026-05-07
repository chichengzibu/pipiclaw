/**
 * PiPiClaw - 配置存储管理器
 * 
 * 职责：
 * 1. 管理应用配置（JSON文件存储）
 * 2. 配置的读取、写入、持久化
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { LogManager } from './LogManager';

export class ConfigStore {
  // 单例实例
  private static instance: ConfigStore;
  
  // 日志管理器
  private log = LogManager.getInstance();
  
  // 配置文件路径
  private configPath: string;
  
  // 内存中的配置数据
  private config: Record<string, any> = {};

  // 私有构造函数（单例模式）
  private constructor() {
    // 配置文件路径：用户数据目录下的config.json
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'config.json');
    
    this.loadConfig();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): void {
    try {
      // 确保目录存在
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // 读取配置文件
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
        this.log.info('配置加载成功', { path: this.configPath });
      } else {
        // 配置文件不存在，使用默认配置
        this.config = this.getDefaultConfig();
        this.saveConfig();
        this.log.info('使用默认配置', { path: this.configPath });
      }
    } catch (error) {
      this.log.error('配置加载失败，使用默认配置', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * 保存配置文件
   */
  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      writeFileSync(this.configPath, data, 'utf-8');
      this.log.debug('配置已保存', { path: this.configPath });
    } catch (error) {
      this.log.error('配置保存失败', error);
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): Record<string, any> {
    return {
      // 应用设置
      app: {
        theme: 'dark',
        language: 'zh-CN',
        startMinimized: false,
        autoLaunch: false
      },
      
      // 窗口设置
      window: {
        width: 1280,
        height: 800,
        x: undefined,
        y: undefined,
        isMaximized: false
      },
      
      // 网关设置（预留）
      gateway: {
        port: 18789,
        autoStart: true,
        logLevel: 'info'
      },
      
      // 模型配置（预留）
      models: [],
      
      // 权限配置（预留）
      permissions: {
        enabled: true,
        template: 'safe'
      },
      
      // 首次运行标记
      firstRun: true,
      
      // 版本信息
      version: app.getVersion()
    };
  }

  /**
   * 获取配置项
   */
  public get(key: string): any {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 设置配置项
   */
  public set(key: string, value: any): void {
    const keys = key.split('.');
    let target = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[keys[keys.length - 1]] = value;
    this.saveConfig();
  }

  /**
   * 获取所有配置
   */
  public getAll(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * 重置配置
   */
  public reset(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
    this.log.info('配置已重置');
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    ConfigStore.instance = null as any;
  }
}
