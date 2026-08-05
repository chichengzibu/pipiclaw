/**
 * PiPiClaw - EditTool (M1 v0.1)
 *
 * 精确编辑文件, 跟 ClaudeCode Edit tool 协议对齐:
 *   args: { file_path, old_string, new_string, replace_all?: boolean }
 *   result: { ok, result: "ok" | error }
 *
 * 安全:
 *   - 走 resolveSafePath() (跟 ReadTool 一致)
 *   - old_string 必须唯一匹配 (除非 replace_all=true), 不唯一报错让 LLM 加上下文
 *   - 原子写: 先读原内容 → 替换 → 写新文件; 写失败回滚 (备份原内容)
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { app } from 'electron'
import { LogManager } from '../../core/LogManager'
import type { PiPiTool, ToolExecResult } from './Tool'

function resolveSafePath(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('EditTool: file_path 不能为空')
  }
  const userData = app.getPath('userData')
  const sandboxRoot = path.join(userData, 'sandbox')
  const workspaceRoot = path.join(userData, 'workspace')
  const cwd = process.cwd()
  const roots = [sandboxRoot, workspaceRoot, cwd]
  for (const root of roots) {
    const candidate = path.isAbsolute(input) ? input : path.resolve(root, input)
    const norm = (p: string) => path.normalize(p).toLowerCase() + path.sep
    const lower = candidate.toLowerCase()
    if (lower.startsWith(norm(root.toLowerCase())) || lower === root.toLowerCase()) {
      return candidate
    }
  }
  if (path.isAbsolute(input)) {
    throw new Error(`EditTool: file_path 必须在 sandbox/workspace/cwd 内, 拒绝: ${input}`)
  }
  return path.resolve(cwd, input)
}

export const EditToolMetadata = {
  name: 'Edit',
  description: '精确编辑文件: 把 old_string 替换成 new_string. 默认要求 old_string 唯一匹配, 否则报错. replace_all=true 时全部替换.',
  parametersJson: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: '要编辑的文件路径' },
      old_string: { type: 'string', description: '原内容片段 (必须唯一, 除非 replace_all=true)' },
      new_string: { type: 'string', description: '新内容片段' },
      replace_all: { type: 'boolean', description: '是否替换全部匹配项, 默认 false' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  requiresPermission: true, // 写文件需要权限
  domain: 'agent.tools',
}

export class EditTool implements PiPiTool {
  metadata = EditToolMetadata
  private log = LogManager.getInstance()

  async execute(args: Record<string, unknown>): Promise<ToolExecResult> {
    const filePath = String(args.file_path ?? '').trim()
    const oldString = String(args.old_string ?? '')
    const newString = String(args.new_string ?? '')
    const replaceAll = args.replace_all === true
    if (!filePath) return { ok: false, result: '', error: 'file_path 必填' }
    if (!oldString) return { ok: false, result: '', error: 'old_string 必填' }

    let resolved: string
    try {
      resolved = resolveSafePath(filePath)
    } catch (e) {
      return { ok: false, result: '', error: String((e as Error).message) }
    }

    let original: string
    try {
      original = await fs.readFile(resolved, 'utf-8')
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return { ok: false, result: '', error: `文件不存在: ${resolved}` }
      }
      return { ok: false, result: '', error: `读取失败: ${err.message}` }
    }

    // 计算匹配数
    const matches: number[] = []
    let idx = 0
    while (true) {
      const i = original.indexOf(oldString, idx)
      if (i < 0) break
      matches.push(i)
      idx = i + oldString.length
    }
    if (matches.length === 0) {
      return { ok: false, result: '', error: `old_string 在文件中未找到 (len=${oldString.length})` }
    }
    if (matches.length > 1 && !replaceAll) {
      return {
        ok: false,
        result: '',
        error: `old_string 不唯一 (找到 ${matches.length} 处), 加更多上下文或传 replace_all=true`,
      }
    }

    // 原子写: 先写 .bak 备份, 然后写新内容; 失败时从 .bak 恢复
    const bakPath = resolved + '.bak'
    let next: string
    if (replaceAll) {
      next = original.split(oldString).join(newString)
    } else {
      next = original.slice(0, matches[0]) + newString + original.slice(matches[0] + oldString.length)
    }
    try {
      await fs.writeFile(bakPath, original, 'utf-8')
      await fs.writeFile(resolved, next, 'utf-8')
      // 成功, 删备份
      await fs.unlink(bakPath).catch(() => undefined)
      this.log.info(`EditTool: ${resolved} 写入成功 (${original.length} -> ${next.length} bytes)`)
      return { ok: true, result: `ok (${original.length} -> ${next.length} bytes, ${replaceAll ? matches.length : 1} 处替换)` }
    } catch (e) {
      // 回滚
      try {
        await fs.copyFile(bakPath, resolved)
        await fs.unlink(bakPath).catch(() => undefined)
      } catch {
        // 备份都没了, 至少告诉用户
      }
      return { ok: false, result: '', error: `写入失败已回滚: ${(e as Error).message}` }
    }
  }
}
