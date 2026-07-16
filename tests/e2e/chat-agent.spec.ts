import { test, expect } from '@playwright/test'

/**
 * Chat: 对话窗口与 Agent 集成
 * W12 阶段:全部 skip,需 Electron 窗口渲染
 */
test.describe('Chat Agent integration', () => {
  test.skip('true e2e requires Electron renderer', async () => {
    // 真实测试:
    // 1. 打开 Chat 窗口
    // 2. 输入 "ping"
    // 3. 验证 Agent 回复
    // 4. 验证流式输出分片
  })

  test('placeholder assertion', async () => {
    expect('hello'.length).toBe(5)
  })
})
