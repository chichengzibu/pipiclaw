/**
 * PiPiClaw - 聊天配置管理器
 * 
 * 职责：
 * 1. 会话和消息的持久化存储
 * 2. 聊天设置的存储
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { LogManager } from '../core/LogManager';
import { Conversation, ChatMessage, ChatSettings, DEFAULT_CHAT_SETTINGS } from './ChatTypes';

export class ChatConfig {
  private static instance: ChatConfig;
  private log = LogManager.getInstance();
  private configPath: string;
  private conversations: Map<string, Conversation> = new Map();
  private settings: ChatSettings = { ...DEFAULT_CHAT_SETTINGS };
  private lastProviderId: string | null = null;
  private lastModelId: string | null = null;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'chat.json');
    this.loadConfig();
  }

  public static getInstance(): ChatConfig {
    if (!ChatConfig.instance) {
      ChatConfig.instance = new ChatConfig();
    }
    return ChatConfig.instance;
  }

  private loadConfig(): void {
    try {
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (existsSync(this.configPath)) {
        try {
          const data = readFileSync(this.configPath, 'utf-8');
          
          // 尝试解析，同时备份旧文件
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (jsonError) {
            this.log.warn('聊天配置 JSON 解析失败，尝试备份和恢复', jsonError);
            
            // 备份损坏的文件
            const backupPath = `${this.configPath}.backup.${Date.now()}`;
            try {
              writeFileSync(backupPath, data, 'utf-8');
              this.log.info('已备份损坏的聊天配置', { path: backupPath });
            } catch (backupError) {
              this.log.error('备份失败', backupError);
            }
            
            throw jsonError;
          }
          
          // 验证数据结构完整性
          if (!Array.isArray(parsed.conversations)) {
            this.log.warn('配置文件中 conversations 格式错误，使用默认值');
            parsed.conversations = [];
          }
          
          if (!parsed.settings) {
            parsed.settings = { ...DEFAULT_CHAT_SETTINGS };
          }
          
          // 加载配置
          this.conversations.clear();
          for (const conv of parsed.conversations) {
            // 验证单个会话的完整性
            if (conv && typeof conv.id === 'string') {
              // 确保必要字段存在
              const safeConv = {
                id: conv.id,
                title: conv.title || '新对话',
                messages: Array.isArray(conv.messages) ? conv.messages : [],
                providerId: conv.providerId || undefined,
                modelId: conv.modelId || undefined,
                permissionSetId: conv.permissionSetId || undefined,
                createdAt: conv.createdAt || Date.now(),
                updatedAt: conv.updatedAt || Date.now(),
                status: ['active', 'archived'].includes(conv.status) ? conv.status : 'active',
                pinned: !!conv.pinned
              };
              this.conversations.set(safeConv.id, safeConv);
            }
          }
          
          // 验证并合并设置
          this.settings = { ...DEFAULT_CHAT_SETTINGS };
          if (parsed.settings) {
            for (const key of Object.keys(DEFAULT_CHAT_SETTINGS)) {
              if (typeof parsed.settings[key] !== 'undefined') {
                this.settings[key as keyof ChatSettings] = parsed.settings[key];
              }
            }
          }
          
          this.lastProviderId = parsed.lastProviderId || null;
          this.lastModelId = parsed.lastModelId || null;
          
          this.log.info('聊天配置加载成功', { count: this.conversations.size });
          
        } catch (error) {
          this.log.error('读取聊天配置失败，重置为默认值', error);
          this.initDefault();
          this.saveConfig(); // 立即保存默认值以避免下次启动仍失败
        }
      } else {
        this.initDefault();
        this.saveConfig();
        this.log.info('初始化默认聊天配置');
      }
    } catch (error) {
      this.log.error('聊天配置加载过程中发生错误', error);
      this.initDefault();
    }
  }

  private initDefault(): void {
    this.conversations.clear();
    this.settings = { ...DEFAULT_CHAT_SETTINGS };
    this.lastProviderId = null;
    this.lastModelId = null;
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify({
        version: app.getVersion(),
        conversations: Array.from(this.conversations.values()),
        settings: this.settings,
        lastProviderId: this.lastProviderId,
        lastModelId: this.lastModelId
      }, null, 2);
      writeFileSync(this.configPath, data, 'utf-8');
      this.log.debug('聊天配置已保存');
    } catch (error) {
      this.log.error('聊天配置保存失败', error);
    }
  }

  public getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getActiveConversations(): Conversation[] {
    return this.getAllConversations()
      .filter(c => c.status === 'active');
  }

  public getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  public getMessage(conversationId: string, messageId: string): ChatMessage | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return undefined;
    return conversation.messages.find(m => m.id === messageId);
  }

  public createConversation(data?: {
    title?: string;
    providerId?: string;
    modelId?: string;
    permissionSetId?: string;
    messages?: ChatMessage[];
  }): Conversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const conversation: Conversation = {
      id,
      title: data?.title || `新对话 ${new Date().toLocaleString('zh-CN')}`,
      messages: data?.messages || [],
      providerId: data?.providerId || this.lastProviderId || undefined,
      modelId: data?.modelId || this.lastModelId || undefined,
      permissionSetId: data?.permissionSetId,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      pinned: false
    };

    this.conversations.set(id, conversation);
    this.saveConfig();
    return conversation;
  }

  public updateConversation(id: string, updates: Partial<Conversation>): Conversation | null {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return null;
    }

    const updated: Conversation = {
      ...conversation,
      ...updates,
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: Date.now()
    };

    this.conversations.set(id, updated);
    this.saveConfig();
    return updated;
  }

  public addMessage(conversationId: string, message: ChatMessage): ChatMessage | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    // 如果消息没有完整属性，补充它们
    const fullMessage: ChatMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: message.timestamp || Date.now(),
      status: message.status || 'sent'
    };

    conversation.messages.push(fullMessage);
    conversation.updatedAt = Date.now();

    if (conversation.messages.length === 1) {
      conversation.title = this.generateTitle(fullMessage.content);
    }

    this.saveConfig();
    return fullMessage;
  }

  public updateMessage(conversationId: string, messageId: string, updates: Partial<ChatMessage>): ChatMessage | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    const msgIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
      return null;
    }

    conversation.messages[msgIndex] = {
      ...conversation.messages[msgIndex],
      ...updates
    };

    conversation.updatedAt = Date.now();
    this.saveConfig();
    return conversation.messages[msgIndex];
  }

  public createStreamingMessage(conversationId: string, message: ChatMessage): ChatMessage | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    // 如果消息已经有 ID（从 ChatManager 传入），直接使用；否则生成新 ID
    const fullMessage: ChatMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: 'streaming'
    };

    conversation.messages.push(fullMessage);
    conversation.updatedAt = Date.now();
    return fullMessage;
  }

  public appendStreamingContent(conversationId: string, messageId: string, content: string, thinking?: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    const msg = conversation.messages.find(m => m.id === messageId);
    if (!msg) return;

    if (thinking !== undefined) {
      msg.thinking = thinking;
    }
    if (content !== undefined) {
      msg.content = content;
    }
    msg.timestamp = Date.now();
  }

  public finalizeStreamingMessage(conversationId: string, messageId: string, status: 'sent' | 'error', error?: string): ChatMessage | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const msg = conversation.messages.find(m => m.id === messageId);
    if (!msg) return null;

    msg.status = status;
    msg.timestamp = Date.now();
    if (error) msg.error = error;

    conversation.updatedAt = Date.now();
    this.saveConfig();
    return msg;
  }

  public deleteMessage(conversationId: string, messageId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return false;
    }

    const msgIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
      return false;
    }

    conversation.messages.splice(msgIndex, 1);
    conversation.updatedAt = Date.now();
    this.saveConfig();
    return true;
  }

  public deleteConversation(id: string): boolean {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.saveConfig();
    }
    return deleted;
  }

  public archiveConversation(id: string): Conversation | null {
    return this.updateConversation(id, { status: 'archived' });
  }

  public pinConversation(id: string, pinned: boolean): Conversation | null {
    return this.updateConversation(id, { pinned });
  }

  private generateTitle(content: string): string {
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 30) {
      return firstLine;
    }
    return firstLine.substring(0, 27) + '...';
  }

  public getSettings(): ChatSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<ChatSettings>): ChatSettings {
    this.settings = { ...this.settings, ...updates };
    this.saveConfig();
    return this.settings;
  }

  public setLastProvider(providerId: string): void {
    this.lastProviderId = providerId;
    this.saveConfig();
  }

  public getLastProvider(): string | null {
    return this.lastProviderId;
  }

  public setLastModel(modelId: string): void {
    this.lastModelId = modelId;
    this.saveConfig();
  }

  public getLastModel(): string | null {
    return this.lastModelId;
  }

  public destroy(): void {
    ChatConfig.instance = null as any;
  }
}
