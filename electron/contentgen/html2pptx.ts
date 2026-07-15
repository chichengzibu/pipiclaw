/**
 * PiPiClaw - ContentGen / html2pptx (W7.3)
 *
 * html → pptx 转换。W7 stub:用 PptxRenderer.render。
 */

import { PptxRenderer } from './PptxRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

export async function html2pptx(html: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return PptxRenderer.getInstance().render({ source: html, ...opts })
}