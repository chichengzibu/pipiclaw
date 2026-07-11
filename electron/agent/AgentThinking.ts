/**
 * PiPiClaw - Agent / AgentThinking (W5.2.4)
 *
 * Bridges ThinkingContext + LLM. W5 ships a deterministic stub returning a
 * "reply" Decision; W5+W6 will swap in the ChatManager LLM channel.
 */

import { LogManager } from '../core/LogManager'
import { AgentConfig } from './AgentConfig'
import type { ThinkingContext } from './AgentTypes'
import type { Decision } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export class AgentThinking {
  private static instance: AgentThinking
  private log = LogManager.getInstance()
  private config = AgentConfig.getInstance()

  private constructor() {}

  public static getInstance(): AgentThinking {
    if (!AgentThinking.instance) AgentThinking.instance = new AgentThinking()
    return AgentThinking.instance
  }

  async think(ctx: ThinkingContext): Promise<Decision> {
    const cfg = this.config.get()
    this.log.debug(`AgentThinking[${cfg.defaultModel}]: ${ctx.userMessage.slice(0, 50)}`)
    return {
      action: 'reply',
      payload: {
        text: `[stub-think] ${cfg.defaultModel} 收到: ${ctx.userMessage.slice(0, 80)}`,
        thinkingId: randomUUID(),
      },
    }
  }
}