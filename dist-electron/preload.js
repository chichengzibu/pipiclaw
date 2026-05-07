"use strict";
const electron = require("electron");
const IpcChannels = {
  // 文件选择器
  DIALOG_OPEN_FILE: "dialog:openFile",
  // 窗口管理
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_CLOSE: "window:close",
  WINDOW_IS_MAXIMIZED: "window:isMaximized",
  WINDOW_ON_MAXIMIZE_CHANGE: "window:onMaximizeChange",
  WINDOW_SET_ALWAYS_ON_TOP: "window:setAlwaysOnTop",
  WINDOW_IS_ALWAYS_ON_TOP: "window:isAlwaysOnTop",
  WINDOW_SET_EDGE_HIDE: "window:setEdgeHide",
  WINDOW_IS_EDGE_HIDE: "window:isEdgeHide",
  WINDOW_SHOW_MINI: "window:showMini",
  WINDOW_HIDE_TO_TRAY: "window:hideToTray",
  // 快捷键
  SHORTCUT_GET: "shortcut:get",
  SHORTCUT_SET: "shortcut:set",
  // 网关管理
  GATEWAY_START: "gateway:start",
  GATEWAY_STOP: "gateway:stop",
  GATEWAY_RESTART: "gateway:restart",
  GATEWAY_STATUS: "gateway:status",
  GATEWAY_LOGS: "gateway:logs",
  GATEWAY_CONFIG_GET: "gateway:config:get",
  GATEWAY_CONFIG_SET: "gateway:config:set",
  GATEWAY_ON_STATUS_CHANGE: "gateway:onStatusChange",
  GATEWAY_ON_LOG: "gateway:onLog",
  // 全局配置
  CONFIG_GET: "config:get",
  CONFIG_SET: "config:set",
  CONFIG_GET_ALL: "config:getAll",
  // 模型管理
  MODELS_LIST: "models:list",
  MODELS_GET: "models:get",
  MODELS_ADD: "models:add",
  MODELS_UPDATE: "models:update",
  MODELS_DELETE: "models:delete",
  MODELS_TOGGLE: "models:toggle",
  MODELS_TEST: "models:test",
  MODELS_SYNC_OLLAMA: "models:syncOllama",
  // 权限管理
  PERMISSIONS_LIST: "permissions:list",
  PERMISSIONS_GET: "permissions:get",
  PERMISSIONS_ACTIVE: "permissions:active",
  PERMISSIONS_SET_ACTIVE: "permissions:setActive",
  PERMISSIONS_CREATE: "permissions:create",
  PERMISSIONS_UPDATE: "permissions:update",
  PERMISSIONS_UPDATE_RULE: "permissions:updateRule",
  PERMISSIONS_DELETE: "permissions:delete",
  PERMISSIONS_DUPLICATE: "permissions:duplicate",
  PERMISSIONS_CHECK: "permissions:check",
  // 聊天管理
  CHAT_CONVERSATIONS: "chat:conversations",
  CHAT_CONVERSATION_GET: "chat:conversation:get",
  CHAT_CONVERSATION_CREATE: "chat:conversation:create",
  CHAT_CONVERSATION_UPDATE: "chat:conversation:update",
  CHAT_CONVERSATION_DELETE: "chat:conversation:delete",
  CHAT_CONVERSATION_ARCHIVE: "chat:conversation:archive",
  CHAT_CONVERSATION_PIN: "chat:conversation:pin",
  CHAT_MESSAGE_SEND: "chat:message:send",
  CHAT_MESSAGE_STOP: "chat:message:stop",
  CHAT_MESSAGE_CONTINUE: "chat:message:continue",
  CHAT_LAST_MODEL_GET: "chat:lastModel:get",
  CHAT_SETTINGS_GET: "chat:settings:get",
  CHAT_SETTINGS_UPDATE: "chat:settings:update",
  CHAT_ON_MESSAGE: "chat:onMessage",
  CHAT_ON_CONVERSATION_UPDATE: "chat:onConversationUpdate",
  CHAT_ON_STREAM_UPDATE: "chat:streamUpdate",
  // 应用信息
  APP_VERSION: "app:version",
  // 任务执行
  TASK_EXECUTE: "task:execute",
  TASK_EXECUTE_TOOL: "task:executeTool",
  TASK_TOOLS_GET: "task:toolsGet",
  TASK_GATEWAY_CHECK: "task:gatewayCheck",
  // 执行模式
  EXECUTION_MODE_GET: "execution:mode:get",
  EXECUTION_MODE_SET: "execution:mode:set",
  EXECUTION_MODE_CHECK: "execution:mode:check",
  EXECUTION_MODE_CANCEL: "execution:mode:cancel",
  // 任务日志
  TASK_LOG_GET: "task:log:get",
  TASK_LOG_QUERY: "task:log:query",
  TASK_LOG_DELETE: "task:log:delete",
  TASK_LOG_DELETE_BATCH: "task:log:deleteBatch",
  TASK_LOG_EXPORT: "task:log:export",
  TASK_LOG_STATS: "task:log:stats",
  TASK_LOG_RETRY: "task:log:retry",
  TASK_LOG_CANCEL: "task:log:cancel",
  // 文件操作
  FILE_PARSE: "file:parse",
  FILE_PARSE_BATCH: "file:parseBatch",
  FILE_READ_CLIPBOARD_IMAGE: "file:readClipboardImage",
  FILE_GET_INFO: "file:getInfo",
  FILE_GET_ALLOWED_EXTENSIONS: "file:getAllowedExtensions",
  // 对话导出
  CONVERSATION_EXPORT: "conversation:export",
  // OpenClaw 核心执行引擎
  OPENCLAW_EXECUTE: "openclaw:execute",
  OPENCLAW_BATCH_EXECUTE: "openclaw:batch-execute",
  OPENCLAW_CHECK_PERMISSION: "openclaw:check-permission",
  OPENCLAW_GET_AUDIT_LOGS: "openclaw:get-audit-logs",
  OPENCLAW_HEALTH_CHECK: "openclaw:health-check",
  // Hermes 记忆管理
  HERMES_GET_MEMORIES: "hermes:getMemories",
  HERMES_SAVE_CORE_MEMORY: "hermes:saveCoreMemory",
  // Phase 2: 任务预览与确认
  TASK_TRACE: "task:trace",
  TASK_CONFIRM_PREVIEW: "task:confirm-preview",
  TASK_ON_PREVIEW: "task:on-preview",
  // ========== 技能管理 ==========
  SKILLS_LIST: "skills:list",
  SKILLS_TOGGLE: "skills:toggle",
  SKILLS_RELOAD: "skills:reload",
  SKILLS_IMPORT_FILE: "skills:importFile",
  SKILLS_IMPORT_URL: "skills:importUrl",
  SKILLS_MERGE_CANDIDATES: "skills:merge-candidates",
  SKILLS_PERFORM_MERGE: "skills:perform-merge",
  // ========== MCP 配置管理 ==========
  MCP_LIST: "mcp:list",
  MCP_ADD: "mcp:add",
  MCP_UPDATE: "mcp:update",
  MCP_REMOVE: "mcp:remove",
  MCP_TOGGLE: "mcp:toggle",
  MCP_TEST: "mcp:test",
  // ========== Hermes 学习统计 ==========
  LEARNING_GET_STATS: "learning:get-stats",
  LEARNING_RESET: "learning:reset",
  LEARNING_SAVE_SKILL_PROPOSAL: "learning:save-skill-proposal",
  LEARNING_GET_PENDING_PROPOSAL: "learning:get-pending-proposal",
  LEARNING_CLEAR_PENDING_PROPOSAL: "learning:clear-pending-proposal"
};
const electronAPI = {
  // ========== 文件选择器 ==========
  dialog: {
    openFile: (options) => electron.ipcRenderer.invoke(IpcChannels.DIALOG_OPEN_FILE, options)
  },
  // ========== 窗口管理 ==========
  window: {
    minimize: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_MINIMIZE),
    maximize: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_MAXIMIZE),
    close: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_CLOSE),
    isMaximized: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_IS_MAXIMIZED),
    setAlwaysOnTop: (value) => electron.ipcRenderer.invoke(IpcChannels.WINDOW_SET_ALWAYS_ON_TOP, value),
    isAlwaysOnTop: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_IS_ALWAYS_ON_TOP),
    setEdgeHide: (value) => electron.ipcRenderer.invoke(IpcChannels.WINDOW_SET_EDGE_HIDE, value),
    isEdgeHide: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_IS_EDGE_HIDE),
    showMini: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_SHOW_MINI),
    hideToTray: () => electron.ipcRenderer.invoke(IpcChannels.WINDOW_HIDE_TO_TRAY),
    onMaximizeChange: (callback) => {
      const handler = (_, isMaximized) => callback(isMaximized);
      electron.ipcRenderer.on(IpcChannels.WINDOW_ON_MAXIMIZE_CHANGE, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.WINDOW_ON_MAXIMIZE_CHANGE, handler);
    }
  },
  // ========== 快捷键 ==========
  shortcut: {
    get: () => electron.ipcRenderer.invoke(IpcChannels.SHORTCUT_GET),
    set: (key, accelerator) => electron.ipcRenderer.invoke(IpcChannels.SHORTCUT_SET, key, accelerator)
  },
  // ========== 应用信息 ==========
  app: {
    getVersion: () => electron.ipcRenderer.invoke(IpcChannels.APP_VERSION),
    getPlatform: () => process.platform
  },
  // ========== 全局配置 ==========
  config: {
    get: (key) => electron.ipcRenderer.invoke(IpcChannels.CONFIG_GET, key),
    set: (key, value) => electron.ipcRenderer.invoke(IpcChannels.CONFIG_SET, key, value),
    getAll: () => electron.ipcRenderer.invoke(IpcChannels.CONFIG_GET_ALL)
  },
  // ========== 网关管理 ==========
  gateway: {
    // 启动网关
    start: (options) => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_START, options),
    // 停止网关
    stop: () => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_STOP),
    // 重启网关
    restart: () => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_RESTART),
    // 获取状态
    status: () => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_STATUS),
    // 获取日志
    logs: () => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_LOGS),
    // 获取配置
    config: {
      get: () => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_CONFIG_GET),
      set: (config) => electron.ipcRenderer.invoke(IpcChannels.GATEWAY_CONFIG_SET, config)
    },
    // 监听状态变更
    onStatusChange: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on(IpcChannels.GATEWAY_ON_STATUS_CHANGE, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.GATEWAY_ON_STATUS_CHANGE, handler);
    },
    // 监听日志
    onLog: (callback) => {
      const handler = (_, entry) => callback(entry);
      electron.ipcRenderer.on(IpcChannels.GATEWAY_ON_LOG, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.GATEWAY_ON_LOG, handler);
    }
  },
  // ========== 模型管理 ==========
  models: {
    list: () => electron.ipcRenderer.invoke(IpcChannels.MODELS_LIST),
    get: (id) => electron.ipcRenderer.invoke(IpcChannels.MODELS_GET, id),
    add: (data) => electron.ipcRenderer.invoke(IpcChannels.MODELS_ADD, data),
    update: (id, updates) => electron.ipcRenderer.invoke(IpcChannels.MODELS_UPDATE, id, updates),
    delete: (id) => electron.ipcRenderer.invoke(IpcChannels.MODELS_DELETE, id),
    toggle: (id, enabled) => electron.ipcRenderer.invoke(IpcChannels.MODELS_TOGGLE, id, enabled),
    test: (providerId, modelId) => electron.ipcRenderer.invoke(IpcChannels.MODELS_TEST, providerId, modelId),
    syncOllama: (providerId) => electron.ipcRenderer.invoke(IpcChannels.MODELS_SYNC_OLLAMA, providerId)
  },
  // ========== 权限管理 ==========
  permissions: {
    list: () => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_LIST),
    get: (id) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_GET, id),
    active: () => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_ACTIVE),
    setActive: (id) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_SET_ACTIVE, id),
    create: (data) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_CREATE, data),
    update: (id, updates) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_UPDATE, id, updates),
    updateRule: (setId, ruleId, updates) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_UPDATE_RULE, setId, ruleId, updates),
    delete: (id) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_DELETE, id),
    duplicate: (id, newName) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_DUPLICATE, id, newName),
    check: (request) => electron.ipcRenderer.invoke(IpcChannels.PERMISSIONS_CHECK, request)
  },
  // ========== 聊天管理 ==========
  chat: {
    conversations: () => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATIONS),
    getConversation: (id) => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_GET, id),
    createConversation: (data) => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_CREATE, data),
    updateConversation: (id, updates) => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_UPDATE, id, updates),
    deleteConversation: (id) => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_DELETE, id),
    archiveConversation: (id) => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_ARCHIVE, id),
    pinConversation: (id, pinned) => electron.ipcRenderer.invoke(IpcChannels.CHAT_CONVERSATION_PIN, id, pinned),
    sendMessage: (conversationId, content, providerId, modelId) => electron.ipcRenderer.invoke(IpcChannels.CHAT_MESSAGE_SEND, conversationId, content, providerId, modelId),
    stopGeneration: (conversationId) => electron.ipcRenderer.invoke(IpcChannels.CHAT_MESSAGE_STOP, conversationId),
    continueGeneration: (conversationId) => electron.ipcRenderer.invoke(IpcChannels.CHAT_MESSAGE_CONTINUE, conversationId),
    getLastModel: () => electron.ipcRenderer.invoke(IpcChannels.CHAT_LAST_MODEL_GET),
    getSettings: () => electron.ipcRenderer.invoke(IpcChannels.CHAT_SETTINGS_GET),
    updateSettings: (settings) => electron.ipcRenderer.invoke(IpcChannels.CHAT_SETTINGS_UPDATE, settings),
    onMessage: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on(IpcChannels.CHAT_ON_MESSAGE, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.CHAT_ON_MESSAGE, handler);
    },
    onConversationUpdate: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on(IpcChannels.CHAT_ON_CONVERSATION_UPDATE, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.CHAT_ON_CONVERSATION_UPDATE, handler);
    },
    onStreamUpdate: (callback) => {
      const handler = (_, data) => callback(data);
      electron.ipcRenderer.on(IpcChannels.CHAT_ON_STREAM_UPDATE, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.CHAT_ON_STREAM_UPDATE, handler);
    }
  },
  // ========== 任务执行 ==========
  task: {
    execute: (task) => electron.ipcRenderer.invoke(IpcChannels.TASK_EXECUTE, task),
    executeTool: (request) => electron.ipcRenderer.invoke(IpcChannels.TASK_EXECUTE_TOOL, request),
    getTools: () => electron.ipcRenderer.invoke(IpcChannels.TASK_TOOLS_GET),
    isGatewayRunning: () => electron.ipcRenderer.invoke(IpcChannels.TASK_GATEWAY_CHECK),
    // 任务日志
    getLog: (taskId) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_GET, taskId),
    queryLogs: (query) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_QUERY, query),
    deleteLog: (taskId) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_DELETE, taskId),
    deleteLogs: (taskIds) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_DELETE_BATCH, taskIds),
    exportLog: (taskId, format) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_EXPORT, taskId, format),
    getStats: () => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_STATS),
    retry: (taskId) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_RETRY, taskId),
    cancel: (taskId) => electron.ipcRenderer.invoke(IpcChannels.TASK_LOG_CANCEL, taskId),
    // Phase 2: 任务追踪与预览
    trace: (data) => electron.ipcRenderer.invoke(IpcChannels.TASK_TRACE, data),
    confirmPreview: (taskId, confirmed, editedContent) => electron.ipcRenderer.invoke(IpcChannels.TASK_CONFIRM_PREVIEW, taskId, confirmed, editedContent),
    onPreview: (callback) => {
      const handler = (_, previewData) => callback(previewData);
      electron.ipcRenderer.on(IpcChannels.TASK_ON_PREVIEW, handler);
      return () => electron.ipcRenderer.removeListener(IpcChannels.TASK_ON_PREVIEW, handler);
    }
  },
  // ========== 执行模式 ==========
  execution: {
    getMode: () => electron.ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_GET),
    setMode: (mode) => electron.ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_SET, mode),
    checkOperation: (operation, params) => electron.ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_CHECK, operation, params),
    cancelExecution: () => electron.ipcRenderer.invoke(IpcChannels.EXECUTION_MODE_CANCEL)
  },
  // ========== 文件操作 ==========
  file: {
    parse: (filePath) => electron.ipcRenderer.invoke(IpcChannels.FILE_PARSE, filePath),
    parseBatch: (filePaths) => electron.ipcRenderer.invoke(IpcChannels.FILE_PARSE_BATCH, filePaths),
    readClipboardImage: () => electron.ipcRenderer.invoke(IpcChannels.FILE_READ_CLIPBOARD_IMAGE),
    getInfo: (filePath) => electron.ipcRenderer.invoke(IpcChannels.FILE_GET_INFO, filePath),
    getAllowedExtensions: () => electron.ipcRenderer.invoke(IpcChannels.FILE_GET_ALLOWED_EXTENSIONS)
  },
  // ========== 对话导出 ==========
  conversation: {
    export: (conversation, format, outputPath) => electron.ipcRenderer.invoke(IpcChannels.CONVERSATION_EXPORT, conversation, format, outputPath)
  },
  // ========== OpenClaw 核心执行引擎 ==========
  openclaw: {
    // 健康检查
    healthCheck: () => electron.ipcRenderer.invoke(IpcChannels.OPENCLAW_HEALTH_CHECK),
    // 执行操作
    execute: (request) => electron.ipcRenderer.invoke(IpcChannels.OPENCLAW_EXECUTE, request),
    // 批量执行
    batchExecute: (request) => electron.ipcRenderer.invoke(IpcChannels.OPENCLAW_BATCH_EXECUTE, request),
    // 权限检查
    checkPermission: (request) => electron.ipcRenderer.invoke(IpcChannels.OPENCLAW_CHECK_PERMISSION, request),
    // 获取审计日志
    getAuditLogs: (limit) => electron.ipcRenderer.invoke(IpcChannels.OPENCLAW_GET_AUDIT_LOGS, limit)
  },
  // ========== Hermes 记忆管理 ==========
  hermes: {
    getMemories: () => electron.ipcRenderer.invoke(IpcChannels.HERMES_GET_MEMORIES),
    saveCoreMemory: (content) => electron.ipcRenderer.invoke(IpcChannels.HERMES_SAVE_CORE_MEMORY, content)
  },
  // ========== 技能管理 ==========
  skills: {
    list: () => electron.ipcRenderer.invoke(IpcChannels.SKILLS_LIST),
    toggle: (id, enabled) => electron.ipcRenderer.invoke(IpcChannels.SKILLS_TOGGLE, id, enabled),
    reload: () => electron.ipcRenderer.invoke(IpcChannels.SKILLS_RELOAD),
    importFile: (filePath) => electron.ipcRenderer.invoke(IpcChannels.SKILLS_IMPORT_FILE, filePath),
    importUrl: (url) => electron.ipcRenderer.invoke(IpcChannels.SKILLS_IMPORT_URL, url),
    mergeCandidates: () => electron.ipcRenderer.invoke(IpcChannels.SKILLS_MERGE_CANDIDATES),
    performMerge: (skillId1, skillId2) => electron.ipcRenderer.invoke(IpcChannels.SKILLS_PERFORM_MERGE, skillId1, skillId2)
  },
  // ========== MCP 配置管理 ==========
  mcp: {
    list: () => electron.ipcRenderer.invoke(IpcChannels.MCP_LIST),
    add: (data) => electron.ipcRenderer.invoke(IpcChannels.MCP_ADD, data),
    update: (data) => electron.ipcRenderer.invoke(IpcChannels.MCP_UPDATE, data),
    remove: (name) => electron.ipcRenderer.invoke(IpcChannels.MCP_REMOVE, name),
    toggle: (name, enabled) => electron.ipcRenderer.invoke(IpcChannels.MCP_TOGGLE, name, enabled),
    test: (name) => electron.ipcRenderer.invoke(IpcChannels.MCP_TEST, name)
  },
  // ========== Hermes 学习统计 ==========
  learning: {
    getStats: () => electron.ipcRenderer.invoke(IpcChannels.LEARNING_GET_STATS),
    reset: () => electron.ipcRenderer.invoke(IpcChannels.LEARNING_RESET),
    saveSkillProposal: (proposal) => electron.ipcRenderer.invoke(IpcChannels.LEARNING_SAVE_SKILL_PROPOSAL, proposal),
    getPendingProposal: () => electron.ipcRenderer.invoke(IpcChannels.LEARNING_GET_PENDING_PROPOSAL),
    clearPendingProposal: () => electron.ipcRenderer.invoke(IpcChannels.LEARNING_CLEAR_PENDING_PROPOSAL)
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
