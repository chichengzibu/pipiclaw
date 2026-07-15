/**
 * PiPiClaw - ContentGen / PdfRenderer (W7.3)
 *
 * markdown → .pdf 渲染。W7 阶段:stub 实现。
 */

import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { RenderRequest, RenderResult } from './DocxRenderer'

/**
 * PdfRenderer: 把 markdown 渲染成 .pdf。W7 stub,W8+ 用 pdfkit/puppeteer 实装。
 */
export class PdfRenderer {
  private static instance: PdfRenderer
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): PdfRenderer {
    if (!PdfRenderer.instance) PdfRenderer.instance = new PdfRenderer()
    return PdfRenderer.instance
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const format = 'pdf'
    try {
      const outPath =
        req.outputPath ?? path.join(app.getPath('userData'), 'output', `${Date.now()}.${format}`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      // W7 stub: 把 markdown 文本当内容,append 一行 pdf stub marker
      const payload = `%PDF-1.4 (stub)\n${req.source}\n%%EOF\n`
      fs.writeFileSync(outPath, payload, 'utf-8')
      const sizeBytes = fs.statSync(outPath).size
      this.log.info(`PdfRenderer: stub rendered ${outPath} (${sizeBytes} bytes)`)
      return { ok: true, format, outputPath: outPath, sizeBytes, stub: true }
    } catch (e) {
      return { ok: false, format, error: String(e), stub: true }
    }
  }
}