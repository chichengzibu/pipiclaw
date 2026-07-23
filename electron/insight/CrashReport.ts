/**
 * PiPiClaw - CrashReport 收集器 (P5-T5.4)
 *
 * 监听 process 级 uncaughtException / unhandledRejection,记录到
 * userData/crash-reports/ 下,供用户 / 开发者下次启动时查看。
 *
 * 报告格式:JSON
 * {
 *   timestamp: ISO 时间
 *   type: 'uncaughtException' | 'unhandledRejection'
 *   error: { name, message, stack }
 *   appVersion, platform, arch, nodeVersion
 *   uptimeMs
 * }
 *
 * 同时:可选上传到 telemetry endpoint(默认禁用,需 opt-in)
 */

import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'

export interface CrashReportData {
  timestamp: string
  type: 'uncaughtException' | 'unhandledRejection' | 'render-process-gone'
  error: { name: string; message: string; stack?: string }
  context?: Record<string, unknown>
  appVersion: string
  platform: string
  arch: string
  nodeVersion: string
  uptimeMs: number
}

export class CrashReportCollector {
  private static instance: CrashReportCollector
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private reportsDir: string
  private startTime = Date.now()
  private installed = false

  private constructor() {
    this.reportsDir = path.join(app.getPath('userData'), 'crash-reports')
    this.ensureDir()
  }

  public static getInstance(): CrashReportCollector {
    if (!CrashReportCollector.instance) CrashReportCollector.instance = new CrashReportCollector()
    return CrashReportCollector.instance
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true })
    }
  }

  /**
   * 安装 process 级监听器
   */
  public install(): void {
    if (this.installed) return
    this.installed = true

    process.on('uncaughtException', (err: Error) => {
      this.record('uncaughtException', err)
    })
    process.on('unhandledRejection', (reason: unknown) => {
      const err =
        reason instanceof Error
          ? reason
          : new Error(`Unhandled rejection: ${String(reason)}`)
      this.record('unhandledRejection', err)
    })

    this.log.info('CrashReportCollector: installed (userData/crash-reports)')
  }

  /**
   * 记录一次 crash
   */
  public record(type: CrashReportData['type'], err: Error, context?: Record<string, unknown>): string {
    const id = `crash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const data: CrashReportData = {
      timestamp: new Date().toISOString(),
      type,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      context,
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptimeMs: Date.now() - this.startTime,
    }

    try {
      this.ensureDir()
      const filePath = path.join(this.reportsDir, `${id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      this.log.error(`CrashReportCollector: ${type} recorded to ${filePath}`)
      void this.bus.publish('crash:recorded', { id, type, message: err.message })
      return id
    } catch (e) {
      this.log.error('CrashReportCollector: write failed', e)
      return ''
    }
  }

  /**
   * 列出所有 crash 报告(按时间倒序)
   */
  public list(): Array<{ id: string; path: string; data: CrashReportData }> {
    this.ensureDir()
    const files = fs
      .readdirSync(this.reportsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
    return files
      .map((f) => {
        const fullPath = path.join(this.reportsDir, f)
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          return { id: f.replace('.json', ''), path: fullPath, data: JSON.parse(content) as CrashReportData }
        } catch {
          return null
        }
      })
      .filter((x): x is { id: string; path: string; data: CrashReportData } => x !== null)
  }

  /**
   * 读单个报告
   */
  public get(id: string): CrashReportData | null {
    const filePath = path.join(this.reportsDir, `${id}.json`)
    if (!fs.existsSync(filePath)) return null
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CrashReportData
    } catch {
      return null
    }
  }

  /**
   * 清掉所有报告
   */
  public clear(): number {
    this.ensureDir()
    const files = fs.readdirSync(this.reportsDir).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      fs.unlinkSync(path.join(this.reportsDir, f))
    }
    return files.length
  }

  /**
   * 报告数量
   */
  public count(): number {
    if (!fs.existsSync(this.reportsDir)) return 0
    return fs.readdirSync(this.reportsDir).filter((f) => f.endsWith('.json')).length
  }
}
