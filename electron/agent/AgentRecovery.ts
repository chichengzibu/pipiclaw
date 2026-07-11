/**
 * PiPiClaw - Agent / AgentRecovery (W5.2.5)
 *
 * Wraps AgentBrain.think() with a RetryPolicy. On exhausted retries that are
 * classified retryable, recovers the latest checkpoint and retries once.
 * Logs every anomaly to AnomalyTimeline for the Insights view.
 */

import { LogManager } from '../core/LogManager'
import { AgentCheckpointStore } from './AgentCheckpoint'
import { AgentBrainImpl, asAgentBrain } from './AgentBrain'
import { AgentMetrics } from './AgentMetrics'
import { AnomalyTimeline } from '../insight/AnomalyTimeline'
import { EventBus } from '../runtime/bridge/EventBus'
import type { AgentBrain as AgentBrainContract } from '../contracts/types'
import { classifyError } from './ErrorClassifier'
import { RetryPolicy } from './RetryPolicy'

export class AgentRecovery {
  private static instance: AgentRecovery
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private store = AgentCheckpointStore.getInstance()
  private metrics = AgentMetrics.getInstance()
  private anomaly = AnomalyTimeline.getInstance()
  private defaultRetry: RetryPolicy

  private constructor() {
    this.defaultRetry = new RetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 2000,
      backoffMultiplier: 2,
    })
  }

  public static getInstance(): AgentRecovery {
    if (!AgentRecovery.instance) AgentRecovery.instance = new AgentRecovery()
    return AgentRecovery.instance
  }

  async recoverFromCheckpoint(brain: AgentBrainImpl, checkpointId: string): Promise<boolean> {
    const state = await this.store.load(checkpointId)
    if (!state) {
      this.log.warn(`AgentRecovery: checkpoint ${checkpointId} 不存在或损坏`)
      return false
    }
    brain.setHistory(state.history)
    this.log.info(`AgentRecovery: 已恢复 ${state.history.length} 步历史`)
    await this.bus.publish(
      'agent:recovery:completed',
      { checkpointId, conversationId: state.conversationId },
      'AgentRecovery',
    )
    return true
  }

  async resilientThink(brain: AgentBrainContract, ctx: unknown): Promise<unknown> {
    const agentCtx = ctx as Parameters<AgentBrainContract['think']>[0]
    try {
      return await this.defaultRetry.execute(() => brain.think(agentCtx))
    } catch (e) {
      const cls = classifyError(e)
      this.anomaly.recordError('logic', e, { phase: 'resilientThink', kind: cls.kind })
      if (!cls.retryable) throw e
      const impl = brain as unknown as AgentBrainImpl
      const checkpoints = impl.listCheckpoints()
      if (checkpoints.length > 0) {
        const lastId = checkpoints[checkpoints.length - 1]
        this.log.info(`AgentRecovery: 尝试从 ${lastId} 恢复并重试`)
        const recovered = await this.recoverFromCheckpoint(impl, lastId)
        if (recovered) {
          return await this.defaultRetry.execute(() => brain.think(agentCtx))
        }
      }
      throw e
    }
  }

  /**
   * Convenience: wrap a brain for resilient think.
   * Returns a new AgentBrainContract whose think() goes through resilientThink.
   */
  wrap(brain: AgentBrainContract): AgentBrainContract {
    return {
      think: (ctx) => this.resilientThink(brain, ctx) as Promise<import('../contracts/types').Decision>,
      call: brain.call,
      spawn: brain.spawn,
      checkpoint: brain.checkpoint,
      restore: brain.restore,
    }
  }

  /** Helper used by callers that already hold an AgentBrainImpl. */
  asWrappedBrain(impl: AgentBrainImpl): AgentBrainContract {
    return this.wrap(asAgentBrain(impl))
  }
}