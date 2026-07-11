/**
 * PiPiClaw - Agent / ParallelScheduler (W5.2.3)
 *
 * Bounded-concurrency runner for SubTasks. Uses PriorityQueue for ordering.
 * Each task runs through the supplied handler; failures are captured into
 * the result object instead of throwing, so the batch keeps going.
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { PriorityQueue } from '../runtime/scheduler/PriorityQueue'
import type { SubTask } from '../contracts/types'
import { randomUUID } from 'node:crypto'

export interface ParallelSubTask extends SubTask {
  id: string
  priority: number
  result?: unknown
  error?: string
  durationMs?: number
  status: 'pending' | 'running' | 'success' | 'failed'
}

export class ParallelScheduler {
  private static instance: ParallelScheduler
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private queue: PriorityQueue<ParallelSubTask>
  private maxConcurrent: number

  private constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent
    this.queue = new PriorityQueue<ParallelSubTask>()
  }

  public static getInstance(): ParallelScheduler {
    if (!ParallelScheduler.instance) ParallelScheduler.instance = new ParallelScheduler()
    return ParallelScheduler.instance
  }

  enqueue(subtask: Omit<ParallelSubTask, 'id' | 'status'>): string {
    const task: ParallelSubTask = {
      id: randomUUID(),
      status: 'pending',
      ...subtask,
    }
    this.queue.enqueue(task, task.priority)
    this.log.debug(`ParallelScheduler: enqueue ${task.id} (priority=${task.priority})`)
    return task.id
  }

  async runAll(
    handler: (task: ParallelSubTask) => Promise<unknown>,
  ): Promise<ParallelSubTask[]> {
    const results: ParallelSubTask[] = []
    const inFlight = new Map<string, Promise<void>>()

    while (this.queue.size() > 0 || inFlight.size > 0) {
      while (inFlight.size < this.maxConcurrent && this.queue.size() > 0) {
        const task = this.queue.dequeue()
        if (!task) break
        task.status = 'running'
        const start = Date.now()
        const p = handler(task)
          .then((r) => {
            task.status = 'success'
            task.result = r
            task.durationMs = Date.now() - start
            results.push(task)
          })
          .catch((e) => {
            task.status = 'failed'
            task.error = String(e)
            task.durationMs = Date.now() - start
            results.push(task)
          })
        inFlight.set(task.id, p)
      }
      if (inFlight.size > 0) {
        await Promise.race(inFlight.values())
        // Drop resolved entries; pending ones stay for the next round.
        for (const [id, p] of Array.from(inFlight.entries())) {
          // Awaiting a non-thenable value resolves immediately, so race against p works.
          await p
          inFlight.delete(id)
        }
      }
    }
    return results
  }

  stats(): { queued: number; maxConcurrent: number } {
    return { queued: this.queue.size(), maxConcurrent: this.maxConcurrent }
  }
}