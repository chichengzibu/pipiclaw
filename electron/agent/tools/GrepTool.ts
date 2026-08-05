/**
 * PiPiClaw - GrepTool (M1 v0.1)
 *
 * 内容搜索, 跟 ClaudeCode Grep tool 协议对齐:
 *   args: { pattern: string, cwd?: string, include?: string, max_results?: number }
 *   result: { ok, result: "file:line: content\n...", error? }
 *
 * 简单 JS 正则; 走安全 cwd; 行号输出 ripgrep 风格.
 * 安全: 强制 cwd 必须在 sandbox/workspace 内.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { LogManager } from '../../core/LogManager'
import { resolveSafeCwd, compileGlob, ensureDir } from './_globInternals'
import type { PiPiTool, ToolExecResult } from './Tool'

const MAX_RESULTS = 200
const MAX_FILE_BYTES = 1024 * 1024 // 1MB 上限 (避免读巨型 binary)

interface Hit { rel: string; lineNo: number; text: string }

async function walkGrep(dir: string, rel: string, re: RegExp, include: ((rel: string) => boolean) | null, hits: Hit[]): Promise<void> {
  if (hits.length >= MAX_RESULTS) return
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (hits.length >= MAX_RESULTS) return
    if (e.isDirectory() && (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'release')) continue
    const full = path.join(dir, e.name)
    const newRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      await walkGrep(full, newRel, re, include, hits)
    } else if (e.isFile()) {
      if (include && !include(newRel)) continue
      let st
      try { st = await fs.stat(full) } catch { continue }
      if (st.size > MAX_FILE_BYTES) continue
      let text: string
      try { text = await fs.readFile(full, 'utf-8') } catch { continue }
      // 简单 binary 检测
      if (text.indexOf('\0') >= 0) continue
      const lines = text.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= MAX_RESULTS) return
        if (re.test(lines[i])) {
          hits.push({ rel: newRel, lineNo: i + 1, text: lines[i] })
        }
      }
    }
  }
}

export const GrepToolMetadata = {
  name: 'Grep',
  description: '内容搜索. pattern 是 JS 正则 (自动 ignoreCase). cwd 必须在 sandbox/workspace 内. include 是 glob, 限定文件. 输出 file:line: text 格式.',
  parametersJson: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'JS 正则 (无 flag), 自动 ignoreCase' },
      cwd: { type: 'string', description: '搜索根目录, 默认 sandbox' },
      include: { type: 'string', description: '文件 glob 过滤, 如 *.ts 或 src/**/*.vue' },
    },
    required: ['pattern'],
  },
  requiresPermission: false, // 只读
  domain: 'agent.tools',
}

export class GrepTool implements PiPiTool {
  metadata = GrepToolMetadata
  private log = LogManager.getInstance()

  async execute(args: Record<string, unknown>): Promise<ToolExecResult> {
    const pattern = String(args.pattern ?? '')
    const cwd = args.cwd ? String(args.cwd) : undefined
    const include = args.include ? String(args.include) : undefined
    if (!pattern) return { ok: false, result: '', error: 'pattern 必填' }
    let re: RegExp
    try {
      re = new RegExp(pattern, 'i')
    } catch (e) {
      return { ok: false, result: '', error: `正则解析失败: ${(e as Error).message}` }
    }
    let resolvedCwd: string
    try {
      resolvedCwd = resolveSafeCwd(cwd)
      await ensureDir(resolvedCwd)
    } catch (e) {
      return { ok: false, result: '', error: String((e as Error).message) }
    }
    const includeFn = include ? compileGlob(include) : null
    const hits: Hit[] = []
    await walkGrep(resolvedCwd, '', re, includeFn, hits)
    if (hits.length === 0) {
      return { ok: true, result: '(no matches)' }
    }
    const out = hits.map(h => `${h.rel}:${h.lineNo}: ${h.text}`).join('\n')
    return { ok: true, result: out }
  }
}
