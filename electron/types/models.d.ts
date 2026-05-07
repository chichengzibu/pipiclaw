/**
 * PiPiClaw - 数据模型类型定义（预留）
 * 
 * 定义应用中使用的数据模型类型
 */

// 模型厂商类型
export type ModelProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'doubao' 
  | 'deepseek' 
  | 'qwen' 
  | 'ernie' 
  | 'zhipu' 
  | 'moonshot' 
  | 'ollama' 
  | 'lmstudio' 
  | 'custom';

// 模型使用场景
export type ModelScene = 'global' | 'code' | 'agent' | 'longtext' | 'multimodal';

// 模型配置
export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  apiKey?: string;
  apiUrl: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
  scene?: ModelScene;
  isBackup?: boolean;
  priority?: number;
  createdAt?: number;
  updatedAt?: number;
}

// 权限配置
export interface PermissionConfig {
  enabled: boolean;
  template?: string;
  filesystem: FilesystemPermission;
  shell: ShellPermission;
  browser: BrowserPermission;
  network: NetworkPermission;
  plugins: PluginPermission;
}

// 文件系统权限
export interface FilesystemPermission {
  enabled: boolean;
  allowedDirs: string[];
  blockedDirs: string[];
  allowDelete: boolean;
  allowModify: boolean;
  allowCreate: boolean;
}

// Shell命令权限
export interface ShellPermission {
  enabled: boolean;
  allowedCommands: string[];
  blockedCommands: string[];
  allowAdmin: boolean;
}

// 浏览器权限
export interface BrowserPermission {
  enabled: boolean;
  allowedSites: string[];
  blockedSites: string[];
  allowAutoFill: boolean;
  allowDownload: boolean;
}

// 网络请求权限
export interface NetworkPermission {
  enabled: boolean;
  allowedDomains: string[];
  allowExternal: boolean;
}

// 插件权限
export interface PluginPermission {
  enabled: boolean;
  allowedPlugins: string[];
  blockedPlugins: string[];
}

// 权限模板
export interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  config: PermissionConfig;
}

// 审计日志
export interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  resource: string;
  permission: string;
  result: 'allowed' | 'denied';
  details?: Record<string, any>;
}

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

// 任务步骤状态
export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed';

// 任务步骤
export interface TaskStep {
  id: string;
  name: string;
  status: TaskStepStatus;
  logs: string[];
  result?: any;
  error?: string;
}

// 任务
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  progress: number;
  steps: TaskStep[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

// 系统设置
export interface SystemSettings {
  theme: 'light' | 'dark';
  language: string;
  autoLaunch: boolean;
  startMinimized: boolean;
  gatewayAutoStart: boolean;
  gatewayPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
