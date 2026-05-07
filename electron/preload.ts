/**
 * PiPiClaw - 预加载脚本
 * 
 * 职责：
 * 1. 暴露安全的contextBridge API
 * 2. 隔离主进程和渲染进程
 * 3. 提供类型安全的IPC调用接口
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// ========== IPC通道定义 ==========

const IpcChannels = {
  // 文件选择器
  DIALOG_OPEN_FILE: 'dialog:openFile',

  // 窗口管理
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_ON_MAXIMIZE_CHANGE: 'window:onMaximizeChange',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:setAlwaysOnTop',
  WINDOW_IS_ALWAYS_ON_TOP: 'window:isAlwaysOnTop',
  WINDOW_SET_EDGE_HIDE: 'window:setEdgeHide',
  WINDOW_IS_EDGE_HIDE: 'window:isEdgeHide',
  WINDOW_SHOW_MINI: 'window:showMini',
  WINDOW_HIDE_TO_TRAY: 'window:hideToTray',

  // 快捷键
  SHORTCUT_GET: 'shortcut:get',
  SHORTCUT_SET: 'shortcut:set',

  // 网关管理
  GATEWAY_START: 'gateway:start',
  GATEWAY_STOP: 'gateway:stop',
  GATEWAY_RESTART: 'gateway:restart',
  GATEWAY_STATUS: 'gateway:status',
  GATEWAY_LOGS: 'gateway:logs',
  GATEWAY_CONFIG_GET: 'gateway:config:get',
  GATEWAY_CONFIG_SET: 'gateway:config:set',
  GATEWAY_ON_STATUS_CHANGE: 'gateway:onStatusChange',
  GATEWAY_ON_LOG: 'gateway:onLog',

  // 全局配置
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',

  // 模型管理
  MODELS_LIST: 'models:list',
  MODELS_GET: 'models:get',
  MODELS_ADD: 'models:add',
  MODELS_UPDATE: 'models:update',
  MODELS_DELETE: 'models:delete',
  MODELS_TOGGLE: 'models:toggle',
  MODELS_TEST: 'models:test',
  MODELS_SYNC_OLLAMA: 'models:syncOllama',

  // 权限管理
  PERMISSIONS_LIST: 'permissions:list',
  PERMISSIONS_GET: 'permissions:get',
  PERMISSIONS_ACTIVE: 'permissions:active',
  PERMISSIONS_SET_ACTIVE: 'permissions:setActive',
  PERMISSIONS_CREATE: 'permissions:create',
  PERMISSIONS_UPDATE: 'permissions:update',
  PERMISSIONS_UPDATE_RULE: 'permissions:updateRule',
  PERMISSIONS_DELETE: 'permissions:delete',
  PERMISSIONS_DUPLICATE: 'permissions:duplicate',
  PERMISSIONS_CHECK: 'permissions:check',

  // 聊天管理
  CHAT_CONVERSATIONS: 'chat:conversations',
  CHAT_CONVERSATION_GET: 'chat:conversation:get',
  CHAT_CONVERSATION_CREATE: 'chat:conversation:create',
  CHAT_CONVERSATION_UPDATE: 'chat:conversation:update',
  CHAT_CONVERSATION_DELETE: 'chat:conversation:delete',
  CHAT_CONVERSATION_ARCHIVE: 'chat:conversation:archive',
  CHAT_CONVERSATION_PIN: 'chat:conversation:pin',
  CHAT_MESSAGE_SEND: 'chat:message:send',
  CHAT_MESSAGE_STOP: 'chat:message:stop',
  CHAT_MESSAGE_CONTINUE: 'chat:message:continue',
  CHAT_LAST_MODEL_GET: 'chat:lastModel:get',
  CHAT_SETTINGS_GET: 'chat:settings:get',
  CHAT_SETTINGS_UPDATE: 'chat:settings:update',
  CHAT_ON_MESSAGE: 'chat:onMessage',
  CHAT_ON_CONVERSATION_UPDATE: 'chat:onConversationUpdate',
  CHAT_ON_STREAM_UPDATE: 'chat:streamUpdate',

  // 应用信息
  APP_VERSION: 'app:version',

  // 任务执行
  TASK_EXECUTE: 'task:execute',
  TASK_EXECUTE_TOOL: 'task:executeTool',
  TASK_TOOLS_GET: 'task:toolsGet',
  TASK_GATEWAY_CHECK: 'task:gatewayCheck',

  // 执行模式
  EXECUTION_MODE_GET: 'execution:mode:get',
  EXECUTION_MODE_SET: 'execution:mode:set',
  EXECUTION_MODE_CHECK: 'execution:mode:check',
  EXECUTION_MODE_CANCEL: 'execution:mode:cancel',

  // 任务日志
  TASK_LOG_GET: 'task:log:get',
  TASK_LOG_QUERY: 'task:log:query',
  TASK_LOG_DELETE: 'task:log:delete',
  TASK_LOG_DELETE_BATCH: 'task:log:deleteBatch',
  TASK_LOG_EXPORT: 'task:log:export',
  TASK_LOG_STATS: 'task:log:stats',
  TASK_LOG_RETRY: 'task:log:retry',
  TASK_LOG_CANCEL: 'task:log:cancel',

  // 文件操作
  FILE_PARSE: 'file:parse',
  FILE_PARSE_BATCH: 'file:parseBatch',
  FILE_READ_CLIPBOARD_IMAGE: 'file:readClipboardImage',
  FILE_GET_INFO: 'file:getInfo',
  FILE_GET_ALLOWED_EXTENSIONS: 'file:getAllowedExtensions',

  // 对话导出
  CONVERSATION_EXPORT: 'conversation:export',

  // OpenClaw 核心执行引擎
  OPENCLAW_EXECUTE: 'openclaw:execute',
  OPENCLAW_BATCH_EXECUTE: 'openclaw:batch-execute',
  OPENCLAW_CHECK_PERMISSION: 'openclaw:check-permission',
  OPENCLAW_GET_AUDIT_LOGS: 'openclaw:get-audit-logs',
  OPENCLAW_HEALTH_CHECK: 'openclaw:health-check',

  // Hermes 记忆管理
  HERMES_GET_MEMORIES: 'hermes:getMemories',
  HERMES_SAVE_CORE_MEMORY: 'hermes:saveCoreMemory',

  // Phase 2: 任务预览与确认
  TASK_TRACE: 'task:trace',
  TASK_CONFIRM_PREVIEW: 'task:confirm-preview',
  TASK_ON_PREVIEW: 'task:on-preview',

  // ========== 技能管理 ==========
  SKILLS_LIST: 'skills:list',
  SKILLS_TOGGLE: 'skills:toggle',
  SKILLS_RELOAD: 'skills:reload',
  SKILLS_IMPORT_FILE: 'skills:importFile',
  SKILLS_IMPORT_URL: 'skills:importUrl',
  SKILLS_MERGE_CANDIDATES: 'skills:merge-candidates',
  SKILLS_PERFORM_MERGE: 'skills:perform-merge',

  // ========== MCP 配置管理 ==========
  MCP_LIST: 'mcp:list',
  MCP_ADD: 'mcp:add',
  MCP_UPDATE: 'mcp:update',
  MCP_REMOVE: 'mcp:remove',
  MCP_TOGGLE: 'mcp:toggle',
  MCP_TEST: 'mcp:test',

  // ========== Hermes 学习统计 ==========
  LEARNING_GET_STATS: 'learning:get-stats',
  LEARNING_RESET: 'learning:reset',
  LEARNING_SAVE_SKILL_PROPOSAL: 'learning:save-skill-proposal',
  LEARNING_GET_PENDING_PROPOSAL: 'learning:get-pending-proposal',
  LEARNING_CLEAR_PENDING_PROPOSAL: 'learning:clear-pending-proposal'
} as const;

type IpcCallback = (event: IpcRendererEvent, ...args: any[]) => void;

// ========== API类型定义 ==========

interface GatewayStatus {
  state: 'stopped' | 'starting' | 'running' | 'failed' | 'stopping';
  port: number;
  pid: number | null;
  startTime: number | null;
  error: string | null;
  version: string | null;
}

interface GatewayLog {
  timestamp: number;
  level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

interface GatewayConfig {
  autoStart: boolean;
  defaultPort: number;
  timeout: number;
  logLevel: string;
  customArgs: string[];
}

interface GatewayStartOptions {
  port?: number;
  timeout?: number;
  silent?: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  maxTokens?: number;
  contextWindow?: number;
  inputCost?: number;
  outputCost?: number;
  description?: string;
  disabled?: boolean;
}

interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'deepseek' | 'azure' | 'ollama' | 'custom';
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  organization?: string;
  deploymentName?: string;
  apiVersion?: string;
  models: ModelInfo[];
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  createdAt: number;
  updatedAt: number;
}

interface ModelTestResult {
  success: boolean;
  latency?: number;
  response?: string;
  error?: string;
}

type PermissionCategory = 'filesystem' | 'network' | 'process' | 'system' | 'clipboard' | 'shell' | 'environment';
type PermissionLevel = 'none' | 'read' | 'write' | 'execute' | 'all';
type PermissionTemplate = 'safe' | 'standard' | 'permissive' | 'custom';

interface PermissionRule {
  id: string;
  category: PermissionCategory;
  name: string;
  description: string;
  level: PermissionLevel;
  allowedPaths?: string[];
  deniedPaths?: string[];
  allowedDomains?: string[];
  deniedDomains?: string[];
}

interface PermissionSet {
  id: string;
  name: string;
  template: PermissionTemplate;
  description: string;
  rules: PermissionRule[];
  createdAt: number;
  updatedAt: number;
}

interface PermissionCheckRequest {
  category: PermissionCategory;
  action: string;
  resource?: string;
}

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

type MessageRole = 'user' | 'assistant' | 'system';
type MessageStatus = 'sending' | 'streaming' | 'sent' | 'error';

interface ChatMessage {
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
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId?: string;
  providerId?: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  pinned: boolean;
}

interface ChatSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ========== 任务类型 ==========

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
type StepType = 'permission_check' | 'filesystem' | 'network' | 'process' | 'shell' | 'clipboard' | 'system' | 'user_confirm' | 'result';

interface TaskStepParams {
  operation?: string;
  path?: string;
  content?: string;
  encoding?: string;
  command?: string;
  cwd?: string;
  value?: string;
  url?: string;
  text?: string;
  [key: string]: any;
}

interface TaskStep {
  id: string;
  order: number;
  type: StepType;
  description: string;
  params: TaskStepParams;
  requiredPermission?: string;
  requiredAction?: string;
  requiredResource?: string;
  status: StepStatus;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface Task {
  id: string;
  conversationId: string;
  messageId: string;
  instruction: string;
  steps: TaskStep[];
  status: TaskStatus;
  result?: any;
  error?: string;
  createdAt: number;
  startTime?: number;
  endTime?: number;
}

interface TaskResult {
  success: boolean;
  taskId: string;
  status: TaskStatus;
  summary: string;
  result?: any;
  error?: string;
  totalSteps: number;
  successSteps: number;
  failedSteps: number;
  duration: number;
}

interface ToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

interface ToolCallResult {
  success: boolean;
  content: string;
  error?: string;
}

interface ParsedInstruction {
  isExecutable: boolean;
  confidence: number;
  steps: Omit<TaskStep, 'id' | 'status' | 'result' | 'error' | 'startTime' | 'endTime'>[];
  originalInstruction: string;
  explanation?: string;
}

// ========== 执行模式类型 ==========

type ExecutionMode = 'safe' | 'plan' | 'craft';

interface ExecutionModeConfig {
  mode: ExecutionMode;
  name: string;
  description: string;
  icon: string;
  allowExecution: boolean;
  requireConfirmation: boolean;
}

interface ExecutionCheckResult {
  allowed: boolean;
  checkLevel: 'passed' | 'requires_confirmation' | 'blocked';
  reason?: string;
  guidance?: string;
}

interface ExecutionPlanStep {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  permissionCheck: {
    category: string;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
}

interface ExecutionPlan {
  taskId: string;
  instruction: string;
  mode: ExecutionMode;
  steps: ExecutionPlanStep[];
  totalSteps: number;
  executableSteps: number;
  blockedSteps: number;
  estimatedDuration?: number;
  createdAt: number;
}

// ========== 任务日志类型 ==========

type TaskLogStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

interface TaskLogStep {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked';
  permissionCheck?: {
    category: string;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface TaskLogEntry {
  id: string;
  conversationId: string;
  instruction: string;
  mode: ExecutionMode;
  status: TaskLogStatus;
  steps: TaskLogStep[];
  summary: string;
  error?: string;
  duration?: number;
  createdAt: number;
  startTime?: number;
  endTime?: number;
  retryCount: number;
  parentTaskId?: string;
}

interface TaskLogQuery {
  status?: TaskLogStatus;
  mode?: ExecutionMode;
  startDate?: number;
  endDate?: number;
  keyword?: string;
  limit?: number;
  offset?: number;
}

interface TaskLogStats {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  byMode: Record<string, number>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

// ========== API对象 ==========

const electronAPI = {
  // ========== 文件选择器 ==========
  dialog: {
    openFile: (options: any) => ipcRenderer.invoke(IpcChannels.DIALOG_OPEN_FILE, options)
  },

  // ========== 窗口管理 ==========
  window: {
    minimize: () => ipcRenderer.invoke(IpcChannels.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IpcChannels.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IpcChannels.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IpcChannels.WINDOW_IS_MAXIMIZED),
    setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke(IpcChannels.WINDOW_SET_ALWAYS_ON_TOP, value),
    isAlwaysOnTop: () => ipcRenderer.invoke(IpcChannels.WINDOW_IS_ALWAYS_ON_TOP),
    setEdgeHide: (value: boolean) => ipcRenderer.invoke(IpcChannels.WINDOW_SET_EDGE_HIDE, value),
    isEdgeHide: () => ipcRenderer.invoke(IpcChannels.WINDOW_IS_EDGE_HIDE),
    showMini: () => ipcRenderer.invoke(IpcChannels.WINDOW_SHOW_MINI),
    hideToTray: () => ipcRenderer.invoke(IpcChannels.WINDOW_HIDE_TO_TRAY),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler: IpcCallback = (_, isMaximized: boolean) => callback(isMaximized);
      ipcRenderer.on(IpcChannels.WINDOW_ON_MAXIMIZE_CHANGE, handler);
      return () => ipcRenderer.removeListener(IpcChannels.WINDOW_ON_MAXIMIZE_CHANGE, handler);
    }
  },
  
  // ========== 快捷键 ==========
  shortcut: {
    get: () => ipcRenderer.invoke(IpcChannels.SHORTCUT_GET),
    set: (key: string, accelerator: string) => ipcRenderer.invoke(IpcChannels.SHORTCUT_SET, key, accelerator)
  },

  // ========== 应用信息 ==========
  app: {
    getVersion: () => ipcRenderer.invoke(IpcChannels.APP_VERSION),
    getPlatform: () => process.platform
  },
  
  // ========== 全局配置 ==========
  config: {
    get: (key: string) => ipcRenderer.invoke(IpcChannels.CONFIG_GET, key),
    set: (key: string, value: any) => ipcRenderer.invoke(IpcChannels.CONFIG_SET, key, value),
    getAll: () => ipcRenderer.invoke(IpcChannels.CONFIG_GET_ALL)
  },
  
  // ========== 网关管理 ==========
  gateway: {
    // 启动网关
    start: (options?: GatewayStartOptions): Promise<IpcResponse<GatewayStatus>> => 
      ipcRenderer.invoke(IpcChannels.GATEWAY_START, options),
    
    // 停止网关
    stop: (): Promise<IpcResponse<void>> => 
      ipcRenderer.invoke(IpcChannels.GATEWAY_STOP),
    
    // 重启网关
    restart: (): Promise<IpcResponse<GatewayStatus>> => 
      ipcRenderer.invoke(IpcChannels.GATEWAY_RESTART),
    
    // 获取状态
    status: (): Promise<IpcResponse<GatewayStatus>> => 
      ipcRenderer.invoke(IpcChannels.GATEWAY_STATUS),
    
    // 获取日志
    logs: (): Promise<IpcResponse<GatewayLog[]>> => 
      ipcRenderer.invoke(IpcChannels.GATEWAY_LOGS),
    
    // 获取配置
    config: {
      get: (): Promise<IpcResponse<GatewayConfig>> => 
        ipcRenderer.invoke(IpcChannels.GATEWAY_CONFIG_GET),
      set: (config: Partial<GatewayConfig>): Promise<IpcResponse<void>> => 
        ipcRenderer.invoke(IpcChannels.GATEWAY_CONFIG_SET, config)
    },
    
    // 监听状态变更
    onStatusChange: (callback: (data: { oldState: string; newState: string; info: GatewayStatus }) => void) => {
      const handler: IpcCallback = (_, data) => callback(data);
      ipcRenderer.on(IpcChannels.GATEWAY_ON_STATUS_CHANGE, handler);
      return () => ipcRenderer.removeListener(IpcChannels.GATEWAY_ON_STATUS_CHANGE, handler);
    },
    
    // 监听日志
    onLog: (callback: (entry: GatewayLog) => void) => {
      const handler: IpcCallback = (_, entry: GatewayLog) => callback(entry);
      ipcRenderer.on(IpcChannels.GATEWAY_ON_LOG, handler);
      return () => ipcRenderer.removeListener(IpcChannels.GATEWAY_ON_LOG, handler);
    }
  },

  // ========== 模型管理 ==========
  models: {
    list: (): Promise<IpcResponse<ProviderConfig[]>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_LIST),

    get: (id: string): Promise<IpcResponse<ProviderConfig>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_GET, id),

    add: (data: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<IpcResponse<ProviderConfig>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_ADD, data),

    update: (id: string, updates: Partial<ProviderConfig>): Promise<IpcResponse<ProviderConfig>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_UPDATE, id, updates),

    delete: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_DELETE, id),

    toggle: (id: string, enabled: boolean): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_TOGGLE, id, enabled),

    test: (providerId: string, modelId?: string): Promise<IpcResponse<ModelTestResult>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_TEST, providerId, modelId),

    syncOllama: (providerId: string): Promise<IpcResponse<ModelInfo[]>> =>
      ipcRenderer.invoke(IpcChannels.MODELS_SYNC_OLLAMA, providerId)
  },

  // ========== 权限管理 ==========
  permissions: {
    list: (): Promise<IpcResponse<PermissionSet[]>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_LIST),

    get: (id: string): Promise<IpcResponse<PermissionSet>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_GET, id),

    active: (): Promise<IpcResponse<PermissionSet>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_ACTIVE),

    setActive: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_SET_ACTIVE, id),

    create: (data: { name: string; template: PermissionTemplate; description: string; rules?: PermissionRule[] }): Promise<IpcResponse<PermissionSet>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_CREATE, data),

    update: (id: string, updates: Partial<PermissionSet>): Promise<IpcResponse<PermissionSet>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_UPDATE, id, updates),

    updateRule: (setId: string, ruleId: string, updates: Partial<PermissionRule>): Promise<IpcResponse<PermissionRule>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_UPDATE_RULE, setId, ruleId, updates),

    delete: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_DELETE, id),

    duplicate: (id: string, newName: string): Promise<IpcResponse<PermissionSet>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_DUPLICATE, id, newName),

    check: (request: PermissionCheckRequest): Promise<IpcResponse<PermissionCheckResult>> =>
      ipcRenderer.invoke(IpcChannels.PERMISSIONS_CHECK, request)
  },

  // ========== 聊天管理 ==========
  chat: {
    conversations: (): Promise<IpcResponse<Conversation[]>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATIONS),

    getConversation: (id: string): Promise<IpcResponse<Conversation>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_GET, id),

    createConversation: (data?: { title?: string; providerId?: string; modelId?: string }): Promise<IpcResponse<Conversation>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_CREATE, data),

    updateConversation: (id: string, updates: Partial<Conversation>): Promise<IpcResponse<Conversation>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_UPDATE, id, updates),

    deleteConversation: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_DELETE, id),

    archiveConversation: (id: string): Promise<IpcResponse<Conversation>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_ARCHIVE, id),

    pinConversation: (id: string, pinned: boolean): Promise<IpcResponse<Conversation>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_PIN, id, pinned),

    sendMessage: (conversationId: string, content: string, providerId?: string, modelId?: string): Promise<IpcResponse<ChatMessage>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_MESSAGE_SEND, conversationId, content, providerId, modelId),

    stopGeneration: (conversationId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_MESSAGE_STOP, conversationId),

    continueGeneration: (conversationId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_MESSAGE_CONTINUE, conversationId),

    getLastModel: (): Promise<IpcResponse<{ providerId: string | null; modelId: string | null }>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_LAST_MODEL_GET),

    getSettings: (): Promise<IpcResponse<ChatSettings>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_SETTINGS_GET),

    updateSettings: (settings: Partial<ChatSettings>): Promise<IpcResponse<ChatSettings>> =>
      ipcRenderer.invoke(IpcChannels.CHAT_SETTINGS_UPDATE, settings),

    onMessage: (callback: (data: { conversationId: string; message: ChatMessage }) => void) => {
      const handler: IpcCallback = (_, data) => callback(data);
      ipcRenderer.on(IpcChannels.CHAT_ON_MESSAGE, handler);
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_ON_MESSAGE, handler);
    },

    onConversationUpdate: (callback: (data: { conversation: Conversation }) => void) => {
      const handler: IpcCallback = (_, data) => callback(data);
      ipcRenderer.on(IpcChannels.CHAT_ON_CONVERSATION_UPDATE, handler);
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_ON_CONVERSATION_UPDATE, handler);
    },

    onStreamUpdate: (callback: (data: { conversationId: string; message: ChatMessage }) => void) => {
      const handler: IpcCallback = (_, data) => callback(data);
      ipcRenderer.on(IpcChannels.CHAT_ON_STREAM_UPDATE, handler);
      return () => ipcRenderer.removeListener(IpcChannels.CHAT_ON_STREAM_UPDATE, handler);
    }
  },

  // ========== 任务执行 ==========
  task: {
    execute: (task: Task): Promise<IpcResponse<TaskResult>> =>
      ipcRenderer.invoke(IpcChannels.TASK_EXECUTE, task),

    executeTool: (request: ToolCallRequest): Promise<IpcResponse<ToolCallResult>> =>
      ipcRenderer.invoke(IpcChannels.TASK_EXECUTE_TOOL, request),

    getTools: (): Promise<IpcResponse<ToolDefinition[]>> =>
      ipcRenderer.invoke(IpcChannels.TASK_TOOLS_GET),

    isGatewayRunning: (): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.TASK_GATEWAY_CHECK),

    // 任务日志
    getLog: (taskId: string): Promise<IpcResponse<TaskLogEntry>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_GET, taskId),

    queryLogs: (query: TaskLogQuery): Promise<IpcResponse<TaskLogEntry[]>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_QUERY, query),

    deleteLog: (taskId: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_DELETE, taskId),

    deleteLogs: (taskIds: string[]): Promise<IpcResponse<number>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_DELETE_BATCH, taskIds),

    exportLog: (taskId: string, format: 'json' | 'txt'): Promise<IpcResponse<string>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_EXPORT, taskId, format),

    getStats: (): Promise<IpcResponse<TaskLogStats>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_STATS),

    retry: (taskId: string): Promise<IpcResponse<TaskResult>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_RETRY, taskId),

    cancel: (taskId: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.TASK_LOG_CANCEL, taskId),

    // Phase 2: 任务追踪与预览
    trace: (data: any): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.TASK_TRACE, data),

    confirmPreview: (taskId: string, confirmed: boolean, editedContent?: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.TASK_CONFIRM_PREVIEW, taskId, confirmed, editedContent),

    onPreview: (callback: (previewData: any) => void) => {
      const handler: IpcCallback = (_, previewData) => callback(previewData);
      ipcRenderer.on(IpcChannels.TASK_ON_PREVIEW, handler);
      return () => ipcRenderer.removeListener(IpcChannels.TASK_ON_PREVIEW, handler);
    }
  },

  // ========== 执行模式 ==========
  execution: {
    getMode: (): Promise<IpcResponse<ExecutionMode>> =>
      ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_GET),

    setMode: (mode: ExecutionMode): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_SET, mode),

    checkOperation: (operation: string, params: Record<string, any>): Promise<IpcResponse<ExecutionCheckResult>> =>
      ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_CHECK, operation, params),

    cancelExecution: (): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_CANCEL)
  },

  // ========== 文件操作 ==========
  file: {
    parse: (filePath: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.FILE_PARSE, filePath),

    parseBatch: (filePaths: string[]): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke(IpcChannels.FILE_PARSE_BATCH, filePaths),

    readClipboardImage: (): Promise<IpcResponse<{ base64?: string; error?: string }>> =>
      ipcRenderer.invoke(IpcChannels.FILE_READ_CLIPBOARD_IMAGE),

    getInfo: (filePath: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.FILE_GET_INFO, filePath),

    getAllowedExtensions: (): Promise<IpcResponse<string[]>> =>
      ipcRenderer.invoke(IpcChannels.FILE_GET_ALLOWED_EXTENSIONS)
  },

  // ========== 对话导出 ==========
  conversation: {
    export: (conversation: any, format: 'markdown' | 'pdf' | 'word', outputPath?: string): Promise<IpcResponse<{ filePath: string }>> =>
      ipcRenderer.invoke(IpcChannels.CONVERSATION_EXPORT, conversation, format, outputPath)
  },

  // ========== OpenClaw 核心执行引擎 ==========
  openclaw: {
    // 健康检查
    healthCheck: (): Promise<IpcResponse<{ healthy: boolean; status: string; version?: string; timestamp: number; error?: string }>> =>
      ipcRenderer.invoke(IpcChannels.OPENCLAW_HEALTH_CHECK),
    
    // 执行操作
    execute: (request: any): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.OPENCLAW_EXECUTE, request),

    // 批量执行
    batchExecute: (request: any): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.OPENCLAW_BATCH_EXECUTE, request),

    // 权限检查
    checkPermission: (request: any): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.OPENCLAW_CHECK_PERMISSION, request),

    // 获取审计日志
    getAuditLogs: (limit?: number): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke(IpcChannels.OPENCLAW_GET_AUDIT_LOGS, limit)
  },

  // ========== Hermes 记忆管理 ==========
  hermes: {
    getMemories: (): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.HERMES_GET_MEMORIES),

    saveCoreMemory: (content: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.HERMES_SAVE_CORE_MEMORY, content)
  },

  // ========== 技能管理 ==========
  skills: {
    list: (): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_LIST),

    toggle: (id: string, enabled: boolean): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_TOGGLE, id, enabled),

    reload: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_RELOAD),

    importFile: (filePath: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_IMPORT_FILE, filePath),

    importUrl: (url: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_IMPORT_URL, url),

    mergeCandidates: (): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_MERGE_CANDIDATES),

    performMerge: (skillId1: string, skillId2: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.SKILLS_PERFORM_MERGE, skillId1, skillId2)
  },

  // ========== MCP 配置管理 ==========
  mcp: {
    list: (): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke(IpcChannels.MCP_LIST),

    add: (data: any): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.MCP_ADD, data),

    update: (data: any): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.MCP_UPDATE, data),

    remove: (name: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.MCP_REMOVE, name),

    toggle: (name: string, enabled: boolean): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.MCP_TOGGLE, name, enabled),

    test: (name: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.MCP_TEST, name)
  },

  // ========== Hermes 学习统计 ==========
  learning: {
    getStats: (): Promise<IpcResponse<Record<string, number>>> =>
      ipcRenderer.invoke(IpcChannels.LEARNING_GET_STATS),

    reset: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.LEARNING_RESET),

    saveSkillProposal: (proposal: any): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke(IpcChannels.LEARNING_SAVE_SKILL_PROPOSAL, proposal),

    getPendingProposal: (): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke(IpcChannels.LEARNING_GET_PENDING_PROPOSAL),

    clearPendingProposal: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke(IpcChannels.LEARNING_CLEAR_PENDING_PROPOSAL)
  }
};

// ========== 暴露API ==========

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
