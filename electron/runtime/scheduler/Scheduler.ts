import { LogManager } from '../../core/LogManager'
import { EventBus } from '../bridge/EventBus'
import { TaskQueue, ScheduledTask } from './TaskQueue'

export type SchedulingStrategy = 'fifo' | 'priority' | 'deadline'

export interface SchedulerOptions {
  maxConcurrent?: number
  strategy?: SchedulingStrategy
  taskTimeoutMs?: number
}

export class Scheduler {
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private queue: TaskQueue
  private maxConcurrent: number
  private strategy: SchedulingStrategy
  private taskTimeoutMs: number
  private running: Map<string, ScheduledTask> = new Map()
  private stopped = false

  constructor(opts: SchedulerOptions = {}) {
    this.maxConcurrent = opts.maxConcurrent ?? 4
    this.strategy = opts.strategy ?? 'priority'
    this.taskTimeoutMs = opts.taskTimeoutMs ?? 0
    this.queue = new TaskQueue()
  }

  enqueue(handler: () => Promise<unknown>, opts: { priority?: number; deadline?: number } = {}): ScheduledTask {
    if (this.stopped) {
      throw new Error('Scheduler 已停止')
    }
    let priority = opts.priority ?? 0
    if (this.strategy === 'fifo') priority = 0
    return this.queue.enqueue(handler, { priority, deadline: opts.deadline })
  }

  async tick(): Promise<number> {
    if (this.stopped) return 0
    let dispatched = 0
    while (this.running.size < this.maxConcurrent) {
      const task = this.queue.dequeue()
      if (!task) break
      this.startTask(task)
      dispatched += 1
    }
    return dispatched
  }

  async runUntilEmpty(): Promise<void> {
    while (this.queue.size() > 0 || this.running.size > 0) {
      await this.tick()
      await new Promise(r => setTimeout(r, 10))
    }
  }

  stop(): void {
    this.stopped = true
    for (const t of Array.from(this.running.values())) {
      t.state = 'cancelled'
    }
    this.running.clear()
    this.queue.clear()
    this.log.info('Scheduler 已停止')
  }

  stats() {
    return {
      queued: this.queue.size(),
      running: this.running.size,
      maxConcurrent: this.maxConcurrent,
      strategy: this.strategy,
    }
  }

  private startTask(task: ScheduledTask): void {
    task.state = 'running'
    task.startedAt = Date.now()
    this.running.set(task.id, task)
    void this.bus.publish('scheduler:task:start', { id: task.id }, 'Scheduler')

    const execute = async () => {
      try {
        const timeout = this.taskTimeoutMs > 0
          ? new Promise<never>((_, reject) => setTimeout(() => reject(new Error('task timeout')), this.taskTimeoutMs))
          : null
        const result = timeout
          ? await Promise.race([task.handler(), timeout])
          : await task.handler()
        task.state = 'success'
        task.result = result
        task.completedAt = Date.now()
        void this.bus.publish('scheduler:task:success', { id: task.id, result }, 'Scheduler')
      } catch (e) {
        task.state = 'failed'
        task.error = String(e)
        task.completedAt = Date.now()
        this.log.error(`Scheduler: task ${task.id} 失败`, e)
        void this.bus.publish('scheduler:task:failed', { id: task.id, error: task.error }, 'Scheduler')
      } finally {
        this.running.delete(task.id)
        setImmediate(() => void this.tick())
      }
    }

    void execute()
  }
}