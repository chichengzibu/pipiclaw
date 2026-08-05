/**
 * PiPiClaw - BashTool (M1 v0.1)
 *
 * 跑命令, 跟 ClaudeCode Bash tool 协议对齐:
 *   args: { command: string, args?: string[], cwd?: string, timeout_ms?: number }
 *   result: { ok, result: "exit=N\nstdout=...\nstderr=...", error? }
 *
 * 安全:
 *   - 强制 execFile (不走 shell), 数组传参, 参数按字面量
 *   - command (baseCmd) 必须在白名单内 (跟 OpenClawGateway.runCommand 共享同一白名单)
 *   - cwd 必须在 userData/{sandbox,workspace} 内 (跟 runCommand 一致)
 *   - args 任何含 null byte 拒绝
 *   - timeout 上限 60s (LLM 误用不会卡死)
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { app } from 'electron'
import { LogManager } from '../../core/LogManager'
import type { PiPiTool, ToolExecResult } from './Tool'

const execFileAsync = promisify(execFile)

/** 跟 OpenClawGateway 共享同一白名单 (M1 v0.1: 同步复制, 后续在 constants.ts 抽) */
const COMMAND_ALLOWLIST: ReadonlySet<string> = new Set([
  'git',
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'deno',
  'python', 'python3', 'pip', 'pip3', 'poetry', 'uv',
  'ls', 'cat', 'head', 'tail', 'wc', 'find', 'grep', 'tree', 'echo', 'pwd', 'env', 'whoami', 'date', 'uname',
  'make', 'cmake', 'cargo', 'rustc', 'go', 'gcc', 'g++', 'clang', 'javac', 'mvn', 'gradle',
  'docker', 'docker-compose', 'podman',
  'jest', 'vitest', 'pytest', 'mocha', 'eslint', 'prettier', 'tsc',
  'cp', 'mv', 'mkdir', 'rmdir', 'touch', 'tar', 'zip', 'unzip', 'gzip', 'gunzip',
  'curl', 'wget',
  'powershell', 'cmd', 'bash', 'sh', 'zsh', 'fish',
])

function isCwdInSandbox(resolvedCwd: string): boolean {
  try {
    const userData = app.getPath('userData')
    const userDataReal = fs.realpathSync(userData)
    const sandboxRoot = path.join(userDataReal, 'sandbox')
    const workspaceRoot = path.join(userDataReal, 'workspace')
    const real = fs.realpathSync(resolvedCwd)
    const norm = (p: string) => path.normalize(p).toLowerCase() + path.sep
    return real.toLowerCase().startsWith(norm(sandboxRoot)) ||
           real.toLowerCase().startsWith(norm(workspaceRoot)) ||
           real.toLowerCase() === sandboxRoot.toLowerCase() ||
           real.toLowerCase() === workspaceRoot.toLowerCase()
  } catch {
    return false
  }
}

export const BashToolMetadata = {
  name: 'Bash',
  description: '跑命令 (走 execFile + 白名单, 不走 shell). command 是 baseCmd (如 git/node/python), args 是参数数组. cwd 必须在 sandbox/workspace 内. timeout 默认 30s 上限 60s.',
  parametersJson: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的可执行文件 (如 git, node, python), 必须在白名单内' },
      args: { type: 'array', items: { type: 'string' }, description: '参数数组, 按字面量传给 execFile, 不走 shell 解析' },
      cwd: { type: 'string', description: '工作目录, 必须在 sandbox/workspace 内' },
      timeout_ms: { type: 'number', description: '超时毫秒, 默认 30000, 上限 60000' },
    },
    required: ['command'],
  },
  requiresPermission: true, // 跑命令需要权限
  domain: 'agent.tools',
}

export class BashTool implements PiPiTool {
  metadata = BashToolMetadata
  private log = LogManager.getInstance()

  async execute(args: Record<string, unknown>): Promise<ToolExecResult> {
    const command = String(args.command ?? '').trim()
    const rawArgs = Array.isArray(args.args) ? (args.args as unknown[]) : []
    const cwd = args.cwd ? String(args.cwd) : undefined
    const timeoutMs = Math.min(Math.max(Number(args.timeout_ms ?? 30000) || 30000, 1000), 60000)

    if (!command) return { ok: false, result: '', error: 'command 必填' }
    const baseCmd = command.toLowerCase()
    // 防御 shell metacharacter
    if (/[\s;&|`$<>(){}\\]/.test(baseCmd)) {
      return { ok: false, result: '', error: `command 含非法字符, 只接受 baseCmd: ${baseCmd}` }
    }
    if (!COMMAND_ALLOWLIST.has(baseCmd)) {
      return { ok: false, result: '', error: `command "${baseCmd}" 不在白名单, 允许列表: ${Array.from(COMMAND_ALLOWLIST).join(', ')}` }
    }
    // args 校验
    const safeArgs: string[] = []
    for (let i = 0; i < rawArgs.length; i++) {
      const a = rawArgs[i]
      if (typeof a !== 'string') {
        return { ok: false, result: '', error: `args[${i}] 不是字符串` }
      }
      if (a.includes('\0')) {
        return { ok: false, result: '', error: `args[${i}] 含 null byte` }
      }
      safeArgs.push(a)
    }
    // cwd 校验
    let resolvedCwd: string
    if (cwd) {
      try {
        resolvedCwd = path.resolve(cwd)
      } catch {
        return { ok: false, result: '', error: `cwd 解析失败: ${cwd}` }
      }
      if (!isCwdInSandbox(resolvedCwd)) {
        return { ok: false, result: '', error: `cwd 必须在 sandbox/workspace 内, 实际: ${resolvedCwd}` }
      }
    } else {
      // 默认 cwd: userData/sandbox
      const userData = app.getPath('userData')
      const sandboxRoot = path.join(userData, 'sandbox')
      fs.mkdirSync(sandboxRoot, { recursive: true })
      resolvedCwd = sandboxRoot
    }

    this.log.info(`BashTool: ${baseCmd} ${safeArgs.join(' ').slice(0, 80)} (cwd=${resolvedCwd})`)
    try {
      const { stdout, stderr } = await execFileAsync(baseCmd, safeArgs, {
        cwd: resolvedCwd,
        timeout: timeoutMs,
        // 不 inherit parent env, 只给最小环境
        env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', USERPROFILE: process.env.USERPROFILE ?? '' },
        maxBuffer: 1024 * 1024, // 1MB 输出上限
      })
      const out = (stdout ?? '').toString()
      const err = (stderr ?? '').toString()
      return { ok: true, result: `exit=0\nstdout=${out.length > 4000 ? out.slice(0, 4000) + '\n...[truncated]' : out}${err ? `\nstderr=${err.slice(0, 1000)}` : ''}` }
    } catch (e: any) {
      // execFile 失败时 e.code 是 'ENOENT' / 'EACCES' / exit code (string number)
      const code = e.code ?? 'unknown'
      const stdout = (e.stdout ?? '').toString()
      const stderr = (e.stderr ?? '').toString()
      const killed = e.killed || e.signal === 'SIGTERM'
      return {
        ok: false,
        result: '',
        error: `exit=${code}${killed ? ' (killed/timeout)' : ''}\nstdout=${stdout.slice(0, 2000)}\nstderr=${stderr.slice(0, 1000)}`,
      }
    }
  }
}
