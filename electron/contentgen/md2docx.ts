/**
 * PiPiClaw - ContentGen / md2docx (W7.3)
 *
 * markdown → docx 转换。W7 stub:用 DocxRenderer.render 简单把 md 文本当源。
 */

import { DocxRenderer } from './DocxRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

export async function md2docx(source: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return DocxRenderer.getInstance().render({ source, ...opts })
}