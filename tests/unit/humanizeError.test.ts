import { describe, it, expect } from 'vitest'
import { humanizeError } from '../../src/utils/humanizeError'

/**
 * P4-T4.2: 错误消息人话化
 *
 * 验证 humanizeError 把技术错误翻译成中文 + 用户能懂的提示。
 */

describe('P4-T4.2: humanizeError 网络错误', () => {
  it('ECONNREFUSED → 本地服务没起来 + 提示检查端口', () => {
    const r = humanizeError(new Error('ECONNREFUSED 127.0.0.1:11434'))
    expect(r.kind).toBe('network')
    expect(r.userMessage).toContain('本地服务')
    expect(r.hint).toContain('端口')
  })

  it('ENOTFOUND → DNS 解析失败', () => {
    const r = humanizeError(new Error('getaddrinfo ENOTFOUND api.openai.com'))
    expect(r.kind).toBe('network')
    expect(r.userMessage).toContain('找不到服务器')
  })

  it('ETIMEDOUT → 超时', () => {
    const r = humanizeError(new Error('Request timeout after 30000ms'))
    expect(r.kind).toBe('network')
    expect(r.userMessage).toContain('超时')
  })

  it('EADDRINUSE → 端口已占用', () => {
    const r = humanizeError('Error: listen EADDRINUSE: address already in use :::3000')
    expect(r.kind).toBe('network')
    expect(r.userMessage).toContain('端口')
  })
})

describe('P4-T4.2: humanizeError 鉴权错误', () => {
  it('401 → API Key 不对 + 跳转提示', () => {
    const r = humanizeError(new Error('401 Unauthorized'))
    expect(r.kind).toBe('auth')
    expect(r.userMessage).toContain('API Key')
    expect(r.hint).toContain('Settings')
    expect(r.action?.route).toBe('/settings/llm-config')
  })

  it('invalid api key → 鉴权错误', () => {
    const r = humanizeError('invalid api key provided')
    expect(r.kind).toBe('auth')
    expect(r.userMessage).toContain('API Key')
  })

  it('403 → 权限不够', () => {
    const r = humanizeError(new Error('HTTP 403 Forbidden'))
    expect(r.kind).toBe('permission')
    expect(r.userMessage).toContain('权限')
  })
})

describe('P4-T4.2: humanizeError 业务错误', () => {
  it('429 → 限流', () => {
    const r = humanizeError(new Error('429 rate limit exceeded'))
    expect(r.kind).toBe('rate-limit')
    expect(r.userMessage).toContain('限流')
  })

  it('404 → 资源不存在', () => {
    const r = humanizeError(new Error('404 not found'))
    expect(r.kind).toBe('not-found')
    expect(r.userMessage).toContain('找不到')
  })

  it('OOM → 内存爆了', () => {
    const r = humanizeError(new Error('JavaScript heap out of memory'))
    expect(r.kind).toBe('oom')
    expect(r.userMessage).toContain('内存')
  })

  it('no provider → 还没配置', () => {
    const r = humanizeError(new Error('no LLM provider configured'))
    expect(r.kind).toBe('config')
    expect(r.userMessage).toContain('配置')
    expect(r.action?.route).toBe('/settings/llm-config')
  })
})

describe('P4-T4.2: humanizeError fallback', () => {
  it('未知错误 → 通用文案 + 保留 raw', () => {
    const r = humanizeError(new Error('weird alien error 0xDEADBEEF'))
    expect(r.kind).toBe('unknown')
    expect(r.userMessage).toContain('出错了')
    expect(r.raw).toBe('weird alien error 0xDEADBEEF')
  })

  it('非 Error 对象也能处理', () => {
    const r = humanizeError('string error 401')
    expect(r.kind).toBe('auth') // 401 匹配上了
  })

  it('非 Error 字符串且不匹配 → unknown', () => {
    const r = humanizeError('weird string')
    expect(r.kind).toBe('unknown')
  })

  it('userMessage 永远非空', () => {
    const errors = [
      new Error('a'),
      new Error('connection refused'),
      'string',
      null,
      undefined,
      42,
    ]
    for (const e of errors) {
      const r = humanizeError(e)
      expect(r.userMessage.length, `userMessage should be non-empty for ${String(e)}`).toBeGreaterThan(0)
    }
  })
})
