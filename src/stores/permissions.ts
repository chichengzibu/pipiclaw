/**
 * PiPiClaw - 权限状态管理 (Pinia Store)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type PermissionCategory = 'filesystem' | 'network' | 'process' | 'system' | 'clipboard' | 'shell' | 'environment';
export type PermissionLevel = 'none' | 'read' | 'write' | 'execute' | 'all';
export type PermissionTemplate = 'safe' | 'standard' | 'permissive' | 'custom';

export interface PermissionRule {
  id: string;
  category: PermissionCategory;
  name: string;
  description: string;
  level: PermissionLevel;
  allowedPaths?: string[];
  deniedPaths?: string[];
  allowedDomains?: string[];
  deniedDomains?: string[];
}

export interface PermissionSet {
  id: string;
  name: string;
  template: PermissionTemplate;
  description: string;
  rules: PermissionRule[];
  createdAt: number;
  updatedAt: number;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

export const PERMISSION_CATEGORIES: Record<PermissionCategory, {
  name: string;
  description: string;
  icon: string;
}> = {
  filesystem: { name: '文件系统', description: '读写文件和目录', icon: '📁' },
  network: { name: '网络', description: '发起网络请求和连接', icon: '🌐' },
  process: { name: '进程', description: '启动和管理进程', icon: '⚙️' },
  system: { name: '系统', description: '系统级别操作', icon: '🖥️' },
  clipboard: { name: '剪贴板', description: '读写剪贴板内容', icon: '📋' },
  shell: { name: 'Shell', description: '执行shell命令', icon: '💻' },
  environment: { name: '环境变量', description: '读取和修改环境变量', icon: '🔧' }
};

export const PERMISSION_LEVELS: Record<PermissionLevel, {
  name: string;
  description: string;
  color: string;
}> = {
  none: { name: '禁止', description: '完全禁止此操作', color: 'danger' },
  read: { name: '只读', description: '仅允许读取', color: 'info' },
  write: { name: '读写', description: '允许读取和写入', color: 'warning' },
  execute: { name: '执行', description: '允许执行操作', color: 'success' },
  all: { name: '完全', description: '允许所有操作', color: 'success' }
};

export const TEMPLATE_NAMES: Record<PermissionTemplate, string> = {
  safe: '安全模式',
  standard: '标准模式',
  permissive: '开放模式',
  custom: '自定义'
};

export const usePermissionsStore = defineStore('permissions', () => {
  const permissionSets = ref<PermissionSet[]>([]);
  const activeSetId = ref<string | null>(null);
  const loading = ref(false);

  const activeSet = computed(() => 
    permissionSets.value.find(s => s.id === activeSetId.value)
  );

  const presetSets = computed(() =>
    permissionSets.value.filter(s => s.template !== 'custom')
  );

  const customSets = computed(() =>
    permissionSets.value.filter(s => s.template === 'custom')
  );

  async function fetchPermissionSets(): Promise<void> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.permissions?.list();
      if (result?.success && result.data) {
        permissionSets.value = result.data;
      }

      const activeResult = await (window as any).electronAPI?.permissions?.active();
      if (activeResult?.success && activeResult.data) {
        activeSetId.value = activeResult.data.id;
      }
    } catch (err) {
      console.error('获取权限集列表失败:', err);
    } finally {
      loading.value = false;
    }
  }

  async function getPermissionSet(id: string): Promise<PermissionSet | null> {
    try {
      const result = await (window as any).electronAPI?.permissions?.get(id);
      if (result?.success && result.data) {
        return result.data;
      }
    } catch (err) {
      console.error('获取权限集失败:', err);
    }
    return null;
  }

  async function setActiveSet(id: string): Promise<boolean> {
    try {
      const result = await (window as any).electronAPI?.permissions?.setActive(id);
      if (result?.success) {
        activeSetId.value = id;
        return true;
      }
    } catch (err) {
      console.error('设置激活权限集失败:', err);
    }
    return false;
  }

  async function createPermissionSet(data: {
    name: string;
    template: PermissionTemplate;
    description: string;
    rules?: PermissionRule[];
  }): Promise<PermissionSet | null> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.permissions?.create(data);
      if (result?.success && result.data) {
        permissionSets.value.push(result.data);
        return result.data;
      }
    } catch (err) {
      console.error('创建权限集失败:', err);
    } finally {
      loading.value = false;
    }
    return null;
  }

  async function updatePermissionSet(id: string, updates: Partial<PermissionSet>): Promise<PermissionSet | null> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.permissions?.update(id, updates);
      if (result?.success && result.data) {
        const index = permissionSets.value.findIndex(s => s.id === id);
        if (index !== -1) {
          permissionSets.value[index] = result.data;
        }
        return result.data;
      }
    } catch (err) {
      console.error('更新权限集失败:', err);
    } finally {
      loading.value = false;
    }
    return null;
  }

  async function updatePermissionRule(setId: string, ruleId: string, updates: Partial<PermissionRule>): Promise<PermissionRule | null> {
    try {
      const result = await (window as any).electronAPI?.permissions?.updateRule(setId, ruleId, updates);
      if (result?.success && result.data) {
        const set = permissionSets.value.find(s => s.id === setId);
        if (set) {
          const ruleIndex = set.rules.findIndex(r => r.id === ruleId);
          if (ruleIndex !== -1) {
            set.rules[ruleIndex] = result.data;
          }
        }
        return result.data;
      }
    } catch (err) {
      console.error('更新权限规则失败:', err);
    }
    return null;
  }

  async function deletePermissionSet(id: string): Promise<boolean> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.permissions?.delete(id);
      if (result?.success) {
        const index = permissionSets.value.findIndex(s => s.id === id);
        if (index !== -1) {
          permissionSets.value.splice(index, 1);
        }
        if (activeSetId.value === id) {
          activeSetId.value = permissionSets.value.length > 0 ? permissionSets.value[0].id : null;
        }
        return true;
      }
    } catch (err) {
      console.error('删除权限集失败:', err);
    } finally {
      loading.value = false;
    }
    return false;
  }

  async function duplicatePermissionSet(id: string, newName: string): Promise<PermissionSet | null> {
    loading.value = true;
    try {
      const result = await (window as any).electronAPI?.permissions?.duplicate(id, newName);
      if (result?.success && result.data) {
        permissionSets.value.push(result.data);
        return result.data;
      }
    } catch (err) {
      console.error('复制权限集失败:', err);
    } finally {
      loading.value = false;
    }
    return null;
  }

  async function checkPermission(request: {
    category: PermissionCategory;
    action: string;
    resource?: string;
  }): Promise<PermissionCheckResult | null> {
    try {
      const result = await (window as any).electronAPI?.permissions?.check(request);
      if (result?.success && result.data) {
        return result.data;
      }
    } catch (err) {
      console.error('权限检查失败:', err);
    }
    return null;
  }

  return {
    permissionSets,
    activeSetId,
    loading,
    activeSet,
    presetSets,
    customSets,
    fetchPermissionSets,
    getPermissionSet,
    setActiveSet,
    createPermissionSet,
    updatePermissionSet,
    updatePermissionRule,
    deletePermissionSet,
    duplicatePermissionSet,
    checkPermission
  };
});
