/**
 * P2-T3.2: D1ScreenshotQA handler 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { d1SkillDefinition } from '../../electron/skill/builtin/D1ScreenshotQA'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-test') },
}))

describe('P2-T3.2: D1ScreenshotQA handler', () => {
  it('有 imageDataUrl + question → 返回 captured 元数据 + 占位说明', async () => {
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const r = await d1SkillDefinition.handler!({ question: '描述这个图', imageDataUrl: tinyPng }, {} as never)
    expect(r.ok).toBe(true)
    expect((r as { captured?: { format: string; sizeBytes: number } }).captured?.format).toBe('PNG')
    expect((r as { captured?: { format: string; sizeBytes: number } }).captured?.sizeBytes).toBeGreaterThan(0)
    expect((r as { answer: string }).answer).toContain('描述这个图')
    expect((r as { answer: string }).answer).toContain('PNG')
  })

  it('无 imageDataUrl → 返回未提供图像提示', async () => {
    const r = await d1SkillDefinition.handler!({ question: 'x' }, {} as never)
    expect(r.ok).toBe(true)
    expect((r as { answer: string }).answer).toContain('未提供图像数据')
  })

  it('JPEG 格式识别', async () => {
    const tinyJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z'
    const r = await d1SkillDefinition.handler!({ question: 'x', imageDataUrl: tinyJpeg }, {} as never)
    expect((r as { captured?: { format: string } }).captured?.format).toBe('JPEG')
  })
})
