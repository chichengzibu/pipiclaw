/**
 * PiPiClaw - Insight / InsightManager (W5.1)
 *
 * Aggregate facade for the 4 insight subsystems. The Insights view pulls
 * a single payload via getDashboardPayload() to avoid 4 IPC calls.
 */

import { LogManager } from '../core/LogManager'
import { TraceCollector } from './TraceCollector'
import { CostTracker, type TodayCostSummary } from './CostTracker'
import { TaskKanban, type KanbanTask } from './TaskKanban'
import { AnomalyTimeline, type Anomaly } from './AnomalyTimeline'

export interface InsightDashboardPayload {
  today: TodayCostSummary
  tasks: KanbanTask[]
  anomalies: Anomaly[]
  activeSpans: number
}

export class InsightManager {
  private static instance: InsightManager
  private log = LogManager.getInstance()
  public readonly trace: TraceCollector
  public readonly cost: CostTracker
  public readonly kanban: TaskKanban
  public readonly anomaly: AnomalyTimeline

  private constructor() {
    this.trace = TraceCollector.getInstance()
    this.cost = CostTracker.getInstance()
    this.kanban = TaskKanban.getInstance()
    this.anomaly = AnomalyTimeline.getInstance()
  }

  public static getInstance(): InsightManager {
    if (!InsightManager.instance) InsightManager.instance = new InsightManager()
    return InsightManager.instance
  }

  getDashboardPayload(): InsightDashboardPayload {
    return {
      today: this.cost.getTodayCost(),
      tasks: this.kanban.listTasks(),
      anomalies: this.anomaly.getRecentAnomalies({ limit: 30 }),
      activeSpans: this.trace.getSpans().length,
    }
  }
}