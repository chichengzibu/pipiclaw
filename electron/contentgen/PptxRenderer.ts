/**
 * PiPiClaw - ContentGen / PptxRenderer (W7.3)
 *
 * markdown → .pptx 渲染。W7 阶段:stub 实现。
 */

import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { RenderRequest, RenderResult } from './DocxRenderer'

/**
 * PptxRenderer: 把 markdown 渲染成 .pptx。W7 stub,W8+ 用 pptxgenjs 实装。
 */
export class PptxRenderer {
  private static instance: PptxRenderer
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): PptxRenderer {
    if (!PptxRenderer.instance) PptxRenderer.instance = new PptxRenderer()
    return PptxRenderer.instance
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const format = 'pptx'
    try {
      const outPath =
        req.outputPath ?? path.join(app.getPath('userData'), 'output', `${Date.now()}.${format}`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      // W7 stub: 把 markdown 文本当 slides 内容, append stub marker
      const slides = req.source.split(/\n---\n/).map((s, i) => `Slide ${i + 1}: ${s}`).join('\n')
      const payload = `PPTX-STUB\n${slides}\n`
      fs.writeFileSync(outPath, payload, 'utf-8')
      const sizeBytes = fs.statSync(outPath).size
      this.log.info(`PptxRenderer: stub rendered ${outPath} (${sizeBytes} bytes)`)
      return { ok: true, format, outputPath: outPath, sizeBytes, stub: true }
    } catch (e) {
      return { ok: false, format, error: String(e), stub: true }
    }
  }
}