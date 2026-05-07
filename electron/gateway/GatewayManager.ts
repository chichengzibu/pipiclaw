/**
 * PiPiClaw - 网关管理器核心（修复版）
 * 
 * 职责：
 * 1. 网关单例模式启动锁，防止重复启动
 * 2. 使用OpenClawServer直接提供HTTP服务
 * 3. 端口检测与自动切换
 * 4. 日志捕获与实时同步
 * 5. 启动超时兜底处理
 * 6. 优雅退出与资源释放
 * 7. 自动启动、健康检查和自动重启
 */

import { BrowserWindow } from 'electron';
import { GatewayState, GatewayLogEntry, GatewayStatus } from './GatewayStatus';
import { GatewayConfig } from './GatewayConfig';
import { LogManager } from '../core/LogManager';
import { OpenClawServer } from '../openclaw/OpenClawServer';

// ========== 常量定义 ==========

const GATEWAY_DEFAULT_PORT = 18789;
const GATEWAY_PORT_RANGE_START = 18790;
const GATEWAY_PORT_RANGE_END = 18809;
const GATEWAY_START_TIMEOUT = 60000;
const GATEWAY_LOG_MAX_LINES = 500;
const GATEWAY_HEALTH_CHECK_INTERVAL = 30000; // 30秒健康检查
const GATEWAY_MAX_RESTART_ATTEMPTS = 3; // 最大重启尝试次数

// ========== 接口定义 ==========

export interface GatewayStartOptions {
  port?: number;
  timeout?: number;
  silent?: boolean;
}

// ========== GatewayManager 类 ==========

export class GatewayManager {
  // 单例相关
  private static instance: GatewayManager;
  private startLock: boolean = false;
  private startPromise: Promise<void> | null = null;
  
  // 核心组件
  private status: GatewayStatus;
  private config: GatewayConfig;
  private log = LogManager.getInstance();
  private server: OpenClawServer;
  
  // 日志
  private logs: GatewayLogEntry[] = [];
  private maxLogs = GATEWAY_LOG_MAX_LINES;
  
  // 健康检查和自动重启
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private restartAttempts: number = 0;
  private isAutoRestartEnabled: boolean = true;

  private constructor() {
    this.status = new GatewayStatus();
    this.config = GatewayConfig.getInstance();
    this.server = OpenClawServer.getInstance();
    
    this.log.info('[GatewayManager] 网关管理器初始化');
    
    this.status.onChange((newStatus) => {
      this.addLog('info', `网关状态变更: ${newStatus.state}`);
    });
  }

  public static getInstance(): GatewayManager {
    if (!GatewayManager.instance) {
      GatewayManager.instance = new GatewayManager();
    }
    return GatewayManager.instance;
  }

  public getStatus() {
    return this.status.getStatus();
  }

  public getLogs(): GatewayLogEntry[] {
    return [...this.logs];
  }

  /**
   * 检查所有依赖文件是否存在
   */
  public checkDependencies(): { valid: boolean; missing: string[]; error?: string; guidance?: string } {
    const missing: string[] = [];
    
    // 检查必要的服务文件
    try {
      require.resolve('../openclaw/OpenClawServer');
    } catch (e) {
      missing.push('OpenClawServer.ts');
    }
    
    try {
      require.resolve('../openclaw/OpenClawGateway');
    } catch (e) {
      missing.push('OpenClawGateway.ts');
    }
    
    try {
      require.resolve('../permissions/PermissionManager');
    } catch (e) {
      missing.push('PermissionManager.ts');
    }

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        error: `缺失关键文件: ${missing.join(', ')}`,
        guidance: '请确认项目文件完整性，缺失文件需要手动恢复'
      };
    }

    return { valid: true, missing: [] };
  }

  /**
   * 启动网关
   */
  public async start(options: GatewayStartOptions = {}): Promise<{ success: boolean; error?: string; guidance?: string }> {
    if (this.startLock && this.startPromise) {
      this.log.info('网关正在启动中，等待...');
      await this.startPromise;
      return { success: true };
    }

    if (!this.status.canStart()) {
      const currentState = this.status.getState();
      this.log.warn(`网关当前状态为${currentState}，无法启动`);
      return { success: false, error: '网关当前状态不允许启动' };
    }

    // 检查依赖文件
    const depCheck = this.checkDependencies();
    if (!depCheck.valid) {
      this.log.error('依赖文件检查失败', depCheck.missing);
      this.status.setFailed(depCheck.error || '依赖文件缺失');
      this.broadcastStatus();
      return { 
        success: false, 
        error: depCheck.error, 
        guidance: depCheck.guidance 
      };
    }

    this.startLock = true;
    this.startPromise = this._doStart(options);

    try {
      await this.startPromise;
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || '启动失败', 
        guidance: '请查看日志了解详细原因' 
      };
    } finally {
      this.startLock = false;
      this.startPromise = null;
    }
  }

  /**
   * 执行实际启动逻辑
   */
  private async _doStart(options: GatewayStartOptions = {}): Promise<void> {
    const port = options.port || this.config.getDefaultPort();
    
    this.log.info('========== 开始启动网关 ==========');

    try {
      // 设置启动中状态
      this.status.setStarting(port);
      this.broadcastStatus();

      // 启动OpenClawServer
      const result = await this.server.start(port);
      
      if (!result.success) {
        this.log.error('网关服务启动失败', result.error);
        this.status.setFailed(result.error || '服务启动失败');
        this.broadcastStatus();
        
        // 尝试自动重启
        if (this.restartAttempts < GATEWAY_MAX_RESTART_ATTEMPTS && this.isAutoRestartEnabled) {
          this.restartAttempts++;
          this.log.warn(`启动失败，尝试第${this.restartAttempts}/${GATEWAY_MAX_RESTART_ATTEMPTS}次重启...`);
          this.addLog('warn', `启动失败，尝试第${this.restartAttempts}/${GATEWAY_MAX_RESTART_ATTEMPTS}次重启...`);
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          return await this._doStart(options);
        }
        
        throw new Error(result.error || '启动失败');
      }

      // 启动成功
      this.status.setRunning(process.pid, '1.0.0');
      this.broadcastStatus();
      this.restartAttempts = 0;
      this.startHealthCheck();
      this.addLog('info', `网关启动成功，监听端口: ${result.port}`);
      this.log.info('========== 网关启动成功 ==========', { port: result.port });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log.error('网关启动失败', error);
      
      let guidance = '请检查端口18789是否被占用';
      if (errorMsg.includes('EADDRINUSE')) {
        guidance = '端口18789已被占用，请关闭占用该端口的程序或修改配置';
      } else if (errorMsg.includes('EACCES')) {
        guidance = '权限不足，请使用管理员/root权限运行或修改端口';
      } else if (errorMsg.includes('权限')) {
        guidance = '请检查权限配置是否正确';
      }

      this.status.setFailed(errorMsg);
      this.broadcastStatus();
      
      // 尝试自动重启
      if (this.restartAttempts < GATEWAY_MAX_RESTART_ATTEMPTS && this.isAutoRestartEnabled) {
        this.restartAttempts++;
        this.log.warn(`启动失败，尝试第${this.restartAttempts}/${GATEWAY_MAX_RESTART_ATTEMPTS}次重启...`);
        this.addLog('warn', `启动失败，尝试第${this.restartAttempts}/${GATEWAY_MAX_RESTART_ATTEMPTS}次重启...`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this._doStart(options);
      }
      
      throw new Error(errorMsg);
    }
  }

  /**
   * 停止网关
   */
  public async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.status.canStop()) {
      this.log.warn('网关当前状态不允许停止');
      return { success: false, error: '网关当前状态不允许停止' };
    }

    this.log.info('========== 停止网关 ==========');
    this.status.setStopping();
    this.broadcastStatus();

    // 停止健康检查
    this.stopHealthCheck();

    try {
      await this.server.stop();
      this.status.setStopped();
      this.broadcastStatus();
      this.log.info('网关已停止');
      return { success: true };
    } catch (error: any) {
      this.log.error('停止网关失败', error);
      this.status.setStopped();
      this.broadcastStatus();
      return { success: false, error: error.message };
    }
  }

  /**
   * 重启网关
   */
  public async restart(options?: GatewayStartOptions): Promise<{ success: boolean; error?: string; guidance?: string }> {
    this.log.info('========== 重启网关 ==========');
    
    try {
      if (this.status.isRunning()) {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return await this.start(options);
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || '重启失败', 
        guidance: '请查看日志了解详细原因' 
      };
    }
  }

  /**
   * 一键修复
   */
  public async repair(): Promise<{ success: boolean; error?: string; guidance?: string }> {
    this.log.info('========== 开始修复网关 ==========');
    
    try {
      // 1. 停止网关
      if (this.status.isRunning()) {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 2. 重置状态
      this.status.reset();
      this.restartAttempts = 0;

      // 3. 检查依赖
      const depCheck = this.checkDependencies();
      if (!depCheck.valid) {
        return { 
          success: false, 
          error: depCheck.error, 
          guidance: depCheck.guidance 
        };
      }

      // 4. 重新启动
      const result = await this.start();
      return result;

    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || '修复失败', 
        guidance: '请查看日志了解详细原因，如问题持续请尝试重新安装程序' 
      };
    }
  }

  // ========== 健康检查和自动重启 ==========

  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, GATEWAY_HEALTH_CHECK_INTERVAL);
    
    this.log.debug('健康检查已启动');
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private checkHealth(): void {
    if (!this.status.isRunning()) {
      return;
    }

    // 检查服务是否仍在运行
    if (!this.server.isRunning()) {
      this.log.warn('网关服务异常停止，触发自动重启...');
      this.addLog('warn', '网关服务异常停止，触发自动重启...');
      this.status.setFailed('服务异常停止');
      this.broadcastStatus();
      
      if (this.isAutoRestartEnabled && this.restartAttempts < GATEWAY_MAX_RESTART_ATTEMPTS) {
        this.restartAttempts++;
        this.log.warn(`尝试第${this.restartAttempts}/${GATEWAY_MAX_RESTART_ATTEMPTS}次自动重启...`);
        this.addLog('warn', `尝试第${this.restartAttempts}/${GATEWAY_MAX_RESTART_ATTEMPTS}次自动重启...`);
        
        this.start().catch(err => {
          this.log.error('自动重启失败', err);
        });
      }
    }
  }

  // ========== 日志和状态同步 ==========

  private addLog(level: GatewayLogEntry['level'], message: string, source?: string): void {
    const entry: GatewayLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      source
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.broadcastLog(entry);
  }

  private broadcastLog(entry: GatewayLogEntry): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('gateway:onLog', entry);
        } catch (error) {
          this.log.error('广播日志失败', error);
        }
      }
    });
  }

  private broadcastStatus(): void {
    const windows = BrowserWindow.getAllWindows();
    const status = this.getStatus();
    
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('gateway:onStatusChange', { info: status });
        } catch (error) {
          this.log.error('广播状态失败', error);
        }
      }
    });
  }

  private cleanup(): void {
    this.stopHealthCheck();
  }

  public async destroy(): Promise<void> {
    this.log.info('销毁GatewayManager');
    await this.stop();
    this.cleanup();
    this.status.reset();
    await this.server.destroy();
    GatewayManager.instance = null as any;
  }
}
