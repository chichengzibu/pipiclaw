/**
 * PiPiClaw - ContentGen / DocxRenderer (W7.3)
 *
 * markdown → .docx 渲染。W7 阶段:stub 实现(返回 { stub: true })。
 * W8+ 用 docx 库实装 Document/Packer/HeadingLevel。
 */

import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface RenderRequest {
  /** 源 markdown 文本 */
  source: string
  /** 输出文件路径(可选;不填则自动 userData/output/{uuid}.docx) */
  outputPath?: string
  /** 模板路径(可选) */
  templatePath?: string
  /** 标题 */
  title?: string
  /** 作者 */
  author?: string
}

export interface RenderResult {
  ok: boolean
  format: 'docx' | 'pdf' | 'pptx' | 'xlsx'
  outputPath?: string
  sizeBytes?: number
  error?: string
  stub: boolean
}

/**
 * DocxRenderer: 把 markdown 渲染成 .docx
 * W7 阶段:stub 实现(返回 { stub: true }),W8+ 用 docx 库实装。
 */
export class DocxRenderer {
  private static instance: DocxRenderer
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): DocxRenderer {
    if (!DocxRenderer.instance) DocxRenderer.instance = new DocxRenderer()
    return DocxRenderer.instance
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const format = 'docx'
    try {
      const outPath =
        req.outputPath ?? path.join(app.getPath('userData'), 'output', `${Date.now()}.${format}`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, req.source, 'utf-8')
      const sizeBytes = fs.statSync(outPath).size
      this.log.info(`DocxRenderer: stub rendered ${outPath} (${sizeBytes} bytes)`)
      return { ok: true, format, outputPath: outPath, sizeBytes, stub: true }
    } catch (e) {
      return { ok: false, format, error: String(e), stub: true }
    }
  }
}