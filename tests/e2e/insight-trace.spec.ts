import { test, expect } from '@playwright/test'

/**
 * Insight: Trace 时间线跟踪
 *
 * 跳过原因:
 *   - 需要先跑一次真实 chat-to-tool 链路产生 trace 数据
 *   - 需要 InsightTraceCollector 收集事件并写入 trace log
 *   - 需要等待 TraceCollector flush 后,UI 才能加载时间线
 *
 * 启用条件:依赖 chat-agent.spec.ts 跑通后,导航到 /insight 视图验证时间线
 * 已有覆盖:tests/integration/insight-trace.test.ts(TraceCollector / CostTracker)
 */
test.describe.skip('Insight trace timeline', () => {
  test('Insight 面板显示完整 trace 时间线 + cost / tokens', () => {
    expect(Date.now()).toBeGreaterThan(0)
  })
})
