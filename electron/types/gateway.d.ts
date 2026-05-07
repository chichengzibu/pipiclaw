/**
 * PiPiClaw - 网关类型定义
 */

/**
 * 网关运行状态
 */
export enum GatewayState {
  /** 未启动 */
  STOPPED = 'stopped',
  /** 启动中 */
  STARTING = 'starting',
  /** 运行中 */
  RUNNING = 'running',
  /** 启动失败 */
  FAILED = 'failed',
  /** 停止中 */
  STOPPING = 'stopping'
}

/**
 * 网关详细状态信息
 */
export interface GatewayStatusInfo {
  /** 当前状态 */
  state: GatewayState;
  /** 监听端口 */
  port: number;
  /** 进程PID */
  pid: number | null;
  /** 启动时间戳 */
  startTime: number | null;
  /** 错误信息 */
  error: string | null;
  /** OpenClaw版本 */
  version: string | null;
}

/**
 * 网关启动选项
 */
export interface GatewayStartOptions {
  /** 指定端口，不指定则自动检测 */
  port?: number;
  /** 启动超时时间(ms)，默认60000 */
  timeout?: number;
  /** 是否静默启动（不触发事件） */
  silent?: boolean;
}

/**
 * 网关日志条目
 */
export interface GatewayLogEntry {
  /** 时间戳 */
  timestamp: number;
  /** 日志级别 */
  level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
  /** 日志内容 */
  message: string;
  /** 来源 */
  source?: string;
}

/**
 * 网关配置（存储格式）
 */
export interface GatewayStoredConfig {
  /** 是否自动启动 */
  autoStart: boolean;
  /** 默认端口 */
  defaultPort: number;
  /** 启动超时时间(ms) */
  timeout: number;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** 自定义启动参数 */
  customArgs: string[];
}

/**
 * 默认网关配置
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayStoredConfig = {
  autoStart: true,
  defaultPort: 18789,
  timeout: 60000,
  logLevel: 'info',
  customArgs: []
};

/**
 * 状态变更事件
 */
export interface GatewayStatusChangeEvent {
  /** 旧状态 */
  oldState: GatewayState;
  /** 新状态 */
  newState: GatewayState;
  /** 状态信息 */
  info: GatewayStatusInfo;
}

/**
 * 日志事件
 */
export interface GatewayLogEvent {
  /** 日志条目 */
  entry: GatewayLogEntry;
}

/**
 * 错误事件
 */
export interface GatewayErrorEvent {
  /** 错误信息 */
  error: string;
  /** 错误堆栈 */
  stack?: string;
}
