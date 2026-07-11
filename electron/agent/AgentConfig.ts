/**
 * PiPiClaw - Agent / AgentConfig (W5.2.1)
 *
 * Singleton config backed by ConfigStore. Lets the user tweak thinking depth,
 * sub-agent recursion limit, default model, checkpoint cadence, etc.
 */

import { ConfigStore } from '../core/ConfigStore'
import { LogManager } from '../core/LogManager'

export interface AgentConfigData {
  maxThinkingSteps: number
  maxSubAgentDepth: number
  defaultModel: string
  enableCheckpoint: boolean
  /** Steps between auto checkpoints */
  checkpointInterval: number
  enableMemoryInjection: boolean
  memoryTopK: number
  thinkingDimensions: Array<'analysis' | 'decision' | 'critique' | 'synthesis'>
}

const DEFAULT_CONFIG: AgentConfigData = {
  maxThinkingSteps: 20,
  maxSubAgentDepth: 3,
  defaultModel: 'gpt-4o-mini',
  enableCheckpoint: true,
  checkpointInterval: 5,
  enableMemoryInjection: true,
  memoryTopK: 5,
  thinkingDimensions: ['analysis', 'decision', 'critique', 'synthesis'],
}

const KEY = 'agent:config'

export class AgentConfig {
  private static instance: AgentConfig
  private log = LogManager.getInstance()

  private constructor() {
    const stored = ConfigStore.getInstance().get(KEY) as AgentConfigData | undefined
    if (!stored) {
      ConfigStore.getInstance().set(KEY, DEFAULT_CONFIG)
    }
  }

  public static getInstance(): AgentConfig {
    if (!AgentConfig.instance) AgentConfig.instance = new AgentConfig()
    return AgentConfig.instance
  }

  get(): AgentConfigData {
    return (ConfigStore.getInstance().get(KEY) as AgentConfigData | undefined) ?? DEFAULT_CONFIG
  }

  set(patch: Partial<AgentConfigData>): void {
    const current = this.get()
    ConfigStore.getInstance().set(KEY, { ...current, ...patch })
  }

  reset(): void {
    ConfigStore.getInstance().set(KEY, DEFAULT_CONFIG)
  }
}