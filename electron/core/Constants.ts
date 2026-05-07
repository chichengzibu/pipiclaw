/**
 * PiPiClaw - 常量定义
 */

export class Constants {
  // ==================== 应用信息 ====================
  
  public static readonly APP_NAME = 'PiPiClaw';
  public static readonly APP_ID = 'com.pipiclaw.app';
  
  // ==================== 窗口配置 ====================
  
  public static readonly DEFAULT_WINDOW_WIDTH = 1280;
  public static readonly DEFAULT_WINDOW_HEIGHT = 800;
  public static readonly MIN_WINDOW_WIDTH = 900;
  public static readonly MIN_WINDOW_HEIGHT = 600;
  public static readonly TITLE_BAR_HEIGHT = 32;
  public static readonly SIDE_NAV_WIDTH = 200;
  
  // ==================== 路由配置 ====================
  
  public static readonly ROUTES = {
    DASHBOARD: '/dashboard',
    CHAT: '/chat',
    TASKS: '/tasks',
    MODELS: '/models',
    PERMISSIONS: '/permissions',
    SETTINGS: '/settings'
  } as const;
  
  // ==================== IPC通道 ====================
  
  public static readonly IPC_CHANNELS = {
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
  
  // ==================== 网关配置 ====================
  
  /** 默认网关端口 */
  public static readonly GATEWAY_DEFAULT_PORT = 18789;
  
  /** 网关端口范围起始 */
  public static readonly GATEWAY_PORT_RANGE_START = 18790;
  
  /** 网关端口范围结束 */
  public static readonly GATEWAY_PORT_RANGE_END = 18809;
  
  /** 网关启动超时时间(ms) */
  public static readonly GATEWAY_START_TIMEOUT = 60000;
  
  /** OpenClaw 资源路径 */
  public static readonly OPENCLAW_DIR = 'openclaw';
  public static readonly OPENCLAW_ENTRY = 'openclaw.mjs';
  
  /** 日志保留条数 */
  public static readonly GATEWAY_LOG_MAX_LINES = 500;
}
