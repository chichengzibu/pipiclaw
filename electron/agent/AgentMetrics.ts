/**
 * PiPiClaw - Agent / AgentMetrics (W5.2.1)
 *
 * In-memory counters for decisions, tool calls, cost. Powers the Agent
 * tab in the Insights view.
 */

import type { AgentMetricsSnapshot, AgentDecisionRecord } from './AgentTypes'

export class AgentMetrics {
  private static instance: AgentMetrics
  private decisions: AgentDecisionRecord[] = []
  private toolCalls: { id: string; ts: number; durationMs: number; success: boolean }[] = []
  private totalCostUsd = 0

  private constructor() {}

  public static getInstance(): AgentMetrics {
    if (!AgentMetrics.instance) AgentMetrics.instance = new AgentMetrics()
    return AgentMetrics.instance
  }

  recordDecision(record: AgentDecisionRecord): void {
    this.decisions.push(record)
    if (record.costUsd !== undefined) this.totalCostUsd += record.costUsd
  }

  recordToolCall(id: string, durationMs: number, success: boolean): void {
    this.toolCalls.push({ id, ts: Date.now(), durationMs, success })
  }

  snapshot(): AgentMetricsSnapshot {
    const successfulTools = this.toolCalls.filter((t) => t.success).length
    const successRate = this.toolCalls.length > 0 ? successfulTools / this.toolCalls.length : 1
    const avgThink =
      this.decisions.length > 0
        ? this.decisions.reduce((s, d) => s + d.durationMs, 0) / this.decisions.length
        : 0
    const avgTool =
      this.toolCalls.length > 0
        ? this.toolCalls.reduce((s, t) => s + t.durationMs, 0) / this.toolCalls.length
        : 0
    return {
      totalDecisions: this.decisions.length,
      totalToolCalls: this.toolCalls.length,
      successRate,
      avgThinkDurationMs: avgThink,
      avgToolDurationMs: avgTool,
      totalCostUsd: this.totalCostUsd,
    }
  }

  reset(): void {
    this.decisions = []
    this.toolCalls = []
    this.totalCostUsd = 0
  }
}