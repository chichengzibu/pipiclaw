/**
 * PiPiClaw - Agent / AgentTypes (W5.2.1)
 *
 * Shared internal types for the Agent domain. Kept separate from contracts/types.ts
 * so contract surface stays small and internal evolution does not break consumers.
 */

export interface ThinkingStep {
  id: string
  ts: number
  /** analysis / decision / critique / synthesis */
  dimension: 'analysis' | 'decision' | 'critique' | 'synthesis'
  content: string
  /** Optional tool-call id this step references */
  toolCallId?: string
}

export interface ToolMetadata {
  name: string
  description: string
  parametersJson: Record<string, unknown>
  /** Whether invocation must pass permission gate */
  requiresPermission: boolean
  /** Owning domain (used for routing / RBAC display) */
  domain?: string
}

export interface ThinkingContext {
  conversationId: string
  userMessage: string
  history: ThinkingStep[]
  availableTools: ToolMetadata[]
  memoryFacts: string[]
}

export interface AgentMetricsSnapshot {
  totalDecisions: number
  totalToolCalls: number
  successRate: number
  avgThinkDurationMs: number
  avgToolDurationMs: number
  totalCostUsd: number
}

export interface AgentDecisionRecord {
  id: string
  ts: number
  conversationId: string
  decision: { action: string; payload: unknown }
  durationMs: number
  costUsd?: number
}

export interface AgentCheckpointState {
  conversationId: string
  ts: number
  history: ThinkingStep[]
  decisions: AgentDecisionRecord[]
  tokenUsage: number
}

export interface SubAgentSpec {
  instruction: string
  parentConversationId: string
  maxSteps?: number
  depth?: number
}