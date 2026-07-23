import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-fileorganizer-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P3-T3.1: 自动整理下载文件夹
 *
 * 验证:
 * - categorizeByExtension:扩展名 → category 映射
 * - organizeDirectory:扫描 + 移动 + 同名处理 + 跳过 sorted/ 内文件
 * - dryRun 模式只扫描不移动
 * - 不存在的源目录返回错误但不抛
 */

import {
  categorizeByExtension,
  organizeDirectory,
  FILE_CATEGORIES,
} from '../../electron/automation/FileOrganizer'

describe('P3-T3.1: categorizeByExtension', () => {
  it('图片类', () => {
    expect(categorizeByExtension('photo.jpg')).toBe('images')
    expect(categorizeByExtension('icon.PNG')).toBe('images')
    expect(categorizeByExtension('art.svg')).toBe('images')
  })

  it('文档类', () => {
    expect(categorizeByExtension('readme.md')).toBe('documents')
    expect(categorizeByExtension('report.pdf')).toBe('documents')
    expect(categorizeByExtension('contract.docx')).toBe('documents')
  })

  it('表格类', () => {
    expect(categorizeByExtension('data.csv')).toBe('spreadsheets')
    expect(categorizeByExtension('budget.xlsx')).toBe('spreadsheets')
  })

  it('演示类', () => {
    expect(categorizeByExtension('slides.pptx')).toBe('presentations')
    expect(categorizeByExtension('pitch.key')).toBe('presentations')
  })

  it('视频类', () => {
    expect(categorizeByExtension('movie.mp4')).toBe('videos')
    expect(categorizeByExtension('clip.mov')).toBe('videos')
  })

  it('音频类', () => {
    expect(categorizeByExtension('song.mp3')).toBe('audios')
    expect(categorizeByExtension('podcast.m4a')).toBe('audios')
  })

  it('压缩类', () => {
    expect(categorizeByExtension('archive.zip')).toBe('archives')
    expect(categorizeByExtension('backup.tar.gz')).toBe('archives') // 取最后一个扩展名 .gz
  })

  it('代码类', () => {
    expect(categorizeByExtension('main.ts')).toBe('code')
    expect(categorizeByExtension('script.py')).toBe('code')
    expect(categorizeByExtension('style.css')).toBe('code')
  })

  it('未知扩展名归 others', () => {
    expect(categorizeByExtension('random.xyz')).toBe('others')
    expect(categorizeByExtension('weird.unknownext')).toBe('others')
  })

  it('无扩展名归 others', () => {
    expect(categorizeByExtension('Makefile')).toBe('others')
    expect(categorizeByExtension('LICENSE')).toBe('others')
  })

  it('大小写不敏感', () => {
    expect(categorizeByExtension('Photo.JPG')).toBe('images')
    expect(categorizeByExtension('Doc.PDF')).toBe('documents')
  })
})

describe('P3-T3.1: organizeDirectory', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipiclaw-organize-'))
  })

  it('扫描空目录返回 0 moved', async () => {
    const result = await organizeDirectory(tmpDir)
    expect(result.scannedCount).toBe(0)
    expect(result.movedCount).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('整理 3 个不同类型文件', async () => {
    fs.writeFileSync(path.join(tmpDir, 'photo.jpg'), 'fake jpg')
    fs.writeFileSync(path.join(tmpDir, 'doc.pdf'), 'fake pdf')
    fs.writeFileSync(path.join(tmpDir, 'movie.mp4'), 'fake mp4')

    const result = await organizeDirectory(tmpDir)
    expect(result.scannedCount).toBe(3)
    expect(result.movedCount).toBe(3)
    expect(result.byCategory.images).toBe(1)
    expect(result.byCategory.documents).toBe(1)
    expect(result.byCategory.videos).toBe(1)

    // 验证文件确实被移动
    expect(fs.existsSync(path.join(tmpDir, 'sorted/images/photo.jpg'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'sorted/documents/doc.pdf'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'sorted/videos/movie.mp4'))).toBe(true)

    // 原位置不存在
    expect(fs.existsSync(path.join(tmpDir, 'photo.jpg'))).toBe(false)
  })

  it('dryRun 模式只扫描不移动', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.png'), 'a')
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b')

    const result = await organizeDirectory(tmpDir, { dryRun: true })
    expect(result.scannedCount).toBe(2)
    expect(result.movedCount).toBe(0) // dryRun 不移动
    expect(result.byCategory.images).toBe(1)
    expect(result.byCategory.documents).toBe(1)

    // 文件位置不变
    expect(fs.existsSync(path.join(tmpDir, 'a.png'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'b.txt'))).toBe(true)
    // sorted/ 目录不创建
    expect(fs.existsSync(path.join(tmpDir, 'sorted'))).toBe(false)
  })

  it('同名文件加 .1 .2 后缀', async () => {
    fs.writeFileSync(path.join(tmpDir, 'report.pdf'), 'first')
    fs.writeFileSync(path.join(tmpDir, 'report2.pdf'), 'second')

    // 模拟重名:已存在 sorted/documents/report.pdf,新文件 report.pdf 要加 .1 后缀
    fs.mkdirSync(path.join(tmpDir, 'sorted/documents'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'sorted/documents/report.pdf'), 'placeholder')

    const result = await organizeDirectory(tmpDir)
    expect(result.movedCount).toBe(2)
    // 旧的 placeholder 还在
    expect(fs.existsSync(path.join(tmpDir, 'sorted/documents/report.pdf'))).toBe(true)
    // 源 report.pdf → sorted/documents/report.1.pdf(因为目标 report.pdf 已存在)
    expect(fs.existsSync(path.join(tmpDir, 'sorted/documents/report.1.pdf'))).toBe(true)
    // 源 report2.pdf → sorted/documents/report2.pdf(无重名,直接放)
    expect(fs.existsSync(path.join(tmpDir, 'sorted/documents/report2.pdf'))).toBe(true)
  })

  it('跳过已在 sorted/ 子目录内的文件', async () => {
    fs.mkdirSync(path.join(tmpDir, 'sorted/images'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'sorted/images/already.jpg'), 'already here')
    fs.writeFileSync(path.join(tmpDir, 'new.jpg'), 'new')

    const result = await organizeDirectory(tmpDir)
    expect(result.scannedCount).toBe(1) // 只扫顶层
    expect(result.movedCount).toBe(1)
    expect(result.skippedCount).toBe(0) // 顶层只有一个 new.jpg,不是 skip
    // sorted/images/already.jpg 没被动
    expect(fs.readFileSync(path.join(tmpDir, 'sorted/images/already.jpg'), 'utf-8')).toBe('already here')
  })

  it('不存在的源目录返回错误但不抛', async () => {
    const result = await organizeDirectory('/tmp/nonexistent-' + Date.now())
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].reason).toContain('source directory not found')
  })

  it('10 个文件全部归位 < 1s', async () => {
    const types = ['jpg', 'pdf', 'mp4', 'mp3', 'zip', 'xlsx', 'pptx', 'py', 'txt', 'unknown']
    for (const ext of types) {
      fs.writeFileSync(path.join(tmpDir, `file${Math.random().toString(36).slice(2)}.${ext}`), 'x')
    }
    const result = await organizeDirectory(tmpDir)
    expect(result.scannedCount).toBe(10)
    expect(result.movedCount).toBe(10)
    expect(result.durationMs).toBeLessThan(1000)
  })
})

describe('P3-T3.1: FILE_CATEGORIES 完整性', () => {
  it('至少覆盖 8 个常见类别', () => {
    expect(Object.keys(FILE_CATEGORIES).length).toBeGreaterThanOrEqual(8)
  })

  it('每个 category 至少 3 个扩展名', () => {
    for (const [name, exts] of Object.entries(FILE_CATEGORIES)) {
      expect(exts.length, `${name} should have >= 3 exts`).toBeGreaterThanOrEqual(3)
    }
  })
})
