import { test, expect } from '@playwright/test'

/**
 * Insight: Trace 时间线跟踪
 * W12 阶段:全部 skip,需实际任务执行
 */
test.describe('Insight trace timeline', () => {
  test.skip('true e2e requires running tasks', async () => {
    // 真实测试:
    // 1. 跑一次 chat-to-tool 链路
    // 2. 打开 Insight 面板
    // 3. 验证 trace 时间线完整
    // 4. 验证 cost / tokens 展示
  })

  test('placeholder assertion', async () => {
    expect(Date.now()).toBeGreaterThan(0)
  })
})
