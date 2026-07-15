/**
 * PiPiClaw - ContentGen / md2xlsx (W7.3)
 *
 * markdown → xlsx 转换。W7 stub:用 XlsxRenderer.render。
 */

import { XlsxRenderer } from './XlsxRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

export async function md2xlsx(source: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return XlsxRenderer.getInstance().render({ source, ...opts })
}