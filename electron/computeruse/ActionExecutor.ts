import { LogManager } from '../core/LogManager'
import { BrowserWindow } from 'electron'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type ActionKind = 'click' | 'double-click' | 'type' | 'key-press' | 'scroll' | 'drag' | 'screenshot'

export interface ActionRequest {
  kind: ActionKind
  /** click / double-click / drag:目标坐标 */
  x?: number
  y?: number
  /** type:要输入的文本 */
  text?: string
  /** key-press:键名 (e.g. 'Enter', 'Tab', 'Escape', 'F5') */
  key?: string
  /** scroll:滚轮距离(正数向下) */
  deltaY?: number
  /** drag:拖拽终点 */
  toX?: number
  toY?: number
  /** 仅 Electron 模式:目标 window */
  windowId?: number
}

export interface ActionResult {
  ok: boolean
  actionId: string
  kind: ActionKind
  durationMs: number
  executed: boolean
  note?: string
  error?: string
}

/**
 * ActionExecutor: 键盘鼠标执行器
 * W8 阶段:stub 实现,所有 action 仅记录到 EventBus
 *         不真执行,需要用户手动确认(避免误触)
 * W9+ 阶段:用 robotjs / nut.js (W9 评估) 真正执行
 *
 * 注:不引入新依赖。本任务用 Electron 内置 webContents.sendInputEvent
 *     但 W8 阶段不真触发(只记录)。
 */
export class ActionExecutor {
  private static instance: ActionExecutor
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  /** 用户确认开关:false = 沙箱/手动确认;true = 自动执行(W8 默认 false) */
  private autoExecute: boolean = false

  private constructor() {}

  public static getInstance(): ActionExecutor {
    if (!ActionExecutor.instance) ActionExecutor.instance = new ActionExecutor()
    return ActionExecutor.instance
  }

  setAutoExecute(enabled: boolean): void {
    this.autoExecute = enabled
    this.log.warn(`ActionExecutor: autoExecute = ${enabled}`)
  }

  isAutoExecute(): boolean {
    return this.autoExecute
  }

  async execute(req: ActionRequest): Promise<ActionResult> {
    const actionId = randomUUID()
    const startMs = Date.now()
    this.log.info(`ActionExecutor: ${req.kind} ${JSON.stringify({ x: req.x, y: req.y, text: req.text?.slice(0, 30), key: req.key })}`)

    if (!this.autoExecute) {
      void this.bus.publish('action:requested', { actionId, kind: req.kind, args: req })
      return {
        ok: true,
        actionId,
        kind: req.kind,
        durationMs: Date.now() - startMs,
        executed: false,
        note: 'W8 stub: action 未真执行,需用户在 UI 确认后调 setAutoExecute(true) 或手动执行',
      }
    }

    try {
      const win = req.windowId
        ? BrowserWindow.fromId(req.windowId)
        : BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win) {
        return { ok: false, actionId, kind: req.kind, durationMs: Date.now() - startMs, executed: false, error: 'no BrowserWindow' }
      }
      const wc = win.webContents
      switch (req.kind) {
        case 'click':
          wc.sendInputEvent({ type: 'mouseMove', x: req.x ?? 0, y: req.y ?? 0 })
          wc.sendInputEvent({ type: 'mouseDown', x: req.x ?? 0, y: req.y ?? 0, button: 'left', clickCount: 1 })
          wc.sendInputEvent({ type: 'mouseUp', x: req.x ?? 0, y: req.y ?? 0, button: 'left', clickCount: 1 })
          break
        case 'double-click':
          wc.sendInputEvent({ type: 'mouseDown', x: req.x ?? 0, y: req.y ?? 0, button: 'left', clickCount: 2 })
          wc.sendInputEvent({ type: 'mouseUp', x: req.x ?? 0, y: req.y ?? 0, button: 'left', clickCount: 2 })
          break
        case 'type':
          if (req.text) {
            for (const ch of req.text) {
              wc.sendInputEvent({ type: 'char', keyCode: ch })
            }
          }
          break
        case 'key-press':
          if (req.key) wc.sendInputEvent({ type: 'keyDown', keyCode: req.key })
          if (req.key) wc.sendInputEvent({ type: 'keyUp', keyCode: req.key })
          break
        case 'scroll':
          wc.sendInputEvent({ type: 'mouseWheel', x: req.x ?? 0, y: req.y ?? 0, deltaX: 0, deltaY: req.deltaY ?? 0 })
          break
        case 'screenshot':
          break
        case 'drag':
          wc.sendInputEvent({ type: 'mouseMove', x: req.x ?? 0, y: req.y ?? 0 })
          wc.sendInputEvent({ type: 'mouseDown', x: req.x ?? 0, y: req.y ?? 0, button: 'left' })
          wc.sendInputEvent({ type: 'mouseMove', x: req.toX ?? 0, y: req.toY ?? 0 })
          wc.sendInputEvent({ type: 'mouseUp', x: req.toX ?? 0, y: req.toY ?? 0, button: 'left' })
          break
      }
      void this.bus.publish('action:executed', { actionId, kind: req.kind, args: req })
      return { ok: true, actionId, kind: req.kind, durationMs: Date.now() - startMs, executed: true }
    } catch (e) {
      void this.bus.publish('action:failed', { actionId, kind: req.kind, error: String(e) })
      return { ok: false, actionId, kind: req.kind, durationMs: Date.now() - startMs, executed: false, error: String(e) }
    }
  }
}
