/**
 * PiPiClaw - Skill / D1ScreenshotQA (W5.3)
 *
 * Screenshot-Q&A demo skill. Triggered by the Cmd/Ctrl+Shift+S global shortcut
 * registered in GlobalShortcut.ts. Captures the screen via Electron's
 * desktopCapturer, then emits a d1:screenshot:captured IPC event so the
 * renderer can hand it off to the Agent for visual reasoning.
 *
 * W5 ships the capture + IPC + stub answer; W6+W7 wire LLM vision and
 * SelfLearner skill crystallization.
 */

import { LogManager } from '../../core/LogManager'
import { BrowserWindow } from 'electron'
import { SkillRuntime } from '../../runtime/skill/SkillRuntime'
import type { SkillDefinition } from '../../runtime/skill/SkillRuntime'

export const D1_SKILL_NAME = 'd1:screenshot-qa'

export async function handleD1Shortcut(): Promise<void> {
  const log = LogManager.getInstance()
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) {
    log.warn('D1ScreenshotQA: 无可用 BrowserWindow')
    return
  }
  try {
    const { desktopCapturer } = await import('electron')
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })
    if (sources.length === 0) {
      log.warn('D1ScreenshotQA: 无屏幕源')
      return
    }
    const source = sources[0]
    const thumbnail = source.thumbnail
    const dataUrl = thumbnail.toDataURL()
    const buffer = thumbnail.toPNG()
    const size = thumbnail.getSize()

    win.webContents.send('d1:screenshot:captured', {
      ts: Date.now(),
      dataUrlPreview: dataUrl.slice(0, 200) + '...[truncated]',
      sizeBytes: buffer.length,
      width: size.width,
      height: size.height,
      note: 'W5 阶段 D1 stub:图片已截,Agent 真实理解待 LLM 接入',
    })

    log.info(
      `D1ScreenshotQA: 截图 ${size.width}x${size.height}, ${buffer.length} bytes`,
    )
  } catch (e) {
    log.error('D1ScreenshotQA: 截屏失败', e)
  }
}

/**
 * Skill handler in the format SkillRuntime expects.
 * Self-registers on import so main.ts boot picks it up.
 *
 * P2-T3.2: 返回实际捕获的图像信息 (size / dimensions / dataUrl 预览) ,
 *          留 vision LLM hook 给后续接 OpenAI multimodal content
 */
export const d1SkillDefinition: SkillDefinition = {
  name: D1_SKILL_NAME,
  description: '用户截屏后,Agent 对截图内容提问并回答',
  requiresPermission: false,
  handler: async (args) => {
    const log = LogManager.getInstance()
    const a = args as { question?: string; imageDataUrl?: string }
    log.info(
      `D1 skill 触发 question="${a.question ?? ''}", 有图=${!!a.imageDataUrl}`,
    )
    // 1. 解析 imageDataUrl 元数据 (PNG/JPEG prefix + base64 payload)
    let imageMeta: { format: string; sizeBytes: number; approxDimensions?: string } | null = null
    if (a.imageDataUrl && typeof a.imageDataUrl === 'string') {
      const match = a.imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (match) {
        const format = match[1].toUpperCase()
        const base64 = match[2]
        const sizeBytes = Math.floor((base64.length * 3) / 4) // base64 → bytes approx
        // 简化的维度估算 (Tesseract 真实拿图才解析)
        imageMeta = { format, sizeBytes }
      }
    }
    // 2. 返回结构化响应 (含图像元信息 + 占位说明)
    // 完整视觉理解留 hook: 在此调用 visionLlm.analyze(imageDataUrl, question)
    return {
      ok: true,
      captured: imageMeta,
      answer: imageMeta
        ? `[D1] 捕获到截图 ${imageMeta.format} 格式,约 ${imageMeta.sizeBytes} bytes。用户问题:"${a.question ?? '(未提供)'}"。` +
          `视觉理解留 hook,后续接 OpenAI multimodal content / Anthropic vision 后输出真实回答。`
        : `[D1] 未提供图像数据。请先截屏 (Cmd/Ctrl+Shift+S)。`,
    }
  },
}

let registered = false
export function ensureD1SkillRegistered(): void {
  if (registered) return
  SkillRuntime.getInstance().register(d1SkillDefinition)
  registered = true
}