# W8 — Computer 域 + A5 Computer Use demo Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 2 task)
> **执行窗口**:约 30-60 分钟
> **前置 commit**:`9ed4ac6` W7 docs(已合入 master)
> **目标 commit**:2 commit + 1 docs commit = **3 commit 全部由 subagent 自 commit**(短英文 message)
> **当前工作目录**:`D:\pipiclaw\piclaw`

> **职责分工**:
> - **subagent**:写 / 改 5 个文件,2 个 commit。**主会话只跑兜底测试 + 验收**,subagent 自己 git add + git commit。
> - **关键变更**:subagent 直接 commit(短 message,避免含特殊符号)

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W8 章节(L452-L484),做 2 件事:

| Task | 模块 | 文件 | commit |
|---|---|---|---|
| W8.1 | computer 域 3 文件 | ScreenVision 扩展(append-only) + ActionExecutor + ComputerUseHandler | 1 |
| W8.2 | A5 Computer Use v1 demo | A5ComputerUse.ts + A5ComputerUseDemo.vue + 1 route 追加 | 1 |
| **合计** | | **4 新文件 + 1 改 + 1 route** | **2** |

---

## 2. 必读现状(关键)

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W8 章节(L452-L484) | 权威定义 |
| `electron/computeruse/ScreenVision.ts`(W6.4 完成) | **既有 4 个方法 0 改动,只能追加新方法** |
| `electron/computeruse/index.ts`(W3.1 骨架) | W3.1 只有空 re-export,本任务不修改 |
| `electron/browser/BrowserManager.ts` | 1.0.0 已有 Playwright 浏览器控制(W6.4 ScreenVision 也用 desktopCapturer) |
| `electron/agent/AgentBrain.ts` W5.2.2 | AgentBrain 5 方法 think/call/spawn/checkpoint/restore |
| `electron/runtime/skill/SkillRuntime.ts` W4.5 | skill 注册机制 |
| `electron/skill/builtin/D1ScreenshotQA.ts` W5.3 | builtin 参考 |
| `electron/skill/builtin/D3RemoteCommand.ts` W7.4 | D3 demo 编排 ChannelRouter + AgentBrain + Connector 的参考 |
| `src/router/index.ts` | 既有 15 routes(W7.0.2 14 + W7.4 1),本任务末尾追加 1 route |
| `package.json` dependencies | **无 robotjs / nut.js / @nut-tree**——本任务不能引入新依赖 |

**关键约束**:
1. **不引入新 npm 依赖**。ActionExecutor 用 Electron 内置 API(`BrowserWindow.webContents.sendInputEvent` / `webContents.executeJavaScript`),不调系统级 input 模拟。
2. **W6.4 ScreenVision 既有 4 个方法 0 改动**(既有 caller 是 D5 demo `D5RecordingToSkill.ts`)。W8 在 ScreenVision 末尾**追加**新方法。
3. **不修改** ChatManager / IpcServer / preload / tokens / variables / contracts / 既有 view。
4. **A5 demo 走 ActionExecutor stub**:不真执行键盘鼠标,只记录到日志/EventBus,**真实执行由用户手动确认**(L1 隔离 + 权限校验留 W9+)。
5. **A5 view 末尾追加 1 route `/a5-demo`**(W7.0.2 既有 14 + W7.4 1 = 15 route 不动)。
6. **OCR / 图像理解 W8 阶段 stub**——只定义接口签名,真接 Tesseract.js / Ollama Vision 留 W9+。

---

## 3. 总体原则

- **2 个 commit 顺序执行**,每个完成后跑 `npx tsc --noEmit` + `npx vitest run` 验证
- **不引入新 npm 依赖**
- **commit message 短**(避免含特殊符号 `():`-`,`)
- **每 commit 自己跑 + 自己 add + 自己 commit**

---

## 4. Task W8.1 — computer 域 3 文件(1 commit)

### 4.1 文件清单

| 文件 | 状态 | 行数 |
|---|---|---|
| `electron/computeruse/ScreenVision.ts` | **改**(末尾追加新方法) | +150 行 |
| `electron/computeruse/ActionExecutor.ts` | 新建 | 150 行 |
| `electron/computeruse/ComputerUseHandler.ts` | 新建 | 200 行 |

### 4.2 `ScreenVision.ts` 末尾追加(0 改既有)

在文件末尾(`}` class 结束前)追加以下方法和类型:

```typescript
// ============ W8 扩展:additive,不改既有方法 ============

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

/**
 * 一次性截屏 + (可选) OCR + (可选) 图像理解
 * W8 阶段:OCR / 图像理解均 stub,W9+ 接 Tesseract / Ollama Vision
 */
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

/** OCR 单帧(W8 stub:返回空,W9+ 接 Tesseract) */
async ocrFrame(frame: ScreenFrame): Promise<OcrResult> {
  this.log.debug(`ScreenVision.ocrFrame: stub (frame ${frame.width}x${frame.height})`)
  return {
    text: '',
    confidence: 0,
    blocks: [],
  }
}

/** 图像理解(W8 stub:返回启发式 understanding,W9+ 接 Ollama Vision) */
async understandFrame(frame: ScreenFrame): Promise<VisionUnderstanding> {
  this.log.debug(`ScreenVision.understandFrame: stub (frame ${frame.width}x${frame.height})`)
  return {
    description: '(W8 stub) 屏幕内容分析待 W9 接入 Ollama Vision',
    elements: [],
    clickable: [],
  }
}
```

(把这段塞在 class `ScreenVision` 内部,放在 `isRecording()` 方法之后,class 结束 `}` 之前。)

**注意**:
- `captureFrame` / `startRecording` / `stopRecording` / `isRecording` 4 个方法 0 改动
- `RecordingState` interface 0 改动
- 类成员(private fields / log)0 改动
- 只在类内部末尾追加 3 个新方法 + 2 个新 interface 导出

### 4.3 `ActionExecutor.ts` — 键盘鼠标执行器(stub + Electron 内置)

```typescript
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
 * W8 阶段:stub 实现,所有 action 仅记录到 EventBus + 写入 userData/action-log.json
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
      // 沙箱/手动确认模式:不真执行,只记录
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

    // 自动执行模式:用 Electron 内置 webContents.sendInputEvent
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
          // no-op,真截屏用 ScreenVision
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
```

### 4.4 `ComputerUseHandler.ts` — 统一处理入口

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { ScreenVision } from './ScreenVision'
import { ActionExecutor, ActionRequest, ActionResult } from './ActionExecutor'
import { AgentBrainImpl, asAgentBrain } from '../agent/AgentBrain'
import { randomUUID } from 'node:crypto'

export interface ComputerUseTask {
  id: string
  /** 用户自然语言描述(例如 "打开浏览器") */
  instruction: string
  /** 最大步骤数(防无限循环) */
  maxSteps?: number
  /** 自动执行模式 */
  autoExecute?: boolean
}

export interface ComputerUseStep {
  stepIndex: number
  ts: number
  /** 屏幕理解结果 */
  understanding: string
  /** AgentBrain 决策 */
  decision: { action: string; payload: unknown }
  /** ActionExecutor 执行结果 */
  actionResult: ActionResult
  durationMs: number
}

export interface ComputerUseResult {
  ok: boolean
  taskId: string
  steps: ComputerUseStep[]
  finalOutput?: string
  totalDurationMs: number
  /** 是否达到 maxSteps 上限 */
  hitMaxSteps: boolean
  error?: string
}

/**
 * ComputerUseHandler: Computer Use 统一处理入口
 * 循环:截屏 → AgentBrain 思考 → ActionExecutor 执行 → 观察结果
 * W8 阶段:AgentBrain stub,W9+ 接真实 LLM
 */
export class ComputerUseHandler {
  private static instance: ComputerUseHandler
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private vision = ScreenVision.getInstance()
  private executor = ActionExecutor.getInstance()
  private brain = AgentBrainImpl.getInstance()

  private constructor() {}

  public static getInstance(): ComputerUseHandler {
    if (!ComputerUseHandler.instance) ComputerUseHandler.instance = new ComputerUseHandler()
    return ComputerUseHandler.instance
  }

  async run(task: ComputerUseTask): Promise<ComputerUseResult> {
    const taskId = task.id ?? randomUUID()
    const maxSteps = task.maxSteps ?? 5
    const startMs = Date.now()
    const steps: ComputerUseStep[] = []

    if (task.autoExecute) this.executor.setAutoExecute(true)

    this.log.info(`ComputerUseHandler: 启动 task ${taskId} (${task.instruction.slice(0, 40)})`)
    void this.bus.publish('computeruse:task:start', { taskId, instruction: task.instruction })

    for (let i = 0; i < maxSteps; i++) {
      const stepStartMs = Date.now()
      try {
        // 1. 截屏 + 图像理解
        const analysis = await this.vision.captureAndAnalyze({ ocr: true, understand: true })
        const understanding = analysis.understanding?.description ?? '(no description)'

        // 2. AgentBrain 思考
        const decision = await this.brain.think({ conversationId: taskId, content: `[step ${i + 1}] ${task.instruction} | screen: ${understanding.slice(0, 100)}` } as any)

        // 3. 解析 decision payload 为 ActionRequest
        const actionReq = this.decisionToAction(decision.action, decision.payload as any)
        let actionResult: ActionResult
        if (actionReq) {
          actionResult = await this.executor.execute(actionReq)
        } else {
          actionResult = { ok: true, actionId: 'noop-' + i, kind: 'screenshot' as any, durationMs: 0, executed: false, note: 'no action' }
        }

        const step: ComputerUseStep = {
          stepIndex: i,
          ts: Date.now(),
          understanding,
          decision: { action: decision.action, payload: decision.payload },
          actionResult,
          durationMs: Date.now() - stepStartMs,
        }
        steps.push(step)

        // 4. 检查终止
        if (decision.action === 'reply' || decision.action === 'stop') {
          this.log.info(`ComputerUseHandler: 任务 ${taskId} 终止于 step ${i + 1} (action=${decision.action})`)
          break
        }
      } catch (e) {
        this.log.error(`ComputerUseHandler: step ${i + 1} 失败`, e)
        return {
          ok: false,
          taskId,
          steps,
          totalDurationMs: Date.now() - startMs,
          hitMaxSteps: i + 1 >= maxSteps,
          error: String(e),
        }
      }
    }

    void this.bus.publish('computeruse:task:end', { taskId, stepCount: steps.length, ok: true })
    return {
      ok: true,
      taskId,
      steps,
      finalOutput: steps[steps.length - 1]?.understanding,
      totalDurationMs: Date.now() - startMs,
      hitMaxSteps: steps.length >= maxSteps,
    }
  }

  /** 把 AgentBrain decision 翻译成 ActionRequest */
  private decisionToAction(action: string, payload: any): ActionRequest | null {
    if (!payload) return null
    if (action === 'click' || action === 'double-click' || action === 'type' || action === 'key-press' || action === 'scroll' || action === 'drag' || action === 'screenshot') {
      return { kind: action, ...(payload as any) } as ActionRequest
    }
    if (action === 'call') {
      // payload = { name, args }
      const args = (payload as any).args ?? {}
      return { kind: args.kind ?? 'screenshot', ...args } as ActionRequest
    }
    return null
  }
}
```

### 4.5 自查清单

- [ ] ScreenVision.ts 既有 4 个方法(startRecording / captureFrame / stopRecording / isRecording)0 改动
- [ ] ScreenVision.ts 末尾追加 3 个新方法(captureAndAnalyze / ocrFrame / understandFrame)+ 3 个新 interface
- [ ] ActionExecutor.ts 完整实现,含 7 种 ActionKind,autoExecute 默认 false
- [ ] ComputerUseHandler.ts 完整实现,run() 含循环截屏+思考+执行
- [ ] tsc 0 错 + vitest 84/84

### 4.6 commit

```bash
git add electron/computeruse/ScreenVision.ts electron/computeruse/ActionExecutor.ts electron/computeruse/ComputerUseHandler.ts
git commit -m "feat(computer) ScreenVision extends + ActionExecutor + ComputerUseHandler"
```

---

## 5. Task W8.2 — A5 Computer Use v1 demo(1 commit)

### 5.1 文件清单

| 文件 | 状态 | 行数 |
|---|---|---|
| `electron/skill/builtin/A5ComputerUse.ts` | 新建 | 200 行 |
| `src/views/A5ComputerUseDemo.vue` | 新建 | 300 行 |
| `src/router/index.ts` | 末尾追加 1 route | +5 行 |

### 5.2 `electron/skill/builtin/A5ComputerUse.ts`

```typescript
import { LogManager } from '../../core/LogManager'
import { ComputerUseHandler, ComputerUseResult } from '../../computeruse/ComputerUseHandler'
import { EventBus } from '../../runtime/bridge/EventBus'
import { ActionExecutor } from '../../computeruse/ActionExecutor'
import { ScreenVision } from '../../computeruse/ScreenVision'

export const A5_SKILL_NAME = 'a5:computer-use-v1'

export interface A5Input {
  /** 用户自然语言描述(例如 "打开浏览器") */
  instruction: string
  /** 最大步数(默认 5) */
  maxSteps?: number
  /** 是否自动执行(默认 false,需用户在 UI 确认) */
  autoExecute?: boolean
}

/**
 * A5ComputerUse: A5 Computer Use v1 最小 demo
 * 流程:ComputerUseHandler.run() → 循环截屏+思考+执行
 * W8 stub:AgentBrain 决策固定返回 "screenshot" 之类的简单 action
 * W9+ 接真实 LLM
 */
export async function runA5(input: A5Input): Promise<{ ok: boolean; result?: ComputerUseResult; error?: string }> {
  const log = LogManager.getInstance()
  const handler = ComputerUseHandler.getInstance()
  const executor = ActionExecutor.getInstance()
  const vision = ScreenVision.getInstance()

  try {
    log.info(`A5ComputerUse: 启动 (${input.instruction.slice(0, 30)})`)
    if (input.autoExecute) {
      executor.setAutoExecute(true)
      log.warn('A5ComputerUse: autoExecute=true, 真实执行键盘鼠标')
    } else {
      log.info('A5ComputerUse: autoExecute=false,只记录(沙箱模式)')
    }
    // 单独预热一次 ScreenVision
    const frame = await vision.captureFrame()
    if (!frame) {
      return { ok: false, error: 'A5: 截屏失败,无可用屏幕' }
    }
    void EventBus.getInstance().publish('a5:start', { instruction: input.instruction, frameWidth: frame.width, frameHeight: frame.height })

    const result = await handler.run({ id: `a5-${Date.now()}`, instruction: input.instruction, maxSteps: input.maxSteps ?? 5, autoExecute: input.autoExecute })
    void EventBus.getInstance().publish('a5:done', { taskId: result.taskId, stepCount: result.steps.length, hitMaxSteps: result.hitMaxSteps })
    return { ok: true, result }
  } catch (e) {
    log.error('A5ComputerUse: 失败', e)
    return { ok: false, error: String(e) }
  }
}

export const a5SkillHandler = {
  name: A5_SKILL_NAME,
  description: 'Computer Use v1 最小 demo(看屏幕+思考+执行)',
  requiresPermission: true,  // 危险动作,需用户授权
  async execute(args: A5Input) {
    return runA5(args)
  },
}

/** W8.2 wire:由 main.ts 调用,把 A5 skill 注册到 SkillRuntime */
export function registerA5Skill(): void {
  const { SkillRuntime } = require('../../runtime/skill/SkillRuntime')
  SkillRuntime.getInstance().register({
    name: A5_SKILL_NAME,
    description: 'Computer Use v1 最小 demo',
    handler: async (args: any) => runA5(args as A5Input),
  })
}
```

### 5.3 `src/views/A5ComputerUseDemo.vue`

```vue
<template>
  <div class="a5-demo">
    <h2>A5 Computer Use v1 最小 Demo</h2>
    <p class="a5-hint">看屏幕 → Agent 思考 → 执行(默认沙箱模式,只记录不真执行)</p>

    <el-card class="a5-controls">
      <div class="a5-row">
        <el-input v-model="instruction" placeholder="自然语言指令(例如:打开浏览器)" />
      </div>
      <div class="a5-row">
        <span>最大步数: </span>
        <el-input-number v-model="maxSteps" :min="1" :max="20" :step="1" />
      </div>
      <div class="a5-row">
        <el-switch v-model="autoExecute" active-text="自动执行(危险)" inactive-text="沙箱(只记录)" />
      </div>
      <div class="a5-row a5-actions">
        <el-button type="primary" @click="runDemo" :loading="isRunning" :disabled="!canRun">
          启动 Computer Use
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastFrame" class="a5-frame">
      <h3>当前屏幕</h3>
      <img :src="lastFrame.dataUrl" :alt="`frame-${lastFrame.width}x${lastFrame.height}`" class="a5-img" />
      <p class="a5-meta">尺寸: {{ lastFrame.width }}x{{ lastFrame.height }} | 大小: {{ lastFrame.byteSize }} bytes</p>
    </el-card>

    <el-card v-if="lastResult" class="a5-result">
      <h3>执行结果</h3>
      <p v-if="lastResult.ok">
        <strong>步数:</strong> {{ lastResult.result?.steps?.length }}<br>
        <strong>是否到 maxSteps 上限:</strong> {{ lastResult.result?.hitMaxSteps ? '是' : '否' }}<br>
        <strong>总时长:</strong> {{ lastResult.result?.totalDurationMs }}ms
      </p>
      <p v-else class="a5-error">
        <strong>失败:</strong> {{ lastResult.error }}
      </p>
    </el-card>

    <el-card v-if="steps.length > 0" class="a5-steps">
      <h3>步骤详情</h3>
      <ul class="a5-step-list">
        <li v-for="(s, i) in steps" :key="i" class="a5-step">
          <strong>Step {{ s.stepIndex + 1 }}:</strong>
          <span class="a5-step-decision">decision: {{ s.decision.action }}</span>
          <span class="a5-step-result" :class="{ 'a5-step-ok': s.actionResult.ok, 'a5-step-fail': !s.actionResult.ok }">
            result: {{ s.actionResult.executed ? 'executed' : 'recorded' }} ({{ s.actionResult.durationMs }}ms)
          </span>
          <div class="a5-step-understanding">understanding: {{ s.understanding.slice(0, 200) }}</div>
        </li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const instruction = ref('打开浏览器')
const maxSteps = ref(5)
const autoExecute = ref(false)
const isRunning = ref(false)
const lastFrame = ref<{ dataUrl: string; width: number; height: number; byteSize: number } | null>(null)
const lastResult = ref<{ ok: boolean; result?: { steps: Array<{ stepIndex: number; understanding: string; decision: { action: string; payload: unknown }; actionResult: { ok: boolean; executed: boolean; durationMs: number; note?: string; error?: string } }>; hitMaxSteps: boolean; totalDurationMs: number }; error?: string } | null>(null)
const steps = ref<Array<{ stepIndex: number; understanding: string; decision: { action: string; payload: unknown }; actionResult: { ok: boolean; executed: boolean; durationMs: number; note?: string; error?: string } }>>([])

const canRun = computed(() => instruction.value.trim().length > 0)

async function runDemo() {
  isRunning.value = true
  try {
    // W8 stub:直接模拟一次"截屏 + 思考 + 执行"循环
    await new Promise(r => setTimeout(r, 200))
    lastFrame.value = {
      dataUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="24">[W8 stub screenshot]</text></svg>`),
      width: 800,
      height: 600,
      byteSize: 0,
    }

    const stubSteps = []
    for (let i = 0; i < maxSteps.value; i++) {
      stubSteps.push({
        stepIndex: i,
        understanding: `Step ${i + 1}: 屏幕内容(W8 stub)`,
        decision: { action: i === maxSteps.value - 1 ? 'reply' : 'screenshot', payload: {} },
        actionResult: {
          ok: true,
          executed: autoExecute.value,
          durationMs: 50 + i * 10,
          note: autoExecute.value ? 'executed' : 'W8 沙箱模式:仅记录',
        },
      })
    }

    steps.value = stubSteps
    lastResult.value = {
      ok: true,
      result: {
        steps: stubSteps,
        hitMaxSteps: stubSteps.length >= maxSteps.value,
        totalDurationMs: stubSteps.reduce((s, x) => s + x.actionResult.durationMs, 0),
      },
    }
  } finally {
    isRunning.value = false
  }
}
</script>

<style lang="scss" scoped>
.a5-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.a5-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.a5-row {
  margin-bottom: var(--space-md, 16px);
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
}

.a5-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.a5-frame, .a5-result, .a5-steps {
  margin-top: var(--space-lg, 24px);
}

.a5-img {
  max-width: 100%;
  border: 1px solid var(--border-color, #ddd);
  border-radius: var(--radius-sm, 4px);
}

.a5-meta {
  font-size: var(--font-size-caption-1, 11px);
  color: var(--text-secondary, #666);
  margin-top: var(--space-sm, 8px);
}

.a5-error {
  color: #c92a2a;
}

.a5-step-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.a5-step {
  padding: var(--space-sm, 8px) var(--space-md, 16px);
  border-left: 3px solid var(--accent-color, #007aff);
  background: var(--card-bg, #fafafa);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--space-sm, 8px);
  font-size: var(--font-size-caption-1, 11px);
  line-height: 1.6;
}

.a5-step-decision {
  margin-left: var(--space-sm, 8px);
  color: var(--text-secondary, #888);
  font-family: var(--font-family-mono, monospace);
}

.a5-step-result {
  margin-left: var(--space-sm, 8px);
  font-weight: 600;
}

.a5-step-ok {
  color: #16a34a;
}

.a5-step-fail {
  color: #c92a2a;
}

.a5-step-understanding {
  margin-top: var(--space-xs, 4px);
  color: var(--text-primary, #333);
  font-size: var(--font-size-caption-2, 9px);
}
</style>
```

### 5.4 末尾追加 A5 路由

读 `src/router/index.ts`,在 routes 数组末尾(W7.4 既有 `/d3-demo` 之后)追加 1 个:

```typescript
  {
    path: '/a5-demo',
    name: 'A5ComputerUseDemo',
    component: () => import('@/views/A5ComputerUseDemo.vue'),
  },
```

**注意**:既有 15 routes 0 改动,只末尾追加 1 个,共 16。

### 5.5 自查清单

- [ ] 2 个新文件 + 1 改(末尾追加 route)
- [ ] A5ComputerUse 编排 ScreenVision + ActionExecutor + ComputerUseHandler
- [ ] A5ComputerUseDemo.vue 用 Element Plus + Apple HIG tokens
- [ ] 默认 autoExecute=false(沙箱)
- [ ] tsc 0 错 + vitest 84/84

### 5.6 commit

```bash
git add electron/skill/builtin/A5ComputerUse.ts src/views/A5ComputerUseDemo.vue src/router/index.ts
git commit -m "feat(demo-a5) Computer Use v1 minimal loop"
```

---

## 6. subagent 工作流

```
1. Read 任务指令(本文件)
2. cd D:\pipiclaw\piclaw
3. 跑 git status 确认干净
4. Read 关键文件校准:
   - electron/computeruse/ScreenVision.ts 全文(W6.4 既有,末尾追加新方法)
   - electron/agent/AgentBrain.ts(AgentBrain 5 方法)
   - src/router/index.ts(W7 既有 15 route,末尾追加 1 个)
   - electron/skill/builtin/D1ScreenshotQA.ts / D3RemoteCommand.ts(demo builtin 参考)
5. W8.1: 改 ScreenVision 末尾追加 3 方法 + 写 ActionExecutor + 写 ComputerUseHandler → tsc + vitest → 1 commit
6. W8.2: 写 A5ComputerUse + A5ComputerUseDemo + 末尾追加 1 route → tsc + vitest → 1 commit
7. 最终 git log + 报告
```

---

## 7. 完成报告(返回内容)

1. **2 commit hash**(从 git log 读)
2. tsc 错误数(应保持 0)
3. vitest 通过数(应保持 84)
4. computeruse 目录文件数(应有 4:.gitkeep + index.ts + ScreenVision 改 + ActionExecutor + ComputerUseHandler)
5. router 改后 route 数(15 → 16)
6. 关键决策 / 难题 / 遗留未改项

---

## 8. 禁止事项

- **不引入** 任何新 npm 依赖
- **不修改** 既有 ChatManager / IpcServer / preload / tokens.css / variables.scss / contracts
- **不修改** 既有 view / component / store / SideNav
- **不修改** 既有 ScreenVision.ts 的 4 个方法(只能末尾追加)
- **不修改** 既有 W7.0.2 14 routes + W7.4 1 route(共 15,末尾追加 1 = 16)
- **不删除** / 不重命名任何文件
- **不跑 npm install**

---

## 9. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git log --oneline -3` 看 2 commit + 1 docs
2. `npx vitest run` 确认 84/84
3. `npx tsc --noEmit` 确认 0 错
4. 报告 W8 整体结果