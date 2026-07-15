/**
 * PiPiClaw - SandboxL1(W9.2)
 *
 * 3 平台 L1 进程隔离统一入口。
 * 自动按平台选择 isolation mechanism:
 *   macOS → sandbox-exec (seatbelt)
 *   Linux → bwrap (bubblewrap,探测到才有,否则 stub)
 *   Windows → Job Object (W9 stub,plan 明确"留占位")
 *
 * 设计:不引入新 npm 依赖,仅走 node:child_process 原生。
 */

import { LogManager } from '../core/LogManager'
import * as os from 'node:os'
import {
  isSeatbeltAvailable,
  runWithSeatbelt,
  buildSeatbeltProfile,
  SeatbeltRunResult,
  SeatbeltProfile,
} from './l1/seatbelt'
import { isBwrapAvailable, runWithBwrap, BwrapOptions, BwrapRunResult } from './l1/bwrap'
import {
  isWindowsJobAvailable,
  runWithWindowsJob,
  WindowsJobConfig,
  WindowsJobResult,
} from './l1/windowsJob'

export type L1Mode = 'seatbelt' | 'bwrap' | 'windows-job' | 'stub'

export interface L1Options {
  /** 平台自动选择(W9 阶段) */
  mode?: L1Mode
  /** 沙箱内允许读路径 */
  allowReadPaths?: string[]
  /** 沙箱内允许写路径 */
  allowWritePaths?: string[]
  /** 是否允许网络 */
  allowNetwork?: boolean
  /** cwd */
  cwd?: string
  /** Linux 专属 */
  memoryMb?: number
  /** Windows 专属 */
  cpuLimit?: number
  allowProcessFork?: boolean
}

export interface L1Result {
  ok: boolean
  mode: L1Mode
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  fallback: boolean
}

export class SandboxL1 {
  private static instance: SandboxL1
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxL1 {
    if (!SandboxL1.instance) SandboxL1.instance = new SandboxL1()
    return SandboxL1.instance
  }

  /** 当前平台支持的 L1 mode */
  currentMode(): L1Mode {
    if (isSeatbeltAvailable()) return 'seatbelt'
    if (isBwrapAvailable()) return 'bwrap'
    if (isWindowsJobAvailable()) return 'windows-job'
    return 'stub'
  }

  /** 探测 L1 能力 */
  capability(): { mode: L1Mode; available: boolean; reason?: string } {
    const mode = this.currentMode()
    if (mode === 'stub') {
      return { mode: 'stub', available: false, reason: `平台 ${os.platform()} W9 不支持 L1 隔离` }
    }
    if (mode === 'seatbelt') return { mode: 'seatbelt', available: true }
    if (mode === 'bwrap') return { mode: 'bwrap', available: true }
    return { mode: 'windows-job', available: false, reason: 'W9 stub' }
  }

  /** 跑命令(自动选 L1 mode) */
  run(command: string[], opts: L1Options = {}): L1Result {
    const mode = opts.mode ?? this.currentMode()
    this.log.info(`SandboxL1: mode=${mode} cmd=${command.join(' ')}`)
    switch (mode) {
      case 'seatbelt': {
        const profile: SeatbeltProfile = {
          allowReadPaths: opts.allowReadPaths ?? ['/usr', '/System', '/Library'],
          allowWritePaths: opts.allowWritePaths ?? [opts.cwd ?? process.cwd()],
          allowNetwork: opts.allowNetwork ?? false,
          allowProcessFork: opts.allowProcessFork ?? true,
        }
        const r: SeatbeltRunResult = runWithSeatbelt(buildSeatbeltProfile(profile), command, opts.cwd)
        return {
          ok: r.ok,
          mode,
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
          durationMs: r.durationMs,
          fallback: false,
        }
      }
      case 'bwrap': {
        const bwrapOpts: BwrapOptions = {
          cwd: opts.cwd,
          unshareNetwork: !opts.allowNetwork,
          unsharePid: true,
          memoryMb: opts.memoryMb,
        }
        const r: BwrapRunResult = runWithBwrap(command, bwrapOpts)
        return {
          ok: r.ok,
          mode,
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
          durationMs: r.durationMs,
          fallback: r.fallback,
        }
      }
      case 'windows-job': {
        const jobConfig: WindowsJobConfig = {
          cpuLimit: opts.cpuLimit,
          memoryMb: opts.memoryMb,
          allowChildProcesses: opts.allowProcessFork,
        }
        const r: WindowsJobResult = runWithWindowsJob(command, jobConfig)
        return {
          ok: r.ok,
          mode,
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
          durationMs: r.durationMs,
          fallback: r.fallback,
        }
      }
      case 'stub':
        return {
          ok: false,
          mode,
          exitCode: 1,
          stdout: '',
          stderr: 'L1 隔离不可用',
          durationMs: 0,
          fallback: true,
        }
    }
  }
}