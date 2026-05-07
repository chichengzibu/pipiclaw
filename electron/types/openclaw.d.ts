/**
 * PiPiClaw - OpenClaw 核心类型定义
 */

// ========== 操作类型 ==========
export type OpenClawOperationType =
  | 'read_file'
  | 'write_file'
  | 'create_file'
  | 'delete_file'
  | 'rename_file'
  | 'list_directory'
  | 'create_directory'
  | 'delete_directory'
  | 'file_exists'
  | 'run_command'
  | 'open_url'
  | 'clipboard_read'
  | 'clipboard_write'
  // 浏览器操作
  | 'browser_open'
  | 'browser_click'
  | 'browser_type'
  | 'browser_navigate'
  | 'browser_screenshot'
  | 'browser_get_text'
  | 'browser_wait_for';

// ========== 操作状态 ==========
export type OpenClawOperationStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

// ========== 文件操作参数 ==========
export interface FileOperationParams {
  path: string;
  content?: string;
  encoding?: BufferEncoding;
  newPath?: string;
  recursive?: boolean;
}

// ========== 命令执行参数 ==========
export interface CommandOperationParams {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  shell?: boolean;
}

// ========== 单步操作请求 ==========
export interface OpenClawOperationRequest {
  operationType: OpenClawOperationType;
  params: FileOperationParams | CommandOperationParams | Record<string, any>;
  operationId?: string;
}

// ========== 单步操作结果 ==========
export interface OpenClawOperationResult {
  success: boolean;
  operationType: OpenClawOperationType;
  operationId?: string;
  status: OpenClawOperationStatus;
  result?: any;
  error?: string;
  errorCode?: string;
  guidance?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  permissionCheck?: {
    allowed: boolean;
    category: string;
    action: string;
    reason?: string;
    guidance?: string;
  };
}

// ========== 批量执行请求 ==========
export interface OpenClawBatchRequest {
  operations: OpenClawOperationRequest[];
  failFast?: boolean;
  parallel?: boolean;
}

// ========== 批量执行结果 ==========
export interface OpenClawBatchResult {
  success: boolean;
  total: number;
  completed: number;
  failed: number;
  results: OpenClawOperationResult[];
  summary?: string;
  duration?: number;
}

// ========== 权限校验请求 ==========
export interface OpenClawPermissionCheckRequest {
  operationType: OpenClawOperationType;
  resource?: string;
}

// ========== 权限校验结果 ==========
export interface OpenClawPermissionCheckResult {
  allowed: boolean;
  category: string;
  action: string;
  resource?: string;
  reason?: string;
  guidance?: string;
}

// ========== 审计日志条目 ==========
export interface OpenClawAuditLogEntry {
  id: string;
  timestamp: number;
  operationType: OpenClawOperationType;
  params: Record<string, any>;
  result: OpenClawOperationResult;
  userId?: string;
  sessionId?: string;
}
