/**
 * PiPiClaw - Agent / SubAgentSpawner (W5.2.3)
 *
 * Spawns a child AgentBrainImpl for a given SubTask. Enforces a recursion-depth
 * cap (default 3) so runaway delegation cannot blow the stack.
 */

import { LogManager } from '../core/LogManager'
import { AgentBrainImpl, asAgentBrain } from './AgentBrain'
import { EventBus } from '../runtime/bridge/EventBus'
import type { SubTask, SubAgent } from '../contracts/types'

export interface SubAgentHandle {
  id: string
  instruction: string
  brain: AgentBrainImpl
  parentConversationId: string
  depth: number
  startedAt: number
}

export class SubAgentSpawner {
  private static instance: SubAgentSpawner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private handles: Map<string, SubAgentHandle> = new Map()
  private maxDepth: number

  private constructor(maxDepth = 3) {
    this.maxDepth = maxDepth
  }

  public static getInstance(): SubAgentSpawner {
    if (!SubAgentSpawner.instance) SubAgentSpawner.instance = new SubAgentSpawner()
    return SubAgentSpawner.instance
  }

  async spawn(subtask: SubTask, parentConversationId: string, depth = 0): Promise<SubAgent> {
    if (depth > this.maxDepth) {
      throw new Error(`SubAgentSpawner: 派生深度超过 ${this.maxDepth},终止`)
    }
    const brain = AgentBrainImpl.create()
    const id = `sub-${subtask.instruction.slice(0, 12)}-${Date.now()}`
    const handle: SubAgentHandle = {
      id,
      instruction: subtask.instruction,
      brain,
      parentConversationId,
      depth,
      startedAt: Date.now(),
    }
    this.handles.set(id, handle)
    this.log.info(
      `SubAgentSpawner: ${id} 派生成功 (depth=${depth}, parent=${parentConversationId})`,
    )
    await this.bus.publish(
      'agent:subagent:spawn',
      { id, instruction: subtask.instruction, depth },
      'SubAgentSpawner',
    )
    return { id, brain: asAgentBrain(brain) }
  }

  async runSubTask(id: string): Promise<unknown> {
    const h = this.handles.get(id)
    if (!h) throw new Error(`SubAgentSpawner: ${id} not found`)
    return await h.brain.think({ conversationId: h.parentConversationId, content: h.instruction })
  }

  getHandle(id: string): SubAgentHandle | undefined {
    return this.handles.get(id)
  }

  list(): SubAgentHandle[] {
    return Array.from(this.handles.values())
  }
}