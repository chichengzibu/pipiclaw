import { PriorityQueue } from './PriorityQueue'

export type TaskState = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface ScheduledTask {
  readonly id: string
  readonly handler: () => Promise<unknown>
  priority: number
  deadline?: number
  state: TaskState
  enqueuedAt: number
  startedAt?: number
  completedAt?: number
  error?: string
  result?: unknown
}

/**
 * 任务队列封装。
 * 提供 FIFO 模式(priority=0 不排序),优先级模式(priority>0),
 * 和 deadline 模式(过期插队)。
 */
export class TaskQueue {
  private queue: PriorityQueue<ScheduledTask> = new PriorityQueue()
  private counter = 0

  enqueue(handler: () => Promise<unknown>, opts: { priority?: number; deadline?: number } = {}): ScheduledTask {
    this.counter += 1
    const task: ScheduledTask = {
      id: `task-${this.counter}`,
      handler,
      priority: opts.priority ?? 0,
      deadline: opts.deadline,
      state: 'pending',
      enqueuedAt: Date.now(),
    }
    this.queue.enqueue(task, task.priority, task.deadline)
    return task
  }

  dequeue(): ScheduledTask | null {
    return this.queue.dequeue()
  }

  peek(): ScheduledTask | null {
    return this.queue.peek()
  }

  size(): number {
    return this.queue.size()
  }

  clear(): void {
    this.queue.clear()
  }
}