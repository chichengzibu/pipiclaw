/**
 * PiPiClaw - Linux bwrap(bubblewrap) L1 隔离(W9.2)
 *
 * bwrap 需 sudo apt install bubblewrap
 * 典型用法:bwrap --ro-bind / --bind $cwd --unshare-net --unshare-pid -- <cmd>
 * W9 阶段:探测到就用,否则 stub 降级(不阻断)
 */

import { LogManager } from '../../core/LogManager'
import { execFileSync } from 'node:child_process'
import * as os from 'node:os'

/**
 * BwrapOptions:bubblewrap 启动参数
 * - cwd:工作目录(默认 process.cwd())
 * - unshareNetwork:限制网络(W9 默认 true)
 * - unsharePid:限制 PID 命名空间(W9 默认 true)
 * - memoryMb:内存限制(MB,W9 阶段仅占位,未真正限制)
 */
export interface BwrapOptions {
  /** 工作目录(默认 cwd) */
  cwd?: string
  /** 限制网络 */
  unshareNetwork?: boolean
  /** 限制 PID 命名空间 */
  unsharePid?: boolean
  /** 内存限制(MB) */
  memoryMb?: number
}

export function isBwrapAvailable(): boolean {
  if (os.platform() !== 'linux') return false
  try {
    execFileSync('bwrap', ['--version'], { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

export function buildBwrapArgs(opts: BwrapOptions): string[] {
  const args: string[] = []
  args.push('--ro-bind', '/', '/')
  const cwd = opts.cwd ?? process.cwd()
  args.push('--bind', cwd, cwd)
  args.push('--tmpfs', '/tmp')
  if (opts.unshareNetwork !== false) args.push('--unshare-net')
  if (opts.unsharePid !== false) args.push('--unshare-pid')
  args.push('--setenv', 'PATH', process.env.PATH ?? '/usr/bin:/bin')
  args.push('--chdir', cwd)
  return args
}

export interface BwrapRunResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  /** bwrap 不可用,降级 stub */
  fallback: boolean
}

export function runWithBwrap(command: string[], opts: BwrapOptions = {}): BwrapRunResult {
  const log = LogManager.getInstance()
  const startMs = Date.now()

  if (!isBwrapAvailable()) {
    log.warn('Bwrap: 不可用,降级 stub(W9 阶段不阻断)')
    return {
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: 'bwrap not available, fallback stub',
      durationMs: 0,
      fallback: true,
    }
  }

  try {
    const args = [...buildBwrapArgs(opts), '--', ...command]
    const stdout = execFileSync('bwrap', args, { encoding: 'utf-8', timeout: 30_000 })
    return {
      ok: true,
      exitCode: 0,
      stdout,
      stderr: '',
      durationMs: Date.now() - startMs,
      fallback: false,
    }
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: { toString(): string }; stderr?: { toString(): string } }
    return {
      ok: false,
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      durationMs: Date.now() - startMs,
      fallback: false,
    }
  }
}