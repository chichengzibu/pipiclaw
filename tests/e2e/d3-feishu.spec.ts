import { test, expect } from '@playwright/test'

/**
 * D3: 飞书远程指令
 *
 * 跳过原因:
 *   - 需要真实飞书 bot 凭证(LARK_APP_ID / LARK_APP_SECRET)
 *   - 需要公网回调地址(ngrok / cloudflared)
 *   - 需要 IMConfigStore 写入凭证并触发 token refresh
 *
 * 启用条件:见 doctring,需 sandbox appId + ngrok webhook
 * 已有覆盖:tests/integration/channel-to-agent.test.ts(IM message routing)
 */
test.describe.skip('D3 Feishu remote', () => {
  test('飞书 bot 收到 ping 并路由到 ChatManager', () => {
    // 占位实现 — 等真实凭证就绪后填充
    expect(true).toBe(true)
  })
})
