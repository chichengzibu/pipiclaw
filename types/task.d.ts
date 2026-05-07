/**
 * PiPiClaw - 任务系统类型定义（增强版）
 */

import type { PermissionCategory } from '../electron/permissions/PermissionTypes';

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
 * 任务步骤参数 - 文件系统（增强版）
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
 * 任务步骤（增强版）
 */
export interface TaskStep {
  id: string;
  order: number;
  type: string;
  description: string;
  params: FileSystemParams | Record<string, any>;
  requiredPermission?: PermissionCategory;
  requiredAction?: string;
  requiredResource?: string;
  status: string;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * 解析后的指令（增强版）
 */
export interface ParsedInstruction {
  isExecutable: boolean;
  confidence: number;
  steps: Omit<TaskStep, 'id' | 'status' | 'result' | 'error' | 'startTime' | 'endTime'>[];
  originalInstruction: string;
  explanation?: string;
}
