/**
 * PiPiClaw - Agent / AgentBrain (W5.2.2)
 *
 * Main thinking loop. Structurally duck-typed to the contracts AgentBrain
 * interface (think/call/spawn/checkpoint/restore). Bridge via asAgentBrain()
 * so ChatManager.registerAgent() accepts this without `implements`.
 *
 * W5.2.2 = scaffolding: stubs for each method; real LLM/tool wiring lands in
 * W5.2.3 (ExecutionEngine) + W5.2.4 (ToolRegistry) + W5.2.5 (Recovery).
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { AgentConfig } from './AgentConfig'
import { AgentLogger } from './AgentLogger'
import { AgentMetrics } from './AgentMetrics'
import { AgentEventBus } from './AgentEventBus'
import { TraceCollector } from '../insight/TraceCollector'
import { CostTracker } from '../insight/CostTracker'
import { TaskKanban } from '../insight/TaskKanban'
import { Conversation } from '../runtime/conversation/Conversation'
import type {
  AgentContext,
  Decision,
  ToolCall,
  ToolResult,
  SubTask,
  SubAgent,
  AgentBrain as AgentBrainContract,
} from '../contracts/types'
import type {
  ThinkingStep,
  ThinkingContext,
  AgentDecisionRecord,
  AgentCheckpointState,
} from './AgentTypes'
import { randomUUID } from 'node:crypto'

export class AgentBrainImpl {
  private static instance: AgentBrainImpl
  private log = LogManager.getInstance()
  private agentLogger = AgentLogger.getInstance()
  private bus = AgentEventBus.getInstance()
  private eventBus = EventBus.getInstance()
  private config = AgentConfig.getInstance()
  private metrics = AgentMetrics.getInstance()
  private trace = TraceCollector.getInstance()
  private cost = CostTracker.getInstance()
  private kanban = TaskKanban.getInstance()
  private conversation: Conversation | null = null
  private history: ThinkingStep[] = []
  private checkpoints: Map<string, AgentCheckpointState> = new Map()
  private subAgents: Map<string, AgentBrainImpl> = new Map()

  private constructor() {
    this.agentLogger.setSource('AgentBrain')
  }

  public static getInstance(): AgentBrainImpl {
    if (!AgentBrainImpl.instance) AgentBrainImpl.instance = new AgentBrainImpl()
    return AgentBrainImpl.instance
  }

  /** Build a new (non-singleton) brain — used by SubAgentSpawner. */
  public static create(): AgentBrainImpl {
    return new AgentBrainImpl()
  }

  static resetInstance(): void {
    AgentBrainImpl.instance = new AgentBrainImpl()
  }

  // ============ 5 AgentBrain interface methods ============

  async think(ctx: AgentContext): Promise<Decision> {
    const startMs = Date.now()
    const span = this.trace.startSpan({
      name: 'agent.think',
      attrs: { conversationId: ctx.conversationId as string },
    })
    this.agentLogger.info('开始思考', ctx as Record<string, unknown>)

    const cfg = this.config.get()
    const thinking: ThinkingContext = {
      conversationId: (ctx.conversationId as string) ?? 'unknown',
      userMessage: (ctx as { content?: string }).content ?? '',
      history: [...this.history],
      availableTools: [],
      memoryFacts: [],
    }
    const step: ThinkingStep = {
      id: randomUUID(),
      ts: Date.now(),
      dimension: 'decision',
      content: `[stub] think 收到 ${thinking.userMessage.slice(0, 30)}`,
    }
    this.history.push(step)
    const decision: Decision = {
      action: 'reply',
      payload: { text: `思考完成: ${thinking.userMessage.slice(0, 50)}` },
    }

    const durationMs = Date.now() - startMs
    const record: AgentDecisionRecord = {
      id: randomUUID(),
      ts: Date.now(),
      conversationId: thinking.conversationId,
      decision: { action: decision.action, payload: decision.payload },
      durationMs,
    }
    this.metrics.recordDecision(record)
    this.cost.recordUsage({
      model: cfg.defaultModel,
      inputTokens: 0,
      outputTokens: 0,
      conversationId: thinking.conversationId,
    })
    await this.bus.publish('agent:think:end', { decision, durationMs })
    this.trace.endSpan(span, decision)
    return decision
  }

  async call(tool: ToolCall): Promise<ToolResult> {
    const span = this.trace.startSpan({ name: 'agent.call', attrs: { toolName: tool.name } })
    const startMs = Date.now()
    this.agentLogger.info('调用工具', tool as unknown as Record<string, unknown>)
    const result: ToolResult = { ok: true, data: { stub: true, tool: tool.name, args: tool.args } }
    const durationMs = Date.now() - startMs
    this.metrics.recordToolCall(randomUUID(), durationMs, true)
    this.trace.endSpan(span, result)
    return result
  }

  async spawn(subtask: SubTask): Promise<SubAgent> {
    const child = new AgentBrainImpl()
    const id = randomUUID()
    this.subAgents.set(id, child)
    this.log.info(`AgentBrain: spawn sub-agent ${id} for "${subtask.instruction.slice(0, 30)}"`)
    await this.bus.publish('agent:subagent:spawn', { id, instruction: subtask.instruction })
    return { id, brain: child as unknown as AgentBrainContract }
  }

  async checkpoint(): Promise<string> {
    if (!this.config.get().enableCheckpoint) return ''
    const state: AgentCheckpointState = {
      conversationId: this.conversation?.id ?? 'unknown',
      ts: Date.now(),
      history: [...this.history],
      decisions: [],
      tokenUsage: 0,
    }
    const id = randomUUID()
    this.checkpoints.set(id, state)
    this.log.info(`AgentBrain: checkpoint saved ${id}`)
    await this.bus.publish('agent:checkpoint:saved', { id })
    return id
  }

  async restore(id: string): Promise<void> {
    const state = this.checkpoints.get(id)
    if (!state) {
      this.log.warn(`AgentBrain: checkpoint ${id} not found`)
      return
    }
    this.history = [...state.history]
    this.log.info(`AgentBrain: restored from ${id}, ${state.history.length} steps`)
    await this.bus.publish('agent:recovery:started', { id })
  }

  // ============ internal management helpers (not on interface) ============

  getHistory(): ThinkingStep[] {
    return [...this.history]
  }

  setHistory(history: ThinkingStep[]): void {
    this.history = [...history]
  }

  setConversation(c: Conversation): void {
    this.conversation = c
  }

  getConversation(): Conversation | null {
    return this.conversation
  }

  getSubAgent(id: string): AgentBrainImpl | undefined {
    return this.subAgents.get(id)
  }

  listCheckpoints(): string[] {
    return Array.from(this.checkpoints.keys())
  }

  publishKanban(event: string, payload: unknown): void {
    void this.eventBus.publish(event, payload, 'AgentBrain')
  }
}

/**
 * Bridge to the contracts AgentBrain interface. Used by ChatManager.registerAgent
 * and CapabilityRegistry.register so consumers do not need to know the impl class.
 */
export function asAgentBrain(brain: AgentBrainImpl): AgentBrainContract {
  return brain as unknown as AgentBrainContract
}