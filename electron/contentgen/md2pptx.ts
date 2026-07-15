/**
 * PiPiClaw - ContentGen / md2pptx (W7.3)
 *
 * markdown → pptx 转换。W7 stub:用 PptxRenderer.render。
 */

import { PptxRenderer } from './PptxRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

export async function md2pptx(source: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return PptxRenderer.getInstance().render({ source, ...opts })
}