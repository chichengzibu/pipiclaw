/**
 * PiPiClaw - 任务执行模式定义
 * 
 * 职责：
 * 1. 定义3种执行模式：安全模式(Ask)、计划模式(Plan)、全量模式(Craft)
 * 2. 映射权限级别到操作类型
 * 3. 提供模式规则和配置
 */

import type { PermissionCategory } from '../permissions/PermissionTypes';

/**
 * 执行模式枚举
 */
export enum ExecutionMode {
  /** 🔒 安全模式（Ask）：纯对话模式，拦截所有执行类指令 */
  SAFE = 'safe',
  
  /** ⚖️ 计划模式（Plan）：AI输出执行计划，用户确认后执行 */
  PLAN = 'plan',
  
  /** 🔓 全量模式（Craft）：权限范围内自动执行，高危操作二次确认 */
  CRAFT = 'craft'
}

/**
 * 执行模式配置
 */
export interface ExecutionModeConfig {
  /** 模式标识 */
  mode: ExecutionMode;
  /** 模式名称 */
  name: string;
  /** 模式描述 */
  description: string;
  /** 模式图标 */
  icon: string;
  /** 是否允许执行操作 */
  allowExecution: boolean;
  /** 是否需要用户确认 */
  requireConfirmation: boolean;
  /** 需要二次确认的操作类型 */
  highRiskOperations?: string[];
}

/**
 * 操作风险等级
 */
export enum RiskLevel {
  /** 低风险：读取类操作 */
  LOW = 'low',
  /** 中风险：写入类操作 */
  MEDIUM = 'medium',
  /** 高风险：删除、执行类操作 */
  HIGH = 'high'
}

/**
 * 操作风险映射
 */
export const RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  // 文件系统 - 低风险
  read_file: RiskLevel.LOW,
  list_directory: RiskLevel.LOW,
  file_exists: RiskLevel.LOW,
  
  // 文件系统 - 中风险
  write_file: RiskLevel.MEDIUM,
  create_file: RiskLevel.MEDIUM,
  create_directory: RiskLevel.MEDIUM,
  
  // 文件系统 - 高风险
  delete_file: RiskLevel.HIGH,
  delete_dir: RiskLevel.HIGH,
  copy_file: RiskLevel.HIGH,
  move_file: RiskLevel.HIGH,
  
  // Shell - 高风险
  run_command: RiskLevel.HIGH,
  
  // 系统 - 中风险
  open_url: RiskLevel.MEDIUM,
  clipboard_read: RiskLevel.LOW,
  clipboard_write: RiskLevel.LOW
};

/**
 * 需要二次确认的操作（高危操作）
 */
export const HIGH_RISK_OPERATIONS = [
  'delete_file',
  'delete_dir',
  'run_command',
  'copy_file',
  'move_file'
];

/**
 * 执行模式配置表
 */
export const EXECUTION_MODE_CONFIGS: Record<ExecutionMode, ExecutionModeConfig> = {
  [ExecutionMode.SAFE]: {
    mode: ExecutionMode.SAFE,
    name: '安全模式',
    description: '纯对话模式，完全拦截所有执行类指令，禁止OpenClaw网关调用，仅支持纯文本对话',
    icon: '🔒',
    allowExecution: false,
    requireConfirmation: false
  },
  [ExecutionMode.PLAN]: {
    mode: ExecutionMode.PLAN,
    name: '计划模式',
    description: 'AI先输出完整执行计划+全链路权限校验结果，用户手动点击「确认执行」后，才会发起任务执行',
    icon: '⚖️',
    allowExecution: true,
    requireConfirmation: true
  },
  [ExecutionMode.CRAFT]: {
    mode: ExecutionMode.CRAFT,
    name: '全量模式',
    description: '权限范围内的操作自动执行，高危操作（删除文件、执行Shell、修改系统配置）自动触发二次确认弹窗',
    icon: '🔓',
    allowExecution: true,
    requireConfirmation: false,
    highRiskOperations: HIGH_RISK_OPERATIONS
  }
};

/**
 * 权限检查请求（执行前校验）
 */
export interface ExecutionCheckRequest {
  operation: string;
  params: Record<string, any>;
  mode: ExecutionMode;
}

/**
 * 权限检查结果
 */
export interface ExecutionCheckResult {
  /** 是否允许执行 */
  allowed: boolean;
  /** 检查级别 */
  checkLevel: 'passed' | 'requires_confirmation' | 'blocked';
  /** 原因说明 */
  reason?: string;
  /** 权限配置指引 */
  guidance?: string;
}

/**
 * 执行计划步骤
 */
export interface ExecutionPlanStep {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  riskLevel: RiskLevel;
  permissionCheck: {
    category: PermissionCategory;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
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

/**
 * 确认执行请求
 */
export interface ConfirmExecutionRequest {
  taskId: string;
  plan: ExecutionPlan;
  confirmedSteps: number[];
}
