/**
 * PiPiClaw - 任务系统类型定义
 * 
 * 核心类型：
 * 1. Task - 任务单元
 * 2. TaskStep - 执行步骤
 * 3. TaskResult - 执行结果
 * 4. TaskStatus - 任务状态枚举
 */

import type { PermissionCategory } from '../permissions/PermissionTypes';

/**
 * 任务状态
 */
export enum TaskStatus {
  /** 等待执行 */
  PENDING = 'pending',
  /** 执行中 */
  RUNNING = 'running',
  /** 执行成功 */
  SUCCESS = 'success',
  /** 执行失败 */
  FAILED = 'failed',
  /** 被取消 */
  CANCELLED = 'cancelled'
}

/**
 * 任务步骤状态
 */
export enum StepStatus {
  /** 等待执行 */
  PENDING = 'pending',
  /** 执行中 */
  RUNNING = 'running',
  /** 执行成功 */
  SUCCESS = 'success',
  /** 执行失败 */
  FAILED = 'failed',
  /** 跳过 */
  SKIPPED = 'skipped'
}

/**
 * 任务步骤类型
 */
export enum StepType {
  /** 权限检查 */
  PERMISSION_CHECK = 'permission_check',
  /** 文件系统操作 */
  FILESYSTEM = 'filesystem',
  /** 网络请求 */
  NETWORK = 'network',
  /** 进程管理 */
  PROCESS = 'process',
  /** Shell命令 */
  SHELL = 'shell',
  /** 剪贴板操作 */
  CLIPBOARD = 'clipboard',
  /** 系统操作 */
  SYSTEM = 'system',
  /** 等待用户确认 */
  USER_CONFIRM = 'user_confirm',
  /** 返回结果 */
  RESULT = 'result'
}

/**
 * 文件系统操作类型
 */
export type FileOperation = 
  | 'read_file'
  | 'write_file'
  | 'create_file'
  | 'delete_file'
  | 'read_dir'
  | 'create_dir'
  | 'delete_dir'
  | 'copy_file'
  | 'move_file'
  | 'exists'
  | 'stat';

/**
 * 网络操作类型
 */
export type NetworkOperation = 'http_get' | 'http_post' | 'http_put' | 'http_delete';

/**
 * 进程操作类型
 */
export type ProcessOperation = 'run' | 'kill' | 'list' | 'status';

/**
 * 系统操作类型
 */
export type SystemOperation = 'open_url' | 'open_app' | 'screenshot' | 'clipboard_read' | 'clipboard_write';

/**
 * 任务步骤参数 - 文件系统
 */
export interface FileSystemParams {
  operation: FileOperation;
  path: string;
  content?: string;
  encoding?: string;
  options?: Record<string, any>;
  /** 是否需要 AI 生成内容 */
  requires_ai_generation?: boolean;
  /** 文件类型（从路径推断） */
  fileType?: string;
}

/**
 * 内容校验结果
 */
export interface ValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * AI 生成结果
 */
export interface AIGenerationResult {
  success: boolean;
  content?: string;
  error?: string;
  suggestion?: string;
}

/**
 * 任务步骤参数 - 网络请求
 */
export interface NetworkParams {
  operation: NetworkOperation;
  url: string;
  headers?: Record<string, string>;
  body?: string | object;
  timeout?: number;
}

/**
 * 任务步骤参数 - Shell命令
 */
export interface ShellParams {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * 任务步骤参数 - 进程管理
 */
export interface ProcessParams {
  operation: ProcessOperation;
  command?: string;
  args?: string[];
  pid?: number;
}

/**
 * 任务步骤参数 - 系统操作
 */
export interface SystemParams {
  operation: SystemOperation;
  value: string;
  options?: Record<string, any>;
}

/**
 * 任务步骤参数（联合类型）
 */
export type StepParams = 
  | FileSystemParams 
  | NetworkParams 
  | ShellParams 
  | ProcessParams 
  | SystemParams
  | Record<string, any>;

/**
 * 任务步骤
 */
export interface TaskStep {
  /** 步骤ID */
  id: string;
  /** 步骤序号 */
  order: number;
  /** 步骤类型 */
  type: StepType;
  /** 步骤描述 */
  description: string;
  /** 步骤参数 */
  params: StepParams;
  /** 需要的权限类别 */
  requiredPermission?: PermissionCategory;
  /** 需要的权限动作 */
  requiredAction?: string;
  /** 需要的资源路径 */
  requiredResource?: string;
  /** 步骤状态 */
  status: StepStatus;
  /** 执行结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
}

/**
 * 任务
 */
export interface Task {
  /** 任务ID */
  id: string;
  /** 关联的会话ID */
  conversationId: string;
  /** 关联的消息ID */
  messageId: string;
  /** 原始用户指令 */
  instruction: string;
  /** 解析后的任务步骤 */
  steps: TaskStep[];
  /** 任务状态 */
  status: TaskStatus;
  /** 权限集ID（可选，如果不提供则使用全局） */
  permissionSetId?: string;
  /** 执行结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 开始执行时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
}

/**
 * 任务执行结果
 */
export interface TaskResult {
  /** 是否成功 */
  success: boolean;
  /** 任务ID */
  taskId: string;
  /** 状态 */
  status: TaskStatus;
  /** 执行摘要 */
  summary: string;
  /** 详细结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 执行步骤数 */
  totalSteps: number;
  /** 成功步骤数 */
  successSteps: number;
  /** 失败步骤数 */
  failedSteps: number;
  /** 执行时间(ms) */
  duration: number;
}

/**
 * 工具调用请求（来自AI）
 */
export interface ToolCallRequest {
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, any>;
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 是否成功 */
  success: boolean;
  /** 结果内容 */
  content: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 自然语言指令解析结果
 */
export interface ParsedInstruction {
  /** 是否识别为执行类指令 */
  isExecutable: boolean;
  /** 置信度(0-1) */
  confidence: number;
  /** 解析出的任务步骤 */
  steps: Omit<TaskStep, 'id' | 'status' | 'result' | 'error' | 'startTime' | 'endTime'>[];
  /** 原始指令 */
  originalInstruction: string;
  /** 解析说明 */
  explanation?: string;
}

/**
 * 工具定义（供AI识别）
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数定义 */
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/**
 * 可用工具列表
 */
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取文本文件内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径，如 D:/test/file.txt' },
        encoding: { type: 'string', description: '文件编码，默认 utf-8' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: '创建或覆盖写入文本文件',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径，如 D:/test/file.txt' },
        content: { type: 'string', description: '文件内容' },
        encoding: { type: 'string', description: '文件编码，默认 utf-8' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_directory',
    description: '创建文件夹目录',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径，如 D:/test' }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description: '删除文件',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'list_directory',
    description: '列出目录内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'file_exists',
    description: '检查文件或目录是否存在',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件或目录路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'run_command',
    description: '执行系统命令',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        cwd: { type: 'string', description: '工作目录（可选）' }
      },
      required: ['command']
    }
  },
  {
    name: 'open_url',
    description: '在浏览器中打开网址',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '网址 URL' }
      },
      required: ['url']
    }
  },
  {
    name: 'clipboard_read',
    description: '读取剪贴板内容',
    parameters: {
      type: 'object',
      properties: {
        dummy: { type: 'string', description: '(无参数)' }
      },
      required: []
    }
  },
  {
    name: 'clipboard_write',
    description: '写入内容到剪贴板',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要写入剪贴板的文本' }
      },
      required: ['text']
    }
  }
];
