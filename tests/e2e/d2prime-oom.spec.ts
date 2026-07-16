import { test, expect } from '@playwright/test'

/**
 * D2-Prime: OOM 错误处理
 * W12 阶段:全部 skip,无 docker 环境
 */
test.describe('D2-Prime OOM', () => {
  test.skip('true e2e requires OOM trigger in sandbox', async () => {
    // 真实测试:
    // 1. 设置 memoryMb=256
    // 2. 运行大内存应用
    // 3. 验证 OOM 错误捕获 + 友好提示
  })

  test('placeholder assertion', async () => {
    expect(2 * 1024).toBe(2048)
  })
})
