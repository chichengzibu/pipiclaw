/**
 * PiPiClaw - GlobTool (M1 v0.1)
 *
 * 文件匹配, 跟 ClaudeCode Glob tool 协议对齐:
 *   args: { pattern: string, cwd?: string }
 *   result: { ok, result: "file1\nfile2\n...", error? }
 *
 * 用手写 glob (避免再装 minimatch). 支持 **, *, ?, 字符类, brace 展开.
 * 安全: 强制 cwd 必须在 sandbox/workspace 内.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { LogManager } from '../../core/LogManager'
import { resolveSafeCwd, compileGlob, ensureDir } from './_globInternals'
import type { PiPiTool, ToolExecResult } from './Tool'

const MAX_RESULTS = 500

async function walk(dir: string, rel: string, match: (rel: string) => boolean, out: string[]): Promise<void> {
  if (out.length >= MAX_RESULTS) return
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (out.length >= MAX_RESULTS) return
    // 跳过常见大目录 / 缓存
    if (e.isDirectory() && (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'release')) continue
    const full = path.join(dir, e.name)
    const newRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      await walk(full, newRel, match, out)
    } else if (e.isFile()) {
      if (match(newRel)) out.push(newRel)
    }
  }
}

export const GlobToolMetadata = {
  name: 'Glob',
  description: '文件匹配. 输入 pattern (如 **/*.ts 或 src/**/*.vue) + 可选 cwd. 列出 sandbox/workspace 内匹配的文件 (相对 cwd 路径).',
  parametersJson: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'glob 模式, 如 **/*.ts 或 src/**/*.vue' },
      cwd: { type: 'string', description: '搜索根目录, 必须在 sandbox/workspace 内, 默认 sandbox' },
    },
    required: ['pattern'],
  },
  requiresPermission: false, // 只读
  domain: 'agent.tools',
}

export class GlobTool implements PiPiTool {
  metadata = GlobToolMetadata
  private log = LogManager.getInstance()

  async execute(args: Record<string, unknown>): Promise<ToolExecResult> {
    const pattern = String(args.pattern ?? '').trim()
    const cwd = args.cwd ? String(args.cwd) : undefined
    if (!pattern) return { ok: false, result: '', error: 'pattern 必填' }
    let resolvedCwd: string
    try {
      resolvedCwd = resolveSafeCwd(cwd)
      await ensureDir(resolvedCwd)
    } catch (e) {
      return { ok: false, result: '', error: String((e as Error).message) }
    }
    const match = compileGlob(pattern)
    const all: string[] = []
    await walk(resolvedCwd, '', match, all)
    all.sort()
    if (all.length === 0) {
      return { ok: true, result: '(no matches)' }
    }
    const out = all.slice(0, MAX_RESULTS)
    return {
      ok: true,
      result: out.join('\n') + (all.length > MAX_RESULTS ? `\n...[${all.length - MAX_RESULTS} more truncated]` : ''),
    }
  }
}
