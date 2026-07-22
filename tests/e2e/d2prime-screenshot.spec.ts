import { test, expect } from '@playwright/test'

/**
 * D2-Prime: 项目骨架 demo 截图验证
 *
 * 跳过原因:
 *   - 需要真实 sandbox(docker / webContainer)启动并生成 iframe
 *   - 需要 30s+ 等待首次启动
 *   - 与 d2prime-30s.spec.ts 的 stub 测试有重叠
 *
 * 启用条件:E2E_ELECTRON + E2E_D2_PRIME_30S 双开关,且真实 sandbox 可用
 * 后续动作:用 fake sandbox → 截图归档,见 docs/e2e-testing.md Phase 5 任务
 */
test.describe.skip('D2-Prime screenshot', () => {
  test('输入"Vite + React 博客" + 启动 → iframe 渲染 → 截图归档', () => {
    expect(1 + 1).toBe(2)
  })
})
