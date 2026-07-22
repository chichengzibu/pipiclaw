import { test, expect } from '@playwright/test'

/**
 * D2-Prime: docker 缺失错误展示
 *
 * 跳过原因:
 *   - 需要"卸载 docker" — 这在 CI 容器无法实现
 *   - 错误展示依赖于 dockerDetector 检测链路 + 错误回传路径
 *   - 测试场景需要修改 sandbox/dockerDetector.ts 的 mock 状态
 *
 * 启用条件:用 fake sandbox 实现(DOCKER_MOCK_STATE=missing)替换 dockerDetector,再 e2e
 * 已有覆盖:tests/unit/DockerDetector.test.ts(detection 直接验证)
 */
test.describe.skip('D2-Prime docker missing', () => {
  test('缺失 docker 时展示友好错误提示', () => {
    expect('Docker 未安装').toContain('Docker')
  })
})
