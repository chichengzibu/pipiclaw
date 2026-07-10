import { LogManager } from '../../core/LogManager'
import { randomUUID } from 'node:crypto'

export type EventHandler = (payload: unknown) => void | Promise<void>
export type Unsubscribe = () => void

export interface BusEvent {
  readonly id: string
  readonly topic: string
  readonly payload: unknown
  readonly timestamp: number
  readonly source?: string
}

export class EventBus {
  private static instance: EventBus
  private log = LogManager.getInstance()
  private subscribers: Map<string, Set<EventHandler>> = new Map()
  private history: BusEvent[] = []
  private maxHistory = 100

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  subscribe(topic: string, handler: EventHandler): Unsubscribe {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set())
    }
    this.subscribers.get(topic)!.add(handler)
    return () => {
      this.subscribers.get(topic)?.delete(handler)
    }
  }

  async publish(topic: string, payload: unknown, source?: string): Promise<void> {
    const event: BusEvent = {
      id: randomUUID(),
      topic,
      payload,
      timestamp: Date.now(),
      source,
    }
    this.history.push(event)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
    const handlers = this.subscribers.get(topic)
    if (!handlers || handlers.size === 0) {
      this.log.debug(`EventBus: topic ${topic} 无订阅者`)
      return
    }
    for (const h of Array.from(handlers)) {
      try {
        await h(payload)
      } catch (e) {
        this.log.error(`EventBus: handler for ${topic} 失败`, e)
      }
    }
  }

  historyOf(topic?: string, limit = 50): BusEvent[] {
    const filtered = topic ? this.history.filter(e => e.topic === topic) : this.history
    return filtered.slice(-limit)
  }

  clear(): void {
    this.subscribers.clear()
    this.history = []
  }

  reset(): void {
    EventBus.instance = new EventBus()
  }
}