/**
 * PiPiClaw - ContentGen / ImageGenHandler (W7.3)
 *
 * 图像生成 handler(代理 DALL-E / SD / 即梦 / 通义万相)。
 * W7 阶段:仅 mock provider 真实可调,其余 provider stub。W8+ 接真实 API。
 */

import { LogManager } from '../core/LogManager'

export type ImageGenProvider =
  | 'openai-dalle'
  | 'stability-sd'
  | 'volcengine-jimeng'
  | 'aliyun-tongyi'
  | 'mock'

export interface ImageGenRequest {
  prompt: string
  provider?: ImageGenProvider
  width?: number
  height?: number
  /** 张数 */
  count?: number
}

export interface ImageGenResult {
  ok: boolean
  provider: ImageGenProvider
  images: Array<{ url: string; revisedPrompt?: string }>
  error?: string
  stub: boolean
}

/**
 * ImageGenHandler: 图像生成 handler(代理 DALL-E / SD / 即梦 / 通义万相)
 * W7 阶段:仅 mock provider 真实可调,其余 provider stub
 * W8+ 接真实 API
 */
export class ImageGenHandler {
  private static instance: ImageGenHandler
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): ImageGenHandler {
    if (!ImageGenHandler.instance) ImageGenHandler.instance = new ImageGenHandler()
    return ImageGenHandler.instance
  }

  async generate(req: ImageGenRequest): Promise<ImageGenResult> {
    const provider = req.provider ?? 'mock'
    const count = req.count ?? 1
    if (provider === 'mock') {
      const w = req.width ?? 512
      const h = req.height ?? 512
      const images = Array.from({ length: count }, (_, i) => ({
        url: `data:image/svg+xml;base64,${Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" dy=".3em">mock-${i}</text></svg>`,
        ).toString('base64')}`,
        revisedPrompt: req.prompt,
      }))
      return { ok: true, provider, images, stub: false }
    }
    // 其他 provider: stub
    this.log.warn(`ImageGenHandler: provider ${provider} W7 stub,W8+ 接入`)
    return { ok: true, provider, images: [], stub: true }
  }
}