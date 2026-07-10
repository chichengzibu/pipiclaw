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
