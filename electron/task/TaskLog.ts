/**
 * PiPiClaw - 任务日志管理器
 * 
 * 职责：
 * 1. 持久化存储每一次任务的全链路日志
 * 2. 日志查询、筛选、导出
 * 3. 任务重试历史记录
 */

import { app } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { LogManager } from '../core/LogManager';
import { ExecutionMode } from './TaskExecutionMode';

export enum TaskLogStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TaskLogStep {
  order: number;
  operation: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked';
  permissionCheck?: {
    category: string;
    action: string;
    resource?: string;
    allowed: boolean;
    reason?: string;
  };
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface TaskLogEntry {
  id: string;
  conversationId: string;
  instruction: string;
  mode: ExecutionMode;
  status: TaskLogStatus;
  steps: TaskLogStep[];
  summary: string;
  error?: string;
  duration?: number;
  createdAt: number;
  startTime?: number;
  endTime?: number;
  retryCount: number;
  parentTaskId?: string;
}

export interface TaskLogQuery {
  status?: TaskLogStatus;
  mode?: ExecutionMode;
  startDate?: number;
  endDate?: number;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface TaskLogExportOptions {
  format: 'json' | 'txt';
  includeSteps?: boolean;
}

export class TaskLog {
  private static instance: TaskLog;
  private log = LogManager.getInstance();
  private logsDir: string;
  private logsFile: string;
  private logs: Map<string, TaskLogEntry> = new Map();
  private currentTaskId: string | null = null;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.logsDir = join(userDataPath, 'task-logs');
    this.logsFile = join(this.logsDir, 'task-logs.json');
    
    this.ensureLogsDir();
    this.loadLogs();
    this.cleanupLogs(); // 初始化时清理旧日志
  }

  /**
   * 清理过期日志
   * 规则：
   * 1. 最多保留 1000 条结构化日志
   * 2. 删除 30 天前的物理日志文件
   */
  private cleanupLogs(): void {
    try {
      // 1. 清理内存和 JSON 中的日志条目
      if (this.logs.size > 1000) {
        const entries = Array.from(this.logs.values())
          .sort((a, b) => b.createdAt - a.createdAt);
        
        const keptEntries = entries.slice(0, 1000);
        this.logs.clear();
        for (const entry of keptEntries) {
          this.logs.set(entry.id, entry);
        }
        this.saveLogs();
        this.log.info('[TaskLog] 已清理冗余日志条目，保留 1000 条');
      }

      // 2. 清理 30 天前的 .log 文件
      const files = fs.readdirSync(this.logsDir);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = join(this.logsDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < thirtyDaysAgo) {
            fs.unlinkSync(filePath);
            this.log.info('[TaskLog] 已删除过期日志文件:', file);
          }
        }
      }
    } catch (error) {
      this.log.error('[TaskLog] 清理日志失败:', error);
    }
  }

  public static getInstance(): TaskLog {
    if (!TaskLog.instance) {
      TaskLog.instance = new TaskLog();
    }
    return TaskLog.instance;
  }

  private ensureLogsDir(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
      this.log.info('[TaskLog] 创建日志目录:', this.logsDir);
    }
  }

  private loadLogs(): void {
    try {
      if (existsSync(this.logsFile)) {
        const data = readFileSync(this.logsFile, 'utf-8');
        const entries: TaskLogEntry[] = JSON.parse(data);
        this.logs.clear();
        for (const entry of entries) {
          this.logs.set(entry.id, entry);
        }
        this.log.info('[TaskLog] 加载日志:', this.logs.size, '条');
      }
    } catch (error) {
      this.log.error('[TaskLog] 加载日志失败:', error);
    }
  }

  private saveLogs(): void {
    try {
      const entries = Array.from(this.logs.values());
      const data = JSON.stringify(entries, null, 2);
      writeFileSync(this.logsFile, data, 'utf-8');
      this.log.debug('[TaskLog] 保存日志:', entries.length, '条');
    } catch (error) {
      this.log.error('[TaskLog] 保存日志失败:', error);
    }
  }

  public startTask(task: {
    id: string;
    conversationId: string;
    instruction: string;
    mode: ExecutionMode;
    steps: TaskLogStep[];
  }): string {
    const entry: TaskLogEntry = {
      id: task.id,
      conversationId: task.conversationId,
      instruction: task.instruction,
      mode: task.mode,
      status: TaskLogStatus.RUNNING,
      steps: task.steps,
      summary: '',
      createdAt: Date.now(),
      startTime: Date.now(),
      retryCount: 0
    };
    
    this.logs.set(entry.id, entry);
    this.currentTaskId = entry.id;
    this.saveLogs();
    
    this.log.info('[TaskLog] 开始任务:', entry.id);
    this.appendToFile(`[${new Date().toISOString()}] 开始执行任务: ${entry.instruction}\n`);
    
    return entry.id;
  }

  public updateStep(taskId: string, stepOrder: number, updates: Partial<TaskLogStep>): void {
    const entry = this.logs.get(taskId);
    if (!entry) return;

    const step = entry.steps.find(s => s.order === stepOrder);
    if (step) {
      Object.assign(step, updates);
      this.saveLogs();
      
      const statusStr = updates.status === 'success' ? '成功' : updates.status === 'failed' ? '失败' : updates.status === 'blocked' ? '被拦截' : '进行中';
      this.appendToFile(`[${new Date().toISOString()}] 步骤${stepOrder} ${step.description}: ${statusStr}\n`);
    }
  }

  public completeTask(taskId: string, result: {
    success: boolean;
    summary: string;
    error?: string;
    duration?: number;
  }): void {
    const entry = this.logs.get(taskId);
    if (!entry) return;

    entry.status = result.success ? TaskLogStatus.SUCCESS : TaskLogStatus.FAILED;
    entry.summary = result.summary;
    entry.error = result.error;
    entry.endTime = Date.now();
    entry.duration = result.duration || (entry.startTime ? entry.endTime - entry.startTime : 0);
    
    this.saveLogs();
    this.currentTaskId = null;
    
    const statusStr = result.success ? '成功' : '失败';
    this.log.info(`[TaskLog] 任务完成: ${taskId}, 状态: ${statusStr}, 耗时: ${entry.duration}ms`);
    this.appendToFile(`[${new Date().toISOString()}] 任务${statusStr}, ${result.summary}\n\n`);
    
    this.cleanupLogs(); // 任务完成后执行清理
  }

  public cancelTask(taskId: string, reason?: string): void {
    const entry = this.logs.get(taskId);
    if (!entry) return;

    entry.status = TaskLogStatus.CANCELLED;
    entry.error = reason || '用户取消';
    entry.endTime = Date.now();
    entry.duration = entry.startTime ? entry.endTime - entry.startTime : 0;
    
    this.saveLogs();
    this.currentTaskId = null;
    
    this.log.info('[TaskLog] 任务取消:', taskId, reason);
    this.appendToFile(`[${new Date().toISOString()}] 任务取消: ${reason || '用户取消'}\n\n`);

    this.cleanupLogs(); // 任务取消后执行清理
  }

  public getLog(taskId: string): TaskLogEntry | null {
    return this.logs.get(taskId) || null;
  }

  public queryLogs(query: TaskLogQuery): TaskLogEntry[] {
    let results = Array.from(this.logs.values());

    if (query.status) {
      results = results.filter(r => r.status === query.status);
    }

    if (query.mode) {
      results = results.filter(r => r.mode === query.mode);
    }

    if (query.startDate) {
      results = results.filter(r => r.createdAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter(r => r.createdAt <= query.endDate!);
    }

    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(r => 
        r.instruction.toLowerCase().includes(keyword) ||
        r.summary.toLowerCase().includes(keyword) ||
        r.error?.toLowerCase().includes(keyword)
      );
    }

    results.sort((a, b) => b.createdAt - a.createdAt);

    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return results.slice(offset, offset + limit);
  }

  public deleteLog(taskId: string): boolean {
    const deleted = this.logs.delete(taskId);
    if (deleted) {
      this.saveLogs();
      this.log.info('[TaskLog] 删除日志:', taskId);
    }
    return deleted;
  }

  public deleteLogs(taskIds: string[]): number {
    let deletedCount = 0;
    for (const id of taskIds) {
      if (this.logs.delete(id)) {
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.saveLogs();
      this.log.info('[TaskLog] 批量删除日志:', deletedCount, '条');
    }
    return deletedCount;
  }

  public exportLog(taskId: string, options: TaskLogExportOptions): string {
    const entry = this.logs.get(taskId);
    if (!entry) return '';

    if (options.format === 'json') {
      return JSON.stringify(entry, null, 2);
    }

    let text = `=== 任务执行日志 ===\n`;
    text += `ID: ${entry.id}\n`;
    text += `指令: ${entry.instruction}\n`;
    text += `模式: ${entry.mode}\n`;
    text += `状态: ${entry.status}\n`;
    text += `创建时间: ${new Date(entry.createdAt).toLocaleString('zh-CN')}\n`;
    if (entry.startTime) text += `开始时间: ${new Date(entry.startTime).toLocaleString('zh-CN')}\n`;
    if (entry.endTime) text += `结束时间: ${new Date(entry.endTime).toLocaleString('zh-CN')}\n`;
    if (entry.duration) text += `执行耗时: ${entry.duration}ms\n`;
    text += `摘要: ${entry.summary}\n`;
    if (entry.error) text += `错误: ${entry.error}\n`;

    if (options.includeSteps !== false) {
      text += `\n=== 执行步骤 ===\n`;
      for (const step of entry.steps) {
        text += `[${step.order}] ${step.description}\n`;
        text += `  操作: ${step.operation}\n`;
        text += `  状态: ${step.status}\n`;
        if (step.permissionCheck) {
          text += `  权限检查: ${step.permissionCheck.allowed ? '通过' : '拒绝'} (${step.permissionCheck.category}/${step.permissionCheck.action})\n`;
          if (step.permissionCheck.reason) text += `  原因: ${step.permissionCheck.reason}\n`;
        }
        if (step.result) text += `  结果: ${step.result}\n`;
        if (step.error) text += `  错误: ${step.error}\n`;
        text += `\n`;
      }
    }

    return text;
  }

  public exportLogs(taskIds: string[], options: TaskLogExportOptions): string {
    let content = '';
    for (const taskId of taskIds) {
      content += this.exportLog(taskId, options);
      content += '\n' + '='.repeat(50) + '\n\n';
    }
    return content;
  }

  public getStatistics(): {
    total: number;
    success: number;
    failed: number;
    cancelled: number;
    byMode: Record<string, number>;
  } {
    const entries = Array.from(this.logs.values());
    
    return {
      total: entries.length,
      success: entries.filter(e => e.status === TaskLogStatus.SUCCESS).length,
      failed: entries.filter(e => e.status === TaskLogStatus.FAILED).length,
      cancelled: entries.filter(e => e.status === TaskLogStatus.CANCELLED).length,
      byMode: {
        [ExecutionMode.SAFE]: entries.filter(e => e.mode === ExecutionMode.SAFE).length,
        [ExecutionMode.PLAN]: entries.filter(e => e.mode === ExecutionMode.PLAN).length,
        [ExecutionMode.CRAFT]: entries.filter(e => e.mode === ExecutionMode.CRAFT).length
      }
    };
  }

  private appendToFile(message: string): void {
    try {
      const logFile = join(this.logsDir, `task-${new Date().toISOString().split('T')[0]}.log`);
      appendFileSync(logFile, message, 'utf-8');
    } catch (error) {
      this.log.error('[TaskLog] 写入日志文件失败:', error);
    }
  }

  public destroy(): void {
    TaskLog.instance = null as any;
    this.log.info('[TaskLog] 已销毁');
  }
}
