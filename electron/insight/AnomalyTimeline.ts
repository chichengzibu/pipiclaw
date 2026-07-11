/**
 * PiPiClaw - Insight / AnomalyTimeline (W5.1)
 *
 * Rolling anomaly timeline. Each anomaly has severity + category and can
 * be resolved later. Bounded FIFO retention (default 200 entries).
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type AnomalySeverity = 'info' | 'warn' | 'error' | 'critical'
export type AnomalyCategory =
  | 'performance'
  | 'cost'
  | 'security'
  | 'logic'
  | 'integration'
  | 'user'

export interface Anomaly {
  id: string
  ts: number
  category: AnomalyCategory
  severity: AnomalySeverity
  title: string
  description?: string
  context?: Record<string, unknown>
  resolvedAt?: number
  resolvedBy?: string
}

export class AnomalyTimeline {
  private static instance: AnomalyTimeline
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private anomalies: Anomaly[] = []
  private maxAnomalies = 200

  private constructor() {}

  public static getInstance(): AnomalyTimeline {
    if (!AnomalyTimeline.instance) AnomalyTimeline.instance = new AnomalyTimeline()
    return AnomalyTimeline.instance
  }

  addAnomaly(anomaly: Omit<Anomaly, 'id' | 'ts'>): Anomaly {
    const a: Anomaly = { id: randomUUID(), ts: Date.now(), ...anomaly }
    this.anomalies.push(a)
    if (this.anomalies.length > this.maxAnomalies) this.anomalies.shift()
    this.log.warn(`AnomalyTimeline: [${a.severity}] ${a.category} ${a.title}`)
    void this.bus.publish(
      'anomaly:added',
      { id: a.id, severity: a.severity, category: a.category },
      'AnomalyTimeline',
    )
    return a
  }

  getRecentAnomalies(
    opts?: {
      limit?: number
      category?: AnomalyCategory
      severity?: AnomalySeverity
      sinceTs?: number
    },
  ): Anomaly[] {
    const options = opts ?? {}
    const category = options.category
    const severity = options.severity
    const sinceTs = options.sinceTs
    let filtered = [...this.anomalies]
    if (category) filtered = filtered.filter((a) => a.category === category)
    if (severity) filtered = filtered.filter((a) => a.severity === severity)
    if (sinceTs !== undefined) filtered = filtered.filter((a) => a.ts >= sinceTs)
    const limit = options.limit ?? 50
    return filtered.slice(-limit).reverse()
  }

  resolveAnomaly(id: string, resolvedBy: string): boolean {
    const a = this.anomalies.find((x) => x.id === id)
    if (!a) return false
    a.resolvedAt = Date.now()
    a.resolvedBy = resolvedBy
    void this.bus.publish('anomaly:resolved', { id, resolvedBy }, 'AnomalyTimeline')
    return true
  }

  recordError(
    category: AnomalyCategory,
    error: unknown,
    context?: Record<string, unknown>,
  ): Anomaly {
    const message = error instanceof Error ? error.message : String(error)
    return this.addAnomaly({
      category,
      severity: 'error',
      title: message,
      context,
    })
  }
}