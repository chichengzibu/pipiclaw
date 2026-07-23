import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-crash-test'), getVersion: vi.fn(() => '3.1.0') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P5-T5.4: CrashReport 收集器
 *
 * 验证 crash 报告的 record / list / get / clear / count 全链路。
 */

import { CrashReportCollector } from '../../electron/insight/CrashReport'

const TEST_USER_DATA = '/tmp/pipiclaw-crash-test'
const REPORTS_DIR = path.join(TEST_USER_DATA, 'crash-reports')

describe('P5-T5.4: CrashReportCollector', () => {
  beforeEach(() => {
    ;(CrashReportCollector as unknown as { instance: CrashReportCollector | null }).instance = null
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true })
    }
  })

  it('singleton returns same instance', () => {
    const a = CrashReportCollector.getInstance()
    const b = CrashReportCollector.getInstance()
    expect(a).toBe(b)
  })

  it('record 写一个 crash 报告到 userData/crash-reports/', () => {
    const collector = CrashReportCollector.getInstance()
    const id = collector.record('uncaughtException', new Error('boom'))
    expect(id).toMatch(/^crash-/)
    expect(fs.existsSync(REPORTS_DIR)).toBe(true)
    const files = fs.readdirSync(REPORTS_DIR)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/\.json$/)
  })

  it('记录包含完整信息(时间 / 类型 / 错误 / 版本 / 平台)', () => {
    const collector = CrashReportCollector.getInstance()
    const id = collector.record('unhandledRejection', new Error('rejected promise'))
    const data = collector.get(id)
    expect(data).not.toBeNull()
    expect(data!.type).toBe('unhandledRejection')
    expect(data!.error.message).toBe('rejected promise')
    expect(data!.error.name).toBe('Error')
    expect(data!.appVersion).toBe('3.1.0')
    expect(data!.platform).toBeTruthy()
    expect(data!.arch).toBeTruthy()
    expect(data!.nodeVersion).toBeTruthy()
    expect(data!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(data!.uptimeMs).toBeGreaterThanOrEqual(0)
  })

  it('list 按时间倒序返回所有报告', () => {
    const collector = CrashReportCollector.getInstance()
    const id1 = collector.record('uncaughtException', new Error('first'))
    // sleep 10ms 保证 timestamp 不同
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    return sleep(20).then(() => {
      const id2 = collector.record('unhandledRejection', new Error('second'))
      const reports = collector.list()
      expect(reports.length).toBe(2)
      // 最新的在前面
      expect(reports[0].id).toBe(id2)
      expect(reports[1].id).toBe(id1)
    })
  })

  it('get 不存在的 id 返回 null', () => {
    const collector = CrashReportCollector.getInstance()
    expect(collector.get('nonexistent-12345')).toBeNull()
  })

  it('clear 清空所有报告,返回清掉的个数', () => {
    const collector = CrashReportCollector.getInstance()
    collector.record('uncaughtException', new Error('a'))
    collector.record('unhandledRejection', new Error('b'))
    collector.record('render-process-gone', new Error('c'))
    expect(collector.count()).toBe(3)

    const cleared = collector.clear()
    expect(cleared).toBe(3)
    expect(collector.count()).toBe(0)
  })

  it('count 空目录返回 0', () => {
    const collector = CrashReportCollector.getInstance()
    expect(collector.count()).toBe(0)
  })

  it('install 注册 process 级监听器', () => {
    const collector = CrashReportCollector.getInstance()
    const before = process.listenerCount('uncaughtException')
    collector.install()
    const after = process.listenerCount('uncaughtException')
    expect(after).toBeGreaterThan(before)
  })

  it('install 幂等(只装一次)', () => {
    const collector = CrashReportCollector.getInstance()
    const before = process.listenerCount('uncaughtException')
    collector.install()
    const after1 = process.listenerCount('uncaughtException')
    collector.install()
    const after2 = process.listenerCount('uncaughtException')
    expect(after1).toBeGreaterThan(before)
    expect(after2).toBe(after1) // 没新增
  })

  it('context 字段透传(可选)', () => {
    const collector = CrashReportCollector.getInstance()
    const id = collector.record('uncaughtException', new Error('with context'), {
      taskId: 'task-123',
      phase: 'execute',
    })
    const data = collector.get(id)
    expect(data!.context).toEqual({ taskId: 'task-123', phase: 'execute' })
  })

  it('stack 字段被记录(供开发者调试)', () => {
    const collector = CrashReportCollector.getInstance()
    const err = new Error('with stack')
    const id = collector.record('uncaughtException', err)
    const data = collector.get(id)
    expect(data!.error.stack).toBeDefined()
    expect(data!.error.stack).toContain('with stack')
  })
})
