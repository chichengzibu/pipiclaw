/**
 * TaskExecutor - 任务执行器
 * 仅负责执行结构化任务步骤，不再解析自然语言
 */

import { LogManager } from '../core/LogManager';
import { OpenClawGateway } from '../openclaw/OpenClawGateway';
import type { Task, TaskStep } from './TaskTypes';

export class TaskExecutor {
  private static instance: TaskExecutor;
  private log = LogManager.getInstance();
  private gateway = OpenClawGateway.getInstance();
  private runningTasks: Map<string, AbortController> = new Map();

  private constructor() {
    this.log.info('[TaskExecutor] 初始化');
  }

  public static getInstance(): TaskExecutor {
    if (!TaskExecutor.instance) {
      TaskExecutor.instance = new TaskExecutor();
    }
    return TaskExecutor.instance;
  }

  /**
   * 执行完整任务
   */
  public async executeTask(task: Task): Promise<{
    success: boolean;
    summary: string;
    error?: string;
    result?: { steps: Array<{ status: string; result?: any; error?: string }> };
    duration: number;
  }> {
    const startTime = Date.now();
    this.log.info(`[TaskExecutor] 开始执行任务: ${task.instruction}`);

    const abortController = new AbortController();
    this.runningTasks.set(task.id, abortController);

    const steps = task.steps;
    const results = [];
    let allSuccess = true;

    try {
      for (let i = 0; i < steps.length; i++) {
        if (abortController.signal.aborted) {
          this.log.info(`[TaskExecutor] 任务 ${task.id} 已被取消`);
          allSuccess = false;
          results.push({
            status: 'cancelled',
            error: 'Task cancelled by user'
          });
          break;
        }

        const step = steps[i];

        // 确保步骤有描述
        if (!step.description) {
          switch (step.type as string) {
            case 'write_file':
              step.description = '写入文件';
              break;
            case 'read_file':
              step.description = '读取文件';
              break;
            case 'create_file':
              step.description = '创建文件';
              break;
            case 'delete_file':
              step.description = '删除文件';
              break;
            case 'list_directory':
              step.description = '列出目录';
              break;
            case 'create_directory':
              step.description = '创建目录';
              break;
            case 'delete_directory':
              step.description = '删除目录';
              break;
            case 'rename_file':
              step.description = '重命名文件';
              break;
            default:
              step.description = '执行操作';
              break;
          }
        }

        this.log.info(`[TaskExecutor] 执行步骤 ${i + 1}/${steps.length}: ${step.description}`);

        try {
          const result = await this.executeStep(step);
          results.push({
            status: 'success',
            result
          });
        } catch (error) {
          this.log.error(`[TaskExecutor] 步骤失败: ${error}`);
          allSuccess = false;
          results.push({
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } finally {
      this.runningTasks.delete(task.id);
    }

    const duration = Date.now() - startTime;
    const cancelled = abortController.signal.aborted;
    const summary = cancelled
      ? '任务已取消'
      : allSuccess
        ? '任务执行完成'
        : '任务部分执行失败';

    this.log.info(`[TaskExecutor] 任务完成，耗时 ${duration}ms`);

    return {
      success: allSuccess,
      summary,
      result: { steps: results },
      duration
    };
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: TaskStep): Promise<any> {
    const params = step.params as Record<string, any>;
    this.log.debug('[TaskExecutor] 原始 step.params:', JSON.stringify(params));

    const stepType = step.type as string;
    switch (stepType) {
      case 'write_file': {
        this.log.debug('[TaskExecutor] write_file 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'write_file',
          params: {
            path: params.filePath || params.path,
            content: params.content
          }
        });
      }

      case 'read_file': {
        this.log.debug('[TaskExecutor] read_file 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'read_file',
          params: {
            path: params.filePath || params.path
          }
        });
      }

      case 'delete_file': {
        this.log.debug('[TaskExecutor] delete_file 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'delete_file',
          params: {
            path: params.filePath || params.path
          }
        });
      }

      case 'list_directory': {
        this.log.debug('[TaskExecutor] list_directory 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'list_directory',
          params: {
            path: params.directoryPath || params.path
          }
        });
      }

      case 'run_command': {
        this.log.debug('[TaskExecutor] run_command 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'run_command',
          params: {
            command: params.command,
            cwd: params.cwd
          }
        });
      }

      case 'open_url': {
        this.log.debug('[TaskExecutor] open_url 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'open_url',
          params: {
            url: params.url
          }
        });
      }

      case 'create_file': {
        this.log.debug('[TaskExecutor] create_file 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'create_file',
          params: {
            path: params.filePath || params.path,
            content: params.content
          }
        });
      }

      case 'rename_file': {
        this.log.debug('[TaskExecutor] rename_file 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'rename_file',
          params: {
            path: params.filePath || params.path,
            newPath: params.newPath
          }
        });
      }

      case 'create_directory': {
        this.log.debug('[TaskExecutor] create_directory 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'create_directory',
          params: {
            path: params.directoryPath || params.path
          }
        });
      }

      case 'delete_directory': {
        this.log.debug('[TaskExecutor] delete_directory 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'delete_directory',
          params: {
            path: params.directoryPath || params.path
          }
        });
      }

      case 'file_exists': {
        this.log.debug('[TaskExecutor] file_exists 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'file_exists',
          params: {
            path: params.filePath || params.path
          }
        });
      }

      case 'clipboard_read': {
        this.log.debug('[TaskExecutor] clipboard_read 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'clipboard_read',
          params: {}
        });
      }

      case 'clipboard_write': {
        this.log.debug('[TaskExecutor] clipboard_write 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'clipboard_write',
          params: {
            text: params.text
          }
        });
      }

      case 'browser_open': {
        this.log.debug('[TaskExecutor] browser_open 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_open',
          params: {
            url: params.url
          }
        });
      }

      case 'browser_navigate': {
        this.log.debug('[TaskExecutor] browser_navigate 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_navigate',
          params: {
            url: params.url,
            sessionId: params.sessionId
          }
        });
      }

      case 'browser_click': {
        this.log.debug('[TaskExecutor] browser_click 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_click',
          params: {
            selector: params.selector,
            sessionId: params.sessionId
          }
        });
      }

      case 'browser_type': {
        this.log.debug('[TaskExecutor] browser_type 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_type',
          params: {
            selector: params.selector,
            text: params.text,
            sessionId: params.sessionId
          }
        });
      }

      case 'browser_get_text': {
        this.log.debug('[TaskExecutor] browser_get_text 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_get_text',
          params: {
            selector: params.selector,
            sessionId: params.sessionId
          }
        });
      }

      case 'browser_wait_for': {
        this.log.debug('[TaskExecutor] browser_wait_for 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_wait_for',
          params: {
            selector: params.selector,
            timeout: params.timeout,
            sessionId: params.sessionId
          }
        });
      }

      case 'browser_screenshot': {
        this.log.debug('[TaskExecutor] browser_screenshot 准备执行');
        return await this.gateway.executeOperation({
          operationType: 'browser_screenshot',
          params: {
            path: params.path,
            sessionId: params.sessionId
          }
        });
      }

      default:
        throw new Error(`不支持的操作类型: ${step.type}`);
    }
  }

  /**
   * 取消正在执行的任务
   */
  public cancel(taskId: string): boolean {
    const controller = this.runningTasks.get(taskId);
    if (!controller) {
      this.log.warn(`[TaskExecutor] 未找到任务 ${taskId} 的执行控制器`);
      return false;
    }
    controller.abort();
    this.log.info(`[TaskExecutor] 取消任务 ${taskId}`);
    return true;
  }

  /**
   * 获取可用工具（保留接口）
   */
  public getAvailableTools(): Array<{ name: string; description: string }> {
    return [
      { name: 'write_file', description: '写入文件' },
      { name: 'read_file', description: '读取文件' },
      { name: 'delete_file', description: '删除文件' },
      { name: 'list_directory', description: '列出目录' },
      { name: 'run_command', description: '运行命令' },
      { name: 'open_url', description: '打开URL' },
      { name: 'create_file', description: '创建文件' },
      { name: 'rename_file', description: '重命名文件' },
      { name: 'create_directory', description: '创建目录' },
      { name: 'delete_directory', description: '删除目录' },
      { name: 'file_exists', description: '检查文件是否存在' },
      { name: 'clipboard_read', description: '读取剪贴板' },
      { name: 'clipboard_write', description: '写入剪贴板' },
      { name: 'browser_open', description: '打开浏览器' },
      { name: 'browser_navigate', description: '导航到URL' },
      { name: 'browser_click', description: '点击元素' },
      { name: 'browser_type', description: '输入文本' },
      { name: 'browser_get_text', description: '获取文本' },
      { name: 'browser_wait_for', description: '等待元素' },
      { name: 'browser_screenshot', description: '截图' }
    ];
  }

  /**
   * 检查网关状态
   */
  public isGatewayRunning(): boolean {
    const status = this.gateway.getStatus();
    return status.state === 'running';
  }
}