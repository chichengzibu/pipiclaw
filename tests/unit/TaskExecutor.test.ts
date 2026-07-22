/**
 * TaskExecutor 单元测试
 *
 * 覆盖 Phase 3 Task 2:
 * - executeTask 走 OpenClawGateway.executeOperation
 * - cancel(taskId) 中止正在运行的任务
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock OpenClawGateway,避免引入 electron 依赖
const executeOperationMock = vi.fn(async ({ operationType, params }: any) => ({
  ok: true,
  operationType,
  params,
}))

vi.mock('../../electron/openclaw/OpenClawGateway', () => ({
  OpenClawGateway: {
    getInstance: () => ({
      executeOperation: (...args: any[]) => executeOperationMock(...args),
      getStatus: () => ({ state: 'running' }),
    }),
  },
}))

vi.mock('../../electron/core/LogManager', () => ({
  LogManager: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}))

import { TaskExecutor } from '../../electron/task/TaskExecutor'
import type { Task } from '../../electron/task/TaskTypes'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  conversationId: 'conv-1',
  messageId: 'msg-1',
  instruction: '测试',
  steps: [
    {
      id: 's1',
      order: 1,
      type: 'write_file' as any,
      description: '写入文件',
      params: { path: '/tmp/x.txt', content: 'hello' },
      status: 'pending' as any,
    },
  ],
  status: 'pending' as any,
  createdAt: Date.now(),
  ...overrides,
})

describe('TaskExecutor', () => {
  let executor: TaskExecutor

  beforeEach(() => {
    executeOperationMock.mockClear()
    executeOperationMock.mockImplementation(async ({ operationType, params }: any) => ({
      ok: true,
      operationType,
      params,
    }))
    // 重置 singleton,确保每个 case 状态独立
    ;(TaskExecutor as any).instance = undefined
    executor = TaskExecutor.getInstance()
  })

  it('executeTask happy path returns success and summary', async () => {
    const task = makeTask()
    const result = await executor.executeTask(task)
    expect(result.success).toBe(true)
    expect(result.summary).toBe('任务执行完成')
    expect(result.result?.steps?.length).toBe(1)
    expect(result.result?.steps?.[0].status).toBe('success')
  })

  it('executeTask aggregates failure and marks allSuccess=false', async () => {
    const task = makeTask({
      id: 'task-2',
      steps: [
        {
          id: 's1',
          order: 1,
          type: 'write_file' as any,
          description: '写入文件',
          params: { path: '/tmp/x.txt', content: 'hello' },
          status: 'pending' as any,
        },
        {
          id: 's2',
          order: 2,
          type: 'unsupported_op' as any,
          description: '未知操作',
          params: {},
          status: 'pending' as any,
        },
      ],
    })
    const result = await executor.executeTask(task)
    expect(result.success).toBe(false)
    expect(result.summary).toBe('任务部分执行失败')
    expect(result.result?.steps?.[0].status).toBe('success')
    expect(result.result?.steps?.[1].status).toBe('failed')
  })

  it('cancel(taskId) returns false for unknown task', () => {
    expect(executor.cancel('not-running')).toBe(false)
  })

  it('cancel(taskId) cancels a running task and marks remaining steps as cancelled', async () => {
    // 让 executeOperation 等待足够久,以便 cancel 能介入
    executeOperationMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 30))
      return { ok: true }
    })

    const task = makeTask({
      id: 'task-cancel',
      steps: [
        { id: 's1', order: 1, type: 'write_file' as any, description: '一', params: {}, status: 'pending' as any },
        { id: 's2', order: 2, type: 'write_file' as any, description: '二', params: {}, status: 'pending' as any },
        { id: 's3', order: 3, type: 'write_file' as any, description: '三', params: {}, status: 'pending' as any },
      ],
    })

    const execPromise = executor.executeTask(task)
    // 等到至少第一个步骤开始
    setTimeout(() => executor.cancel('task-cancel'), 5)
    const result = await execPromise

    expect(result.success).toBe(false)
    expect(result.summary).toBe('任务已取消')
    const lastStep = result.result?.steps?.[result.result.steps.length - 1]
    expect(lastStep?.status).toBe('cancelled')
    // 任务结束后,记录被清,再次 cancel 返回 false
    expect(executor.cancel('task-cancel')).toBe(false)
  })
})