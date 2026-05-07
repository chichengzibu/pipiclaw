/**
 * PiPiClaw - 日志管理器
 * 
 * 职责：
 * 1. 统一日志输出（控制台+文件）
 * 2. 日志级别管理
 * 3. 日志文件轮转
 */

import log from 'electron-log';
import { app } from 'electron';
import { join } from 'path';
import { execSync } from 'child_process';
import type { LogMessage } from 'electron-log';

export class LogManager {
  private static instance: LogManager;

  private constructor() {
    this.initializeLogger();
  }

  public static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  private initializeLogger(): void {
    // Windows 平台设置控制台 UTF-8 编码
    if (process.platform === 'win32') {
      try {
        execSync('chcp 65001', { stdio: 'ignore' });
      } catch {}
    }

    const userDataPath = app.getPath('userData');
    const logPath = join(userDataPath, 'logs');

    log.transports.file.resolvePathFn = () => join(logPath, 'pipiclaw.log');
    log.transports.file.maxSize = 5 * 1024 * 1024;
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

    // Windows 控制台使用自定义 writeFn，解决中文乱码
    if (process.platform === 'win32') {
      log.transports.console.writeFn = (options: { message: LogMessage }) => {
        const msg = options.message;
        const time = msg.date;
        const pad = (n: number, len = 2) => String(n).padStart(len, '0');
        
        const formatted = `[${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}] [${msg.level}] ${msg.data.map((a: any) => 
          typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`;
        
        process.stdout.write(formatted + '\n');
      };
    }

    if (!app.isPackaged) {
      log.transports.file.level = 'debug';
      log.transports.console.level = 'debug';
    } else {
      log.transports.file.level = 'info';
      log.transports.console.level = 'info';
    }
  }

  public debug(message: string, ...args: any[]): void {
    log.debug(message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    log.info(message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    log.warn(message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    log.error(message, ...args);
  }

  public getLogPath(): string {
    return join(app.getPath('userData'), 'logs');
  }
}

export const logger = LogManager.getInstance();
