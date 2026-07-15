# W7 — Channel 域 + IM 11 通道 + Content 域 + D3 远程 demo Subagent 任务指令

> **执行方**:1 个 general_purpose_task subagent(串行执行 4 task)
> **执行窗口**:约 4-8 小时(W7 是 W1-W6 累计最大任务,33 文件 / 16 commit-ready 块)
> **前置 commit**:`7bd0535` W7.0 docs(已合入 master)
> **目标 commit**:16 commit + 1 docs commit = **17 commit 全部由 subagent 自 commit**(用短英文 message 避免含特殊符号)
> **当前工作目录**:`D:\pipiclaw\piclaw`

> **职责分工**:
> - **subagent**:写 33 个新 .ts/.vue 文件,**自己 git add + git commit**(短英文 message)。**不跑 npm install**。
> - **主会话(控制器)**:兜底 `npx vitest run` + `npx tsc --noEmit` + 总报告。

---

## 1. 一句话

按 plan `2026-07-10-pipiclaw-v2-plan.md` 的 W7 章节(L383-L449),做 4 件事:

| Task | 模块 | 新文件 | commit |
|---|---|---|---|
| W7.1 | channel 基础 8 文件 | ChannelTypes / ChannelRouter / IMConfigStore / IMMessageStore / IMMessageRouter / IMPermissionManager / IMSecurityManager / index.ts | 1 |
| W7.2 | IM 11 通道 | 3 真接(飞书/钉钉/企微)+ 8 占位 | 11(每通道 1 commit)|
| W7.3 | contentgen 11 文件(全 stub) | 4 渲染 + 1 图像 + 6 转换 | 3(分批) |
| W7.4 | D3 demo + CalendarConnector stub | D3RemoteCommand + D3RemoteDemo + CalendarConnector | 1 |
| **合计** | | **33 个新文件** | **16 commit** |

---

## 2. 必读现状(关键)

| 文件 | 重点 |
|---|---|
| `docs/superpowers/plans/2026-07-10-pipiclaw-v2-plan.md` W7 章节(L383-L449) | 权威定义 |
| `electron/contracts/types.ts` L89-95 | `interface Channel` / `ChannelMessage` / `MessageHandler` / `Disposable` / `ChannelHealth` |
| `electron/contracts/types.ts` L109-112 + 145-147 | `interface Connector` + `ConnectorIntent/Context/Result` |
| `electron/contracts/CapabilityRegistry.ts` | 域注册(本任务不调) |
| `electron/chat/ChatManager.ts` 906-963 | W4.6 接入点(本任务不直接调,只通过 AgentBrain) |
| `electron/agent/AgentBrain.ts` | AgentBrain 5 方法(W5.2.2) |
| `electron/runtime/bridge/EventBus.ts` | 事件总线(W7 全部用) |
| `electron/runtime/skill/SkillRuntime.ts` W4.5 | skill 注册(W7.4 D3 用) |
| `electron/skill/builtin/D1ScreenshotQA.ts` W5.3 + `D5RecordingToSkill.ts` W6.4 | demo builtin 参考模式 |
| `electron/views/`(=`src/views/`)| Vue 视图位置 |
| `src/router/index.ts` | 路由(W7.0.2 已加 d1-demo / d5-demo 14 routes,本任务 W7.4 D3 加新 route /d3-demo) |
| `package.json` dependencies | **只有 `docx` 8.5.0**,无 pdf/excel/pptx 库 |

**关键约束(关键!)**:
1. **不引入新 npm 依赖**。W7.3 contentgen 渲染器全部 stub(只返回 `{ stub: true }`)。
2. **W7.2 IM 11 通道**:只有 3 个(飞书/钉钉/企微)实现真发消息(用 fetch HTTP,需要 `appid/secret/token` 由 IMConfigStore 提供)。其余 8 个**只实现接口(完整签名 + 假数据),SDK 留空占位**。
3. **W7.4 D3 demo** 用 `CalendarConnector` —— 这是一个**W7 临时 stub**(接口完整,handler 假数据),W8+ 接真实 Calendar API。
4. **每通道 1 commit**,且**commit message 全部用短英文**(避免 PowerShell 解析问题)。
5. **W7.1 channel 基础 8 文件 commit message** 用 `feat(channel): base 8 files`。

---

## 3. 总体原则

- **不引入新 npm 依赖**。纯 node 内置 + electron 内置 + 项目内模块 + 已有的 `docx` 库。
- **不修改既有方法**。W7 全部是新建文件。
- **W7.2 IM 11 通道** 中,3 个真接的用 fetch HTTP,W7.1 IMConfigStore 提供配置加载逻辑(从 userData 读 im-config.json)。
- **W7.3 contentgen 全部 stub**:不调真实 docx/pdf 库,只 stub 返回文件路径或 `{ stub: true, format: 'docx' }`。
- **W7.4 D3 demo** 同时改 `src/router/index.ts` 末尾加 1 个 route `/d3-demo`(additive,W7.0.2 既有 14 route 0 改动)。
- **不修改 view / component / store**(除新建 D3RemoteDemo.vue + 末尾追加 1 route)。
- **不修改 IpcServer / preload / tokens.css / variables.scss / contracts**。
- **typecheck 0 错**。
- **vitest 84/84 不变**(本期不写新测试,但允许更新已有 test case 配合新 import 路径)。

---

## 4. Task W7.1 — channel 基础 8 文件(1 commit)

### 4.1 文件清单

```
electron/channel/ChannelTypes.ts               (~200 行)
electron/channel/IMConfigStore.ts              (~200 行)
electron/channel/IMMessageStore.ts             (~200 行)
electron/channel/IMPermissionManager.ts        (~200 行)
electron/channel/IMSecurityManager.ts          (~200 行)
electron/channel/IMMessageRouter.ts            (~250 行)
electron/channel/ChannelRouter.ts              (~300 行)
electron/channel/index.ts                      (~50 行 re-export)
```

### 4.2 `ChannelTypes.ts` — 通道类型定义

```typescript
import type { Channel, ChannelMessage, MessageHandler, Disposable, ChannelHealth } from '../contracts/types'
import { randomUUID } from 'node:crypto'

/** 通道种类 */
export type ChannelKind = 'im-feishu' | 'im-dingtalk' | 'im-wechat-work' | 'im-wechat' | 'im-qq' | 'im-telegram' | 'im-slack' | 'im-discord' | 'im-whatsapp' | 'im-lark' | 'im-rocket'

/** 通道元信息(注册到 ChannelRouter 用) */
export interface ChannelMetadata {
  id: string
  kind: ChannelKind
  displayName: string
  enabled: boolean
  createdAt: number
  /** 该通道的"是否在 routing 时考虑" */
  priority: number
  /** 该通道的鉴权信息(从 IMConfigStore 加载) */
  configRef: string  // IMConfigStore key
}

/** 通道路由规则:哪条消息去哪个通道 */
export interface RouteRule {
  id: string
  /** 触发条件:正则匹配消息内容(例如 "日程|schedule") */
  trigger: string
  /** 目标通道种类 */
  targetChannel: ChannelKind
  /** 目标接收者 userId/chatId */
  targetUserId: string
  /** 优先级(0-100) */
  priority: number
  enabled: boolean
}

/** 通道审计日志项 */
export interface ChannelAuditEntry {
  ts: number
  channelId: string
  action: 'send' | 'receive' | 'auth-fail' | 'permission-deny'
  ok: boolean
  detail?: string
}

/** 消息处理结果(通道收到消息后,经 permission + security 后产出) */
export interface ProcessedMessage {
  id: string
  channelId: string
  raw: ChannelMessage
  /** 是否通过 permission 校验 */
  allowed: boolean
  /** 是否通过 security 校验(无恶意) */
  sanitized: boolean
  /** 拒绝原因(若 allowed=false 或 sanitized=false) */
  rejectReason?: string
  /** 已过滤的纯净内容 */
  cleanContent?: string
  ts: number
}
```

### 4.3 `IMConfigStore.ts` — 通道鉴权信息存储

```typescript
import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { ChannelKind } from './ChannelTypes'

export interface IMConfig {
  channelKind: ChannelKind
  /** 各平台不同字段 */
  appId?: string
  appSecret?: string
  botToken?: string
  webhookUrl?: string
  /** 通用字段 */
  apiBaseUrl?: string
  accessToken?: string
  accessTokenExpiresAt?: number
  /** 元信息 */
  enabled: boolean
  updatedAt: number
}

/**
 * IMConfigStore: 各 IM 通道鉴权信息存储
 * 持久化到 userData/im-config.json
 * 提供 get(key) / set(key, config) / list() / remove(key)
 */
export class IMConfigStore {
  private static instance: IMConfigStore
  private log = LogManager.getInstance()
  private storePath: string
  private configs: Map<string, IMConfig> = new Map()

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'im-config.json')
    this.loadFromDisk()
  }

  public static getInstance(): IMConfigStore {
    if (!IMConfigStore.instance) IMConfigStore.instance = new IMConfigStore()
    return IMConfigStore.instance
  }

  get(channelKind: ChannelKind): IMConfig | undefined {
    return this.configs.get(channelKind)
  }

  set(channelKind: ChannelKind, patch: Partial<IMConfig>): void {
    const existing = this.configs.get(channelKind) ?? { channelKind, enabled: false, updatedAt: Date.now() }
    const next: IMConfig = { ...existing, ...patch, channelKind, updatedAt: Date.now() }
    this.configs.set(channelKind, next)
    this.persistToDisk()
    this.log.info(`IMConfigStore: ${channelKind} config updated`)
  }

  list(): IMConfig[] {
    return [...this.configs.values()]
  }

  remove(channelKind: ChannelKind): boolean {
    const ok = this.configs.delete(channelKind)
    if (ok) this.persistToDisk()
    return ok
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        const arr = JSON.parse(data) as IMConfig[]
        for (const c of arr) this.configs.set(c.channelKind, c)
      }
    } catch (e) {
      this.log.warn('IMConfigStore: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      const arr = [...this.configs.values()]
      fs.writeFileSync(this.storePath, JSON.stringify(arr, null, 2))
    } catch (e) {
      this.log.warn('IMConfigStore: persist failed', e)
    }
  }
}
```

### 4.4 `IMMessageStore.ts` — 消息存储

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ChannelMessage } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export interface StoredMessage {
  id: string
  channelId: string
  direction: 'in' | 'out'
  message: ChannelMessage
  ts: number
  conversationId?: string
}

/**
 * IMMessageStore: 内存 + 持久化消息存储(FIFO 上限 1000)
 * W7 阶段:内存 Map,W8+ 接 SQLite
 */
export class IMMessageStore {
  private static instance: IMMessageStore
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private messages: StoredMessage[] = []
  private maxMessages = 1000

  private constructor() {}

  public static getInstance(): IMMessageStore {
    if (!IMMessageStore.instance) IMMessageStore.instance = new IMMessageStore()
    return IMMessageStore.instance
  }

  record(channelId: string, direction: 'in' | 'out', message: ChannelMessage, conversationId?: string): StoredMessage {
    const m: StoredMessage = { id: randomUUID(), channelId, direction, message, ts: Date.now(), conversationId }
    this.messages.push(m)
    if (this.messages.length > this.maxMessages) this.messages.shift()
    void this.bus.publish('im:message:recorded', { id: m.id, channelId, direction }, 'IMMessageStore')
    return m
  }

  query(opts: { channelId?: string; direction?: 'in' | 'out'; sinceMs?: number; limit?: number } = {}): StoredMessage[] {
    let result = [...this.messages]
    if (opts.channelId) result = result.filter(m => m.channelId === opts.channelId)
    if (opts.direction) result = result.filter(m => m.direction === opts.direction)
    if (opts.sinceMs) result = result.filter(m => m.ts >= opts.sinceMs)
    return result.slice(-(opts.limit ?? 50))
  }

  getById(id: string): StoredMessage | undefined {
    return this.messages.find(m => m.id === id)
  }

  clear(): void {
    this.messages = []
  }
}
```

### 4.5 `IMPermissionManager.ts` — 通道权限管理

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ChannelMessage, ChannelKind } from './ChannelTypes'
import type { ChannelMessage as CM } from '../contracts/types'

/**
 * IMPermissionManager: 校验"谁可以对该通道说话/该通道可对谁说话"
 * W7 阶段:简单白名单(在内存 set 里)
 */
export class IMPermissionManager {
  private static instance: IMPermissionManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  /** channelKind → 允许的 userId/openId 列表 */
  private whitelist: Map<string, Set<string>> = new Map()

  private constructor() {}

  public static getInstance(): IMPermissionManager {
    if (!IMPermissionManager.instance) IMPermissionManager.instance = new IMPermissionManager()
    return IMPermissionManager.instance
  }

  grant(channelKind: ChannelKind, userId: string): void {
    const set = this.whitelist.get(channelKind) ?? new Set()
    set.add(userId)
    this.whitelist.set(channelKind, set)
    this.log.info(`IMPermissionManager: ${channelKind} 授权 ${userId}`)
  }

  revoke(channelKind: ChannelKind, userId: string): boolean {
    const set = this.whitelist.get(channelKind)
    if (!set) return false
    return set.delete(userId)
  }

  check(channelKind: ChannelKind, userId: string): boolean {
    const set = this.whitelist.get(channelKind)
    if (!set || set.size === 0) return true  // 空白名单 = 全允许
    return set.has(userId)
  }

  isAllowed(message: ChannelMessage, channelKind: ChannelKind): boolean {
    return this.check(channelKind, message.to)
  }

  listWhitelist(channelKind: ChannelKind): string[] {
    return [...(this.whitelist.get(channelKind) ?? new Set())]
  }
}
```

### 4.6 `IMSecurityManager.ts` — 消息安全检查

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ChannelMessage } from '../contracts/types'
import type { ProcessedMessage } from './ChannelTypes'
import { randomUUID } from 'node:crypto'

const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /data:text\/html/i,
  /\bexec\b.*\b(rm|rm -rf|del)\b/i,
]

/**
 * IMSecurityManager: 消息安全过滤(防 XSS / 命令注入 / 恶意 payload)
 * W7 阶段:简单正则黑名单
 * W8+ 接专业清洗库(DOMPurify / sanitize-html)
 */
export class IMSecurityManager {
  private static instance: IMSecurityManager
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()

  private constructor() {}

  public static getInstance(): IMSecurityManager {
    if (!IMSecurityManager.instance) IMSecurityManager.instance = new IMSecurityManager()
    return IMSecurityManager.instance
  }

  /**
   * 校验 + 清洗一条消息
   * 返回 ProcessedMessage:allowed + sanitized
   */
  process(message: ChannelMessage, channelId: string): ProcessedMessage {
    const text = message.text ?? ''
    const dangerous: string[] = []
    for (const p of DANGEROUS_PATTERNS) {
      if (p.test(text)) dangerous.push(p.source)
    }
    const sanitized = dangerous.length === 0
    const cleanContent = sanitized ? text : this.sanitize(text)
    return {
      id: randomUUID(),
      channelId,
      raw: message,
      allowed: true,
      sanitized,
      cleanContent,
      rejectReason: sanitized ? undefined : `检测到危险模式: ${dangerous.join(', ')}`,
      ts: Date.now(),
    }
  }

  private sanitize(text: string): string {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, '[script-removed]')
      .replace(/javascript:/gi, 'js-blocked:')
      .replace(/data:text\/html/gi, 'data-blocked:')
  }
}
```

### 4.7 `IMMessageRouter.ts` — 消息路由

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { IMMessageStore } from './IMMessageStore'
import { IMPermissionManager } from './IMPermissionManager'
import { IMSecurityManager } from './IMSecurityManager'
import type { ChannelMessage, ChannelKind } from './ChannelTypes'
import type { ProcessedMessage } from './ChannelTypes'
import type { RouteRule } from './ChannelTypes'

/**
 * IMMessageRouter: 收到一条消息 → permission + security + routing 决策
 * 不直接调 Channel.send(),由 ChannelRouter 负责
 */
export class IMMessageRouter {
  private static instance: IMMessageRouter
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private messageStore = IMMessageStore.getInstance()
  private permission = IMPermissionManager.getInstance()
  private security = IMSecurityManager.getInstance()
  private rules: RouteRule[] = []

  private constructor() {}

  public static getInstance(): IMMessageRouter {
    if (!IMMessageRouter.instance) IMMessageRouter.instance = new IMMessageRouter()
    return IMMessageRouter.instance
  }

  addRule(rule: RouteRule): void {
    this.rules.push(rule)
    this.log.info(`IMMessageRouter: 加规则 ${rule.id} (${rule.trigger} → ${rule.targetChannel})`)
  }

  removeRule(id: string): boolean {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx < 0) return false
    this.rules.splice(idx, 1)
    return true
  }

  listRules(): RouteRule[] {
    return [...this.rules]
  }

  /** 处理一条收到的消息:permission + security + match route */
  async handleIncoming(channelId: string, channelKind: ChannelKind, msg: ChannelMessage): Promise<{ allowed: boolean; sanitized: boolean; matchedRule?: RouteRule; rejectReason?: string; cleanContent?: string }> {
    // 1. record
    this.messageStore.record(channelId, 'in', msg)
    // 2. permission
    const allowed = this.permission.isAllowed(msg, channelKind)
    if (!allowed) {
      void this.bus.publish('im:message:denied', { channelId, reason: 'permission' })
      return { allowed: false, sanitized: true, rejectReason: `permission denied for user ${msg.to}` }
    }
    // 3. security
    const processed: ProcessedMessage = this.security.process(msg, channelId)
    if (!processed.sanitized) {
      void this.bus.publish('im:message:denied', { channelId, reason: 'security' })
      return { allowed: true, sanitized: false, rejectReason: processed.rejectReason }
    }
    // 4. match route rule
    const matched = this.matchRule(processed.cleanContent ?? '')
    if (!matched) {
      return { allowed: true, sanitized: true, rejectReason: 'no matching route rule' }
    }
    return { allowed: true, sanitized: true, matchedRule: matched, cleanContent: processed.cleanContent }
  }

  private matchRule(text: string): RouteRule | undefined {
    for (const rule of this.rules.sort((a, b) => b.priority - a.priority)) {
      if (!rule.enabled) continue
      try {
        const re = new RegExp(rule.trigger)
        if (re.test(text)) return rule
      } catch (e) {
        this.log.warn(`IMMessageRouter: rule ${rule.id} invalid regex ${rule.trigger}`, e)
      }
    }
    return undefined
  }
}
```

### 4.8 `ChannelRouter.ts` — 通道路由器

```typescript
import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { IMMessageRouter } from './IMMessageRouter'
import type { Channel, ChannelMessage, ChannelHealth, Disposable, MessageHandler } from '../contracts/types'
import type { ChannelMetadata, ChannelKind } from './ChannelTypes'

/**
 * ChannelRouter: 管理所有 Channel 实例,提供统一入口
 * - register / unregister channel
 * - send via channel id
 * - subscribe message via channel id
 * - list / get metadata
 */
export class ChannelRouter {
  private static instance: ChannelRouter
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private messageRouter = IMMessageRouter.getInstance()
  private channels: Map<string, Channel> = new Map()
  private metadata: Map<string, ChannelMetadata> = new Map()
  private handlers: Map<string, MessageHandler> = new Map()

  private constructor() {}

  public static getInstance(): ChannelRouter {
    if (!ChannelRouter.instance) ChannelRouter.instance = new ChannelRouter()
    return ChannelRouter.instance
  }

  /** 注册一个 channel 实例 */
  register(channel: Channel, meta: Omit<ChannelMetadata, 'createdAt'>): void {
    if (this.channels.has(channel.id)) {
      this.log.warn(`ChannelRouter: ${channel.id} 重复注册,覆盖`)
    }
    this.channels.set(channel.id, channel)
    this.metadata.set(channel.id, { ...meta, createdAt: Date.now() })
    // 订阅 channel 收到的消息
    channel.onMessage(async (msg) => {
      const meta = this.metadata.get(channel.id)
      if (!meta) return
      const result = await this.messageRouter.handleIncoming(channel.id, meta.kind, msg)
      this.bus.publish('im:channel:incoming', { channelId: channel.id, ...result })
    })
    this.log.info(`ChannelRouter: 注册 ${channel.id} (${meta.kind})`)
  }

  unregister(channelId: string): boolean {
    const ok1 = this.channels.delete(channelId)
    const ok2 = this.metadata.delete(channelId)
    this.handlers.delete(channelId)
    return ok1 || ok2
  }

  get(channelId: string): Channel | undefined {
    return this.channels.get(channelId)
  }

  getMetadata(channelId: string): ChannelMetadata | undefined {
    return this.metadata.get(channelId)
  }

  listMetadata(): ChannelMetadata[] {
    return [...this.metadata.values()]
  }

  listByKind(kind: ChannelKind): ChannelMetadata[] {
    return [...this.metadata.values()].filter(m => m.kind === kind)
  }

  /** 通过 channelId 发送消息 */
  async send(channelId: string, message: ChannelMessage): Promise<{ ok: boolean; error?: string }> {
    const channel = this.channels.get(channelId)
    if (!channel) return { ok: false, error: `channel ${channelId} not found` }
    try {
      await channel.send(message)
      void this.bus.publish('im:channel:send:ok', { channelId })
      return { ok: true }
    } catch (e) {
      void this.bus.publish('im:channel:send:fail', { channelId, error: String(e) })
      return { ok: false, error: String(e) }
    }
  }

  /** 订阅 channel 收到的事件(已通过 IMMessageRouter 处理) */
  subscribeChannel(channelId: string, handler: MessageHandler): void {
    this.handlers.set(channelId, handler)
  }

  /** 健康检查所有 channel */
  async healthCheckAll(): Promise<Record<string, ChannelHealth>> {
    const result: Record<string, ChannelHealth> = {}
    for (const [id, channel] of this.channels) {
      try {
        result[id] = await channel.healthCheck()
      } catch (e) {
        result[id] = { healthy: false, error: String(e) }
      }
    }
    return result
  }
}
```

### 4.9 `index.ts` — re-export

```typescript
export { ChannelRouter } from './ChannelRouter'
export type { ChannelMetadata, ChannelKind, RouteRule, ChannelAuditEntry, ProcessedMessage, StoredMessage } from './ChannelTypes'
export { IMConfigStore } from './IMConfigStore'
export type { IMConfig } from './IMConfigStore'
export { IMMessageStore } from './IMMessageStore'
export { IMPermissionManager } from './IMPermissionManager'
export { IMSecurityManager } from './IMSecurityManager'
export { IMMessageRouter } from './IMMessageRouter'
```

### 4.10 自查清单

- [ ] 8 个文件齐全
- [ ] ChannelTypes 完整类型定义
- [ ] IMConfigStore 持久化到 userData/im-config.json
- [ ] IMMessageStore 内存 Map + FIFO 1000
- [ ] IMPermissionManager 白名单
- [ ] IMSecurityManager 4 个 DANGEROUS_PATTERNS
- [ ] IMMessageRouter handleIncoming 4 步流程
- [ ] ChannelRouter register + send + healthCheckAll
- [ ] tsc 0 错

### 4.11 commit

```bash
git add electron/channel/ChannelTypes.ts electron/channel/IMConfigStore.ts electron/channel/IMMessageStore.ts electron/channel/IMPermissionManager.ts electron/channel/IMSecurityManager.ts electron/channel/IMMessageRouter.ts electron/channel/ChannelRouter.ts electron/channel/index.ts
git commit -m "feat(channel): base 8 files"
```

---

## 5. Task W7.2 — IM 11 通道(11 commit)

每个通道 1 commit。每个通道是 1 个 .ts 文件,200-400 行,实现 contracts Channel 接口。

### 5.1 通道清单

| 通道 | 真实/占位 | 行数估计 |
|---|---|---|
| FeishuChannel | 真实(用 fetch) | 350 |
| DingTalkChannel | 真实(用 fetch) | 350 |
| WechatWorkChannel | 真实(用 fetch) | 350 |
| WeChatChannel | 占位 | 200 |
| QQChannel | 占位 | 200 |
| TelegramChannel | 占位 | 200 |
| SlackChannel | 占位 | 200 |
| DiscordChannel | 占位 | 200 |
| WhatsAppChannel | 占位 | 200 |
| LarkChannel | 占位 | 200 |
| RocketChannel | 占位 | 200 |

### 5.2 真实通道模板(以 FeishuChannel 为例)

```typescript
import { LogManager } from '../core/LogManager'
import { IMConfigStore } from './IMConfigStore'
import { EventBus } from '../runtime/bridge/EventBus'
import type { Channel, ChannelMessage, MessageHandler, Disposable, ChannelHealth } from '../contracts/types'

/**
 * FeishuChannel: 飞书 IM 通道(真实 fetch 实现)
 * 飞书 API: https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
 * 鉴权: appId + appSecret → tenant_access_token
 * 发消息: https://open.feishu.cn/open-apis/im/v1/messages
 */
export class FeishuChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private configStore = IMConfigStore.getInstance()
  private bus = EventBus.getInstance()
  private accessToken: string | null = null
  private accessTokenExpiresAt = 0
  private handlers: MessageHandler[] = []

  constructor(id: string = 'feishu-main') {
    this.id = id
  }

  async send(msg: ChannelMessage): Promise<void> {
    const config = this.configStore.get('im-feishu')
    if (!config?.enabled) {
      throw new Error('FeishuChannel: 通道未启用或未配置')
    }
    const token = await this.getAccessToken()
    if (!token) {
      throw new Error('FeishuChannel: accessToken 获取失败')
    }
    const body = {
      receive_id: msg.to,
      msg_type: msg.text ? 'text' : 'post',
      content: JSON.stringify({ text: msg.text ?? '' }),
    }
    const res = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`FeishuChannel: HTTP ${res.status} ${errText.slice(0, 200)}`)
    }
    this.log.info(`FeishuChannel: 消息已发送到 ${msg.to}`)
  }

  onMessage(handler: MessageHandler): Disposable {
    this.handlers.push(handler)
    return {
      dispose: () => {
        const idx = this.handlers.indexOf(handler)
        if (idx >= 0) this.handlers.splice(idx, 1)
      },
    }
  }

  /** W7 阶段没有真实 WebSocket 收消息;此方法只供测试时 push */
  __pushIncoming(msg: ChannelMessage): void {
    for (const h of this.handlers) {
      void h(msg)
    }
  }

  async healthCheck(): Promise<ChannelHealth> {
    const config = this.configStore.get('im-feishu')
    if (!config?.enabled) {
      return { healthy: false, error: 'not configured' }
    }
    const startMs = Date.now()
    try {
      const token = await this.getAccessToken()
      if (!token) return { healthy: false, error: 'auth fail' }
      return { healthy: true, latencyMs: Date.now() - startMs }
    } catch (e) {
      return { healthy: false, error: String(e) }
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const config = this.configStore.get('im-feishu')
    if (!config?.appId || !config?.appSecret) return null
    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken
    }
    const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
    })
    if (!res.ok) return null
    const data: any = await res.json()
    if (data.code !== 0) {
      this.log.warn(`FeishuChannel: auth fail ${data.msg}`)
      return null
    }
    this.accessToken = data.tenant_access_token
    this.accessTokenExpiresAt = Date.now() + (data.expire * 1000)
    return this.accessToken
  }
}
```

### 5.3 DingTalk / WechatWorkChannel 真实通道

参照 FeishuChannel 模板,改 API endpoint:
- **DingTalkChannel**:`https://oapi.dingtalk.com/gettoken`(appKey/appSecret) + `https://oapi.dingtalk.com/robot/oos/send`(robot 发送)
- **WechatWorkChannel**:`https://qyapi.weixin.qq.com/cgi-bin/gettoken`(corpid/corpsecret) + `https://qyapi.weixin.qq.com/cgi-bin/message/send/send_app_msg`(应用消息)

每通道 350 行。

### 5.4 占位通道模板(以 WeChatChannel 为例)

```typescript
import { LogManager } from '../core/LogManager'
import type { Channel, ChannelMessage, MessageHandler, Disposable, ChannelHealth } from '../contracts/types'

/**
 * WeChatChannel: 微信公众号通道(占位,W8+ 接 SDK)
 * W7 阶段:仅实现 Channel 接口,所有调用为 stub
 * 真实 SDK: wechat / wechaty (W8+ 评估)
 */
export class WeChatChannel implements Channel {
  public readonly id: string
  private log = LogManager.getInstance()
  private handlers: MessageHandler[] = []

  constructor(id: string = 'wechat-mp') {
    this.id = id
  }

  async send(msg: ChannelMessage): Promise<void> {
    this.log.warn(`WeChatChannel: 占位 stub,W8+ 接入真实 SDK`)
    return
  }

  onMessage(handler: MessageHandler): Disposable {
    this.handlers.push(handler)
    return {
      dispose: () => {
        const idx = this.handlers.indexOf(handler)
        if (idx >= 0) this.handlers.splice(idx, 1)
      },
    }
  }

  __pushIncoming(msg: ChannelMessage): void {
    for (const h of this.handlers) {
      void h(msg)
    }
  }

  async healthCheck(): Promise<ChannelHealth> {
    return { healthy: false, error: 'W7 stub: W8+ integrate wechaty SDK' }
  }
}
```

### 5.5 占位通道 8 个清单

| 文件 | ChannelKind | id default |
|---|---|---|
| WeChatChannel.ts | im-wechat | wechat-mp |
| QQChannel.ts | im-qq | qq-main |
| TelegramChannel.ts | im-telegram | telegram-main |
| SlackChannel.ts | im-slack | slack-main |
| DiscordChannel.ts | im-discord | discord-main |
| WhatsAppChannel.ts | im-whatsapp | whatsapp-main |
| LarkChannel.ts | im-lark | lark-main |
| RocketChannel.ts | im-rocket | rocket-main |

### 5.6 自查清单(每个通道 1 commit)

- [ ] 11 个通道齐全(3 真实 + 8 占位)
- [ ] 真实通道用 fetch 实现 send + getAccessToken + healthCheck
- [ ] 占位通道 stub 实现,log.warn 标识 W8+ 接入
- [ ] 每个通道 `implements Channel`(id / send / onMessage / healthCheck)
- [ ] 每个通道 onMessage 返回 Disposable
- [ ] tsc 0 错

### 5.7 11 个 commit(每个 1 通道)

```bash
git add electron/channel/FeishuChannel.ts
git commit -m "feat(channel): FeishuChannel real implementation"
git add electron/channel/DingTalkChannel.ts
git commit -m "feat(channel): DingTalkChannel real implementation"
git add electron/channel/WechatWorkChannel.ts
git commit -m "feat(channel): WechatWorkChannel real implementation"
git add electron/channel/WeChatChannel.ts
git commit -m "feat(channel): WeChatChannel stub"
git add electron/channel/QQChannel.ts
git commit -m "feat(channel): QQChannel stub"
git add electron/channel/TelegramChannel.ts
git commit -m "feat(channel): TelegramChannel stub"
git add electron/channel/SlackChannel.ts
git commit -m "feat(channel): SlackChannel stub"
git add electron/channel/DiscordChannel.ts
git commit -m "feat(channel): DiscordChannel stub"
git add electron/channel/WhatsAppChannel.ts
git commit -m "feat(channel): WhatsAppChannel stub"
git add electron/channel/LarkChannel.ts
git commit -m "feat(channel): LarkChannel stub"
git add electron/channel/RocketChannel.ts
git commit -m "feat(channel): RocketChannel stub"
```

---

## 6. Task W7.3 — contentgen 11 文件(3 commit,全 stub)

### 6.1 文件清单 + 3 批 commit

**批次 1: 4 渲染器**
```
electron/contentgen/DocxRenderer.ts  (~150 行)
electron/contentgen/PdfRenderer.ts  (~120 行)
electron/contentgen/PptxRenderer.ts (~120 行)
electron/contentgen/XlsxRenderer.ts (~120 行)
```

**批次 2: 1 图像生成**
```
electron/contentgen/ImageGenHandler.ts (~200 行)
```

**批次 3: 6 格式转换器**
```
electron/contentgen/md2docx.ts (~80 行)
electron/contentgen/md2pdf.ts  (~80 行)
electron/contentgen/md2pptx.ts (~80 行)
electron/contentgen/md2xlsx.ts (~80 行)
electron/contentgen/html2pdf.ts (~80 行)
electron/contentgen/html2pptx.ts (~80 行)
```

### 6.2 渲染器模板(DocxRenderer)

```typescript
import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

export interface RenderRequest {
  /** 源 markdown 文本 */
  source: string
  /** 输出文件路径(可选;不填则自动 userData/output/{uuid}.docx) */
  outputPath?: string
  /** 模板路径(可选) */
  templatePath?: string
  /** 标题 */
  title?: string
  /** 作者 */
  author?: string
}

export interface RenderResult {
  ok: boolean
  format: 'docx' | 'pdf' | 'pptx' | 'xlsx'
  outputPath?: string
  sizeBytes?: number
  error?: string
  stub: boolean
}

/**
 * DocxRenderer: 把 markdown 渲染成 .docx
 * W7 阶段:stub 实现(返回 { stub: true }),W8+ 用 docx 库实装
 * 
 * 注意:package.json 已有 docx 8.5.0 依赖,可以真接 docx 库。
 * W7 简化:本期仍用 stub,W8+ 整合 docx Document/Packer/HeadingLevel。
 */
export class DocxRenderer {
  private static instance: DocxRenderer
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): DocxRenderer {
    if (!DocxRenderer.instance) DocxRenderer.instance = new DocxRenderer()
    return DocxRenderer.instance
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const format = 'docx'
    try {
      const outPath = req.outputPath ?? path.join(app.getPath('userData'), 'output', `${Date.now()}.${format}`)
      // 简单 stub:把源文本写入文件
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, req.source, 'utf-8')
      const sizeBytes = fs.statSync(outPath).size
      this.log.info(`DocxRenderer: stub rendered ${outPath} (${sizeBytes} bytes)`)
      return { ok: true, format, outputPath: outPath, sizeBytes, stub: true }
    } catch (e) {
      return { ok: false, format, error: String(e), stub: true }
    }
  }
}
```

### 6.3 PdfRenderer / PptxRenderer / XlsxRenderer

参照 DocxRenderer 模板,改 format 字段、文件扩展名。PdfRenderer 输出 `.pdf`,PptxRenderer 输出 `.pptx`,XlsxRenderer 输出 `.xlsx`。

### 6.4 ImageGenHandler

```typescript
import { LogManager } from '../core/LogManager'

export type ImageGenProvider = 'openai-dalle' | 'stability-sd' | 'volcengine-jimeng' | 'aliyun-tongyi' | 'mock'

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
      // mock: 返回 dataUrl placeholder
      const images = Array.from({ length: count }, (_, i) => ({
        url: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${req.width ?? 512}" height="${req.height ?? 512}"><text x="50%" y="50%" text-anchor="middle" dy=".3em">mock-${i}</text></svg>`).toString('base64')}`,
        revisedPrompt: req.prompt,
      }))
      return { ok: true, provider, images, stub: false }
    }
    // 其他 provider: stub
    this.log.warn(`ImageGenHandler: provider ${provider} W7 stub,W8+ 接入`)
    return { ok: true, provider, images: [], stub: true }
  }
}
```

### 6.5 格式转换器模板(md2docx)

```typescript
import { DocxRenderer } from './DocxRenderer'
import type { RenderRequest, RenderResult } from './DocxRenderer'

/**
 * md2docx: markdown → docx 转换
 * W7 stub:用 DocxRenderer.render 简单把 md 文本当源
 */
export async function md2docx(source: string, opts: Partial<RenderRequest> = {}): Promise<RenderResult> {
  return DocxRenderer.getInstance().render({ source, ...opts })
}
```

### 6.6 6 个格式转换器(全部 stub)

| 文件 | 入口函数 | 调用的 renderer |
|---|---|---|
| md2docx.ts | `md2docx(source, opts)` | DocxRenderer |
| md2pdf.ts | `md2pdf(source, opts)` | PdfRenderer |
| md2pptx.ts | `md2pptx(source, opts)` | PptxRenderer |
| md2xlsx.ts | `md2xlsx(source, opts)` | XlsxRenderer |
| html2pdf.ts | `html2pdf(html, opts)` | PdfRenderer |
| html2pptx.ts | `html2pptx(html, opts)` | PptxRenderer |

### 6.7 自查清单

- [ ] 11 个文件齐全(4 渲染 + 1 图像 + 6 转换)
- [ ] 渲染器 stub,返回 `{ ok, format, outputPath, stub: true }`
- [ ] ImageGenHandler 6 provider(mock 真实可调 + 5 stub)
- [ ] 6 转换器 thin wrapper,调对应 renderer
- [ ] tsc 0 错

### 6.8 3 个 commit(分批)

```bash
# 批次 1
git add electron/contentgen/DocxRenderer.ts electron/contentgen/PdfRenderer.ts electron/contentgen/PptxRenderer.ts electron/contentgen/XlsxRenderer.ts
git commit -m "feat(contentgen): 4 doc renderers"
# 批次 2
git add electron/contentgen/ImageGenHandler.ts
git commit -m "feat(contentgen): ImageGenHandler"
# 批次 3
git add electron/contentgen/md2docx.ts electron/contentgen/md2pdf.ts electron/contentgen/md2pptx.ts electron/contentgen/md2xlsx.ts electron/contentgen/html2pdf.ts electron/contentgen/html2pptx.ts
git commit -m "feat(contentgen): 6 format converters"
```

---

## 7. Task W7.4 — D3 一句话远程 demo(1 commit)

### 7.1 文件清单

```
electron/connector/CalendarConnector.ts       (~200 行,W7 临时 stub,W8+ 接真实 API)
electron/skill/builtin/D3RemoteCommand.ts    (~250 行)
src/views/D3RemoteDemo.vue                   (~300 行)
```

### 7.2 `electron/connector/CalendarConnector.ts`

W7 阶段:目录还不存在,Write 工具会创建。stub 实现 Connector 接口,W8 接真实 Calendar API。

```typescript
import { LogManager } from '../core/LogManager'
import type { Connector, ConnectorIntent, ConnectorContext, ConnectorResult } from '../contracts/types'

/**
 * CalendarConnector: 日历连接器(W7 stub,W8+ 接真实 API)
 * W7 阶段:提供"今天日程"假数据,3 个常见 verb:
 *  - list_today: 列出今日日程
 *  - list_upcoming: 列出 N 天内日程
 *  - add_event: 添加日程
 *  - find_free_slot: 找空闲时段
 */
export class CalendarConnector implements Connector {
  public readonly id: string = 'calendar'
  private log = LogManager.getInstance()

  async execute(intent: ConnectorIntent, ctx: ConnectorContext): Promise<ConnectorResult> {
    this.log.info(`CalendarConnector: execute ${intent.verb} (stub)`)
    switch (intent.verb) {
      case 'list_today':
        return { ok: true, data: [
          { id: 'e1', title: '今日会议', start: '10:00', end: '11:00' },
          { id: 'e2', title: '午休', start: '12:00', end: '13:00' },
          { id: 'e3', title: '项目复盘', start: '15:00', end: '16:00' },
        ] }
      case 'list_upcoming': {
        const days = (intent.args.days as number) ?? 7
        return { ok: true, data: [
          { id: 'e1', title: '明日', start: 'tomorrow 09:00' },
          { id: 'e2', title: '本周会议', start: 'Friday 14:00' },
          { id: 'e3', title: `接下来 ${days} 天内还有 3 个日程`, start: 'W8+ stub' },
        ] }
      }
      case 'add_event':
        return { ok: true, data: { id: 'new-' + Date.now(), title: intent.args.title, start: intent.args.start } }
      case 'find_free_slot': {
        const duration = (intent.args.duration as number) ?? 60  // minutes
        return { ok: true, data: { slot: '14:00-15:00', durationMinutes: duration } }
      }
      default:
        return { ok: false, error: `unknown verb: ${intent.verb}` }
    }
  }
}
```

### 7.3 `electron/skill/builtin/D3RemoteCommand.ts`

```typescript
import { LogManager } from '../../core/LogManager'
import { ChannelRouter } from '../../channel/ChannelRouter'
import { CalendarConnector } from '../../connector/CalendarConnector'
import { AgentBrainImpl } from '../../agent/AgentBrain'
import { EventBus } from '../../runtime/bridge/EventBus'

export const D3_SKILL_NAME = 'd3:remote-command'

export interface D3Input {
  /** 飞书发来的用户消息 */
  userMessage: string
  /** 飞书 userId */
  userId: string
  /** 飞书 channelId */
  channelId: string
}

/**
 * D3RemoteCommand: 飞书"帮我查今天日程" → 调 CalendarConnector → 回复飞书
 * W7 阶段:demo 用 AgentBrain stub
 * W8+ 接真实 AgentBrain think + LLM
 */
export async function runD3(input: D3Input): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const log = LogManager.getInstance()
  const channelRouter = ChannelRouter.getInstance()
  const calendar = new CalendarConnector()
  const brain = AgentBrainImpl.getInstance()

  try {
    // 1. AgentBrain think(判断意图)
    const decision = await brain.think({ conversationId: input.channelId, content: input.userMessage } as any)

    // 2. 根据 user message 调 Calendar(简化:固定调 list_today)
    let replyText = ''
    if (/日程|schedule|today|今天/i.test(input.userMessage)) {
      const result = await calendar.execute({ verb: 'list_today', args: {} }, { userId: input.userId })
      if (result.ok) {
        const events = result.data as Array<{ title: string; start: string; end: string }>
        replyText = `今日日程:\n${events.map(e => `- ${e.start}-${e.end} ${e.title}`).join('\n')}`
      } else {
        replyText = `查询失败: ${result.error}`
      }
    } else {
      replyText = `(stub) AgentBrain 决策: ${JSON.stringify(decision)}`
    }

    // 3. 发送回飞书
    const sendResult = await channelRouter.send(input.channelId, { to: input.userId, text: replyText })
    if (!sendResult.ok) {
      log.warn('D3RemoteCommand: 飞书发送失败', sendResult.error)
    }

    void EventBus.getInstance().publish('d3:remote:completed', { userId: input.userId, reply: replyText })
    return { ok: true, reply: replyText }
  } catch (e) {
    log.error('D3RemoteCommand: 失败', e)
    return { ok: false, error: String(e) }
  }
}

export const d3SkillHandler = {
  name: D3_SKILL_NAME,
  description: '飞书一句话远程指令(W7 stub)',
  requiresPermission: false,
  async execute(args: D3Input) {
    return runD3(args)
  },
}
```

### 7.4 `src/views/D3RemoteDemo.vue`

```vue
<template>
  <div class="d3-demo">
    <h2>D3 一句话远程 Demo (Channel + Agent + Connector)</h2>
    <p class="d3-hint">模拟飞书发消息 → Agent 解析 → Calendar 查询 → 飞书回复</p>

    <el-card class="d3-controls">
      <div class="d3-row">
        <el-input v-model="userMessage" placeholder="输入用户消息,例如:帮我查今天日程"></el-input>
      </div>
      <div class="d3-row">
        <el-input v-model="userId" placeholder="飞书 userId"></el-input>
      </div>
      <div class="d3-row d3-actions">
        <el-button type="primary" @click="runDemo" :loading="isRunning" :disabled="!canRun">
          模拟飞书消息
        </el-button>
      </div>
    </el-card>

    <el-card v-if="lastResult" class="d3-result">
      <h3>运行结果</h3>
      <p v-if="lastResult.ok">
        <strong>Agent 回复:</strong>
        <pre class="d3-reply">{{ lastResult.reply }}</pre>
      </p>
      <p v-else class="d3-error">
        <strong>失败:</strong> {{ lastResult.error }}
      </p>
    </el-card>

    <el-card class="d3-flow">
      <h3>流程</h3>
      <ol class="d3-steps">
        <li>飞书发送消息 <code>{{ userMessage || '(空)' }}</code></li>
        <li>ChannelRouter 路由到 D3 skill</li>
        <li>AgentBrain 解析意图(W7 stub)</li>
        <li>CalendarConnector.list_today(W7 stub data)</li>
        <li>ChannelRouter.send → 飞书回复 <code>{{ lastResult?.reply?.split('\n')[0] ?? '(待运行)' }}</code></li>
      </ol>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const userMessage = ref('帮我查今天日程')
const userId = ref('ou_test_user_001')
const isRunning = ref(false)
const lastResult = ref<{ ok: boolean; reply?: string; error?: string } | null>(null)

const canRun = computed(() => userMessage.value.trim().length > 0)

async function runDemo() {
  isRunning.value = true
  try {
    // W7 阶段:直接调本 view 内的 stub 模拟
    // W8+ 改为通过 IPC 调 main 进程的 runD3()
    if (/日程|schedule|today|今天/i.test(userMessage.value)) {
      lastResult.value = {
        ok: true,
        reply: `今日日程(W7 stub):
- 10:00-11:00 今日会议
- 12:00-13:00 午休
- 15:00-16:00 项目复盘`,
      }
    } else {
      lastResult.value = {
        ok: true,
        reply: `(stub) AgentBrain 决策: action=reply, payload.text="${userMessage.value.slice(0, 50)}"`,
      }
    }
  } finally {
    isRunning.value = false
  }
}
</script>

<style lang="scss" scoped>
.d3-demo {
  padding: var(--content-padding);
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.d3-hint {
  color: var(--text-secondary, #666);
  font-size: var(--font-size-body, 14px);
  margin-bottom: var(--space-lg, 24px);
}

.d3-row {
  margin-bottom: var(--space-md, 16px);
}

.d3-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.d3-result, .d3-flow {
  margin-top: var(--space-lg, 24px);
}

.d3-reply {
  background: var(--card-bg, #fafafa);
  border-radius: var(--radius-sm, 4px);
  padding: var(--space-sm, 8px);
  font-size: var(--font-size-caption-1, 11px);
  white-space: pre-wrap;
  font-family: var(--font-family-mono, monospace);
}

.d3-error {
  color: #c92a2a;
}

.d3-steps {
  padding-left: var(--space-lg, 24px);
  font-size: var(--font-size-body, 14px);
  line-height: 1.8;
}

code {
  background: var(--card-bg, #f5f5f5);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-caption-1, 11px);
}
</style>
```

### 7.5 追加 D3 路由(W7.0.2 既有 14 route 后追加 1 个)

读 `src/router/index.ts`,在 routes 数组末尾追加(不能重排既有 14 个):

```typescript
  {
    path: '/d3-demo',
    name: 'D3RemoteDemo',
    component: () => import('@/views/D3RemoteDemo.vue'),
  },
```

**注意**:`src/router/index.ts` 末尾追加 1 个 route,W7.0.2 既有 14 个 route 0 改动。

### 7.6 自查清单

- [ ] 3 个文件齐全(CalendarConnector + D3RemoteCommand + D3RemoteDemo.vue)
- [ ] CalendarConnector implements contracts Connector(4 verb:list_today/list_upcoming/add_event/find_free_slot)
- [ ] D3RemoteCommand 编排 ChannelRouter + CalendarConnector + AgentBrain
- [ ] D3RemoteDemo.vue 用 Element Plus + Apple HIG tokens
- [ ] src/router/index.ts 末尾追加 1 个 `/d3-demo` route,既有 14 route 0 改动
- [ ] tsc 0 错

### 7.7 commit

```bash
git add electron/connector/CalendarConnector.ts electron/skill/builtin/D3RemoteCommand.ts src/views/D3RemoteDemo.vue src/router/index.ts
git commit -m "feat(demo-d3): one-line remote (Channel + Agent + Calendar stub)"
```

---

## 8. subagent 工作流

```
1. Read 任务指令(本文件)
2. cd D:\pipiclaw\piclaw
3. 跑 git status 确认干净(若还有 .smoke-tmp/test-*.txt/tsc-*.txt,这些是 W7.0 临时产物,可保留或删除均可,本任务不删)
4. Read 关键文件校准:
   - electron/contracts/types.ts L89-147(Channel / Connector / ChannelMessage 等接口)
   - electron/contracts/CapabilityRegistry.ts
   - electron/chat/ChatManager.ts 906-963
   - electron/agent/AgentBrain.ts(AgentBrainImpl / asAgentBrain)
   - electron/channel/(检查目录是否存在,若不存在 Write 会创建)
   - electron/contentgen/(检查目录)
   - electron/connector/(检查目录)
   - src/router/index.ts(W7.0.2 已挂 14 route)
   - src/components/SideNav.vue(看菜单格式,本任务不需要新增菜单但 D3 route 需要挂上)
5. W7.1: Write 8 个 channel 基础文件 → tsc + vitest → git add + commit
6. W7.2: 顺序 Write 11 个通道(每通道 1 commit)
7. W7.3: Write 4 渲染器(commit 1) + 1 图像(commit 2) + 6 转换器(commit 3)
8. W7.4: Write CalendarConnector + D3RemoteCommand + D3RemoteDemo + 末尾追加 1 route → commit
9. 最终报告
```

---

## 9. 完工报告(返回内容)

1. **16 commit hash**(从 git log --oneline -16 读)
2. tsc 错误数(应保持 0)
3. vitest 通过数(应保持 84)
4. channel 目录文件数(应 8 基础 + 11 通道 = 19)
5. contentgen 目录文件数(应 4+1+6 = 11)
6. connector 目录文件数(应 1 CalendarConnector + 可能 1 connector/index.ts)
7. router 改后 route 数(14 → 15)
8. 关键决策 / 难题 / 遗留未改项

---

## 10. 禁止事项

- **不引入** 任何新 npm 依赖
- **不修改** 既有 ChatManager / IpcServer / preload / tokens.css / variables.scss / contracts
- **不修改** 既有 view / component / store / SideNav
- **不修改** 既有 W7.0.2 router(只在末尾追加 1 route)
- **不修改** `src/router/index.ts` 既有 14 route
- **不删除** 任何文件
- **不重命名** 任何文件
- **不跑 npm install**

---

## 11. 控制器(主会话)验收

subagent 报告完成后,主会话会:
1. `git log --oneline -17` 看 16 commit + 1 docs
2. `npx vitest run` 确认 84/84
3. `npx tsc --noEmit` 确认 0 错
4. 报告 W7 整体结果