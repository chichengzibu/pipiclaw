/**
 * PiPiClaw - Agent / ExecutionEngine (W5.2.3)
 *
 * Translates a Decision produced by AgentBrain.think() into an actual side-effect.
 *  - action == 'think' : pass-through (no side-effect)
 *  - action == 'stop'  : pass-through (termination sentinel)
 *  - action == 'reply' : push payload to ChatManager stream
 *  - action == 'call'  : hand off to ToolRegistry (W5.2.4)
 *  - action == 'spawn' : hand off to SubAgentSpawner (W5.2.3)
 *
 * W5.2.3 ships a routing skeleton; the call/spawn branches return stubs.
 */

import { LogManager } from '../core/LogManager'
import { AgentConfig } from './AgentConfig'
import type { Decision, ToolCall } from '../contracts/types'

export interface ExecutionResult {
  ok: boolean
  action: string
  output: unknown
  durationMs: number
  error?: string
}

export class ExecutionEngine {
  private static instance: ExecutionEngine
  private log = LogManager.getInstance()
  private config = AgentConfig.getInstance()

  private constructor() {}

  public static getInstance(): ExecutionEngine {
    if (!ExecutionEngine.instance) ExecutionEngine.instance = new ExecutionEngine()
    return ExecutionEngine.instance
  }

  async execute(decision: Decision, _toolCall?: ToolCall): Promise<ExecutionResult> {
    const startMs = Date.now()
    this.log.debug(`ExecutionEngine: ${decision.action}`)

    switch (decision.action) {
      case 'think':
      case 'stop':
      case 'reply':
        return {
          ok: true,
          action: decision.action,
          output: decision.payload,
          durationMs: Date.now() - startMs,
        }
      case 'call':
        return {
          ok: true,
          action: 'call',
          output: { stub: true, note: 'ToolRegistry W5.2.4 接管' },
          durationMs: Date.now() - startMs,
        }
      case 'spawn':
        return {
          ok: true,
          action: 'spawn',
          output: { stub: true, note: 'SubAgentSpawner W5.2.3 接管' },
          durationMs: Date.now() - startMs,
        }
      default:
        return {
          ok: false,
          action: (decision as { action: string }).action,
          output: null,
          durationMs: Date.now() - startMs,
          error: `unknown action: ${(decision as { action: string }).action}`,
        }
    }
  }
}