/**
 * PiPiClaw - Insight 能力域(W3 骨架,具体实现在 W12)
 *
 * 职责:链路追踪、用量统计、成本分析、Insights 面板数据源。
 * 入口:TraceCollector(见 spec 段 4 "关键接口签名")。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W12):在此目录下创建 TraceCollector.ts / CostAggregator.ts / 等。
 */

export const INSIGHT_DOMAIN = {
  id: 'insight',
  displayName: 'Insight',
  description: '链路追踪 + 用量统计 + 成本分析',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[],
  dependencies: [],
} as const

export type InsightDomainId = typeof INSIGHT_DOMAIN.id

// ============ W5.1 added (保留上方 W3.1 的 AGENT_DOMAIN/INSIGHT_DOMAIN 常量不动) ============
export { TraceCollector } from './TraceCollector'
export type { TraceSpanOptions } from './TraceCollector'
export { CostTracker } from './CostTracker'
export type { UsageEntry, ModelPricing, TodayCostSummary } from './CostTracker'
export { TaskKanban } from './TaskKanban'
export type { KanbanTask, KanbanColumn, KanbanPriority } from './TaskKanban'
export { AnomalyTimeline } from './AnomalyTimeline'
export type { Anomaly, AnomalySeverity, AnomalyCategory } from './AnomalyTimeline'
export { InsightManager } from './InsightManager'
export type { InsightDashboardPayload } from './InsightManager'
