/**
 * PiPiClaw - ReadTool (M1 v0.1)
 *
 * 读取文件内容, 跟 ClaudeCode Read tool 协议对齐:
 *   args: { file_path: string, encoding?: 'utf-8' | 'utf-8-with-bom' | 'base64' }
 *   result: { ok, result: <file content>, error? }
 *
 * 安全: 走 OpenClawGateway 的 resolvePath() 强制在 userData/{sandbox,workspace} 内, 拒绝 ~/.ssh / C:\Windows\ 等敏感路径.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { app } from 'electron'
import { LogManager } from '../../core/LogManager'
import type { PiPiTool, ToolExecResult } from './Tool'

const MAX_BYTES = 200 * 1024 // 200KB 上限, 超过截断 + 提示

/** 把任意输入 path 转成绝对路径, 必须在 userData/{sandbox,workspace} 内. 其它路径拒绝. */
function resolveSafePath(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('ReadTool: file_path 不能为空')
  }
  // 拒绝 shell metacharacter / null byte (防止后续 string injection)
  if (/[\0&|`$<>(){}\\]/.test(input) && !path.isAbsolute(input)) {
    throw new Error(`ReadTool: file_path 含非法字符: ${input.slice(0, 60)}`)
  }
  const userData = app.getPath('userData')
  const sandboxRoot = path.join(userData, 'sandbox')
  const workspaceRoot = path.join(userData, 'workspace')
  const cwd = process.cwd()
  // 优先级: 1) userData/sandbox, 2) userData/workspace, 3) cwd
  const roots = [sandboxRoot, workspaceRoot, cwd]
  for (const root of roots) {
    const candidate = path.isAbsolute(input) ? input : path.resolve(root, input)
    const norm = (p: string) => path.normalize(p).toLowerCase() + path.sep
    const lower = candidate.toLowerCase()
    if (lower.startsWith(norm(root.toLowerCase())) || lower === root.toLowerCase()) {
      return candidate
    }
  }
  // 绝对路径但不在任何 root 内, 直接拒绝
  if (path.isAbsolute(input)) {
    throw new Error(`ReadTool: file_path 必须在 sandbox/workspace/cwd 内, 拒绝: ${input}`)
  }
  // 兜底: 用 cwd 解析
  return path.resolve(cwd, input)
}

export const ReadToolMetadata = {
  name: 'Read',
  description: '读取文件内容. 输入 file_path (相对 sandbox/workspace/cwd 或绝对路径) + 可选 encoding. 超过 200KB 会被截断.',
  parametersJson: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要读取的文件路径' },
      encoding: { type: 'string', enum: ['utf-8', 'utf-8-with-bom', 'base64'], description: '编码, 默认 utf-8' },
    },
    required: ['file_path'],
  },
  requiresPermission: false,
  domain: 'agent.tools',
}

export class ReadTool implements PiPiTool {
  metadata = ReadToolMetadata
  private log = LogManager.getInstance()

  async execute(args: Record<string, unknown>): Promise<ToolExecResult> {
    const filePath = String(args.file_path ?? '').trim()
    const encoding = (args.encoding as 'utf-8' | 'utf-8-with-bom' | 'base64') ?? 'utf-8'
    if (!filePath) {
      return { ok: false, result: '', error: 'file_path 必填' }
    }
    let resolved: string
    try {
      resolved = resolveSafePath(filePath)
    } catch (e) {
      return { ok: false, result: '', error: String((e as Error).message) }
    }
    try {
      const stat = await fs.stat(resolved)
      if (!stat.isFile()) {
        return { ok: false, result: '', error: `不是文件: ${resolved}` }
      }
      if (stat.size > MAX_BYTES) {
        // 截断读取
        const fh = await fs.open(resolved, 'r')
        try {
          const buf = Buffer.alloc(MAX_BYTES)
          await fh.read(buf, 0, MAX_BYTES, 0)
          return {
            ok: true,
            result: `[截断] 文件共 ${stat.size} bytes, 只读前 ${MAX_BYTES} bytes:\n${buf.toString('utf-8')}`,
          }
        } finally {
          await fh.close()
        }
      }
      if (encoding === 'base64') {
        const buf = await fs.readFile(resolved)
        return { ok: true, result: buf.toString('base64') }
      }
      const text = await fs.readFile(resolved, 'utf-8')
      return { ok: true, result: text }
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return { ok: false, result: '', error: `文件不存在: ${resolved}` }
      }
      this.log.warn(`ReadTool: 读取失败 ${resolved}`, err)
      return { ok: false, result: '', error: `读取失败: ${err.message}` }
    }
  }
}
