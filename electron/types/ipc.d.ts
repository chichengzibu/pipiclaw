/**
 * PiPiClaw - IPC类型定义
 */

// IPC通道定义
export const IpcChannels = {
  // 窗口管理
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_ON_MAXIMIZE_CHANGE: 'window:onMaximizeChange',
  
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
  GATEWAY_ON_ERROR: 'gateway:onError',
  
  // 配置管理
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',
  
  // 应用信息
  APP_VERSION: 'app:version'
} as const;

// IPC响应格式
export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 网关状态响应
export interface IpcGatewayStatusResponse extends IpcResponse {
  data: GatewayStatusInfo;
}

// 网关日志响应
export interface IpcGatewayLogsResponse extends IpcResponse {
  data: GatewayLogEntry[];
}

// 窗口状态
export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  width: number;
  height: number;
}

// 应用配置
export interface AppConfig {
  version: string;
  env: 'development' | 'production';
  userDataPath: string;
  logPath: string;
  platform: string;
}

// 日志条目
export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

// ========== 网关相关类型来源：./gateway.d.ts（v2: 保留类型文件，删 electron/gateway/*.ts 实现） ==========
// GatewayStatusInfo / GatewayLogEntry / GatewayState / GatewayStoredConfig 等
// 仍由 ./gateway.d.ts ambient 导出；IpcGatewayStatusResponse 等在下方使用这些类型。
