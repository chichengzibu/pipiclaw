/**
 * PiPiClaw - Insight / TraceCollector (W5.1)
 *
 * OpenTelemetry-style in-process span tracker.
 * Stores active spans in memory and publishes trace:span:start / trace:span:end events.
 * Persisted to log only; W7 will integrate with remote OTLP exporter.
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'
import type { Span } from '../contracts/types'

export interface TraceSpanOptions {
  name: string
  attrs?: Record<string, unknown>
  parentSpanId?: string
}

export class TraceCollector {
  private static instance: TraceCollector
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private spans: Map<string, Span> = new Map()
  private maxSpans = 1000

  private constructor() {}

  public static getInstance(): TraceCollector {
    if (!TraceCollector.instance) TraceCollector.instance = new TraceCollector()
    return TraceCollector.instance
  }

  startSpan(opts: TraceSpanOptions): Span {
    const span: Span = {
      id: randomUUID(),
      name: opts.name,
      startMs: Date.now(),
      attrs: { ...(opts.attrs ?? {}), parent: opts.parentSpanId ?? null },
    }
    this.spans.set(span.id, span)
    this.log.debug(`TraceCollector: span ${span.name} start (${span.id})`)
    void this.bus.publish('trace:span:start', { id: span.id, name: span.name }, 'TraceCollector')
    return span
  }

  endSpan(span: Span, result?: unknown): void {
    span.endMs = Date.now()
    if (result !== undefined) span.attrs.result = result
    this.log.debug(
      `TraceCollector: span ${span.name} end (duration=${span.endMs - span.startMs}ms)`,
    )
    void this.bus.publish(
      'trace:span:end',
      { id: span.id, durationMs: span.endMs - span.startMs, attrs: span.attrs },
      'TraceCollector',
    )
    this.spans.delete(span.id)
    if (this.spans.size > this.maxSpans) {
      const firstKey = this.spans.keys().next().value
      if (firstKey) this.spans.delete(firstKey)
    }
  }

  getSpans(filter?: { name?: string; sinceMs?: number }): Span[] {
    const all = Array.from(this.spans.values())
    if (!filter) return all
    return all.filter((s) => {
      if (filter.name && s.name !== filter.name) return false
      if (filter.sinceMs && s.startMs < filter.sinceMs) return false
      return true
    })
  }

  flush(): void {
    this.spans.clear()
    this.log.info('TraceCollector: flushed')
  }

  reset(): void {
    this.spans.clear()
  }

  static resetInstance(): void {
    if (TraceCollector.instance) TraceCollector.instance.reset()
  }
}