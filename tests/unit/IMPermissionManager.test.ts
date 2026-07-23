import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/pipiclaw-perm-test') },
}))

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: { resolvePathFn: () => {}, maxSize: 0, format: '' }, console: { level: 'info' } } },
}))

/**
 * P2-04: 权限规则 JSON 导入/导出
 *
 * 验证 IMPermissionManager:
 * - grant / revoke / check / listWhitelist
 * - listAll / exportToJson / importFromJson
 * - merge / replace 两种 import 模式
 * - clearAll
 */

import { IMPermissionManager } from '../../electron/channel/IMPermissionManager'

describe('P2-04: IMPermissionManager 基础 CRUD', () => {
  beforeEach(() => {
    ;(IMPermissionManager as unknown as { instance: IMPermissionManager | null }).instance = null
  })

  it('singleton', () => {
    const a = IMPermissionManager.getInstance()
    const b = IMPermissionManager.getInstance()
    expect(a).toBe(b)
  })

  it('grant + check 通过', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'user-1')
    expect(m.check('im-feishu', 'user-1')).toBe(true)
    expect(m.check('im-feishu', 'user-2')).toBe(false)
  })

  it('空白名单 → 全允许(默认策略)', () => {
    const m = IMPermissionManager.getInstance()
    expect(m.check('im-feishu', 'any-user')).toBe(true)
  })

  it('revoke 取消授权 → 空白名单回到全允许', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    expect(m.revoke('im-feishu', 'u1')).toBe(true)
    // 空白名单 = 全允许(默认策略)
    expect(m.check('im-feishu', 'u1')).toBe(true)
    expect(m.listWhitelist('im-feishu')).toEqual([])
  })

  it('grant 多个用户后 revoke 单个,其他用户仍受限', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-feishu', 'u2')
    m.revoke('im-feishu', 'u1')
    expect(m.listWhitelist('im-feishu')).toEqual(['u2'])
    expect(m.check('im-feishu', 'u1')).toBe(false) // u1 不在白名单
    expect(m.check('im-feishu', 'u2')).toBe(true)
  })

  it('revoke 不存在的 userId → false', () => {
    const m = IMPermissionManager.getInstance()
    expect(m.revoke('im-feishu', 'nope')).toBe(false)
  })

  it('listWhitelist 返回数组', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-feishu', 'u2')
    expect(m.listWhitelist('im-feishu').sort()).toEqual(['u1', 'u2'])
  })
})

describe('P2-04: IMPermissionManager 导入/导出', () => {
  beforeEach(() => {
    ;(IMPermissionManager as unknown as { instance: IMPermissionManager | null }).instance = null
  })

  it('listAll 返回全量快照', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-telegram', 'tg-user')
    const all = m.listAll()
    expect(all['im-feishu']).toEqual(['u1'])
    expect(all['im-telegram']).toEqual(['tg-user'])
  })

  it('exportToJson 输出标准 JSON', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-telegram', 'u2')
    const json = m.exportToJson()
    const parsed = JSON.parse(json)
    expect(parsed['im-feishu']).toEqual(['u1'])
    expect(parsed['im-telegram']).toEqual(['u2'])
  })

  it('importFromJson replace 模式:覆盖', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'old-user')
    const result = m.importFromJson(
      JSON.stringify({ 'im-telegram': ['new-user'] }),
      'replace',
    )
    expect(result.imported).toBe(1)
    // replace 模式:im-feishu 旧数据清掉 → 空白名单 = 全允许
    expect(m.check('im-feishu', 'old-user')).toBe(true)
    expect(m.check('im-telegram', 'new-user')).toBe(true)
  })

  it('importFromJson merge 模式:追加', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.importFromJson(
      JSON.stringify({ 'im-feishu': 'u1,u2,u3' }), // string 当 array 跳过
      'merge',
    )
    expect(m.check('im-feishu', 'u1')).toBe(true)
    expect(m.check('im-feishu', 'u2')).toBe(false) // string 不算 array
  })

  it('importFromJson merge:空 channel 也接受', () => {
    const m = IMPermissionManager.getInstance()
    const result = m.importFromJson(
      JSON.stringify({ 'im-feishu': ['u1'], 'im-empty': [] }),
      'merge',
    )
    expect(result.imported).toBe(1)
    expect(m.check('im-feishu', 'u1')).toBe(true)
  })

  it('importFromJson 无效 JSON → 抛错', () => {
    const m = IMPermissionManager.getInstance()
    expect(() => m.importFromJson('not-json{', 'replace')).toThrow(/JSON 解析失败/)
  })

  it('importFromJson 非 object → 抛错', () => {
    const m = IMPermissionManager.getInstance()
    // array 在 JS typeof === 'object',需要 null 判断
    expect(() => m.importFromJson('null', 'replace')).toThrow(/JSON 必须是 object/)
  })

  it('export → import 往返一致', () => {
    const m1 = IMPermissionManager.getInstance()
    m1.grant('im-feishu', 'a')
    m1.grant('im-feishu', 'b')
    m1.grant('im-telegram', 'tg1')
    const json = m1.exportToJson()
    // 模拟重启
    ;(IMPermissionManager as unknown as { instance: IMPermissionManager | null }).instance = null
    const m2 = IMPermissionManager.getInstance()
    m2.importFromJson(json, 'replace')
    expect(m2.listAll()).toEqual(m1.listAll())
  })

  it('clearAll 清空所有授权', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-telegram', 'u2')
    m.clearAll()
    expect(m.listAll()).toEqual({})
  })
})

describe('P2-04: IMPermissionManager 健壮性', () => {
  beforeEach(() => {
    ;(IMPermissionManager as unknown as { instance: IMPermissionManager | null }).instance = null
  })

  it('多次 grant 同一 userId 幂等', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-feishu', 'u1')
    m.grant('im-feishu', 'u1')
    expect(m.listWhitelist('im-feishu')).toEqual(['u1'])
  })

  it('grant 不同 channel 互不影响', () => {
    const m = IMPermissionManager.getInstance()
    m.grant('im-feishu', 'u1')
    m.grant('im-telegram', 'u1') // 同一 user,不同 channel
    // im-feishu 有 u1 → true
    expect(m.check('im-feishu', 'u1')).toBe(true)
    // im-telegram 有 u1 → true
    expect(m.check('im-telegram', 'u1')).toBe(true)
    // im-discord 空白名单 → 默认全允许
    expect(m.check('im-discord', 'u1')).toBe(true)
    // im-discord 加 u2 后,u1 不在白名单 → false
    m.grant('im-discord', 'u2')
    expect(m.check('im-discord', 'u1')).toBe(false)
  })
})
