/**
 * PiPiClaw - ContentGen / html2pdf (W7.3)
 *
 * html → pdf 转换。W7 stub:用 PdfRenderer.render。
 */

import { PdfRenderer } from './PdfRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

export async function html2pdf(html: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return PdfRenderer.getInstance().render({ source: html, ...opts })
}