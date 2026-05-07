/**
 * PiPiClaw - 定时任务管理器
 */

import { app, Notification } from 'electron';
import { LogManager } from '../core/LogManager';
import { TaskExecutor } from './TaskExecutor';
import { TaskLog } from './TaskLog';
import { PermissionManager } from '../permissions/PermissionManager';
import { ConfigStore } from '../core/ConfigStore';
import { ExecutionMode } from './TaskExecutionMode';

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

export class ScheduleTaskManager {
  private static instance: ScheduleTaskManager;
  private log = LogManager.getInstance();
  private configStore = ConfigStore.getInstance();
  private taskExecutor = TaskExecutor.getInstance();
  private taskLog = TaskLog.getInstance();
  private permissionManager = PermissionManager.getInstance();
  private tasks: ScheduleTask[] = [];
  private executionHistory: TaskExecutionHistory[] = [];
  private timers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.loadTasks();
    this.startAllEnabledTasks();
  }

  public static getInstance(): ScheduleTaskManager {
    if (!ScheduleTaskManager.instance) {
      ScheduleTaskManager.instance = new ScheduleTaskManager();
    }
    return ScheduleTaskManager.instance;
  }

  private loadTasks(): void {
    try {
      const saved = this.configStore.get('schedule.tasks') as ScheduleTask[];
      const savedHistory = this.configStore.get('schedule.history') as TaskExecutionHistory[];
      if (saved) this.tasks = saved;
      if (savedHistory) this.executionHistory = savedHistory;
      this.log.info('[ScheduleTaskManager] 任务加载成功', { count: this.tasks.length });
    } catch (error) {
      this.log.error('[ScheduleTaskManager] 任务加载失败', error);
    }
  }

  private saveTasks(): void {
    try {
      this.configStore.set('schedule.tasks', this.tasks);
      this.configStore.set('schedule.history', this.executionHistory.slice(-100));
    } catch (error) {
      this.log.error('[ScheduleTaskManager] 任务保存失败', error);
    }
  }

  public createTask(task: Omit<ScheduleTask, 'id' | 'createdAt' | 'updatedAt'>): ScheduleTask {
    const newTask: ScheduleTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.tasks.push(newTask);
    this.saveTasks();
    if (newTask.enabled) {
      this.startTask(newTask.id);
    }
    this.log.info('[ScheduleTaskManager] 任务创建成功', newTask);
    return newTask;
  }

  public updateTask(id: string, updates: Partial<Omit<ScheduleTask, 'id' | 'createdAt'>>): ScheduleTask | null {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const oldEnabled = this.tasks[index].enabled;
    this.tasks[index] = { 
      ...this.tasks[index], 
      ...updates, 
      updatedAt: Date.now() 
    };
    
    const newTask = this.tasks[index];
    
    if (oldEnabled !== newTask.enabled) {
      if (newTask.enabled) {
        this.startTask(id);
      } else {
        this.stopTask(id);
      }
    }
    
    this.saveTasks();
    this.log.info('[ScheduleTaskManager] 任务更新成功', newTask);
    return newTask;
  }

  public deleteTask(id: string): boolean {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    this.stopTask(id);
    this.tasks.splice(index, 1);
    this.saveTasks();
    this.log.info('[ScheduleTaskManager] 任务删除成功', { id });
    return true;
  }

  public toggleTask(id: string): boolean {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return false;
    
    task.enabled = !task.enabled;
    task.updatedAt = Date.now();
    
    if (task.enabled) {
      this.startTask(id);
    } else {
      this.stopTask(id);
    }
    
    this.saveTasks();
    return true;
  }

  public listTasks(): ScheduleTask[] {
    return [...this.tasks];
  }

  public getHistory(taskId?: string): TaskExecutionHistory[] {
    if (taskId) {
      return this.executionHistory.filter(h => h.taskId === taskId);
    }
    return [...this.executionHistory];
  }

  private startAllEnabledTasks(): void {
    this.tasks.filter(t => t.enabled).forEach(task => {
      this.startTask(task.id);
    });
  }

  private startTask(id: string): void {
    this.stopTask(id);
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const delay = this.calculateNextExecution(task);
    if (delay !== null) {
      const timer = setTimeout(() => {
        this.executeTask(id);
      }, delay);
      this.timers.set(id, timer);
      this.log.info('[ScheduleTaskManager] 任务已启动', { id: task.id, name: task.name, delay });
    }
  }

  private stopTask(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private calculateNextExecution(task: ScheduleTask): number | null {
    const now = new Date();
    const nowMs = now.getTime();
    
    // 如果任务未启用，返回 null
    if (!task.enabled) return null;

    let nextRun: Date | null = null;

    switch (task.scheduleType) {
      case 'once': {
        const targetDate = new Date(task.scheduleValue);
        if (targetDate.getTime() > nowMs) {
          nextRun = targetDate;
        }
        break;
      }
      case 'daily': {
        // scheduleValue 格式: "HH:mm"
        const [hours, minutes] = task.scheduleValue.split(':').map(Number);
        nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        if (nextRun.getTime() <= nowMs) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      }
      case 'weekly': {
        // scheduleValue 格式: "dayOfWeek,HH:mm" (0-6, 0 为周日)
        const [dayStr, timeStr] = task.scheduleValue.split(',');
        const targetDay = parseInt(dayStr);
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil < 0 || (daysUntil === 0 && nextRun.getTime() <= nowMs)) {
          daysUntil += 7;
        }
        nextRun.setDate(nextRun.getDate() + daysUntil);
        break;
      }
      case 'monthly': {
        // scheduleValue 格式: "dayOfMonth,HH:mm" (1-31)
        const [dayStr, timeStr] = task.scheduleValue.split(',');
        const targetDay = parseInt(dayStr);
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        nextRun = new Date(now.getFullYear(), now.getMonth(), targetDay, hours, minutes, 0, 0);
        if (nextRun.getTime() <= nowMs) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      }
      case 'cron': {
        // 简化的 Cron 处理（仅支持每隔 X 分钟）
        // 格式: "*/X * * * *"
        const match = task.scheduleValue.match(/\*\/(\d+)/);
        if (match) {
          const minutes = parseInt(match[1]);
          return minutes * 60 * 1000;
        }
        // 默认 fallback: 1小时
        return 3600 * 1000;
      }
    }

    if (nextRun) {
      const delay = nextRun.getTime() - nowMs;
      return delay > 0 ? delay : null;
    }

    return null;
  }

  private async executeTask(id: string): Promise<void> {
    const task = this.tasks.find(t => t.id === id);
    if (!task || !task.enabled) return;

    const history: TaskExecutionHistory = {
      id: `hist_${Date.now()}`,
      taskId: task.id,
      taskName: task.name,
      instruction: task.instruction,
      status: 'pending',
      retryCount: 0
    };
    this.executionHistory.push(history);

    let success = false;
    let lastError: string | undefined;

    // 创建任务日志条目
    const logId = this.taskLog.startTask({
      id: `schedule_${task.id}_${Date.now()}`,
      conversationId: 'system_schedule',
      instruction: task.instruction,
      mode: ExecutionMode.SAFE, // 定时任务默认使用安全模式
      steps: []
    });

    for (let i = 0; i <= task.maxRetries && !success; i++) {
      try {
        history.status = 'running';
        history.startTime = Date.now();
        history.retryCount = i;

        // 1. 解析任务指令
        const parsed = this.taskExecutor.parseInstruction(task.instruction);
        if (!parsed?.isExecutable) {
          throw new Error('无法解析指令为可执行步骤');
        }

        // 更新日志中的步骤
        const logSteps = parsed.steps.map(s => ({
          order: s.order,
          operation: s.type,
          description: s.description,
          params: s.params || {},
          status: 'pending' as const
        }));
        
        // 重新设置日志步骤（因为 startTask 时可能还没解析出步骤）
        const entry = (this.taskLog as any).logs?.get(logId);
        if (entry) {
          entry.steps = logSteps;
        }

        // 2. 全量权限校验
        for (const step of parsed.steps) {
          this.taskLog.updateStep(logId, step.order, { status: 'running' });
          
          // 映射步骤类型到权限类别
          const stepType = step.type as any;
          let category: any = 'filesystem';
          let action = 'read';

          if (stepType === 'shell') {
            category = 'shell';
            action = 'execute';
          } else if (stepType === 'system') {
            category = 'system';
            action = 'write';
          } else if (stepType === 'clipboard') {
            category = 'clipboard';
            action = 'write';
          }

          const permCheck = this.permissionManager.checkPermission({
            category,
            action,
            resource: (step.params as any)?.path || (step.params as any)?.url
          });

          if (!permCheck.allowed) {
            const errorMsg = `权限不足: [${category}:${action}] ${permCheck.reason || ''}`;
            this.taskLog.updateStep(logId, step.order, { 
              status: 'blocked',
              error: errorMsg,
              permissionCheck: {
                category,
                action,
                resource: (step.params as any)?.path || (step.params as any)?.url,
                allowed: false,
                reason: permCheck.reason
              }
            });
            throw new Error(errorMsg);
          }

          this.taskLog.updateStep(logId, step.order, { 
            permissionCheck: {
              category,
              action,
              resource: (step.params as any)?.path || (step.params as any)?.url,
              allowed: true
            }
          });
        }

        // 3. 执行任务（复用 TaskExecutor）
        const result = await this.taskExecutor.executeTask({
          id: logId,
          conversationId: 'system_schedule',
          messageId: `msg_${Date.now()}`,
          instruction: task.instruction,
          steps: parsed.steps.map((s, idx) => ({
            id: `step_${idx}`,
            order: s.order,
            type: s.type as any,
            description: s.description,
            params: s.params || {},
            status: 'pending' as const
          })),
          status: 'pending',
          createdAt: Date.now()
        });

        history.status = 'success';
        history.endTime = Date.now();
        history.duration = history.endTime - history.startTime;
        success = true;

        this.taskLog.completeTask(logId, {
          success: true,
          summary: '定时任务执行成功',
          duration: history.duration
        });

        this.showNotification(task.name, '执行成功');

      } catch (error: any) {
        lastError = error.message;
        history.status = 'failed';
        history.error = lastError;
        history.endTime = Date.now();
        history.duration = history.startTime ? history.endTime - history.startTime : 0;
        
        this.taskLog.completeTask(logId, {
          success: false,
          summary: '定时任务执行失败',
          error: lastError,
          duration: history.duration
        });

        this.log.error(`[ScheduleTaskManager] 任务执行失败 (第 ${i + 1} 次尝试):`, error);
      }
    }

    if (!success) {
      this.showNotification(task.name, `执行失败: ${lastError}`);
    }

    this.saveTasks();

    // 重新调度下一次（如果是非 'once' 任务或执行失败需要重试）
    if (task.scheduleType !== 'once' || !success) {
      this.startTask(id);
    }
  }

  private showNotification(title: string, body: string): void {
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      }
    } catch (e) {
      this.log.error('[ScheduleTaskManager] 通知发送失败:', e);
    }
  }

  public destroy(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}