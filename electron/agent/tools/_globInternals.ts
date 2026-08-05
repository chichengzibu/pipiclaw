/**
 * PiPiClaw - Agent tools shared internals (M1 v0.1)
 *
 * Glob / Grep 工具共享的辅助函数: 安全 cwd 解析 + glob 段正则.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { app } from 'electron'

export function resolveSafeCwd(input: string | undefined): string {
  const userData = app.getPath('userData')
  const sandboxRoot = path.join(userData, 'sandbox')
  const workspaceRoot = path.join(userData, 'workspace')
  const roots = [sandboxRoot, workspaceRoot]
  if (!input) {
    return sandboxRoot
  }
  const candidate = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input)
  for (const root of roots) {
    const lower = candidate.toLowerCase()
    const norm = path.normalize(root.toLowerCase()) + path.sep
    if (lower === root.toLowerCase() || lower.startsWith(norm)) return candidate
  }
  throw new Error(`cwd 必须在 sandbox/workspace 内: ${candidate}`)
}

export function reEsc(s: string): string {
  return s.replace(/[.+^$()|{}\[\]\\]/g, '\\$&')
}

/** 把 glob 单段转成正则 (无 ** 跨段; ** 在段内退化为 *). */
export function segmentToRegex(seg: string): RegExp {
  let re = ''
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]
    if (c === '*') {
      re += '[^/\\\\]*'
      if (seg[i + 1] === '*') i++
    } else if (c === '?') {
      re += '[^/\\\\]'
    } else if (c === '[') {
      const end = seg.indexOf(']', i + 1)
      if (end > i) {
        const inner = seg.slice(i + 1, end)
        const negated = inner.startsWith('!')
        const body = reEsc(inner.slice(negated ? 1 : 0).replace(/]-/g, '-'))
        re += '[' + (negated ? '^' : '') + body + ']'
        i = end
      } else {
        re += '\\['
      }
    } else if (c === '{') {
      const end = seg.indexOf('}', i + 1)
      if (end > i) {
        const inner = seg.slice(i + 1, end)
        const alts = inner.split(',').map(a => reEsc(a))
        re += '(?:' + alts.join('|') + ')'
        i = end
      } else {
        re += '\\{'
      }
    } else {
      re += reEsc(c)
    }
  }
  return new RegExp('^' + re + '$', 'i')
}

/** 把 glob pattern 编译成 matcher: 接受 'foo/bar/baz.ts' 这样的相对路径, 返回是否匹配. */
export function compileGlob(pat: string): (rel: string) => boolean {
  const segs = pat.split(/[\\/]+/).filter(s => s.length > 0)
  const norm: string[] = []
  for (const s of segs) {
    if (s === '**' && norm[norm.length - 1] === '**') continue
    norm.push(s)
  }
  const starIdx = norm.indexOf('**')
  if (starIdx < 0) {
    const regs = norm.map(segmentToRegex)
    return (rel: string) => {
      const parts = rel.split('/')
      if (parts.length !== regs.length) return false
      return regs.every((r, i) => r.test(parts[i]))
    }
  }
  const prefix = norm.slice(0, starIdx).map(segmentToRegex)
  const suffix = norm.slice(starIdx + 1).map(segmentToRegex)
  return (rel: string) => {
    const parts = rel.split('/')
    if (parts.length < prefix.length + suffix.length) return false
    for (let i = 0; i < prefix.length; i++) if (!prefix[i].test(parts[i])) return false
    for (let i = 0; i < suffix.length; i++) if (!suffix[i].test(parts[parts.length - suffix.length + i])) return false
    return true
  }
}

/** ensure dir exists (async, swallow error) */
export async function ensureDir(dir: string): Promise<void> {
  try { await fs.mkdir(dir, { recursive: true }) } catch { /* noop */ }
}
