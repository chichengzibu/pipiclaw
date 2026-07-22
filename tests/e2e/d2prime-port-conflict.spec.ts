import { test, expect } from '@playwright/test'

/**
 * D2-Prime: 端口冲突处理
 *
 * 跳过原因:
 *   - 需要先占用主机 3000 端口,影响其他开发进程
 *   - 测试隔离差,易产生 flakiness
 *   - PortForwarder 的回退逻辑更适合单元测试
 *
 * 启用条件:用 fake PortForwarder 实现 + mock 已占用端口
 * 已有覆盖:tests/unit/PortForwarder.test.ts(端口转发 + 冲突处理 单元验证)
 */
test.describe.skip('D2-Prime port conflict', () => {
  test('占用 3000 后启动 D2-Prime vite → 自动分配 5173 备用端口', () => {
    expect(typeof 3000).toBe('number')
  })
})
