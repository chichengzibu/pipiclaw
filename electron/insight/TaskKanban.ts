/**
 * PiPiClaw - Insight / TaskKanban (W5.1)
 *
 * Lightweight in-memory 5-column task board used by AgentBrain to expose
 * progress to the Insights view (backlog / todo / doing / review / done).
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { randomUUID } from 'node:crypto'

export type KanbanColumn = 'backlog' | 'todo' | 'doing' | 'review' | 'done'
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface KanbanTask {
  id: string
  title: string
  description?: string
  column: KanbanColumn
  priority: KanbanPriority
  agentId?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
  tags?: string[]
}

export class TaskKanban {
  private static instance: TaskKanban
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private tasks: Map<string, KanbanTask> = new Map()

  private constructor() {}

  public static getInstance(): TaskKanban {
    if (!TaskKanban.instance) TaskKanban.instance = new TaskKanban()
    return TaskKanban.instance
  }

  createTask(
    input: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt' | 'column'> & {
      column?: KanbanColumn
    },
  ): KanbanTask {
    const now = Date.now()
    const task: KanbanTask = {
      id: randomUUID(),
      column: input.column ?? 'backlog',
      createdAt: now,
      updatedAt: now,
      ...input,
    }
    this.tasks.set(task.id, task)
    this.log.info(`TaskKanban: 创建任务 ${task.title} → ${task.column}`)
    void this.bus.publish(
      'kanban:task:created',
      { id: task.id, title: task.title },
      'TaskKanban',
    )
    return task
  }

  moveTask(id: string, toColumn: KanbanColumn): boolean {
    const t = this.tasks.get(id)
    if (!t) return false
    const from = t.column
    t.column = toColumn
    t.updatedAt = Date.now()
    if (toColumn === 'done') t.completedAt = Date.now()
    this.log.debug(`TaskKanban: ${t.title} ${from} → ${toColumn}`)
    void this.bus.publish(
      'kanban:task:moved',
      { id, from, to: toColumn },
      'TaskKanban',
    )
    return true
  }

  completeTask(id: string): boolean {
    return this.moveTask(id, 'done')
  }

  listTasks(opts?: {
    column?: KanbanColumn
    priority?: KanbanPriority
    agentId?: string
  }): KanbanTask[] {
    let tasks = Array.from(this.tasks.values())
    if (opts?.column) tasks = tasks.filter((t) => t.column === opts.column)
    if (opts?.priority) tasks = tasks.filter((t) => t.priority === opts.priority)
    if (opts?.agentId) tasks = tasks.filter((t) => t.agentId === opts.agentId)
    return tasks.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getTask(id: string): KanbanTask | undefined {
    return this.tasks.get(id)
  }

  deleteTask(id: string): boolean {
    const t = this.tasks.get(id)
    if (!t) return false
    this.tasks.delete(id)
    void this.bus.publish(
      'kanban:task:deleted',
      { id, title: t.title },
      'TaskKanban',
    )
    return true
  }
}