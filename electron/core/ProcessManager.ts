/**
 * PiPiClaw - 进程管理器
 * 
 * 职责：
 * 1. 检测残留进程
 * 2. 清理占用端口的进程
 * 3. 进程信息查询
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { LogManager } from './LogManager';

const execAsync = promisify(exec);

export class ProcessManager {
  // 单例实例
  private static instance: ProcessManager;
  
  // 日志管理器
  private log = LogManager.getInstance();

  // 私有构造函数（单例模式）
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  /**
   * 检测端口是否被占用
   * @param port 端口号
   */
  public async isPortInUse(port: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        return stdout.includes(`${port}`);
      } else {
        const { stdout } = await execAsync(`lsof -i :${port}`, { encoding: 'utf-8' });
        return stdout.includes(`${port}`);
      }
    } catch {
      // 命令失败说明端口未被占用
      return false;
    }
  }

  /**
   * 查找占用端口的进程PID
   * @param port 端口号
   */
  public async findProcessByPort(port: number): Promise<number | null> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = stdout.trim().split('\n');
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[1].includes(`${port}`)) {
            return parseInt(parts[4], 10);
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 杀死指定进程
   * @param pid 进程ID
   */
  public async killProcess(pid: number): Promise<boolean> {
    try {
      this.log.info(`正在终止进程: ${pid}`);
      
      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
      } else {
        await execAsync(`kill -9 ${pid}`, { encoding: 'utf-8' });
      }
      
      this.log.info(`进程已终止: ${pid}`);
      return true;
    } catch (error) {
      this.log.error(`终止进程失败: ${pid}`, error);
      return false;
    }
  }

  /**
   * 清理指定端口的占用进程
   * @param port 端口号
   */
  public async cleanupPort(port: number): Promise<boolean> {
    const pid = await this.findProcessByPort(port);
    
    if (pid) {
      this.log.info(`发现占用端口 ${port} 的进程: ${pid}`);
      return await this.killProcess(pid);
    }
    
    return true;
  }

  /**
   * 查找进程名称
   * @param pid 进程ID
   */
  public async getProcessName(pid: number): Promise<string> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf-8' });
        const parts = stdout.split(',');
        return parts[0]?.replace(/"/g, '').trim() || 'Unknown';
      } else {
        const { stdout } = await execAsync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' });
        return stdout.trim();
      }
    } catch {
      return 'Unknown';
    }
  }

  /**
   * 检查进程是否在运行
   * @param pid 进程ID
   */
  public async isProcessRunning(pid: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await execAsync(`tasklist /FI "PID eq ${pid}" | findstr /I "${pid}"`, { encoding: 'utf-8' });
        return true;
      } else {
        await execAsync(`kill -0 ${pid}`, { encoding: 'utf-8' });
        return true;
      }
    } catch {
      return false;
    }
  }
}
