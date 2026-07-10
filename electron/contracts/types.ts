/**
 * PiPiClaw - 能力域间契约(W3 骨架)
 *
 * 域间所有通信必须经过 Capability interface,不允许直接跨域调用内部方法。
 * 本文件只定义接口,实现由各域在 W5-W12 提供。
 */

/**
 * 能力(Capability):域内对外暴露的最小可执行单元
 */
export interface Capability {
  /** 能力唯一 id(域内唯一,推荐格式 `<domain>:<verb>`) */
  id: string
  /** 人类可读名(用于 UI 展示) */
  displayName: string
  /** 描述(LLM tool 描述,200 字内) */
  description: string
  /** 执行函数(参数和返回由各 capability 自定义) */
  execute: (args: Record<string, unknown>, ctx: ExecutionContext) => Promise<unknown>
  /** 子能力(嵌套) */
  capabilities?: readonly Capability[]
}

/**
 * 执行上下文(由 CapabilityRegistry 注入)
 */
export interface ExecutionContext {
  /** 当前会话 id(可选) */
  conversationId?: string
  /** 当前用户 id(可选) */
  userId?: string
  /** 权限 token(可选,未设置时 CapabilityRegistry 兜底拒绝) */
  permissionToken?: string
  /** 链路追踪 span(W7 之后填充) */
  trace?: { spanId: string; parentSpanId?: string }
}

/**
 * 域(Domain):一组 Capability 的容器
 */
export interface Domain {
  /** 域 id,与 AGENT_DOMAIN.id 对齐 */
  id: string
  /** 人类可读名 */
  displayName: string
  /** 描述(用于 Insights 页/About 页) */
  description: string
  /** 当前域版本(语义化版本) */
  version: string
  /** 本域暴露的全部 Capability */
  capabilities: readonly Capability[]
  /** 依赖的其他域 id(启动顺序依据) */
  dependencies: readonly string[]
}

/**
 * Agent 域入口(参考 spec 段 4 "关键接口签名")
 */
export interface AgentBrain {
  think(ctx: AgentContext): Promise<Decision>
  call(tool: ToolCall): Promise<ToolResult>
  spawn(subtask: SubTask): Promise<SubAgent>
  checkpoint(): Promise<string>
  restore(id: string): Promise<void>
}

/**
 * Memory 域入口(参考 spec 段 4)
 */
export interface HermesMemory {
  recall(query: string, opts?: RecallOptions): Promise<Memory[]>
  store(memory: Memory): Promise<void>
  curate(): Promise<CuratorReport>
  evolve(): Promise<EvolutionReport>
}

/**
 * Skill 域入口(参考 spec 段 4)
 */
export interface Skill {
  name: string
  signature: string
  execute(input: SkillInput, ctx: SkillContext): Promise<SkillOutput>
}

/**
 * Channel 域入口(参考 spec 段 4)
 */
export interface Channel {
  id: string
  send(msg: ChannelMessage): Promise<void>
  onMessage(handler: MessageHandler): Disposable
  healthCheck(): Promise<ChannelHealth>
}

/**
 * P7 Sandbox 域入口(参考 spec 段 4)
 */
export interface Sandbox {
  execute(cmd: string, opts?: ExecOptions): Promise<ExecResult>
  preview(): Promise<PreviewURL>
  stop(): Promise<void>
  audit(): Promise<AuditEntry[]>
}

/**
 * Connector 域入口(参考 spec 段 4)
 */
export interface Connector {
  id: string
  execute(intent: ConnectorIntent, ctx: ConnectorContext): Promise<ConnectorResult>
}

/**
 * Insight 域入口(参考 spec 段 4)
 */
export interface TraceCollector {
  startSpan(name: string, attrs?: Record<string, unknown>): Span
  endSpan(span: Span, result?: unknown): void
}

// ============ 类型占位(后续 W4-W12 填充) ============

export interface AgentContext { conversationId?: string; [k: string]: unknown }
export interface Decision { action: 'think' | 'call' | 'spawn' | 'stop' | 'reply'; payload: unknown }
export interface ToolCall { name: string; args: Record<string, unknown> }
export interface ToolResult { ok: boolean; data?: unknown; error?: string }
export interface SubTask { instruction: string; parentTaskId?: string }
export interface SubAgent { id: string; brain: AgentBrain }
export interface RecallOptions { topK?: number; minScore?: number }
export interface Memory { id: string; content: string; score?: number; createdAt: number }
export interface CuratorReport { removed: number; promoted: number }
export interface EvolutionReport { newMemories: number; mutated: number }
export interface SkillInput { [k: string]: unknown }
export interface SkillContext { userId?: string; permissionToken?: string }
export interface SkillOutput { ok: boolean; data?: unknown; error?: string }
export interface ChannelMessage { to: string; text?: string; attachments?: unknown[] }
export type MessageHandler = (msg: ChannelMessage) => void | Promise<void>
export interface Disposable { dispose(): void }
export interface ChannelHealth { healthy: boolean; latencyMs?: number; error?: string }
export interface ExecOptions { cwd?: string; env?: Record<string, string>; timeoutMs?: number }
export interface ExecResult { exitCode: number; stdout: string; stderr: string; durationMs: number }
export interface PreviewURL { url: string; port: number; expiresAt: number }
export interface AuditEntry { ts: number; action: string; args?: unknown; result?: 'ok' | 'denied' | 'error' }
export interface ConnectorIntent { verb: string; args: Record<string, unknown> }
export interface ConnectorContext { userId?: string; permissionToken?: string }
export interface ConnectorResult { ok: boolean; data?: unknown; error?: string }
export interface Span { id: string; name: string; startMs: number; endMs?: number; attrs: Record<string, unknown> }
