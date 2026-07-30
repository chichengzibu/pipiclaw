/**
 * PiPiClaw - 执行模式状态管理 (Pinia Store)
 * 
 * 职责：
 * 1. 管理执行模式状态（安全/计划/全量）
 * 2. 持久化模式配置
 * 3. 提供模式切换API
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type ExecutionMode = 'safe' | 'plan' | 'craft';

export interface ExecutionModeConfig {
  mode: ExecutionMode;
  name: string;
  description: string;
  icon: string;
  allowExecution: boolean;
  requireConfirmation: boolean;
}

export const EXECUTION_MODE_LIST: ExecutionModeConfig[] = [
  {
    mode: 'safe',
    name: '安全模式',
    description: '纯对话模式，拦截所有执行类指令',
    icon: 'Lock',
    allowExecution: false,
    requireConfirmation: false
  },
  {
    mode: 'plan',
    name: '计划模式',
    description: 'AI输出执行计划，用户确认后执行',
    icon: '⚖️',
    allowExecution: true,
    requireConfirmation: true
  },
  {
    mode: 'craft',
    name: '全量模式',
    description: '权限范围内自动执行，高危操作二次确认',
    icon: '🔓',
    allowExecution: true,
    requireConfirmation: false
  }
];

export interface ExecutionCheckResult {
  allowed: boolean;
  checkLevel: 'passed' | 'requires_confirmation' | 'blocked';
  reason?: string;
  guidance?: string;
}

export interface ExecutionPlanStep {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  permissionCheck: {
    category: string;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
}

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

export interface ConfirmDialogState {
  visible: boolean;
  plan: ExecutionPlan | null;
  confirmed: boolean;
  highRiskStep: ExecutionPlanStep | null;
}

const electronAPI = window.electronAPI as any;

export const useExecutionModeStore = defineStore('executionMode', () => {
  const currentMode = ref<ExecutionMode>('craft');
  const loading = ref(false);

  const currentModeConfig = computed(() =>
    EXECUTION_MODE_LIST.find(m => m.mode === currentMode.value)
  );

  const allowExecution = computed(() =>
    currentModeConfig.value?.allowExecution ?? false
  );

  async function fetchMode(): Promise<void> {
    loading.value = true;
    try {
      const result = await electronAPI?.execution?.getMode();
      if (result?.success && result.data) {
        currentMode.value = result.data;
      }
    } catch (err) {
      console.error('[ExecutionModeStore] 获取执行模式失败:', err);
    } finally {
      loading.value = false;
    }
  }

  async function setMode(mode: ExecutionMode): Promise<boolean> {
    try {
      const result = await electronAPI?.execution?.setMode(mode);
      if (result?.success) {
        currentMode.value = mode;
        console.log('[ExecutionModeStore] 设置执行模式:', mode);
        return true;
      }
    } catch (err) {
      console.error('[ExecutionModeStore] 设置执行模式失败:', err);
    }
    return false;
  }

  async function checkOperation(
    operation: string,
    params: Record<string, any>
  ): Promise<ExecutionCheckResult | null> {
    try {
      const result = await electronAPI?.execution?.checkOperation(operation, params);
      if (result?.success && result.data) {
        return result.data;
      }
    } catch (err) {
      console.error('[ExecutionModeStore] 检查操作失败:', err);
    }
    return null;
  }

  return {
    currentMode,
    currentModeConfig,
    allowExecution,
    loading,
    fetchMode,
    setMode,
    checkOperation,
    EXECUTION_MODE_LIST
  };
});
