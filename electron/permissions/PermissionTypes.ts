/**
 * PiPiClaw - 权限系统类型定义
 */

export type PermissionCategory = 
  | 'filesystem' 
  | 'network' 
  | 'process' 
  | 'system' 
  | 'clipboard' 
  | 'shell'
  | 'environment';

export type PermissionLevel = 'none' | 'read' | 'write' | 'execute' | 'all';

export type PermissionTemplate = 'safe' | 'standard' | 'permissive' | 'custom';

export interface PermissionRule {
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

export interface PermissionSet {
  id: string;
  name: string;
  template: PermissionTemplate;
  description: string;
  rules: PermissionRule[];
  createdAt: number;
  updatedAt: number;
}

export interface PermissionCheckRequest {
  category: PermissionCategory;
  action: string;
  resource?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

export const PERMISSION_CATEGORIES: Record<PermissionCategory, {
  name: string;
  description: string;
  icon: string;
}> = {
  filesystem: {
    name: '文件系统',
    description: '读写文件和目录',
    icon: '📁'
  },
  network: {
    name: '网络',
    description: '发起网络请求和连接',
    icon: '🌐'
  },
  process: {
    name: '进程',
    description: '启动和管理进程',
    icon: '⚙️'
  },
  system: {
    name: '系统',
    description: '系统级别操作',
    icon: '🖥️'
  },
  clipboard: {
    name: '剪贴板',
    description: '读写剪贴板内容',
    icon: '📋'
  },
  shell: {
    name: 'Shell',
    description: '执行shell命令',
    icon: '💻'
  },
  environment: {
    name: '环境变量',
    description: '读取和修改环境变量',
    icon: '🔧'
  }
};

export const PERMISSION_LEVELS: Record<PermissionLevel, {
  name: string;
  description: string;
  value: number;
}> = {
  none: {
    name: '禁止',
    description: '完全禁止此操作',
    value: 0
  },
  read: {
    name: '只读',
    description: '仅允许读取',
    value: 1
  },
  write: {
    name: '读写',
    description: '允许读取和写入',
    value: 2
  },
  execute: {
    name: '执行',
    description: '允许执行操作',
    value: 3
  },
  all: {
    name: '完全',
    description: '允许所有操作',
    value: 4
  }
};

export const TEMPLATE_DEFAULTS: Record<PermissionTemplate, {
  description: string;
  rules: Partial<PermissionRule>[]
}> = {
  safe: {
    description: '严格限制，仅允许基本操作',
    rules: [
      { category: 'filesystem', name: 'filesystem', level: 'read', allowedPaths: ['$HOME/Documents'] },
      { category: 'network', name: 'network', level: 'none' },
      { category: 'process', name: 'process', level: 'none' },
      { category: 'system', name: 'system', level: 'none' },
      { category: 'clipboard', name: 'clipboard', level: 'read' },
      { category: 'shell', name: 'shell', level: 'none' },
      { category: 'environment', name: 'environment', level: 'read' }
    ]
  },
  standard: {
    description: '平衡模式，允许常见操作',
    rules: [
      { category: 'filesystem', name: 'filesystem', level: 'all', allowedPaths: ['$HOME/**'] },
      { category: 'network', name: 'network', level: 'read', allowedDomains: ['*.ai.*', '*.openai.com', '*.anthropic.com'] },
      { category: 'process', name: 'process', level: 'execute' },
      { category: 'system', name: 'system', level: 'all' },
      { category: 'clipboard', name: 'clipboard', level: 'all' },
      { category: 'shell', name: 'shell', level: 'all' },
      { category: 'environment', name: 'environment', level: 'read' }
    ]
  },
  permissive: {
    description: '开放模式，允许几乎所有操作',
    rules: [
      { category: 'filesystem', name: 'filesystem', level: 'all' },
      { category: 'network', name: 'network', level: 'all' },
      { category: 'process', name: 'process', level: 'all' },
      { category: 'system', name: 'system', level: 'all' },
      { category: 'clipboard', name: 'clipboard', level: 'all' },
      { category: 'shell', name: 'shell', level: 'all' },
      { category: 'environment', name: 'environment', level: 'all' }
    ]
  },
  custom: {
    description: '自定义权限配置',
    rules: []
  }
};
