/**
 * PiPiClaw - 聊天管理器
 * 
 * 职责：
 * 1. 聊天消息处理（流式/非流式）
 * 2. 对话管理（新建/历史）
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { BrowserWindow, ipcMain } from 'electron';
import { LogManager } from '../core/LogManager';
import { ChatConfig } from './ChatConfig';
import { ModelManager } from '../models/ModelManager';
import { HermesMemory } from '../hermes/HermesMemory';
import { TaskExecutor } from '../task/TaskExecutor';
import { InstructionGenerator } from '../task/InstructionGenerator';
import { OpenClawGateway } from '../openclaw/OpenClawGateway';
import { SelfLearner } from '../learning/SelfLearner';
import type { Conversation, ChatMessage, ChatSettings, MessageRole, StreamChunk } from './ChatTypes';
import type { AgentBrain, Disposable } from '../contracts/types';

export class ChatManager {
  private static instance: ChatManager;
  private log = LogManager.getInstance();
  private config!: ChatConfig;
  private modelManager!: ModelManager;
  private abortControllers: Map<string, AbortController> = new Map();

  private constructor() {
    this.log.info('[ChatManager] 初始化');
    try {
      // 初始化核心组件，遇到单个组件失败不影响其他组件
      try {
        this.config = ChatConfig.getInstance();
      } catch (e) {
        this.log.error('[ChatManager] ChatConfig 初始化失败', e);
        // 如果 ChatConfig 失败，无法继续工作
        throw new Error('聊天配置初始化失败');
      }

      // 可选组件，即使失败不影响基本功能
      try {
        this.modelManager = ModelManager.getInstance();
      } catch (e) {
        this.log.warn('[ChatManager] ModelManager 初始化失败，部分功能不可用', e);
        // 创建一个空的 modelManager 占位符
        this.modelManager = {
          getProvider: () => null,
          getAllProviders: () => []
        } as any;
      }

      try {
        HermesMemory.getInstance();
      } catch (e) {
        this.log.warn('[ChatManager] HermesMemory 初始化失败，记忆功能不可用', e);
      }

      try {
        SelfLearner.getInstance();
      } catch (e) {
        this.log.warn('[ChatManager] SelfLearner 初始化失败，学习功能不可用', e);
      }

      this.log.info('[ChatManager] 初始化成功');
    } catch (error) {
      this.log.error('[ChatManager] 初始化失败', error);
      // 即使部分组件失败，也确保 ChatManager 实例可用
      if (!this.config) {
        // 如果 ChatConfig 没有初始化，尝试再次获取或创建一个空的
        try {
          this.config = ChatConfig.getInstance();
        } catch (e) {
          this.log.error('[ChatManager] ChatConfig 再次初始化失败，应用将无法正常工作', e);
        }
      }
    }
  }

  public static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager();
    }
    return ChatManager.instance;
  }

  /** W12.1 测试 helper:重置单例(测试间隔离用,生产代码勿调) */
  public static destroy(): void {
    ChatManager.instance = null as any;
  }

  // ============ 对话管理核心方法 ============

  public getAllConversations(): Conversation[] {
    return this.config.getAllConversations();
  }

  public getActiveConversations(): Conversation[] {
    return this.config.getAllConversations().filter(c => c.status === 'active');
  }

  public getConversation(id: string): Conversation | undefined {
    return this.config.getConversation(id);
  }

  public createConversation(data?: { title?: string; providerId?: string; modelId?: string }): Conversation {
    this.log.info('[ChatManager] 创建新对话');
    return this.config.createConversation(data);
  }

  public updateConversation(id: string, updates: Partial<Conversation>): Conversation | null {
    return this.config.updateConversation(id, updates);
  }

  public deleteConversation(id: string): boolean {
    this.abortControllers.delete(id);
    return this.config.deleteConversation(id);
  }

  public archiveConversation(id: string): Conversation | null {
    return this.config.archiveConversation(id);
  }

  public pinConversation(id: string, pinned: boolean): Conversation | null {
    return this.config.pinConversation(id, pinned);
  }

  public getSettings(): ChatSettings {
    return this.config.getSettings();
  }

  public updateSettings(settings: Partial<ChatSettings>): ChatSettings {
    return this.config.updateSettings(settings);
  }

  public getMessage(conversationId: string, messageId: string): ChatMessage | undefined {
    return this.config.getMessage(conversationId, messageId);
  }

  public addMessage(conversationId: string, message: ChatMessage): ChatMessage | null {
    return this.config.addMessage(conversationId, message);
  }

  public updateMessage(conversationId: string, messageId: string, updates: Partial<ChatMessage>): ChatMessage | null {
    return this.config.updateMessage(conversationId, messageId, updates);
  }

  public stopGeneration(conversationId: string): void {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(conversationId);
    }
  }

  // ============ 核心消息发送方法 ============

  public async sendMessage(
    conversationId: string,
    content: string,
    providerId?: string,
    modelId?: string,
    settings?: Partial<ChatSettings>
  ): Promise<ChatMessage> {
    const traceId = `msg_${Date.now()}`;
    this.log.info(`[ChatManager] [${traceId}] 收到消息发送请求`);
    this.log.info(`[ChatManager] 用户选择: provider=${providerId || '未指定'}, model=${modelId || '未指定'}`);

    // 1. 检查是否是用户确认技能保存
    if (content.trim() === '是' || content.trim() === '确认' || content.trim() === 'yes') {
      const selfLearner = SelfLearner.getInstance();
      const pendingProposal = selfLearner.getPendingProposal();
      
      if (pendingProposal) {
        // 用户确认保存技能
        this.log.info('[ChatManager] 用户确认保存技能', { name: pendingProposal.name });
        
        // 添加用户消息
        const userMessage: ChatMessage = {
          id: `user_${Date.now()}`,
          role: 'user',
          content,
          timestamp: Date.now(),
          status: 'sent',
          providerId,
          modelId
        };
        this.config.addMessage(conversationId, userMessage);
        this.broadcastMessage(conversationId, userMessage);
        
        // 保存技能
        const saved = selfLearner.saveSkillFromProposal(pendingProposal);
        
        // 回复用户
        const replyMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: saved 
            ? `✅ 太棒了！我已经把这个操作保存为技能"${pendingProposal.name}"了。以后你可以直接用关键词触发它。`
            : '❌ 保存技能失败，请稍后重试。',
          timestamp: Date.now(),
          status: 'sent',
          providerId,
          modelId
        };
        
        this.config.addMessage(conversationId, replyMessage);
        this.broadcastMessage(conversationId, replyMessage);
        this.broadcastConversationUpdate(conversationId);
        
        // 通知前端有新技能提案
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send('skills:new-proposal', pendingProposal);
          }
        });
        
        return replyMessage;
      }
    }

    // 2. 添加用户消息
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sent',
      providerId,
      modelId
    };
    this.config.addMessage(conversationId, userMessage);
    this.broadcastMessage(conversationId, userMessage);

    // 2. 尝试用大模型生成操作步骤并执行
    try {
      const instructionGenerator = InstructionGenerator.getInstance();
      const taskExecutor = TaskExecutor.getInstance();

      const steps = await instructionGenerator.generateTaskSteps(content, providerId, modelId);
      
      if (steps && steps.length > 0) {
        this.log.info(`[ChatManager] [${traceId}] 大模型生成了 ${steps.length} 个步骤，开始执行`);
        
        // 创建助手占位消息
        const placeholderId = `assistant_${Date.now()}`;
        const placeholder: ChatMessage = {
          id: placeholderId,
          role: 'assistant',
          content: '🔧 正在执行操作...',
          timestamp: Date.now(),
          status: 'streaming',
          providerId,
          modelId
        };
        this.config.addMessage(conversationId, placeholder);
        this.broadcastMessage(conversationId, placeholder);

        // 执行任务
        const task = {
          id: `task_${Date.now()}`,
          conversationId,
          messageId: placeholderId,
          instruction: content,
          steps: steps.map((step, i) => ({
            id: `step_${i}`,
            order: i + 1,
            type: step.action,
            description: step.description || `执行 ${step.action}`,
            params: step.params,
            requiredPermission: 'filesystem',
            requiredAction: 'write',
            status: 'pending'
          })),
          status: 'pending',
          createdAt: Date.now()
        };

        const result = await taskExecutor.executeTask(task as any);

        // 更新助手消息 - 详细的任务结果格式
        // 构建详细步骤列表
        let resultContent = result.success ? '✅ 任务执行成功\n\n' : '❌ 任务执行失败\n\n';
        const taskResultSteps = result.result?.steps || [];

        // 构建步骤详情（用于存储和渲染）
        const taskSteps = taskResultSteps.map((step: any, index: number) => {
            const originalStep = steps[index];
            const stepInfo = {
                order: index + 1,
                description: step.description || originalStep?.description || `步骤 ${index + 1}`,
                status: step.status || 'success',
                duration: step.endTime && step.startTime ? step.endTime - step.startTime : 0,
                error: step.error || null,
                params: originalStep?.params || null
            };
            return stepInfo;
        });

        if (result.result?.steps) {
            for (let i = 0; i < result.result.steps.length; i++) {
                const stepResult = result.result.steps[i];
                const originalStep = steps[i];
                const statusIcon = stepResult.status === 'success' ? '✅' : '❌';
                resultContent += `${statusIcon} **步骤 ${i + 1}**：${originalStep.description || originalStep.action}\n`;

                // 如果有更详细的描述，追加显示
                if ((stepResult as any).description && (stepResult as any).description !== originalStep.description) {
                    resultContent += `   > ${(stepResult as any).description}\n`;
                }

                // 如果是文件操作，显示核心参数
                if (originalStep.params) {
                    if (originalStep.params.filePath || originalStep.params.path) {
                        resultContent += `   📁 路径：\`${originalStep.params.filePath || originalStep.params.path}\`\n`;
                    }
                    if (originalStep.params.content) {
                        const preview = originalStep.params.content.length > 100
                            ? originalStep.params.content.substring(0, 100) + '...'
                            : originalStep.params.content;
                        resultContent += `   📝 内容预览：\`${preview}\`\n`;
                    }
                }

                if (stepResult.result) {
                    resultContent += `   ⏱️ 耗时：${stepResult.result.duration || 'N/A'}ms\n`;
                }
                if (stepResult.error) {
                    resultContent += `   ❌ 错误：${stepResult.error}\n`;
                }
                resultContent += '\n';
            }
        }

        if (result.error) {
            resultContent += `\n❌ 任务错误：${result.error}`;
        }

        resultContent += `\n⏱️ 总耗时：${result.duration}ms`;

        const finalMsg: ChatMessage = {
          id: placeholderId,
          role: 'assistant',
          content: resultContent,
          timestamp: Date.now(),
          status: 'sent',
          providerId,
          modelId,
          taskResult: {
            success: result.success,
            status: result.success ? 'completed' : 'failed',
            steps: taskSteps,
            summary: result.summary,
            error: result.error,
            duration: result.duration
          }
        } as any;

        this.config.updateMessage(conversationId, placeholderId, finalMsg);
        this.broadcastMessage(conversationId, finalMsg);
        this.broadcastConversationUpdate(conversationId);
        
        // ============ Hermes 自我学习 ============
        if (result.success) {
          const selfLearner = SelfLearner.getInstance();
          
          // 观察执行 - SelfLearner内部会自动检查是否达到分析阈值
          selfLearner.observeExecution(content, steps, result);
          // 注意：分析是异步的，前端通过 skills:new-proposal 事件接收通知
        }
        
        return finalMsg;
      }
    } catch (taskError) {
      this.log.error(`[ChatManager] [${traceId}] 任务执行失败，回退普通对话:`, taskError);
    }

    // 3. 普通对话流（当任务执行失败或没有生成步骤时）
    return this.handleNormalChat(conversationId, content, providerId, modelId, settings, traceId);
  }

  // ============ 普通对话流 ============

  private async handleNormalChat(
    conversationId: string,
    content: string,
    providerId?: string,
    modelId?: string,
    settings?: Partial<ChatSettings>,
    traceId?: string
  ): Promise<ChatMessage> {
    const conversation = this.config.getConversation(conversationId);
    if (!conversation) throw new Error('会话不存在');

    const effectiveProviderId = providerId || conversation.providerId;
    const effectiveModelId = modelId || conversation.modelId;

    if (!effectiveProviderId || !effectiveModelId) {
      throw new Error('请先选择模型');
    }

    const provider = this.modelManager.getProvider(effectiveProviderId);
    if (!provider) throw new Error('模型提供商不存在');

    this.log.info(`[ChatManager] 实际调用: provider=${provider.name}, type=${provider.type}, model=${effectiveModelId}, url=${provider.baseUrl || 'N/A'}`);

    // 创建助手消息占位
    const assistantMessageId = `assistant_${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      providerId: effectiveProviderId,
      modelId: effectiveModelId
    };
    this.config.createStreamingMessage(conversationId, assistantPlaceholder);
    this.broadcastMessage(conversationId, assistantPlaceholder);

    try {
      const mergedSettings = { ...this.getSettings(), ...settings };
      const chatHistory = conversation.messages
        .filter(m => m.id !== assistantMessageId && m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const hermes = HermesMemory.getInstance();
      const memoryPrompt = hermes.buildMemoryPrompt(content);

      let systemPrompt = '你是PiPiClaw智能助手，一个专业的AI自动化助手，内置OpenClaw本地执行引擎。';
      if (memoryPrompt.trim()) {
        systemPrompt += `\n\n用户记忆:\n${memoryPrompt}`;
      }

      const fullMessages = [
        { role: 'system' as MessageRole, content: systemPrompt },
        ...chatHistory,
        { role: 'user' as MessageRole, content }
      ];

      await this.streamModelResponse(
        conversationId,
        assistantMessageId,
        effectiveProviderId,
        effectiveModelId,
        fullMessages,
        mergedSettings
      );

      this.config.setLastProvider(effectiveProviderId);
      this.config.setLastModel(effectiveModelId);

      const finalMsg = this.config.getMessage(conversationId, assistantMessageId);
      if (finalMsg?.content) {
        const shouldPrecipitate = /(文件|文件夹|目录|创建|写入|修改|删除|整理|习惯|偏好|喜欢)/.test(content)
          || /(文件|文件夹|目录|创建|写入|修改|删除|整理)/.test(finalMsg.content);

        if (shouldPrecipitate) {
          hermes.addConversationMemory(conversationId,
            `用户请求: ${content}\nAI回复: ${finalMsg.content.substring(0, 500)}${finalMsg.content.length > 500 ? '...' : ''}`,
            50
          );
        }
      }

      return finalMsg || assistantPlaceholder;
    } catch (error: any) {
      this.config.finalizeStreamingMessage(conversationId, assistantMessageId, 'error', error.message);
      const errorMsg = this.config.getMessage(conversationId, assistantMessageId);
      this.broadcastMessage(conversationId, errorMsg || {
        ...assistantPlaceholder, status: 'error', error: error.message
      });
      this.broadcastConversationUpdate(conversationId);
      throw error;
    }
  }

  // ============ 流式响应处理 ============

  private async streamModelResponse(
    conversationId: string,
    messageId: string,
    providerId: string,
    modelId: string,
    messages: Array<{ role: MessageRole; content: string }>,
    settings: ChatSettings
  ): Promise<void> {
    const provider = this.modelManager.getProvider(providerId);
    if (!provider) throw new Error('模型提供商不存在');

    this.log.info(`[ChatManager] streamModelResponse: type=${provider.type}, baseUrl=${provider.baseUrl}, model=${modelId}`);

    if (provider.type === 'ollama') {
      return this.streamOllama(conversationId, messageId, provider, modelId, messages, settings);
    } else if (provider.type === 'anthropic') {
      return this.streamAnthropic(conversationId, messageId, provider, modelId, messages, settings);
    } else {
      return this.streamCloudProvider(conversationId, messageId, provider, modelId, messages, settings);
    }
  }

  private async streamAnthropic(
    conversationId: string, messageId: string, provider: any, modelId: string,
    messages: any[], settings: ChatSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) { reject(new Error('缺少baseUrl')); return; }
      baseUrl = baseUrl.replace(/\/$/, '');
      const url = new URL(`${baseUrl}/v1/messages`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey || '',
        'anthropic-version': '2023-06-01'
      };

      // 分离 system 消息和其他消息
      let systemMessage = '';
      const filteredMessages = messages.filter(m => {
        if (m.role === 'system') {
          systemMessage = m.content;
          return false;
        }
        return true;
      }).map(m => ({ role: m.role, content: m.content }));

      const body: any = {
        model: modelId,
        messages: filteredMessages,
        stream: true,
        max_tokens: settings.maxTokens || 4096
      };
      if (systemMessage) {
        body.system = systemMessage;
      }

      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);
      const timeout = setTimeout(() => controller.abort(), 60000);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers,
          signal: controller.signal
        },
        (res) => {
          let buffer = '';
          let accumulatedContent = '';

          // 处理错误响应
          if (res.statusCode && res.statusCode >= 400) {
            let errorData = '';
            res.on('data', chunk => { errorData += chunk.toString(); });
            res.on('end', () => {
              clearTimeout(timeout);
              this.abortControllers.delete(conversationId);
              
              let errorMessage = `请求失败: HTTP ${res.statusCode}`;
              try {
                const errorJson = JSON.parse(errorData);
                errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
              } catch { /* ignore parse error */ }
              
              if (res.statusCode === 401) {
                errorMessage = 'API Key无效，请检查您的Anthropic API Key';
              } else if (res.statusCode === 429) {
                errorMessage = '请求过于频繁，请稍后再试';
              }
              
              this.handleStreamError(conversationId, messageId, errorMessage);
              reject(new Error(errorMessage));
            });
            return;
          }

          res.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'content_block_delta') {
                  const delta = data.delta;
                  if (delta.type === 'text_delta' && delta.text) {
                    accumulatedContent += delta.text;
                    this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, '');
                    const updated = this.config.getMessage(conversationId, messageId);
                    if (updated) this.broadcastMessage(conversationId, updated);
                  }
                } else if (data.type === 'message_stop') {
                  // 流结束，完成处理
                }
              } catch (e) { /* ignore parse errors */ }
            }
          });

          res.on('end', () => {
            clearTimeout(timeout);
            this.abortControllers.delete(conversationId);
            this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, '');
            this.config.finalizeStreamingMessage(conversationId, messageId, 'sent');
            this.broadcastConversationUpdate(conversationId);
            resolve();
          });
        }
      );

      req.on('error', (error) => {
        clearTimeout(timeout);
        this.abortControllers.delete(conversationId);
        
        // 火山引擎错误日志
        if (provider.type === 'volc_ark') {
          this.log.error('[火山引擎] 聊天请求失败', { error: error.message });
        }
        
        if (error.name === 'AbortError') {
          this.handleStreamError(conversationId, messageId, '用户停止了生成或请求超时');
          reject(new Error('用户停止了生成或请求超时'));
        } else {
          this.handleStreamError(conversationId, messageId, error.message);
          reject(error);
        }
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  private isThinkingSupportedModel(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    return lower.includes('qwen') || lower.includes('deepseek');
  }

  private async streamOllama(
    conversationId: string, messageId: string, provider: any, modelId: string,
    messages: any[], settings: ChatSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl || 'http://localhost:11434';
      baseUrl = baseUrl.replace(/\/$/, '');
      const url = new URL(`${baseUrl}/api/chat`);

      const ollamaMessages = messages.map(m => ({ role: m.role, content: m.content }));
      const body: any = { model: modelId, messages: ollamaMessages, stream: true };

      if (this.isThinkingSupportedModel(modelId)) {
        body.options = { think: true };
      }

      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);
      const timeout = setTimeout(() => controller.abort(), 120000);

      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(
        {
          hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 11434),
          path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        },
        (res) => {
          let buffer = '';
          let accumulatedContent = '';
          let accumulatedThinking = '';
          let lastContentUpdate = 0;
          let lastThinkingUpdate = 0;

          res.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (this.isThinkingSupportedModel(modelId) && data.message?.think) {
                  accumulatedThinking += data.message.think;
                  const now = Date.now();
                  if (now - lastThinkingUpdate > 100) {
                    lastThinkingUpdate = now;
                    this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
                    const updated = this.config.getMessage(conversationId, messageId);
                    if (updated) this.broadcastMessage(conversationId, updated);
                  }
                }
                if (data.message?.content) {
                  accumulatedContent += data.message.content;
                  const now = Date.now();
                  if (now - lastContentUpdate > 50) {
                    lastThinkingUpdate = now;
                    this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
                    const updated = this.config.getMessage(conversationId, messageId);
                    if (updated) this.broadcastMessage(conversationId, updated);
                  }
                }
              } catch (e) { /* ignore parse errors */ }
            }
          });

          res.on('end', () => {
            clearTimeout(timeout);
            this.abortControllers.delete(conversationId);
            
            // 火山引擎响应日志
            if (provider.type === 'volc_ark') {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                this.log.info('[火山引擎] 聊天请求成功');
              } else {
                this.log.error('[火山引擎] 聊天请求失败', { statusCode: res.statusCode });
              }
            }
            
            this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
            this.config.finalizeStreamingMessage(conversationId, messageId, 'sent');
            this.broadcastConversationUpdate(conversationId);
            resolve();
          });
        }
      );

      req.on('error', (error) => {
        clearTimeout(timeout);
        this.abortControllers.delete(conversationId);
        if (error.name === 'AbortError') {
          this.handleStreamError(conversationId, messageId, '用户停止了生成或请求超时');
          reject(new Error('用户停止了生成或请求超时'));
        } else {
          this.handleStreamError(conversationId, messageId, error.message);
          reject(error);
        }
      });

      req.write(JSON.stringify(body));
      req.end();
    });
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

  private async streamCloudProvider(
    conversationId: string, messageId: string, provider: any, modelId: string,
    messages: any[], settings: ChatSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let baseUrl = provider.baseUrl;
      if (!baseUrl) { reject(new Error('缺少baseUrl')); return; }

      let url: URL;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (provider.type === 'openai' || provider.type === 'deepseek' || provider.type === 'custom' || provider.type === 'volc_ark') {
        url = this.buildUrl(baseUrl, '/chat/completions');
        headers['Authorization'] = `Bearer ${provider.apiKey || ''}`;
        
        // 火山引擎诊断日志
        if (provider.type === 'volc_ark') {
          this.log.info('[火山引擎] 发起聊天请求', {
            url: url.toString(),
            apiKeyPrefix: provider.apiKey ? (provider.apiKey.substring(0, 6) + '...') : 'empty',
            modelId: modelId
          });
        }
      } else if (provider.type === 'azure') {
        const deploymentName = provider.deploymentName || modelId;
        url = this.buildUrl(baseUrl, `/openai/deployments/${deploymentName}/chat/completions?api-version=${provider.apiVersion || '2024-02-01'}`);
        headers['api-key'] = provider.apiKey || '';
      } else {
        reject(new Error(`不支持的提供商类型: ${provider.type}`)); return;
      }

      const body: any = { model: modelId, messages, stream: true, temperature: settings.temperature, max_tokens: settings.maxTokens };
      if (settings.topP) body.top_p = settings.topP;

      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);
      const timeout = setTimeout(() => controller.abort(), 60000);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(
        { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, method: 'POST', headers, signal: controller.signal },
        (res) => {
          let buffer = '';
          let accumulatedContent = '';
          let accumulatedThinking = '';

          res.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const data = JSON.parse(dataStr);
                const delta = data.choices?.[0]?.delta || {};

                if (provider.type === 'deepseek' && delta.thinking) {
                  accumulatedThinking += delta.thinking;
                }

                if (delta.content) {
                  accumulatedContent += delta.content;
                  this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
                  const updated = this.config.getMessage(conversationId, messageId);
                  if (updated) this.broadcastMessage(conversationId, updated);
                }
              } catch (e) { /* ignore parse errors */ }
            }
          });

          res.on('end', () => {
            clearTimeout(timeout);
            this.abortControllers.delete(conversationId);
            this.config.appendStreamingContent(conversationId, messageId, accumulatedContent, accumulatedThinking);
            this.config.finalizeStreamingMessage(conversationId, messageId, 'sent');
            this.broadcastConversationUpdate(conversationId);
            resolve();
          });
        }
      );

      req.on('error', (error) => {
        clearTimeout(timeout);
        this.abortControllers.delete(conversationId);
        if (error.name === 'AbortError') {
          this.handleStreamError(conversationId, messageId, '用户停止了生成或请求超时');
          reject(new Error('用户停止了生成或请求超时'));
        } else {
          this.handleStreamError(conversationId, messageId, error.message);
          reject(error);
        }
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  private handleStreamError(conversationId: string, messageId: string, error: string): void {
    this.config.finalizeStreamingMessage(conversationId, messageId, 'error', error);
    const errMsg = this.config.getMessage(conversationId, messageId);
    this.broadcastMessage(conversationId, errMsg || { id: messageId, role: 'assistant', content: '', status: 'error', error, timestamp: Date.now() });
    this.broadcastConversationUpdate(conversationId);
  }

  public async continueGeneration(conversationId: string): Promise<void> {
    const conv = this.config.getConversation(conversationId);
    if (!conv) throw new Error('会话不存在');
    await this.sendMessage(conversationId, '请继续', conv.providerId, conv.modelId);
  }

  // ============ 事件广播方法 ============

  private broadcastMessage(conversationId: string, message: ChatMessage): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(w => {
      if (!w.isDestroyed()) {
        w.webContents.send('chat:onMessage', { conversationId, message });
      }
    });
  }

  private broadcastConversationUpdate(conversationId: string): void {
    const conversation = this.config.getConversation(conversationId);
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(w => {
      if (!w.isDestroyed() && conversation) {
        w.webContents.send('chat:onConversationUpdate', { conversation });
      }
    });
  }

  public destroy(): void {
    this.abortControllers.forEach(c => c.abort());
    this.abortControllers.clear();
    ChatManager.instance = null as any;
  }

  // ============ W4.6 新增:Agent 接入点(additive,不改既有方法) ============

  private registeredAgent: AgentBrain | null = null;
  private streamHandlers: Set<(chunk: StreamChunk) => void> = new Set();
  private streamSeq = 0;

  /**
   * 注册 Agent brain(由 Agent 域在启动时调用,ChatManager 后续可通过 dispatchToAgent 把消息转给 agent)
   * 只保留最后注册的 agent;重复注册会覆盖。
   */
  public registerAgent(brain: AgentBrain): void {
    this.log.info('[ChatManager] 注册 AgentBrain');
    this.registeredAgent = brain;
  }

  /**
   * 派发消息给已注册的 agent(由 IpcServer / TaskExecutor 调用)
   * 如果没注册 agent,返回 void(noop),不抛错
   */
  public async dispatchToAgent(msg: ChatMessage): Promise<void> {
    if (!this.registeredAgent) {
      this.log.debug('[ChatManager] dispatchToAgent: 未注册 agent,跳过');
      return;
    }
    try {
      const decision = await this.registeredAgent.think({ conversationId: msg.id, content: msg.content });
      this.log.debug('[ChatManager] dispatchToAgent: agent decision', { decision });
    } catch (e) {
      this.log.error('[ChatManager] dispatchToAgent 失败', e);
    }
  }

  /**
   * 订阅流式 chunk(由渲染进程通过 IPC 订阅)
   * 返回 Disposable 用于取消订阅
   */
  public subscribeStream(handler: (chunk: StreamChunk) => void): Disposable {
    this.streamHandlers.add(handler);
    return {
      dispose: () => {
        this.streamHandlers.delete(handler);
      },
    };
  }

  /** W4.6 内部:产生一个 stream chunk 并通知所有订阅者(供 Chat 流使用) */
  public _emitStreamChunk(chunk: Omit<StreamChunk, 'seq' | 'timestamp'>): void {
    this.streamSeq += 1;
    const fullChunk: StreamChunk = { ...chunk, seq: this.streamSeq, timestamp: Date.now() };
    for (const h of Array.from(this.streamHandlers)) {
      try {
        h(fullChunk);
      } catch (e) {
        this.log.error('[ChatManager] stream handler error', e);
      }
    }
  }
}