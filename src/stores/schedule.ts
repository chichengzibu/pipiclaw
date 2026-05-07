/**
 * PiPiClaw - 定时任务状态管理
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ScheduleTask {
  id: string;
  name: string;
  description?: string;
  instruction: string;
  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
  scheduleValue: string;
  enabled: boolean;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskExecutionHistory {
  id: string;
  taskId: string;
  taskName: string;
  instruction: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
  retryCount: number;
}

export const useScheduleStore = defineStore('schedule', () => {
  const tasks = ref<ScheduleTask[]>([]);
  const history = ref<TaskExecutionHistory[]>([]);
  const showCreateDialog = ref(false);
  const editingTask = ref<ScheduleTask | null>(null);

  function setTasks(newTasks: ScheduleTask[]): void {
    tasks.value = newTasks;
  }

  function setHistory(newHistory: TaskExecutionHistory[]): void {
    history.value = newHistory;
  }

  function openCreateDialog(): void {
    editingTask.value = null;
    showCreateDialog.value = true;
  }

  function openEditDialog(task: ScheduleTask): void {
    editingTask.value = { ...task };
    showCreateDialog.value = true;
  }

  function closeDialog(): void {
    showCreateDialog.value = false;
    editingTask.value = null;
  }

  return {
    tasks,
    history,
    showCreateDialog,
    editingTask,
    setTasks,
    setHistory,
    openCreateDialog,
    openEditDialog,
    closeDialog
  };
});