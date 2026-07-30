/**
 * PiPiClaw - 聊天状态管理 (Pinia Store)
 * 
 * 核心功能：
 * 1. 会话管理（创建、删除、归档、置顶）
 * 2. 消息发送（乐观更新 + 实时同步）
 * 3. 流式响应（实时更新UI）
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';

// ========== 类型定义 ==========

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'streaming' | 'sent' | 'error' | 'stopped';
export type ConversationStatus = 'active' | 'archived';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  timestamp: number;
  status: MessageStatus;
  modelId?: string;
  providerId?: string;
  error?: string;
  metadata?: Record<string, any>;
  taskResult?: TaskExecutionResult;
}

export interface TaskExecutionResult {
  success: boolean;
  status: 'parsing' | 'executing' | 'completed' | 'failed';
  steps?: TaskStepResult[];
  summary?: string;
  error?: string;
  duration?: number;
}

export interface TaskExecutionPlan {
  planId: string;
  instruction: string;
  steps: TaskStepResult[];
  estimatedDuration?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TaskStepResult {
  order: number;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  duration?: number;
  params?: Record<string, any>;
}

export interface Task {
  id: string;
  conversationId: string;
  messageId: string;
  instruction: string;
  steps: Array<{
    id: string;
    order: number;
    type: string;
    description: string;
    params: Record<string, any>;
    requiredPermission?: string;
    requiredAction?: string;
    requiredResource?: string;
    status: string;
    result?: any;
    error?: string;
  }>;
  status: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId?: string;
  providerId?: string;
  permissionSetId?: string;
  createdAt: number;
  updatedAt: number;
  status: ConversationStatus;
  pinned: boolean;
}

export interface ChatSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

// ========== 类型断言 ==========

const electronAPI = window.electronAPI as any;

// ========== 适配函数 ==========

/**
 * 将前端 TaskExecutionPlan 适配为 TaskExecutor 所需的 Task 结构
 */
function planToTask(plan: TaskExecutionPlan, conversationId: string, messageId: string): Task {
  return {
    id: plan.planId,
    conversationId,
    messageId,
    instruction: plan.instruction,
    steps: plan.steps.map((s, idx) => ({
      id: `${plan.planId}-step-${idx}`,
      order: s.order ?? idx,
      type: (s as any).type ?? 'result',
      description: s.description,
      params: (s.params as Record<string, any>) ?? {},
      status: s.status === 'success' ? 'success' : s.status === 'failed' ? 'failed' : 'pending',
    })),
    status: 'pending',
    createdAt: Date.now(),
  };
}

// ========== Store 定义 ==========

export const useChatStore = defineStore('chat', () => {
  // ========== 状态 ==========
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  
  // 全局模型选择：记录最后使用的模型，用于新建会话时继承
  const lastProviderId = ref<string | null>(null);
  const lastModelId = ref<string | null>(null);
  
  // 从 localStorage 加载
  function loadLastModelFromStorage(): void {
    try {
      const savedProviderId = localStorage.getItem('lastProviderId');
      const savedModelId = localStorage.getItem('lastModelId');
      if (savedProviderId) lastProviderId.value = savedProviderId;
      if (savedModelId) lastModelId.value = savedModelId;
    } catch {
      // 忽略 localStorage 错误
    }
  }
  
  // 监听 lastProviderId 变化并持久化
  watch(lastProviderId, (newVal) => {
    try {
      if (newVal) {
        localStorage.setItem('lastProviderId', newVal);
      } else {
        localStorage.removeItem('lastProviderId');
      }
    } catch {
      // 忽略 localStorage 错误
    }
  });
  
  // 监听 lastModelId 变化并持久化
  watch(lastModelId, (newVal) => {
    try {
      if (newVal) {
        localStorage.setItem('lastModelId', newVal);
      } else {
        localStorage.removeItem('lastModelId');
      }
    } catch {
      // 忽略 localStorage 错误
    }
  });
  
  const settings = ref<ChatSettings>({
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0
  });
  const loading = ref(false);
  const sending = ref(false);

  const quotedMessage = ref<ChatMessage | null>(null);
  const searchKeyword = ref('');
  const selectedConversations = ref<string[]>([]);

  // ========== 任务执行相关状态 ==========
  const executingTask = ref(false);
  const currentTaskResult = ref<TaskExecutionResult | null>(null);
  const showTaskConfirmDialog = ref(false);
  const pendingTaskPlan = ref<TaskExecutionPlan | null>(null);

  // ========== 计算属性 ==========
  
  /**
   * 当前会话
   */
  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value)
  );

  /**
   * 当前会话的 Provider ID（便捷访问）
   */
  const currentProviderId = computed(() =>
    currentConversation.value?.providerId || lastProviderId.value
  );

  /**
   * 当前会话的 Model ID（便捷访问）
   */
  const currentModelId = computed(() =>
    currentConversation.value?.modelId || lastModelId.value
  );

  const activeConversations = computed(() =>
    conversations.value.filter(c => c.status === 'active')
  );

  const pinnedConversations = computed(() =>
    conversations.value.filter(c => c.pinned && c.status === 'active')
  );

  const recentConversations = computed(() =>
    conversations.value
      .filter(c => c.status === 'active' && !c.pinned)
      .slice(0, 50)
  );

  const archivedConversations = computed(() =>
    conversations.value.filter(c => c.status === 'archived')
  );

  const searchResults = computed(() => {
    if (!searchKeyword.value.trim()) return [];
    const keyword = searchKeyword.value.toLowerCase();
    return conversations.value.filter(c => {
      const titleMatch = c.title.toLowerCase().includes(keyword);
      const messageMatch = c.messages.some(m => 
        m.content.toLowerCase().includes(keyword)
      );
      return titleMatch || messageMatch;
    });
  });

  // ========== 会话管理 ==========

  /**
   * 获取所有会话
   */
  async function fetchConversations(): Promise<void> {
    loading.value = true;
    try {
      const result = await electronAPI?.chat?.conversations();
      if (result?.success && result.data) {
        conversations.value = result.data;
      } else if (result?.error) {
        console.error('获取会话列表失败:', result.error);
        ElMessage.error(`获取会话列表失败: ${result.error}`);
      } else if (!result) {
        console.warn('electronAPI.chat.conversations 返回为空，可能初始化失败');
        conversations.value = []; // 即使失败也显示空列表，不让用户卡死
      }
    } catch (err) {
      console.error('获取会话列表失败:', err);
      conversations.value = []; // 即使异常也显示空列表
      ElMessage.error('获取会话列表失败，请重启应用');
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取单个会话
   */
  async function getConversation(id: string): Promise<Conversation | null> {
    try {
      const result = await electronAPI?.chat?.getConversation(id);
      if (result?.success && result.data) {
        // 更新本地缓存
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value[index] = result.data;
        } else {
          conversations.value.push(result.data);
        }
        return result.data;
      }
    } catch (err) {
      console.error('获取会话失败:', err);
    }
    return null;
  }

  /**
   * 创建新会话
   * 
   * 核心逻辑：
   * - 如果没有指定模型，自动继承上一个会话的模型配置
   * - 这样用户不需要每次都重新选择模型
   */
  async function createConversation(data?: {
    title?: string;
    providerId?: string;
    modelId?: string;
  }): Promise<Conversation | null> {
    loading.value = true;
    try {
      // 合并数据：如果没有指定模型，使用全局最后使用的模型
      const finalData = {
        title: data?.title,
        providerId: data?.providerId || lastProviderId.value || undefined,
        modelId: data?.modelId || lastModelId.value || undefined
      };

      const result = await electronAPI?.chat?.createConversation(finalData);
      if (result?.success && result.data) {
        const conv = result.data;
        
        // 添加到本地列表
        conversations.value.unshift(conv);
        
        // 选中新会话
        currentConversationId.value = conv.id;
        
        // 更新全局模型选择（如果会话没有指定模型但全局有，则同步过去）
        if (!conv.providerId && lastProviderId.value) {
          await updateConversation(conv.id, { providerId: lastProviderId.value });
        }
        if (!conv.modelId && lastModelId.value) {
          await updateConversation(conv.id, { modelId: lastModelId.value });
        }
        
        console.log('[ChatStore] 创建会话:', conv.id, '模型:', conv.providerId, conv.modelId);
        return conv;
      } else if (result?.error) {
        console.error('创建会话失败:', result.error);
        ElMessage.error(`创建会话失败: ${result.error}`);
      }
    } catch (err) {
      console.error('创建会话失败:', err);
      ElMessage.error('创建会话失败，请重试');
    } finally {
      loading.value = false;
    }
    return null;
  }

  /**
   * 更新会话
   */
  async function updateConversation(id: string, updates: Partial<Conversation>): Promise<boolean> {
    try {
      const result = await electronAPI?.chat?.updateConversation(id, updates);
      if (result?.success && result.data) {
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value[index] = result.data;
        }
        return true;
      }
    } catch (err) {
      console.error('更新会话失败:', err);
    }
    return false;
  }

  /**
   * 删除会话
   */
  async function deleteConversation(id: string): Promise<boolean> {
    try {
      const result = await electronAPI?.chat?.deleteConversation(id);
      if (result?.success) {
        // 从本地列表移除
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value.splice(index, 1);
        }
        // 如果删除的是当前会话，选择其他会话
        if (currentConversationId.value === id) {
          currentConversationId.value = conversations.value.length > 0 ? conversations.value[0].id : null;
        }
        return true;
      }
    } catch (err) {
      console.error('删除会话失败:', err);
    }
    return false;
  }

  /**
   * 归档会话
   */
  async function archiveConversation(id: string): Promise<boolean> {
    try {
      const result = await electronAPI?.chat?.archiveConversation(id);
      if (result?.success && result.data) {
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value[index] = result.data;
        }
        return true;
      }
    } catch (err) {
      console.error('归档会话失败:', err);
    }
    return false;
  }

  /**
   * 置顶/取消置顶会话
   */
  async function pinConversation(id: string, pinned: boolean): Promise<boolean> {
    try {
      const result = await electronAPI?.chat?.pinConversation(id, pinned);
      if (result?.success && result.data) {
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value[index] = result.data;
        }
        return true;
      }
    } catch (err) {
      console.error('置顶会话失败:', err);
    }
    return false;
  }

  /**
   * 取消归档会话
   */
  async function unarchiveConversation(id: string): Promise<boolean> {
    try {
      const result = await electronAPI?.chat?.updateConversation(id, { status: 'active' });
      if (result?.success && result.data) {
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value[index] = result.data;
        }
        return true;
      }
    } catch (err) {
      console.error('取消归档失败:', err);
    }
    return false;
  }

  /**
   * 批量删除会话
   */
  async function batchDeleteConversations(ids: string[]): Promise<boolean> {
    try {
      let allSuccess = true;
      for (const id of ids) {
        const result = await electronAPI?.chat?.deleteConversation(id);
        if (!result?.success) {
          allSuccess = false;
          continue;
        }
        const index = conversations.value.findIndex(c => c.id === id);
        if (index !== -1) {
          conversations.value.splice(index, 1);
        }
      }
      selectedConversations.value = [];
      return allSuccess;
    } catch (err) {
      console.error('批量删除会话失败:', err);
      return false;
    }
  }

  // ========== 消息引用 ==========

  /**
   * 设置引用消息
   */
  function quoteMessage(message: ChatMessage): void {
    quotedMessage.value = message;
  }

  /**
   * 清空引用消息
   */
  function clearQuotedMessage(): void {
    quotedMessage.value = null;
  }

  // ========== 消息编辑重发 ==========

  /**
   * 编辑用户消息并重新发送
   */
  async function editAndResendMessage(messageId: string, newContent: string): Promise<boolean> {
    const conv = currentConversation.value;
    if (!conv) return false;

    const msgIndex = conv.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1 || conv.messages[msgIndex].role !== 'user') {
      return false;
    }

    const userMsg = conv.messages[msgIndex];
    userMsg.content = newContent;
    userMsg.timestamp = Date.now();
    userMsg.status = 'sending';
    
    if (msgIndex + 1 < conv.messages.length) {
      const aiMsgIndex = msgIndex + 1;
      if (conv.messages[aiMsgIndex].role === 'assistant') {
        conv.messages.splice(aiMsgIndex);
      }
    }

    sending.value = true;
    
    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      providerId: userMsg.providerId,
      modelId: userMsg.modelId
    };
    addMessageLocally(conv.id, assistantMessage);

    try {
      const effectiveProviderId = userMsg.providerId || lastProviderId.value;
      const effectiveModelId = userMsg.modelId || lastModelId.value;
      
      const result = await electronAPI?.chat?.sendMessage(
        conv.id,
        newContent,
        effectiveProviderId,
        effectiveModelId
      );

      if (!result?.success) {
        const errorMsg = result?.error || '发送失败';
        updateMessageLocally(conv.id, assistantMsgId, {
          status: 'error',
          error: errorMsg
        });
        ElMessage.error(errorMsg);
        sending.value = false;
        return false;
      }

      return true;
    } catch (err) {
      console.error('编辑重发失败:', err);
      updateMessageLocally(conv.id, assistantMsgId, {
        status: 'error',
        error: '发送失败'
      });
      sending.value = false;
      return false;
    }
  }

  // ========== 会话搜索 ==========

  /**
   * 设置搜索关键词
   */
  function setSearchKeyword(keyword: string): void {
    searchKeyword.value = keyword;
  }

  /**
   * 取消任务执行
   */
  async function cancelExecuteTask(): Promise<void> {
    const plan = pendingTaskPlan.value;
    executingTask.value = false;
    isGenerating.value = false;
    if (plan) {
      try {
        await electronAPI?.task?.cancelExecution?.(plan.planId);
      } catch (err) {
        console.error('[ChatStore] 取消任务失败:', err);
      }
    }
    pendingTaskPlan.value = null;
    showTaskConfirmDialog.value = false;
  }

  /**
   * 确认执行任务计划
   * 真正调用 TaskExecutor 执行任务
   */
  async function confirmExecuteTask(): Promise<void> {
    const plan = pendingTaskPlan.value;
    if (!plan) return;
    executingTask.value = true;
    showTaskConfirmDialog.value = false;

    try {
      const conversationId = currentConversationId.value ?? '';
      const messageId = `${plan.planId}-msg`;
      const task = planToTask(plan, conversationId, messageId);

      const resp = await electronAPI?.task?.execute?.(task);
      if (resp?.success && resp.data) {
        const result = resp.data as {
          success: boolean;
          summary?: string;
          result?: { steps?: Array<{ status: string; result?: any; error?: string }> };
          duration?: number;
        };
        currentTaskResult.value = {
          success: result.success,
          status: result.success ? 'completed' : 'failed',
          steps: (result.result?.steps ?? []) as TaskStepResult[],
          summary: result.summary,
          duration: result.duration,
        };
      } else {
        currentTaskResult.value = {
          success: false,
          status: 'failed',
          error: resp?.error ?? '执行失败',
        };
      }
    } catch (err) {
      console.error('[ChatStore] 任务执行失败:', err);
      currentTaskResult.value = {
        success: false,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      executingTask.value = false;
      pendingTaskPlan.value = null;
    }
  }

  /**
   * 切换会话选中状态
   */
  function toggleConversationSelection(id: string): void {
    const index = selectedConversations.value.indexOf(id);
    if (index === -1) {  selectedConversations.value.push(id);
    } else {
      selectedConversations.value.splice(index, 1);
    }
  }

  /**
   * 清空会话选中
   */
  function clearConversationSelection(): void {
    selectedConversations.value = [];
  }

  /**
   * 全选当前显示的会话
   */
  function selectAllConversations(conversationIds: string[]): void {
    selectedConversations.value = [...conversationIds];
  }

  // ========== 消息发送（核心功能）============

  /**
   * 是否正在生成回复
   */
  const isGenerating = ref(false);

  /**
   * 发送消息 - 使用新架构，带即时反馈
   * 直接调用后端 ChatManager，它会自动处理任务执行
   */
  async function sendMessage(
    content: string,
    providerId?: string,
    modelId?: string
  ): Promise<boolean> {
    // 防止重复发送
    if (sending.value || isGenerating.value) {
      ElMessage.warning('正在等待回复，请稍候');
      return false;
    }

    console.log('[ChatStore] ========== [SEND] sendMessage 被调用 ==========');
    console.log('[ChatStore] [MSG] 消息内容:', content);
    console.log('[ChatStore] [PROV] Provider:', providerId, 'Model:', modelId);

    if (!currentConversationId.value) {
      await createConversation({ providerId, modelId });
    }

    const conv = currentConversation.value!;
    const effectiveProviderId = providerId || lastProviderId.value || conv.providerId;
    const effectiveModelId = modelId || lastModelId.value || conv.modelId;

    // Step 1: 立即添加用户消息到本地
    const userMsgId = `msg_${Date.now()}_user`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sent',
      providerId: effectiveProviderId,
      modelId: effectiveModelId
    };
    addMessageLocally(conv.id, userMessage);

    // Step 2: 立即添加助手占位消息
    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      providerId: effectiveProviderId,
      modelId: effectiveModelId
    };
    addMessageLocally(conv.id, assistantMessage);

    sending.value = true;
    isGenerating.value = true;

    try {
      const result = await electronAPI?.chat?.sendMessage(
        conv.id,
        content,
        effectiveProviderId,
        effectiveModelId
      );

      if (result?.success) {
        console.log('[ChatStore] 消息发送成功');
        return true;
      } else {
        // 更新助手消息为错误状态
        updateMessageLocally(conv.id, assistantMsgId, {
          status: 'error',
          error: result?.error || '发送失败'
        });
        ElMessage.error(result?.error || '发送失败');
        return false;
      }
    } catch (err: any) {
      console.error('[ChatStore] 发送消息失败:', err);
      updateMessageLocally(conv.id, assistantMsgId, {
        status: 'error',
        error: err.message || '发送失败'
      });
      ElMessage.error(err.message || '发送失败');
      return false;
    } finally {
      sending.value = false;
      isGenerating.value = false;
    }
  }

  /**
   * 停止生成回复
   */
  async function stopGeneration(): Promise<void> {
    if (!currentConversationId.value) return;
    
    try {
      await electronAPI?.chat?.stopGeneration(currentConversationId.value);
      
      // 更新最后一条助手消息状态
      const conv = currentConversation.value;
      if (conv && conv.messages.length > 0) {
        const lastMsg = conv.messages[conv.messages.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
          updateMessageLocally(conv.id, lastMsg.id, {
            status: 'stopped'
          });
        }
      }
      
      isGenerating.value = false;
      sending.value = false;
    } catch (err) {
      console.error('停止生成失败:', err);
    }
  }

  /**
   * 继续生成
   */
  async function continueGeneration(): Promise<void> {
    if (!currentConversationId.value || sending.value) return;
    
    const conv = currentConversation.value;
    if (!conv || conv.messages.length === 0) return;

    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg.role !== 'assistant') {
      ElMessage.warning('上一条消息不是AI回复');
      return;
    }

    sending.value = true;
    try {
      await electronAPI?.chat?.continueGeneration(currentConversationId.value);
    } catch (err: any) {
      console.error('继续生成失败:', err);
      ElMessage.error(err.message || '继续生成失败');
      sending.value = false;
    }
  }

  // ========== 设置管理 ==========

  /**
   * 获取设置
   */
  async function fetchSettings(): Promise<void> {
    try {
      const result = await electronAPI?.chat?.getSettings();
      if (result?.success && result.data) {
        settings.value = result.data;
      }
    } catch (err) {
      console.error('获取设置失败:', err);
    }
  }

  /**
   * 更新设置
   */
  async function updateSettings(updates: Partial<ChatSettings>): Promise<boolean> {
    try {
      const result = await electronAPI?.chat?.updateSettings(updates);
      if (result?.success && result.data) {
        settings.value = result.data;
        return true;
      }
    } catch (err) {
      console.error('更新设置失败:', err);
    }
    return false;
  }

  // ========== 模型选择 ==========

  /**
   * 更新当前会话的模型
   * 
   * 核心逻辑：
   * - 更新当前会话绑定的模型
   * - 同时更新全局最后使用的模型
   * - 自动持久化到后端
   */
  async function setCurrentModel(providerId: string, modelId: string): Promise<boolean> {
    const conv = currentConversation.value;
    if (!conv) return false;

    // 更新全局最后使用的模型
    lastProviderId.value = providerId;
    lastModelId.value = modelId;

    // 更新当前会话的模型
    const success = await updateConversation(conv.id, { providerId, modelId });
    
    if (success) {
      console.log('[ChatStore] 设置模型:', providerId, modelId, '会话:', conv.id);
    }
    
    return success;
  }

  /**
   * 从后端获取最后使用的模型（初始化时调用）
   */
  async function fetchLastModel(): Promise<void> {
    try {
      const result = await electronAPI?.chat?.getLastModel?.();
      if (result?.success && result.data) {
        lastProviderId.value = result.data.providerId || null;
        lastModelId.value = result.data.modelId || null;
        console.log('[ChatStore] 加载最后模型:', lastProviderId.value, lastModelId.value);
      }
    } catch (err) {
      console.error('获取最后模型失败:', err);
    }
  }

  /**
   * 选择会话
   * 
   * 核心逻辑：
   * - 切换到指定会话
   * - 如果会话没有模型配置，自动继承全局最后使用的模型
   */
  function selectConversation(id: string): void {
    currentConversationId.value = id;
    
    const conv = conversations.value.find(c => c.id === id);
    if (conv) {
      console.log('[ChatStore] 切换到会话:', id, '当前模型:', conv.providerId, conv.modelId);
      
      // 如果会话没有模型但全局有最后使用的模型，自动同步
      if ((!conv.providerId || !conv.modelId) && lastProviderId.value && lastModelId.value) {
        console.log('[ChatStore] 会话缺少模型配置，自动继承全局模型');
        updateConversation(id, {
          providerId: conv.providerId || lastProviderId.value,
          modelId: conv.modelId || lastModelId.value
        });
      }
    }
  }

  // ========== 本地操作（不调用后端）==========

  /**
   * 在本地添加消息（用于乐观更新）
   */
  function addMessageLocally(conversationId: string, message: ChatMessage): void {
    const conv = conversations.value.find(c => c.id === conversationId);
    if (conv) {
      conv.messages.push(message);
    }
  }

  /**
   * 在本地更新消息
   */
  function updateMessageLocally(conversationId: string, messageId: string, updates: Partial<ChatMessage>): void {
    const conv = conversations.value.find(c => c.id === conversationId);
    if (conv) {
      const msgIndex = conv.messages.findIndex(m => m.id === messageId);
      if (msgIndex !== -1) {
        conv.messages[msgIndex] = { ...conv.messages[msgIndex], ...updates };
      }
    }
  }

  /**
   * 替换临时消息ID为真实ID
   */
  function replaceMessageId(conversationId: string, tempId: string, realId: string): void {
    const conv = conversations.value.find(c => c.id === conversationId);
    if (conv) {
      const msgIndex = conv.messages.findIndex(m => m.id === tempId);
      if (msgIndex !== -1) {
        conv.messages[msgIndex].id = realId;
      }
    }
  }

  /**
   * 移除临时消息
   */
  function removeMessageLocally(conversationId: string, messageId: string): void {
    const conv = conversations.value.find(c => c.id === conversationId);
    if (conv) {
      const msgIndex = conv.messages.findIndex(m => m.id === messageId);
      if (msgIndex !== -1) {
        conv.messages.splice(msgIndex, 1);
      }
    }
  }

  // ========== IPC 事件处理 ==========

  /**
   * 处理收到的消息事件
   */
  function handleMessageEvent(data: { conversationId: string; message: ChatMessage }): void {
    const { conversationId, message } = data;
    
    // 查找会话
    const conv = conversations.value.find(c => c.id === conversationId);
    if (!conv) {
      console.log('[ChatStore] 未找到会话:', conversationId);
      return;
    }

    console.log('[ChatStore] 收到消息事件:', message.id, message.role, message.status);

    // 检查消息是否已存在（ID相同）
    const existingMsgIndex = conv.messages.findIndex(m => m.id === message.id);
    
    if (existingMsgIndex !== -1) {
      // 消息已存在，执行更新操作
      console.log('[ChatStore] 更新已有消息:', message.id, '内容长度:', message.content.length);
      conv.messages.splice(existingMsgIndex, 1, message);
    } else {
      // 消息不存在，先检查是否有需要替换的临时消息（包括 msg_ 开头的）
      const tempMsgIndex = conv.messages.findIndex(m => 
        (m.id.startsWith('tmp_') || m.id.startsWith('msg_')) && 
        m.role === message.role &&
        m.content === message.content
      );
      
      if (tempMsgIndex !== -1) {
        // 找到临时消息，替换为真实消息
        console.log('[ChatStore] 替换临时消息:', conv.messages[tempMsgIndex].id, '->', message.id);
        conv.messages.splice(tempMsgIndex, 1, message);
      } else {
        // 额外检查：是否有内容相同且角色相同的消息（防止重复）
        const duplicateMsgIndex = conv.messages.findIndex(m => 
          m.role === message.role && 
          m.content === message.content &&
          Math.abs(m.timestamp - message.timestamp) < 5000 // 5秒内
        );
        
        if (duplicateMsgIndex !== -1) {
          console.log('[ChatStore] 发现重复消息，跳过添加:', message.id);
        } else {
          // 没有重复，直接追加新消息
          console.log('[ChatStore] 添加新消息:', message.id);
          conv.messages.push(message);
        }
      }
    }

    // 更新会话标题（第一条用户消息发送后，AI回复时自动生成标题）
    if (conv.messages.length === 2 && message.role === 'assistant' && message.status === 'streaming') {
      const newTitle = generateTitle(conv.messages[0].content);
      if (conv.title !== newTitle) {
        conv.title = newTitle;
        console.log('[ChatStore] 自动生成标题:', newTitle);
      }
    }

    // 更新发送状态
    if (message.status !== 'streaming') {
      console.log('[ChatStore] 消息状态结束:', message.status);
      sending.value = false;
    }
  }

  /**
   * 处理流式分块事件
   *
   * 新的流式协议：后端推送分块数据 { conversationId, messageId, delta, type }
   * - type: 'content' 表示追加到 content
   * - type: 'thinking' 表示追加到 thinking
   * - 直接修改现有消息对象，避免重复创建消息
   */
  function handleStreamChunkEvent(data: {
    conversationId: string;
    messageId: string;
    delta: string;
    type: 'content' | 'thinking';
  }): void {
    const { conversationId, messageId, delta, type } = data;

    // 查找会话
    const conv = conversations.value.find(c => c.id === conversationId);
    if (!conv) {
      console.log('[ChatStore] 流式分块: 未找到会话:', conversationId);
      return;
    }

    // 查找目标消息
    const msg = conv.messages.find(m => m.id === messageId);
    if (!msg) {
      console.log('[ChatStore] 流式分块: 未找到消息:', messageId);
      return;
    }

    // 根据 type 将 delta 追加到对应字段
    if (type === 'thinking') {
      msg.thinking = (msg.thinking || '') + delta;
    } else {
      msg.content = (msg.content || '') + delta;
    }

    // 确保消息状态为 streaming
    if (msg.status !== 'streaming') {
      msg.status = 'streaming';
    }
  }

  /**
   * 处理会话更新事件
   */
  function handleConversationUpdate(data: { conversation: Conversation }): void {
    const { conversation } = data;

    const index = conversations.value.findIndex(c => c.id === conversation.id);
    if (index !== -1) {
      conversations.value[index] = conversation;
    }
  }

  /**
   * 生成会话标题
   */
  function generateTitle(content: string): string {
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 30) {
      return firstLine || '新对话';
    }
    return firstLine.substring(0, 27) + '...';
  }

  // ========== 初始化 ==========

  // 保存事件取消函数
  let unsubscribeMessage: (() => void) | null = null;
  let unsubscribeConversation: (() => void) | null = null;
  let unsubscribeStream: (() => void) | null = null;

  /**
   * 初始化 Store
   */
  function initialize(): void {
    console.log('[ChatStore] 初始化中...');

    // 从 localStorage 加载最后使用的模型
    loadLastModelFromStorage();

    // 加载数据
    fetchConversations();
    fetchSettings();
    
    // 加载最后使用的模型（从后端）
    fetchLastModel();

    // 清理旧的事件监听（防止重复监听）
    if (unsubscribeMessage) {
      unsubscribeMessage();
      console.log('[ChatStore] 清理旧的消息监听器');
    }
    if (unsubscribeConversation) {
      unsubscribeConversation();
      console.log('[ChatStore] 清理旧的会话监听器');
    }
    if (unsubscribeStream) {
      unsubscribeStream();
      console.log('[ChatStore] 清理旧的流式监听器');
    }

    // 注册 IPC 事件监听
    unsubscribeMessage = electronAPI?.chat?.onMessage?.((data: { conversationId: string; message: ChatMessage }) => {
      console.log('[ChatStore] 收到 onMessage 事件:', data.conversationId, data.message.id);
      handleMessageEvent(data);
    }) || null;

    unsubscribeConversation = electronAPI?.chat?.onConversationUpdate?.((data: { conversation: Conversation }) => {
      console.log('[ChatStore] 收到 onConversationUpdate 事件:', data.conversation.id);
      handleConversationUpdate(data);
    }) || null;

    unsubscribeStream = electronAPI?.chat?.onStreamUpdate?.((data: { conversationId: string; messageId: string; delta: string; type: 'content' | 'thinking' }) => {
      console.log('[ChatStore] 收到 onStreamUpdate 事件:', data.conversationId, data.messageId, 'delta:', data.delta?.length, 'type:', data.type);
      handleStreamChunkEvent(data);
    }) || null;

    console.log('[ChatStore] 初始化完成，监听器已注册');
  }

  // ========== 导出 ==========

  return {
    // 状态
    conversations,
    currentConversationId,
    currentConversation,
    activeConversations,
    pinnedConversations,
    settings,
    loading,
    sending,
    recentConversations,

    // 全局模型选择
    lastProviderId,
    lastModelId,
    currentProviderId,
    currentModelId,

    // 会话管理
    fetchConversations,
    getConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    archiveConversation,
    pinConversation,
    selectConversation,

    // 模型选择
    setCurrentModel,
    fetchLastModel,

    // 消息发送
    sendMessage,
    stopGeneration,
    continueGeneration,

    // 设置
    fetchSettings,
    updateSettings,

    // 本地操作
    addMessageLocally,
    updateMessageLocally,
    replaceMessageId,
    removeMessageLocally,

    // 初始化
    initialize,

    // Phase 7: 会话管理增强
    archivedConversations,
    searchResults,
    searchKeyword,
    quotedMessage,
    selectedConversations,
    searchConversations: setSearchKeyword,
    setSearchKeyword,
    quoteMessage,
    clearQuotedMessage,
    editAndResendMessage,
    unarchiveConversation,
    batchDeleteConversations,
    toggleConversationSelection,
    clearConversationSelection,
    selectAllConversations,

    // 任务执行状态
    executingTask,
    currentTaskResult,
    isGenerating,
    showTaskConfirmDialog,
    pendingTaskPlan,
    cancelExecuteTask,
    confirmExecuteTask
  };
});
