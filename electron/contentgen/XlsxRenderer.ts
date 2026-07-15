/**
 * PiPiClaw - ContentGen / XlsxRenderer (W7.3)
 *
 * markdown → .xlsx 渲染。W7 阶段:stub 实现。
 */

import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { RenderRequest, RenderResult } from './DocxRenderer'

/**
 * XlsxRenderer: 把 markdown 渲染成 .xlsx。W7 stub,W8+ 用 exceljs/xlsx-populate 实装。
 */
export class XlsxRenderer {
  private static instance: XlsxRenderer
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): XlsxRenderer {
    if (!XlsxRenderer.instance) XlsxRenderer.instance = new XlsxRenderer()
    return XlsxRenderer.instance
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const format = 'xlsx'
    try {
      const outPath =
        req.outputPath ?? path.join(app.getPath('userData'), 'output', `${Date.now()}.${format}`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      // W7 stub: 把 markdown pipe-table 简单分行
      const lines = req.source.split('\n').filter(l => l.trim().length > 0)
      const csv = lines.map(l => l.replace(/\|/g, '\t').trim()).join('\n')
      const payload = `XLSX-STUB\n${csv}\n`
      fs.writeFileSync(outPath, payload, 'utf-8')
      const sizeBytes = fs.statSync(outPath).size
      this.log.info(`XlsxRenderer: stub rendered ${outPath} (${sizeBytes} bytes)`)
      return { ok: true, format, outputPath: outPath, sizeBytes, stub: true }
    } catch (e) {
      return { ok: false, format, error: String(e), stub: true }
    }
  }
}