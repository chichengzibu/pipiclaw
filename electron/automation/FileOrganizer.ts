/**
 * PiPiClaw - 文件整理器 (P3-T3.1)
 *
 * 用途:用户说"整理下载文件夹"时,系统按扩展名归类文件
 * 规则:
 *   图片:jpg, jpeg, png, gif, webp, svg, bmp
 *   文档:pdf, doc, docx, txt, md, rtf, odt
 *   表格:xls, xlsx, csv, ods
 *   演示:ppt, pptx, key, odp
 *   视频:mp4, mov, avi, mkv, webm, flv
 *   音频:mp3, wav, flac, aac, ogg, m4a
 *   压缩:zip, rar, 7z, tar, gz, bz2
 *   代码:js, ts, py, java, cpp, c, h, go, rs, rb, php
 *   其他:catch-all
 *
 * 输出:在源目录创建 sorted/{type}/ 子目录,移动文件
 * 失败:文件已在 sorted/{type}/ 内 / 目标目录不可写 / 源文件不存在 → 跳过,记录错误
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { LogManager } from '../core/LogManager'

export const FILE_CATEGORIES = {
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'],
  documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pages'],
  spreadsheets: ['xls', 'xlsx', 'csv', 'ods', 'numbers'],
  presentations: ['ppt', 'pptx', 'key', 'odp'],
  videos: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
  audios: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  code: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'sh', 'sql', 'html', 'css'],
} as const

export type FileCategory = keyof typeof FILE_CATEGORIES | 'others'

export interface OrganizeResult {
  /** 总扫描文件数 */
  scannedCount: number
  /** 成功移动的文件数 */
  movedCount: number
  /** 跳过的文件数(已在 sorted/ 目录内 / 不可读等) */
  skippedCount: number
  /** 失败的文件数 */
  failedCount: number
  /** 移动详情(每个 category 多少文件) */
  byCategory: Record<FileCategory, number>
  /** 错误列表 */
  errors: Array<{ file: string; reason: string }>
  /** 耗时 ms */
  durationMs: number
}

/**
 * 把单个文件名分类
 */
export function categorizeByExtension(filename: string): FileCategory {
  const ext = path.extname(filename).toLowerCase().slice(1)
  if (!ext) return 'others'
  for (const [category, exts] of Object.entries(FILE_CATEGORIES)) {
    if ((exts as readonly string[]).includes(ext)) {
      return category as FileCategory
    }
  }
  return 'others'
}

/**
 * 检查文件是否已经在 sorted/ 子目录内(避免重复移动)
 */
function isAlreadySorted(filePath: string, sourceDir: string): boolean {
  const relative = path.relative(sourceDir, path.dirname(filePath))
  if (!relative || relative.startsWith('..')) return false
  return relative.split(path.sep).some((part) => part === 'sorted')
}

/**
 * 整理一个目录
 *
 * @param sourceDir 源目录
 * @param options.dryRun 只扫描不移动(默认 false)
 * @param options.recursive 是否递归子目录(默认 false,只处理顶层)
 * @returns OrganizeResult
 */
export async function organizeDirectory(
  sourceDir: string,
  options: { dryRun?: boolean; recursive?: boolean } = {},
): Promise<OrganizeResult> {
  const log = LogManager.getInstance()
  const start = Date.now()
  const result: OrganizeResult = {
    scannedCount: 0,
    movedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    byCategory: {
      images: 0,
      documents: 0,
      spreadsheets: 0,
      presentations: 0,
      videos: 0,
      audios: 0,
      archives: 0,
      code: 0,
      others: 0,
    },
    errors: [],
    durationMs: 0,
  }

  if (!fs.existsSync(sourceDir)) {
    result.errors.push({ file: sourceDir, reason: 'source directory not found' })
    result.durationMs = Date.now() - start
    return result
  }

  // 列出文件
  let files: string[]
  try {
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
    files = entries
      .filter((e) => e.isFile() || (options.recursive && e.isDirectory()))
      .map((e) => path.join(sourceDir, e.name))
  } catch (e) {
    result.errors.push({ file: sourceDir, reason: `readdir failed: ${(e as Error).message}` })
    result.durationMs = Date.now() - start
    return result
  }

  for (const filePath of files) {
    result.scannedCount += 1

    try {
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) continue

      // 跳过已在 sorted/ 内
      if (isAlreadySorted(filePath, sourceDir)) {
        result.skippedCount += 1
        continue
      }

      const category = categorizeByExtension(path.basename(filePath))
      result.byCategory[category] += 1

      if (options.dryRun) continue

      // 目标目录
      const targetDir = path.join(sourceDir, 'sorted', category)
      fs.mkdirSync(targetDir, { recursive: true })

      // 同名检测:加 .1 .2 后缀
      let targetPath = path.join(targetDir, path.basename(filePath))
      let counter = 1
      while (fs.existsSync(targetPath)) {
        const ext = path.extname(filePath)
        const base = path.basename(filePath, ext)
        targetPath = path.join(targetDir, `${base}.${counter}${ext}`)
        counter += 1
      }

      // 移动
      fs.renameSync(filePath, targetPath)
      result.movedCount += 1
      log.info(`FileOrganizer: ${path.basename(filePath)} → sorted/${category}/`)
    } catch (e) {
      result.failedCount += 1
      result.errors.push({ file: filePath, reason: (e as Error).message })
    }
  }

  result.durationMs = Date.now() - start
  log.info(`FileOrganizer: ${result.movedCount} moved, ${result.skippedCount} skipped, ${result.failedCount} failed in ${result.durationMs}ms`)
  return result
}
