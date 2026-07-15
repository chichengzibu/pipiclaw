import { LogManager } from '../core/LogManager'

export interface ScreenFrame {
  ts: number
  dataUrl: string
  width: number
  height: number
  byteSize: number
}

export interface RecordingResult {
  frames: ScreenFrame[]
  durationMs: number
  startedAt: number
  endedAt: number
  fps: number
}

interface RecordingState {
  frames: ScreenFrame[]
  timer?: ReturnType<typeof setInterval>
  startedAt?: number
  fps: number
}

/**
 * ScreenVision: 全屏截帧器(W6 阶段:多帧采集合并)
 * W6 阶段:用 desktopCapturer 每 N ms 采一帧(默认 1 fps,D5 demo 用)
 * W7+ 阶段:接 ffmpeg 实现视频流压缩
 *
 * 不引入新 npm 依赖,用 Electron 内置 desktopCapturer + IPC。
 */
export class ScreenVision {
  private static instance: ScreenVision
  private log = LogManager.getInstance()
  private recording: RecordingState | null = null
  private fps: number = 1
  private maxFrames: number = 60

  private constructor() {}

  public static getInstance(): ScreenVision {
    if (!ScreenVision.instance) ScreenVision.instance = new ScreenVision()
    return ScreenVision.instance
  }

  async startRecording(fps = 1): Promise<void> {
    if (this.recording) {
      this.log.warn('ScreenVision: 已在录制中,先 stop')
      await this.stopRecording()
    }
    this.fps = fps
    this.recording = { frames: [], startedAt: Date.now(), fps }
    const intervalMs = 1000 / fps
    this.recording.timer = setInterval(() => void this.captureFrame(), intervalMs)
    this.log.info(`ScreenVision: 开始录制 ${fps}fps`)
  }

  async captureFrame(): Promise<ScreenFrame | null> {
    if (!this.recording) return null
    if (this.recording.frames.length >= this.maxFrames) {
      this.log.warn('ScreenVision: 达上限,自动停止')
      await this.stopRecording()
      return null
    }
    try {
      const { desktopCapturer } = await import('electron')
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 },
      })
      if (sources.length === 0) return null
      const source = sources[0]
      const img = source.thumbnail
      const dataUrl = img.toDataURL()
      const size = img.getSize()
      const frame: ScreenFrame = {
        ts: Date.now(),
        dataUrl,
        width: size.width,
        height: size.height,
        byteSize: Math.floor((dataUrl.length * 3) / 4),
      }
      this.recording.frames.push(frame)
      return frame
    } catch (e) {
      this.log.error('ScreenVision: 截屏失败', e)
      return null
    }
  }

  async stopRecording(): Promise<RecordingResult | null> {
    if (!this.recording) return null
    if (this.recording.timer) clearInterval(this.recording.timer)
    const frames = this.recording.frames
    const startedAt = this.recording.startedAt ?? Date.now()
    const endedAt = Date.now()
    const durationMs = endedAt - startedAt
    const result: RecordingResult = {
      frames,
      durationMs,
      startedAt,
      endedAt,
      fps: this.recording.fps,
    }
    this.recording = null
    this.log.info(`ScreenVision: 录制结束,${frames.length} 帧,${durationMs}ms`)
    return result
  }

  isRecording(): boolean {
    return this.recording !== null
  }

  // ============ W8 扩展:additive,不改既有方法 ============

  async captureAndAnalyze(opts: AnalyzeOptions = {}): Promise<{ frame: ScreenFrame; ocr?: OcrResult; understanding?: VisionUnderstanding; durationMs: number }> {
    const startMs = Date.now()
    const frame = await this.captureFrame()
    if (!frame) {
      throw new Error('ScreenVision: 截屏失败')
    }
    const result: { frame: ScreenFrame; ocr?: OcrResult; understanding?: VisionUnderstanding; durationMs: number } = {
      frame,
      durationMs: Date.now() - startMs,
    }
    if (opts.ocr !== false) {
      result.ocr = await this.ocrFrame(frame)
    }
    if (opts.understand !== false) {
      result.understanding = await this.understandFrame(frame)
    }
    return result
  }

  async ocrFrame(frame: ScreenFrame): Promise<OcrResult> {
    this.log.debug(`ScreenVision.ocrFrame: stub (frame ${frame.width}x${frame.height})`)
    return {
      text: '',
      confidence: 0,
      blocks: [],
    }
  }

  async understandFrame(frame: ScreenFrame): Promise<VisionUnderstanding> {
    this.log.debug(`ScreenVision.understandFrame: stub (frame ${frame.width}x${frame.height})`)
    return {
      description: '(W8 stub) 屏幕内容分析待 W9 接入 Ollama Vision',
      elements: [],
      clickable: [],
    }
  }
}

export interface OcrResult {
  text: string
  confidence: number
  blocks: Array<{ text: string; bbox: { x: number; y: number; w: number; h: number }; confidence: number }>
}

export interface VisionUnderstanding {
  description: string
  elements: Array<{ type: 'button' | 'input' | 'text' | 'image' | 'icon' | 'unknown'; bbox: { x: number; y: number; w: number; h: number }; text?: string }>
  /** 推断的"可点击区域" */
  clickable: Array<{ x: number; y: number; label?: string }>
}

export interface AnalyzeOptions {
  ocr?: boolean
  understand?: boolean
  model?: 'stub-rule-based' | 'ollama-llava' | 'openai-gpt4v'
}