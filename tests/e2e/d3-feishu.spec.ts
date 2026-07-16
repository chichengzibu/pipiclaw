import { test, expect } from '@playwright/test'

/**
 * D3: 飞书远程指令
 * W12 阶段:全部 skip,需真实 appId/appSecret
 */
test.describe('D3 Feishu remote', () => {
  test.skip('true e2e requires Feishu bot credentials', async () => {
    // 真实测试:
    // 1. 飞书 bot 收到 "ping PiPiClaw"
    // 2. 验证指令路由到 PiPiClaw
    // 3. 验证回复内容
  })

  test('placeholder assertion', async () => {
    expect('feishu').toBe('feishu')
  })
})
