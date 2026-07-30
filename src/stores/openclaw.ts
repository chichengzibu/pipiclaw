/**
 * PiPiClaw - OpenClaw网关管理 (Pinia Store)
 * 
 * 职责：
 * 1. 网关健康检查
 * 2. 网关状态管理
 * 3. 网关自动启动
 * 4. 权限校验前置
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

// ========== 类型定义 ==========

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
  | 'browser_open'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_get_text'
  | 'browser_wait_for'
  | 'browser_screenshot';

export interface OpenClawOperationRequest {
  operationType: OpenClawOperationType;
  params: Record<string, any>;
  operationId?: string;
  resource?: string;
}

export interface OpenClawOperationResult {
  success: boolean;
  operationType: OpenClawOperationType;
  operationId?: string;
  status: 'success' | 'failed';
  result?: any;
  error?: string;
  errorCode?: string;
  guidance?: string;
  duration: number;
  startTime: number;
  endTime: number;
  permissionCheck?: {
    category: string;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
}

export interface OpenClawHealthCheckResult {
  healthy: boolean;
  status: 'running' | 'stopped' | 'failed';
  version?: string;
  timestamp: number;
  error?: string;
}

export interface OpenClawPermissionCheckRequest {
  operationType: OpenClawOperationType;
  resource?: string;
}

export interface OpenClawPermissionCheckResult {
  allowed: boolean;
  category: string;
  action: string;
  resource?: string;
  reason?: string;
  guidance?: string;
}

// ========== Store定义 ==========

export const useOpenClawStore = defineStore('openclaw', () => {
  // ========== 状态 ==========

  /** 网关健康状态 */
  const healthStatus = ref<OpenClawHealthCheckResult>({
    healthy: false,
    status: 'stopped',
    timestamp: Date.now()
  });

  /** 是否正在执行健康检查 */
  const healthCheckLoading = ref(false);

  /** 是否正在执行操作 */
  const operationLoading = ref(false);

  /** 审计日志 */
  const auditLogs = ref<any[]>([]);

  /** 最后健康检查时间 */
  const lastHealthCheckTime = ref<number>(0);

  // ========== 计算属性 ==========

  /** 网关是否健康 */
  const isHealthy = computed(() => healthStatus.value.healthy);

  /** 网关是否运行中 */
  const isRunning = computed(() => healthStatus.value.status === 'running');

  /** 网关是否已停止 */
  const isStopped = computed(() => healthStatus.value.status === 'stopped');

  /** 网关是否失败 */
  const isFailed = computed(() => healthStatus.value.status === 'failed');

  /** 是否需要修复 */
  const needsRepair = computed(() => !isHealthy.value && !healthCheckLoading.value);

  // ========== 核心方法 ==========

  /**
   * 执行健康检查
   */
  async function checkHealth(): Promise<boolean> {
    console.log('[OpenClaw Store] ========== 执行健康检查 ==========');
    
    healthCheckLoading.value = true;
    
    try {
      // 首先通过 gateway status 检查
      const gatewayStore = (await import('./gateway')).useGatewayStore();
      await gatewayStore.fetchStatus();
      
      // 通过 task:gatewayCheck 检查
      const result = await (window as any).electronAPI?.task?.isGatewayRunning();
      
      if (result?.success) {
        const isGatewayRunning = result.data;
        
        if (isGatewayRunning) {
          healthStatus.value = {
            healthy: true,
            status: 'running',
            version: '1.0.0',
            timestamp: Date.now()
          };
          console.log('[OpenClaw Store] [OK] 健康检查通过 - 网关运行中');
          return true;
        }
      }
      
      // 如果gateway未运行，尝试启动
      console.log('[OpenClaw Store] [WARN] 网关未运行，尝试启动...');
      await gatewayStore.start();
      
      // 再次检查
      await new Promise(resolve => setTimeout(resolve, 1000));
      await gatewayStore.fetchStatus();
      
      if (gatewayStore.isRunning) {
        healthStatus.value = {
          healthy: true,
          status: 'running',
          version: '1.0.0',
          timestamp: Date.now()
        };
        console.log('[OpenClaw Store] [OK] 网关启动成功');
        return true;
      }
      
      healthStatus.value = {
        healthy: false,
        status: 'failed',
        timestamp: Date.now(),
        error: '网关无法启动'
      };
      console.log('[OpenClaw Store] [FAIL] 网关启动失败');
      return false;
      
    } catch (err: any) {
      console.error('[OpenClaw Store] 健康检查失败:', err);
      healthStatus.value = {
        healthy: false,
        status: 'failed',
        timestamp: Date.now(),
        error: err.message || '健康检查异常'
      };
      return false;
    } finally {
      healthCheckLoading.value = false;
      lastHealthCheckTime.value = Date.now();
    }
  }

  /**
   * 确保网关健康
   */
  async function ensureHealthy(): Promise<boolean> {
    // 距离上次检查超过30秒，重新检查
    const now = Date.now();
    if (now - lastHealthCheckTime.value > 30000 || !isHealthy.value) {
      console.log('[OpenClaw Store] 触发健康检查（超时或不健康）');
      return await checkHealth();
    }
    return isHealthy.value;
  }

  /**
   * 权限校验
   */
  async function checkPermission(request: OpenClawPermissionCheckRequest): Promise<OpenClawPermissionCheckResult | null> {
    console.log('[OpenClaw Store] ========== 权限校验开始 ==========');
    console.log('[OpenClaw Store] 操作类型:', request.operationType);
    console.log('[OpenClaw Store] 资源:', request.resource);
    
    try {
      // 权限映射
      const permMap: Record<OpenClawOperationType, { category: string; action: string }> = {
        read_file: { category: 'filesystem', action: 'read' },
        write_file: { category: 'filesystem', action: 'write' },
        create_file: { category: 'filesystem', action: 'write' },
        delete_file: { category: 'filesystem', action: 'delete' },
        rename_file: { category: 'filesystem', action: 'write' },
        list_directory: { category: 'filesystem', action: 'list' },
        create_directory: { category: 'filesystem', action: 'create' },
        delete_directory: { category: 'filesystem', action: 'delete' },
        file_exists: { category: 'filesystem', action: 'read' },
        run_command: { category: 'shell', action: 'execute' },
        open_url: { category: 'system', action: 'read' },
        clipboard_read: { category: 'clipboard', action: 'read' },
        clipboard_write: { category: 'clipboard', action: 'write' },
        browser_open: { category: 'system', action: 'execute' },
        browser_navigate: { category: 'system', action: 'execute' },
        browser_click: { category: 'system', action: 'execute' },
        browser_type: { category: 'system', action: 'execute' },
        browser_get_text: { category: 'system', action: 'read' },
        browser_wait_for: { category: 'system', action: 'execute' },
        browser_screenshot: { category: 'system', action: 'read' }
      };
      
      const permConfig = permMap[request.operationType];
      if (!permConfig) {
        return {
          allowed: true,
          category: 'unknown',
          action: 'unknown',
          reason: '未知操作类型'
        };
      }
      
      // 调用后端权限校验
      const backendResult = await (window as any).electronAPI?.permissions?.check({
        category: permConfig.category,
        action: permConfig.action,
        resource: request.resource
      });
      
      if (backendResult?.success && backendResult.data) {
        const result = {
          allowed: backendResult.data.allowed,
          category: permConfig.category,
          action: permConfig.action,
          resource: request.resource,
          reason: backendResult.data.reason,
          guidance: backendResult.data.allowed 
            ? undefined 
            : `请开启「${permConfig.category}」的「${permConfig.action}」权限`
        };
        
        console.log('[OpenClaw Store] 权限校验结果:', result);
        return result;
      }
      
    } catch (err) {
      console.error('[OpenClaw Store] 权限校验失败:', err);
    }
    
    return null;
  }

  /**
   * 执行操作
   */
  async function executeOperation(request: OpenClawOperationRequest): Promise<OpenClawOperationResult | null> {
    console.log('[OpenClaw Store] ========== 执行操作开始 ==========');
    
    operationLoading.value = true;
    
    try {
      // 1. 确保网关健康
      const healthy = await ensureHealthy();
      if (!healthy) {
        ElMessage.error('网关未启动，请先启动网关');
        throw new Error('网关未启动');
      }
      
      // 2. 权限校验
      const permCheck = await checkPermission({
        operationType: request.operationType,
        resource: request.params?.path || request.resource
      });
      
      if (permCheck && !permCheck.allowed) {
        ElMessage.warning(permCheck.guidance || '权限不足');
        throw new Error(permCheck.reason || '权限不足');
      }
      
      // 3. 执行操作
      const result = await (window as any).electronAPI?.openclaw?.execute(request);
      
      if (result?.success) {
        console.log('[OpenClaw Store] [OK] 操作执行成功');
        return result.data;
      } else {
        console.error('[OpenClaw Store] [FAIL] 操作执行失败:', result?.error);
        throw new Error(result?.error || '操作失败');
      }
      
    } catch (err: any) {
      console.error('[OpenClaw Store] 操作执行异常:', err);
      ElMessage.error(err.message || '执行失败');
      throw err;
    } finally {
      operationLoading.value = false;
    }
  }

  /**
   * 获取审计日志
   */
  async function fetchAuditLogs(limit = 100): Promise<void> {
    try {
      const result = await (window as any).electronAPI?.openclaw?.getAuditLogs(limit);
      if (result?.success && result.data) {
        auditLogs.value = result.data;
      }
    } catch (err) {
      console.error('[OpenClaw Store] 获取审计日志失败:', err);
    }
  }

  /**
   * 初始化
   */
  function initialize(): void {
    console.log('[OpenClaw Store] ========== 初始化 ==========');
    
    // 应用启动时立即检查健康
    setTimeout(() => {
      checkHealth();
    }, 1000);
    
    // 定期健康检查（每30秒）
    setInterval(() => {
      checkHealth();
    }, 30000);
  }

  return {
    // 状态
    healthStatus,
    healthCheckLoading,
    operationLoading,
    auditLogs,
    lastHealthCheckTime,
    
    // 计算属性
    isHealthy,
    isRunning,
    isStopped,
    isFailed,
    needsRepair,
    
    // 方法
    checkHealth,
    ensureHealthy,
    checkPermission,
    executeOperation,
    fetchAuditLogs,
    initialize
  };
});

