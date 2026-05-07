/**
 * PiPiClaw - 网关状态管理 (Pinia Store)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ========== 类型定义 ==========

export type GatewayState = 'stopped' | 'starting' | 'running' | 'failed' | 'stopping';

export interface GatewayStatus {
  state: GatewayState;
  port: number;
  pid: number | null;
  startTime: number | null;
  error: string | null;
  version: string | null;
}

export interface GatewayLog {
  timestamp: number;
  level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

export interface GatewayConfig {
  autoStart: boolean;
  defaultPort: number;
  timeout: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customArgs: string[];
}

// ========== Store定义 ==========

export const useGatewayStore = defineStore('gateway', () => {
  // ========== 状态 ==========
  
  /** 网关状态 */
  const status = ref<GatewayStatus>({
    state: 'stopped',
    port: 18789,
    pid: null,
    startTime: null,
    error: null,
    version: null
  });

  /** 网关日志 */
  const logs = ref<GatewayLog[]>([]);

  /** 网关配置 */
  const config = ref<GatewayConfig>({
    autoStart: true,
    defaultPort: 18789,
    timeout: 60000,
    logLevel: 'info',
    customArgs: []
  });

  /** 加载状态 */
  const loading = ref(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  // ========== 计算属性 ==========

  /** 是否运行中 */
  const isRunning = computed(() => status.value.state === 'running');
  
  /** 是否启动中 */
  const isStarting = computed(() => status.value.state === 'starting');
  
  /** 是否已停止 */
  const isStopped = computed(() => status.value.state === 'stopped');
  
  /** 是否失败 */
  const isFailed = computed(() => status.value.state === 'failed');
  
  /** 是否可以启动 */
  const canStart = computed(() => 
    status.value.state === 'stopped' || status.value.state === 'failed'
  );
  
  /** 是否可以停止 */
  const canStop = computed(() => status.value.state === 'running');
  
  /** 状态文本 */
  const stateText = computed(() => {
    const stateMap: Record<GatewayState, string> = {
      stopped: '已停止',
      starting: '启动中',
      running: '运行中',
      failed: '启动失败',
      stopping: '停止中'
    };
    return stateMap[status.value.state];
  });

  // ========== 操作方法 ==========

  /**
   * 获取网关状态
   */
  async function fetchStatus(): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.gateway?.status();
      if (result?.success && result.data) {
        status.value = result.data;
      }
    } catch (err) {
      console.error('获取网关状态失败:', err);
    }
  }

  /**
   * 获取网关日志
   */
  async function fetchLogs(): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.gateway?.logs();
      if (result?.success && result.data) {
        logs.value = result.data;
      }
    } catch (err) {
      console.error('获取网关日志失败:', err);
    }
  }

  /**
   * 获取网关配置
   */
  async function fetchConfig(): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.gateway?.config?.get();
      if (result?.success && result.data) {
        config.value = result.data;
      }
    } catch (err) {
      console.error('获取网关配置失败:', err);
    }
  }

  /**
   * 启动网关
   */
  async function start(options?: { port?: number; timeout?: number }): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const result = await (window as any).electronAPI?.gateway?.start(options);
      if (!result?.success) {
        error.value = result?.error || '启动失败';
      }
    } catch (err: any) {
      error.value = err.message || '启动失败';
      console.error('启动网关失败:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 停止网关
   */
  async function stop(): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const result = await (window as any).electronAPI?.gateway?.stop();
      if (!result?.success) {
        error.value = result?.error || '停止失败';
      }
    } catch (err: any) {
      error.value = err.message || '停止失败';
      console.error('停止网关失败:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 重启网关
   */
  async function restart(): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const result = await (window as any).electronAPI?.gateway?.restart();
      if (!result?.success) {
        error.value = result?.error || '重启失败';
      }
    } catch (err: any) {
      error.value = err.message || '重启失败';
      console.error('重启网关失败:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 确保网关正在运行
   * 如果未运行则尝试启动
   */
  async function ensureRunning(): Promise<boolean> {
    if (isRunning.value) return true;
    
    // 如果正在启动中，等待一段时间
    if (isStarting.value) {
      let attempts = 0;
      while (isStarting.value && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      if (isRunning.value) return true;
    }
    
    // 尝试启动
    await start();
    return isRunning.value;
  }

  /**
   * 更新配置
   */
  async function updateConfig(newConfig: Partial<GatewayConfig>): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.gateway?.config?.set(newConfig);
      if (result?.success) {
        config.value = { ...config.value, ...newConfig };
      }
    } catch (err) {
      console.error('更新网关配置失败:', err);
    }
  }

  /**
   * 添加日志条目（由事件触发）
   */
  function addLog(entry: GatewayLog): void {
    logs.value.push(entry);
    // 限制日志条数
    if (logs.value.length > 500) {
      logs.value = logs.value.slice(-500);
    }
  }

  /**
   * 更新状态（由事件触发）
   */
  function updateStatus(newStatus: GatewayStatus): void {
    status.value = newStatus;
  }

  /**
   * 初始化（注册事件监听）
   */
  function initialize(): void {
    // 获取初始状态
    fetchStatus();
    fetchLogs();
    fetchConfig();

    // 注册状态变更监听
    (window as any).electronAPI?.gateway?.onStatusChange?.((data: any) => {
      if (data?.info) {
        updateStatus(data.info);
      }
    });

    // 注册日志监听
    (window as any).electronAPI?.gateway?.onLog?.((entry: GatewayLog) => {
      addLog(entry);
    });
  }

  return {
    // 状态
    status,
    logs,
    config,
    loading,
    error,
    
    // 计算属性
    isRunning,
    isStarting,
    isStopped,
    isFailed,
    canStart,
    canStop,
    stateText,
    
    // 方法
    fetchStatus,
    fetchLogs,
    fetchConfig,
    start,
    stop,
    restart,
    ensureRunning,
    updateConfig,
    addLog,
    updateStatus,
    initialize
  };
});
