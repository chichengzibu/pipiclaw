/**
 * PiPiClaw - 网关状态管理
 * 
 * 职责：
 * 1. 网关状态枚举和状态信息管理
 * 2. 状态变更事件发布/订阅
 */

import { BrowserWindow } from 'electron';

// ========== 类型定义（内联，避免Vite解析.d.ts问题）==========

export enum GatewayState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  FAILED = 'failed',
  STOPPING = 'stopping'
}

export interface GatewayStatusInfo {
  state: GatewayState;
  port: number;
  pid: number | null;
  startTime: number | null;
  error: string | null;
  version: string | null;
}

export interface GatewayLogEntry {
  timestamp: number;
  level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

// ========== GatewayStatus 类 ==========

import { LogManager } from '../../electron/core/LogManager';

export class GatewayStatus {
  private status: GatewayStatusInfo = {
    state: GatewayState.STOPPED,
    port: 18789,
    pid: null,
    startTime: null,
    error: null,
    version: null
  };

  private log = LogManager.getInstance();
  private listeners: Set<(status: GatewayStatusInfo) => void> = new Set();

  constructor() {}

  public getStatus(): GatewayStatusInfo {
    return { ...this.status };
  }

  public getState(): GatewayState {
    return this.status.state;
  }

  public getPort(): number {
    return this.status.port;
  }

  public isRunning(): boolean {
    return this.status.state === GatewayState.RUNNING;
  }

  public canStart(): boolean {
    return this.status.state === GatewayState.STOPPED || 
           this.status.state === GatewayState.FAILED;
  }

  public canStop(): boolean {
    return this.status.state === GatewayState.RUNNING;
  }

  public setStarting(port: number): void {
    const oldState = this.status.state;
    this.status = {
      ...this.status,
      state: GatewayState.STARTING,
      port,
      pid: null,
      startTime: null,
      error: null
    };
    this.notifyListeners(oldState);
    this.log.info(`网关状态变更: ${oldState} -> STARTING, port: ${port}`);
  }

  public setRunning(pid: number, version?: string): void {
    const oldState = this.status.state;
    this.status = {
      ...this.status,
      state: GatewayState.RUNNING,
      pid,
      startTime: Date.now(),
      error: null,
      version: version || null
    };
    this.notifyListeners(oldState);
    this.log.info(`网关状态变更: ${oldState} -> RUNNING, pid: ${pid}`);
  }

  public setStopped(): void {
    const oldState = this.status.state;
    this.status = {
      ...this.status,
      state: GatewayState.STOPPED,
      pid: null,
      startTime: null,
      error: null
    };
    this.notifyListeners(oldState);
    this.log.info(`网关状态变更: ${oldState} -> STOPPED`);
  }

  public setFailed(error: string): void {
    const oldState = this.status.state;
    this.status = {
      ...this.status,
      state: GatewayState.FAILED,
      error
    };
    this.notifyListeners(oldState);
    this.log.error(`网关状态变更: ${oldState} -> FAILED, error: ${error}`);
  }

  public setStopping(): void {
    const oldState = this.status.state;
    this.status = {
      ...this.status,
      state: GatewayState.STOPPING
    };
    this.notifyListeners(oldState);
    this.log.info(`网关状态变更: ${oldState} -> STOPPING`);
  }

  public onChange(callback: (status: GatewayStatusInfo) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(oldState: GatewayState): void {
    const status = this.getStatus();
    
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        this.log.error('状态监听器执行失败', error);
      }
    });

    this.broadcastToRenderer('gateway:onStatusChange', {
      oldState,
      newState: status.state,
      info: status
    });
  }

  private broadcastToRenderer(channel: string, data: any): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }

  public reset(): void {
    this.status = {
      state: GatewayState.STOPPED,
      port: 18789,
      pid: null,
      startTime: null,
      error: null,
      version: null
    };
    this.listeners.clear();
  }
}
