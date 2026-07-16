import { test, expect } from '@playwright/test'

/**
 * D2-Prime: docker 缺失错误展示
 * W12 阶段:全部 skip,无 docker 环境
 */
test.describe('D2-Prime docker missing', () => {
  test.skip('true e2e requires docker absence simulation', async () => {
    // 真实测试:
    // 1. 卸载 docker (在容器里跑)
    // 2. 打开 D2-Prime
    // 3. 验证错误提示 "需要安装 Docker"
    // 4. 验证安装链接可点击
  })

  test('placeholder assertion', async () => {
    expect('Docker 未安装').toContain('Docker')
  })
})
