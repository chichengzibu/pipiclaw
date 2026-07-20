/**
 * PiPiClaw - OpenClaw 核心网关执行引擎
 * 
 * 职责：
 * 1. 本地文件系统操作
 * 2. 系统命令执行（安全）
 * 3. 权限前置校验
 * 4. 操作审计日志
 * 5. 双平台兼容
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { shell, clipboard, app, BrowserWindow } from 'electron';
import { promisify } from 'util';
import { LogManager } from '../core/LogManager';
import { PermissionManager } from '../permissions/PermissionManager';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { OpenClawServer } from './OpenClawServer';
import { BrowserManager } from '../browser/BrowserManager';

const DEFAULT_OPENCLAW_PORT = 18789;
import type {
  OpenClawOperationType,
  OpenClawOperationRequest,
  OpenClawOperationResult,
  OpenClawPermissionCheckRequest,
  OpenClawPermissionCheckResult,
  OpenClawAuditLogEntry,
  FileOperationParams,
  CommandOperationParams
} from '../types/openclaw';

const execAsync = promisify(exec);

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

/**
 * 操作类型到权限类别的映射
 */
const PERMISSION_MAP: Record<OpenClawOperationType, { category: string; action: string }> = {
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
  // 浏览器操作
  browser_open: { category: 'system', action: 'execute' },
  browser_click: { category: 'system', action: 'execute' },
  browser_type: { category: 'system', action: 'execute' },
  browser_navigate: { category: 'system', action: 'execute' },
  browser_screenshot: { category: 'system', action: 'read' },
  browser_get_text: { category: 'system', action: 'read' },
  browser_wait_for: { category: 'system', action: 'execute' }
};

export class OpenClawGateway {
  private static instance: OpenClawGateway;
  private log = LogManager.getInstance();
  private permissionManager = PermissionManager.getInstance();
  private auditLogs: OpenClawAuditLogEntry[] = [];
  private browserManager!: BrowserManager;

  // 网关状态管理
  private server!: OpenClawServer;
  private state: GatewayState = 'stopped';
  private port: number = 18789;
  private pid: number | null = null;
  private startTime: number | null = null;
  private lastError: string | null = null;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  // 当前活动的浏览器会话
  private activeBrowserSessionId: string | null = null;

  private constructor() {
    this.log.info('[OpenClawGateway] 初始化中...');
    // 不在这里初始化 OpenClawServer，避免循环依赖
    // 默认端口（v2：移除对 electron/gateway/GatewayConfig 的依赖，原 gateway 模块已删除）
    this.port = DEFAULT_OPENCLAW_PORT;
    // 初始化浏览器管理器
    this.browserManager = BrowserManager.getInstance();
    this.log.info('[OpenClawGateway] 初始化完成');
  }

  // 延迟初始化 OpenClawServer 的方法
  private getServer(): OpenClawServer {
    if (!this.server) {
      this.server = OpenClawServer.getInstance();
    }
    return this.server;
  }

  public static getInstance(): OpenClawGateway {
    if (!OpenClawGateway.instance) {
      OpenClawGateway.instance = new OpenClawGateway();
    }
    return OpenClawGateway.instance;
  }

  // ========== 网关生命周期管理 ==========

  /**
   * 启动网关
   */
  public async start(options: { port?: number; isRetry?: boolean } = {}): Promise<{ success: boolean; error?: string }> {
    if (this.state === 'running' || (this.state === 'starting' && !options.isRetry)) {
      return { success: true };
    }

    // 默认端口（v2：移除对 electron/gateway/GatewayConfig 的依赖，原 gateway 模块已删除）
    this.port = options.port || DEFAULT_OPENCLAW_PORT;
    this.state = 'starting';
    this.lastError = null;
    this.broadcastStatus();

    try {
      this.log.info(`[OpenClawGateway] 正在启动网关，端口: ${this.port}`);
      const result = await this.getServer().start(this.port);

      if (result.success) {
        this.state = 'running';
        this.pid = process.pid;
        this.startTime = Date.now();
        this.restartAttempts = 0;
        this.startHealthCheck();
        this.broadcastStatus();
        this.log.info('[OpenClawGateway] 网关启动成功');
        return { success: true };
      } else {
        throw new Error(result.error || '启动失败');
      }
    } catch (error: any) {
      this.state = 'failed';
      this.lastError = error.message;
      this.broadcastStatus();
      this.log.error('[OpenClawGateway] 网关启动失败', error);

      // 自动重试
      if (this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++;
        this.log.warn(`[OpenClawGateway] 启动失败，正在进行第 ${this.restartAttempts} 次重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.start({ ...options, isRetry: true });
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * 停止网关
   */
  public async stop(): Promise<{ success: boolean }> {
    this.state = 'stopping';
    this.broadcastStatus();
    this.stopHealthCheck();

    try {
      await this.getServer().stop();
      this.state = 'stopped';
      this.pid = null;
      this.startTime = null;
      this.broadcastStatus();
      this.log.info('[OpenClawGateway] 网关已停止');
      return { success: true };
    } catch (error) {
      this.log.error('[OpenClawGateway] 停止网关失败', error);
      this.state = 'stopped';
      this.broadcastStatus();
      return { success: false };
    }
  }

  /**
   * 重启网关
   */
  public async restart(): Promise<{ success: boolean; error?: string }> {
    this.log.info('[OpenClawGateway] 正在重启网关...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.start();
  }

  /**
   * 一键修复网关
   */
  public async repair(): Promise<{ success: boolean; error?: string }> {
    this.log.info('[OpenClawGateway] 正在执行一键修复...');
    try {
      await this.stop();
      this.restartAttempts = 0;
      this.lastError = null;
      // 这里可以添加更多修复逻辑，比如清理临时文件等
      return await this.start();
    } catch (error: any) {
      this.log.error('[OpenClawGateway] 修复网关失败', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取网关状态
   */
  public getStatus(): GatewayStatus {
    return {
      state: this.state,
      port: this.port,
      pid: this.pid,
      startTime: this.startTime,
      error: this.lastError,
      version: '1.0.0'
    };
  }

  /**
   * 健康检查
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 30000); // 30秒检查一次
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async checkHealth(): Promise<void> {
    if (this.state !== 'running') return;

    if (!this.getServer().isRunning()) {
      this.log.warn('[OpenClawGateway] 检测到网关异常停止，正在尝试自动重启...');
      await this.restart();
    }
  }

  /**
   * 广播状态到前端
   */
  private broadcastStatus(): void {
    const status = this.getStatus();
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('gateway:onStatusChange', { info: status });
      }
    });
  }

  /**
   * 预校验操作权限
   */
  public checkPermission(request: OpenClawPermissionCheckRequest): OpenClawPermissionCheckResult {
    const { operationType, resource } = request;
    const permConfig = PERMISSION_MAP[operationType];
    
    this.log.info(`[OpenClawGateway] 权限校验: ${operationType}, 资源: ${resource || 'N/A'}`);

    const result = this.permissionManager.checkPermission({
      category: permConfig.category as any,
      action: permConfig.action,
      resource
    });

    const guidance = result.allowed 
      ? undefined 
      : `请在权限管理中启用「${permConfig.category}」的「${permConfig.action}」权限`;

    return {
      allowed: result.allowed,
      category: permConfig.category,
      action: permConfig.action,
      resource,
      reason: result.reason,
      guidance
    };
  }

  /**
   * 超时执行函数
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage, { cause: { guidance: '执行时间过长，可能是文件太大或系统响应慢，请稍后重试' } }));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutId!) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * 格式化错误消息，提供友好的用户提示
   */
  private formatErrorMessage(error: any, _operationType: string): { message: string; guidance?: string; errorCode: string } {
    let message = '操作执行失败';
    let guidance: string | undefined;
    let errorCode = 'OPERATION_FAILED';

    if (error.code === 'EACCES') {
      message = '权限不足：没有执行该操作的权限';
      guidance = '请在权限设置中启用相应的权限';
      errorCode = 'PERMISSION_DENIED';
    } else if (error.code === 'ENOENT') {
      message = '路径不存在：无法找到该文件或目录';
      guidance = '请检查路径是否正确';
      errorCode = 'PATH_NOT_FOUND';
    } else if (error.code === 'EEXIST') {
      message = '文件已存在';
      guidance = '请使用其他文件名或删除现有文件';
      errorCode = 'FILE_EXISTS';
    } else if (error.code === 'ENOSPC') {
      message = '磁盘空间不足';
      guidance = '请清理磁盘空间后重试';
      errorCode = 'DISK_FULL';
    } else if (error.message?.includes('timeout') || error.message?.includes('超时')) {
      message = error.message;
      guidance = error.cause?.guidance || '执行超时，请稍后重试';
      errorCode = 'TIMEOUT';
    } else if (error.cause?.guidance) {
      message = error.message;
      guidance = error.cause.guidance;
      errorCode = 'OPERATION_FAILED';
    } else {
      message = error.message || '操作执行失败';
    }

    return { message, guidance, errorCode };
  }

  /**
   * 执行单步操作
   */
  public async executeOperation(request: OpenClawOperationRequest): Promise<OpenClawOperationResult> {
    const { operationType, params, operationId } = request;
    const id = operationId || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const TIMEOUT_MS = 30000; // 30秒超时

    this.log.info(`[OpenClawGateway] 开始执行操作: ${operationType}, ID: ${id}`);
    this.log.debug('[OpenClawGateway] 操作参数:', params);

    // 1. 权限校验
    const permCheck = this.checkPermission({
      operationType,
      resource: (params as any)?.path || (params as any)?.resource
    });

    if (!permCheck.allowed) {
      const result: OpenClawOperationResult = {
        success: false,
        operationType,
        operationId: id,
        status: 'failed',
        error: `权限不足：${permCheck.reason}`,
        errorCode: 'PERMISSION_DENIED',
        guidance: permCheck.guidance,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        permissionCheck: permCheck
      };

      this.logAudit(result);
      this.log.error(`[OpenClawGateway] 权限被拒绝: ${operationType}`);
      return result;
    }

    // 2. 执行操作（带超时）
    try {
      const resultData: any = await this.executeWithTimeout(
        (async () => {
          switch (operationType) {
            case 'read_file':
              return await this.readFile(params as FileOperationParams);
            case 'write_file':
            case 'create_file':
              return await this.writeFile(params as FileOperationParams);
            case 'delete_file':
              return await this.deleteFile(params as FileOperationParams);
            case 'rename_file':
              return await this.renameFile(params as FileOperationParams);
            case 'list_directory':
              return await this.listDirectory(params as FileOperationParams);
            case 'create_directory':
              return await this.createDirectory(params as FileOperationParams);
            case 'delete_directory':
              return await this.deleteDirectory(params as FileOperationParams);
            case 'file_exists':
              return this.fileExists(params as FileOperationParams);
            case 'run_command':
              return await this.runCommand(params as CommandOperationParams);
            case 'open_url':
              return await this.openUrl(params as any);
            case 'clipboard_read':
              return this.readClipboard();
            case 'clipboard_write':
              return this.writeClipboard(params as any);
            // 浏览器操作
            case 'browser_open':
              return await this.openBrowser(params as any);
            case 'browser_navigate':
              return await this.navigateBrowser(params as any);
            case 'browser_click':
              return await this.clickBrowser(params as any);
            case 'browser_type':
              return await this.typeBrowser(params as any);
            case 'browser_get_text':
              return await this.getBrowserText(params as any);
            case 'browser_wait_for':
              return await this.waitBrowserElement(params as any);
            case 'browser_screenshot':
              return await this.takeScreenshot(params as any);
            default:
              throw new Error(`不支持的操作类型: ${operationType}`);
          }
        })(),
        TIMEOUT_MS,
        `执行超时：${operationType}操作超过30秒未完成`
      );

      const result: OpenClawOperationResult = {
        success: true,
        operationType,
        operationId: id,
        status: 'success',
        result: resultData,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        permissionCheck: permCheck
      };

      this.logAudit(result);
      this.log.info(`[OpenClawGateway] 操作执行成功: ${operationType}, 耗时: ${result.duration}ms`);
      return result;

    } catch (error: any) {
      const { message, guidance, errorCode } = this.formatErrorMessage(error, operationType);

      const result: OpenClawOperationResult = {
        success: false,
        operationType,
        operationId: id,
        status: 'failed',
        error: message,
        errorCode,
        guidance,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        permissionCheck: permCheck
      };

      this.logAudit(result);
      this.log.error(`[OpenClawGateway] 操作执行失败: ${operationType}`, error);
      return result;
    }
  }

  /**
   * 记录审计日志
   */
  private logAudit(result: OpenClawOperationResult): void {
    const entry: OpenClawAuditLogEntry = {
      id: result.operationId || `audit_${Date.now()}`,
      timestamp: Date.now(),
      operationType: result.operationType,
      params: {}, // 简化记录
      result
    };

    this.auditLogs.push(entry);

    // 保留最近1000条日志
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    this.log.debug('[OpenClawGateway] 审计日志已记录', entry);
  }

  /**
   * 获取审计日志
   */
  public getAuditLogs(limit = 100): OpenClawAuditLogEntry[] {
    return [...this.auditLogs].slice(-limit);
  }

  // ========== 文件系统操作 ==========

  private async readFile(params: FileOperationParams): Promise<string> {
    const { path: filePath, encoding = 'utf-8' } = params;
    const resolvedPath = this.resolvePath(filePath);
    this.log.debug('[OpenClawGateway] 读取文件:', resolvedPath);
    return fs.promises.readFile(resolvedPath, encoding);
  }

  private async writeFile(params: FileOperationParams): Promise<{ filePath: string; wasFallback: boolean }> {
    const { path: filePath, content = '', encoding = 'utf-8' } = params;
    const resolvedPath = this.resolvePath(filePath);
    
    // 详细日志
    this.log.info('[OpenClawGateway] writeFile 开始执行');
    this.log.debug('[OpenClawGateway] writeFile 原始 filePath:', filePath);
    this.log.debug('[OpenClawGateway] writeFile 解析后 resolvedPath:', resolvedPath);
    this.log.debug('[OpenClawGateway] writeFile content:', content);
    this.log.debug('[OpenClawGateway] writeFile content 长度:', content.length);
    this.log.debug('[OpenClawGateway] writeFile 完整 params:', params);
    
    // 检查路径是否可写
    const pathCheck = await this.checkPathWritable(resolvedPath);
    if (!pathCheck.writable) {
      this.log.error('[OpenClawGateway] writeFile 路径不可写:', pathCheck);
      throw new Error(pathCheck.error, { cause: { guidance: pathCheck.guidance } });
    }
    
    // 确保目录存在
    const dir = path.dirname(resolvedPath);
    this.log.debug('[OpenClawGateway] writeFile 确保目录存在:', dir);
    await fs.promises.mkdir(dir, { recursive: true });
    
    // 检查是否是 docx 文件
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext === '.docx') {
      try {
        this.log.debug('[OpenClawGateway] writeFile 尝试创建 DOCX 文件');
        await this.createDocxFile(resolvedPath, content);
        return { filePath: resolvedPath, wasFallback: false };
      } catch (docxError: any) {
        this.log.warn('[OpenClawGateway] DOCX创建失败，降级为TXT:', docxError);
        // 降级为 txt 文件
        const txtPath = resolvedPath.replace(/\.docx$/i, '.txt');
        await fs.promises.writeFile(txtPath, content, encoding);
        throw new Error(`DOCX生成失败，已自动保存为TXT文件：${txtPath}。原因：${docxError.message}`, {
          cause: { 
            guidance: '您可以使用其他文本编辑器打开TXT文件，或尝试再次生成DOCX文件' 
          }
        });
      }
    } else {
      // 普通文件写入
      this.log.info('[OpenClawGateway] writeFile 执行 fs.promises.writeFile');
      this.log.debug('[OpenClawGateway] 写入内容:', content);
      await fs.promises.writeFile(resolvedPath, content, encoding);
      this.log.info('[OpenClawGateway] writeFile 写入成功!');
      return { filePath: resolvedPath, wasFallback: false };
    }
  }

  /**
   * 使用 docx 库创建 Word 文档
   */
  private async createDocxFile(filePath: string, content: string): Promise<void> {
    // 将文本内容按行分割
    const lines = content.split(/\r?\n/);
    
    // 创建段落
    const paragraphs: Paragraph[] = lines.map(line => {
      if (!line.trim()) {
        return new Paragraph("");
      }
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 24 // 12pt
          })
        ]
      });
    });
    
    // 创建文档
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    // 生成并写入文件
    const buffer = await Packer.toBuffer(doc);
    await fs.promises.writeFile(filePath, buffer);
  }

  private async deleteFile(params: FileOperationParams): Promise<void> {
    const { path: filePath } = params;
    const resolvedPath = this.resolvePath(filePath);
    this.log.debug('[OpenClawGateway] 删除文件:', resolvedPath);
    await fs.promises.unlink(resolvedPath);
  }

  private async renameFile(params: FileOperationParams): Promise<void> {
    const { path: oldPath, newPath } = params;
    if (!newPath) throw new Error('缺少新路径参数');
    
    const resolvedOldPath = this.resolvePath(oldPath);
    const resolvedNewPath = this.resolvePath(newPath);
    
    // 确保目标目录存在
    const dir = path.dirname(resolvedNewPath);
    await fs.promises.mkdir(dir, { recursive: true });
    
    this.log.debug('[OpenClawGateway] 重命名文件:', resolvedOldPath, '→', resolvedNewPath);
    await fs.promises.rename(resolvedOldPath, resolvedNewPath);
  }

  private async listDirectory(params: FileOperationParams): Promise<string[]> {
    const { path: dirPath } = params;
    const resolvedPath = this.resolvePath(dirPath);
    this.log.debug('[OpenClawGateway] 列出目录:', resolvedPath);
    return fs.promises.readdir(resolvedPath);
  }

  private async createDirectory(params: FileOperationParams): Promise<void> {
    const { path: dirPath, recursive = true } = params;
    const resolvedPath = this.resolvePath(dirPath);
    this.log.debug('[OpenClawGateway] 创建目录:', resolvedPath);
    await fs.promises.mkdir(resolvedPath, { recursive });
  }

  private async deleteDirectory(params: FileOperationParams): Promise<void> {
    const { path: dirPath, recursive = true } = params;
    const resolvedPath = this.resolvePath(dirPath);
    this.log.debug('[OpenClawGateway] 删除目录:', resolvedPath);
    await fs.promises.rm(resolvedPath, { recursive, force: true });
  }

  private fileExists(params: FileOperationParams): boolean {
    const { path: filePath } = params;
    const resolvedPath = this.resolvePath(filePath);
    return fs.existsSync(resolvedPath);
  }

  // ========== 系统操作 ==========

  private async runCommand(params: CommandOperationParams): Promise<{ stdout: string; stderr: string }> {
    const { command, args = [], cwd, timeout = 30000, shell = true } = params;
    
    // 放宽限制：移除严格白名单，记录警告
    const baseCmd = command.split(' ')[0].toLowerCase();
    this.log.warn('[OpenClawGateway] 执行命令 (放宽限制):', baseCmd);

    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    this.log.debug('[OpenClawGateway] 执行命令:', fullCommand);

    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd: cwd ? this.resolvePath(cwd) : undefined,
      timeout,
      shell: shell as any
    });

    return { stdout, stderr };
  }

  private async openUrl(params: { url: string }): Promise<void> {
    const { url } = params;
    
    // 安全限制：只允许http/https协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('仅支持http/https协议的URL');
    }

    this.log.debug('[OpenClawGateway] 打开URL:', url);
    await shell.openExternal(url);
  }

  private readClipboard(): string {
    this.log.debug('[OpenClawGateway] 读取剪贴板');
    return clipboard.readText();
  }

  private writeClipboard(params: { text: string }): void {
    const { text } = params;
    this.log.debug('[OpenClawGateway] 写入剪贴板');
    clipboard.writeText(text);
  }

  // ========== 浏览器操作 ==========

  /**
   * 打开新浏览器会话
   */
  private async openBrowser(params: { url?: string }): Promise<{ sessionId: string; url: string }> {
    this.log.info('[OpenClawGateway] 打开浏览器');
    const sessionId = await this.browserManager.createSession();
    this.activeBrowserSessionId = sessionId;
    
    if (params.url) {
      await this.browserManager.navigate(sessionId, params.url);
    }
    
    return { 
      sessionId, 
      url: params.url || 'about:blank' 
    };
  }

  /**
   * 导航到网址
   */
  private async navigateBrowser(params: { url: string; sessionId?: string }): Promise<{ title: string; url: string }> {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error('没有活动的浏览器会话，请先调用 browser_open');
    }
    
    this.log.info('[OpenClawGateway] 导航到:', params.url);
    await this.browserManager.navigate(sessionId, params.url);
    
    const title = await this.browserManager.getTitle(sessionId);
    const url = await this.browserManager.getUrl(sessionId);
    
    return { title, url };
  }

  /**
   * 点击元素
   */
  private async clickBrowser(params: { selector: string; sessionId?: string }): Promise<void> {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error('没有活动的浏览器会话，请先调用 browser_open');
    }
    
    this.log.info('[OpenClawGateway] 点击元素:', params.selector);
    await this.browserManager.click(sessionId, params.selector);
  }

  /**
   * 输入文本
   */
  private async typeBrowser(params: { selector: string; text: string; sessionId?: string }): Promise<void> {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error('没有活动的浏览器会话，请先调用 browser_open');
    }
    
    this.log.info('[OpenClawGateway] 输入文本:', params.selector);
    await this.browserManager.type(sessionId, params.selector, params.text);
  }

  /**
   * 获取文本
   */
  private async getBrowserText(params: { selector: string; sessionId?: string }): Promise<{ text: string }> {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error('没有活动的浏览器会话，请先调用 browser_open');
    }
    
    const text = await this.browserManager.getText(sessionId, params.selector);
    return { text };
  }

  /**
   * 等待元素
   */
  private async waitBrowserElement(params: { selector: string; timeout?: number; sessionId?: string }): Promise<void> {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error('没有活动的浏览器会话，请先调用 browser_open');
    }
    
    this.log.info('[OpenClawGateway] 等待元素:', params.selector);
    await this.browserManager.waitForSelector(sessionId, params.selector, params.timeout);
  }

  /**
   * 截图
   */
  private async takeScreenshot(params: { path?: string; sessionId?: string }): Promise<{ path?: string; saved: boolean }> {
    const sessionId = params.sessionId || this.activeBrowserSessionId;
    if (!sessionId) {
      throw new Error('没有活动的浏览器会话，请先调用 browser_open');
    }
    
    this.log.info('[OpenClawGateway] 截图');
    await this.browserManager.screenshot(sessionId, params.path);
    
    return { 
      path: params.path, 
      saved: !!params.path 
    };
  }

  // ========== 工具方法 ==========

  /**
   * 检查路径是否可写
   */
  private async checkPathWritable(filePath: string): Promise<{ writable: boolean; error?: string; guidance?: string }> {
    try {
      const dir = path.dirname(filePath);
      
      // 确保目录存在
      await fs.promises.mkdir(dir, { recursive: true });
      
      // 尝试写入测试文件
      const testPath = path.join(dir, `.write_test_${Date.now()}`);
      await fs.promises.writeFile(testPath, 'test');
      await fs.promises.unlink(testPath);
      
      return { writable: true };
    } catch (error: any) {
      if (error.code === 'EACCES') {
        return { 
          writable: false, 
          error: '权限不足：没有写入该路径的权限', 
          guidance: '请检查文件或文件夹的权限设置，或尝试使用其他路径' 
        };
      } else if (error.code === 'ENOENT') {
        return { 
          writable: false, 
          error: '路径不存在：无法找到该目录', 
          guidance: '请确保路径正确，或使用其他路径' 
        };
      } else {
        return { 
          writable: false, 
          error: `路径不可写：${error.message}`, 
          guidance: '请检查路径是否正确，或尝试使用其他路径' 
        };
      }
    }
  }

  /**
   * 解析路径，支持~和平台兼容，特别是桌面路径
   */
  private resolvePath(inputPath: string): string {
    // Windows/macOS兼容
    let resolved = inputPath;
    
    // 扩展~
    if (resolved.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      resolved = path.join(home, resolved.slice(1));
    }

    // 支持 桌面/ 或 Desktop/ 前缀
    const desktopPrefixes = ['桌面/', 'Desktop/', 'desktop/'];
    for (const prefix of desktopPrefixes) {
      if (resolved.startsWith(prefix)) {
        try {
          const desktopPath = app.getPath('desktop');
          resolved = path.join(desktopPath, resolved.slice(prefix.length));
          break;
        } catch {
          // 如果获取桌面路径失败，继续使用默认逻辑
        }
      }
    }

    // 相对路径转绝对路径（相对于用户文档目录）
    if (!path.isAbsolute(resolved)) {
      const docs = process.env.DOCUMENTS || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Documents') : process.env.HOME ? path.join(process.env.HOME, 'Documents') : process.cwd());
      resolved = path.join(docs, resolved);
    }

    // 规范化路径
    resolved = path.normalize(resolved);
    
    this.log.debug('[OpenClawGateway] 路径解析:', inputPath, '→', resolved);
    return resolved;
  }
}
