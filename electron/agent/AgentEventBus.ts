/**
 * PiPiClaw - Agent / AgentEventBus (W5.2.1)
 *
 * Thin typed wrapper around the global EventBus. Provides a closed set of
 * agent:* topics for autocomplete and subscription safety.
 */

import { EventBus } from '../runtime/bridge/EventBus'

export type AgentEvent =
  | 'agent:think:start'
  | 'agent:think:end'
  | 'agent:tool:call'
  | 'agent:tool:result'
  | 'agent:subagent:spawn'
  | 'agent:subagent:done'
  | 'agent:checkpoint:saved'
  | 'agent:recovery:started'

export type AgentEventHandler = (payload: unknown) => void | Promise<void>

export class AgentEventBus {
  private static instance: AgentEventBus
  private bus = EventBus.getInstance()

  private constructor() {}

  public static getInstance(): AgentEventBus {
    if (!AgentEventBus.instance) AgentEventBus.instance = new AgentEventBus()
    return AgentEventBus.instance
  }

  subscribe(event: AgentEvent, handler: AgentEventHandler): () => void {
    return this.bus.subscribe(event, handler)
  }

  async publish(event: AgentEvent, payload: unknown): Promise<void> {
    await this.bus.publish(event, payload, 'Agent')
  }
}