/**
 * PiPiClaw - ContentGen / md2pdf (W7.3)
 *
 * markdown → pdf 转换。W7 stub:用 PdfRenderer.render。
 */

import { PdfRenderer } from './PdfRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

export async function md2pdf(source: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return PdfRenderer.getInstance().render({ source, ...opts })
}