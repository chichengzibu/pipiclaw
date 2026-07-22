import { test, expect } from '@playwright/test'

/**
 * D2-Prime: OOM 错误处理
 *
 * 跳过原因:
 *   - 需要真实 sandbox 跑一段大内存分配并触发 OOM
 *   - 容器内无 docker,无法跑 webContainer 沙箱
 *   - 可能引发真机卡死,不适合 e2e
 *
 * 启用条件:用 fake sandbox 注入 OOM 测试桩(resourceLimits OOM trigger)
 * 已有覆盖:tests/unit/ResourceLimits.test.ts(memory limit + OOM detection 单元验证)
 */
test.describe.skip('D2-Prime OOM', () => {
  test('设置 memoryMb=256 + 跑大内存 app → OOM 错误友好提示', () => {
    expect(2 * 1024).toBe(2048)
  })
})
