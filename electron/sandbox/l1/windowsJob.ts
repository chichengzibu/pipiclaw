/**
 * PiPiClaw - Windows Job Object L1 隔离(占位,W9.2)
 *
 * 真实实现路径:win32job npm 库 + JobObject + UiFlags
 * W9 阶段:plan 明确"留占位",仅接口定义 + isAvailable 检测 + runWithWindowsJob 返回 stub
 */

import { LogManager } from '../../core/LogManager'
import * as os from 'node:os'

/**
 * WindowsJobConfig:Windows Job Object 参数(W9 占位)
 * - cpuLimit:CPU 限制(0-100)
 * - memoryMb:内存限制(MB)
 * - allowChildProcesses:是否允许子进程派生
 */
export interface WindowsJobConfig {
  /** CPU 限制(0-100) */
  cpuLimit?: number
  /** 内存限制(MB) */
  memoryMb?: number
  /** 子进程派生 */
  allowChildProcesses?: boolean
}

export interface WindowsJobResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  fallback: boolean
}

export function isWindowsJobAvailable(): boolean {
  return os.platform() === 'win32'
}

export function runWithWindowsJob(command: string[], config: WindowsJobConfig = {}): WindowsJobResult {
  const log = LogManager.getInstance()
  const startMs = Date.now()
  log.warn('WindowsJob: W9 stub,Windows 平台 W9 暂不实装,W10+ 评估')
  return {
    ok: true,
    exitCode: 0,
    stdout: '',
    stderr: 'Windows Job Object W9 stub',
    durationMs: Date.now() - startMs,
    fallback: true,
  }
}