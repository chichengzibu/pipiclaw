/**
 * PiPiClaw - macOS sandbox-exec L1 隔离(W9.2)
 *
 * sandbox-exec 是 macOS 系统自带(12+ 仍存在,15+ deprecated 但可用)
 * 通过 SBPL profile 限制进程权限:deny-write / deny-network / allow-read-only
 */

import { LogManager } from '../../core/LogManager'
import { execFileSync } from 'node:child_process'
import * as os from 'node:os'

/**
 * SeatbeltProfile:SBPL profile 参数化
 * - allowReadPaths:系统只读白名单
 * - allowWritePaths:workspace 可写白名单
 * - allowNetwork:是否允许网络出口
 * - allowProcessFork:是否允许进程派生
 */
export interface SeatbeltProfile {
  /** 允许读(系统只读) */
  readonly allowReadPaths: string[]
  /** 允许写(workspace) */
  readonly allowWritePaths: string[]
  /** 允许网络出口 */
  readonly allowNetwork: boolean
  /** 允许进程派生 */
  readonly allowProcessFork: boolean
}

export function buildSeatbeltProfile(opts: SeatbeltProfile): string {
  const lines: string[] = ['(version 1)', '(deny default)']
  lines.push('(allow process-exec)')
  lines.push('(allow process-fork)' + (opts.allowProcessFork ? '' : ' (deny)'))
  lines.push('(allow sysctl-read)')
  lines.push('(allow system-socket)')
  for (const p of opts.allowReadPaths) {
    lines.push(`(allow file-read* (subpath "${p}"))`)
  }
  for (const p of opts.allowWritePaths) {
    lines.push(`(allow file-write* (subpath "${p}"))`)
  }
  if (opts.allowNetwork) {
    lines.push('(allow network*)')
  } else {
    lines.push('(deny network*)')
  }
  return lines.join('\n')
}

export interface SeatbeltRunResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export function runWithSeatbelt(profile: string, command: string[], cwd?: string): SeatbeltRunResult {
  const log = LogManager.getInstance()
  const startMs = Date.now()
  try {
    const stdout = execFileSync('sandbox-exec', ['-p', profile, ...command], {
      encoding: 'utf-8',
      cwd,
      timeout: 30_000,
    })
    return { ok: true, exitCode: 0, stdout, stderr: '', durationMs: Date.now() - startMs }
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: { toString(): string }; stderr?: { toString(): string } }
    log.warn('Seatbelt: run fail', err.stderr?.toString() ?? '')
    return {
      ok: false,
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      durationMs: Date.now() - startMs,
    }
  }
}

export function isSeatbeltAvailable(): boolean {
  return os.platform() === 'darwin'
}