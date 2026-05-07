/**
 * PiPiClaw - 消息网关（多平台远程控制）
 */

import { LogManager } from '../core/LogManager';
import { ConfigStore } from '../core/ConfigStore';

export interface RemoteControlConfig {
  wechat: {
    enabled: boolean;
    webhookUrl?: string;
    secret?: string;
  };
  feishu: {
    enabled: boolean;
    webhookUrl?: string;
    secret?: string;
  };
  telegram: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
  };
}

export class MessageGateway {
  private static instance: MessageGateway;
  private log = LogManager.getInstance();
  private configStore = ConfigStore.getInstance();
  private config: RemoteControlConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): MessageGateway {
    if (!MessageGateway.instance) {
      MessageGateway.instance = new MessageGateway();
    }
    return MessageGateway.instance;
  }

  private loadConfig(): RemoteControlConfig {
    const defaultConfig: RemoteControlConfig = {
      wechat: { enabled: false },
      feishu: { enabled: false },
      telegram: { enabled: false }
    };
    
    try {
      const saved = this.configStore.get('remoteControl') as RemoteControlConfig;
      if (saved) {
        return { ...defaultConfig, ...saved };
      }
    } catch (error) {
      this.log.error('[MessageGateway] 加载配置失败:', error);
    }
    
    return defaultConfig;
  }

  private saveConfig(): void {
    try {
      this.configStore.set('remoteControl', this.config);
    } catch (error) {
      this.log.error('[MessageGateway] 保存配置失败:', error);
    }
  }

  public getConfig(): RemoteControlConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<RemoteControlConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.log.info('[MessageGateway] 配置已更新');
  }

  public async sendMessage(platform: keyof RemoteControlConfig, message: string): Promise<boolean> {
    try {
      this.log.info(`[MessageGateway] 发送消息到 ${platform}`, { message });
      return true;
    } catch (error: any) {
      this.log.error(`[MessageGateway] 发送消息到 ${platform} 失败`, error);
      return false;
    }
  }

  public async pushExecutionResult(platform: keyof RemoteControlConfig, result: any): Promise<boolean> {
    const message = `任务执行结果：${result.success ? '成功' : '失败'}`;
    return this.sendMessage(platform, message);
  }
}
