/**
 * P0-Security Test 4: forceResetToPermissive 仅在 dev / 首次启动触发
 *
 * 漏洞背景 (后端审计 C3):
 *   electron/main.ts:86 调 permissionConfig.forceResetToPermissive()
 *     改前: 每次启动强制覆盖 → RBAC 形同虚设
 *     改后: 满足以下任一才真重置:
 *       1) options.force === true (UI 主动, IPC permissions:reset)
 *       2) PIPICLAW_DEV=1
 *       3) PIPICLAW_RESET_PERMISSIONS=1
 *       4) activeSetId 为空 (首次启动)
 *     否则: 跳过, 尊重用户选择
 *
 * 测法:
 *   - Test A: fresh userData 启动 + 不设 env → first boot reset → active=permissive
 *   - Test B: 同一 userData + 不设 env 重启 → activeSetId 已设 → 跳过 reset → 仍上次选的
 *            流程: 第一次启动调 setActive('preset_safe') → 第二次启动验证 active 保持 safe
 *   - Test C: 第二次启动 + 设 env PIPICLAW_DEV=1 → 强制 reset → active=permissive
 */

import { test, expect } from '@playwright/test'
import { launchAndProbe, makeUserDataDir } from './_p0-helpers'

test.describe('P0 Security: forceResetToPermissive 仅在 dev / 首次启动触发', () => {
  test('A. fresh userData 首次启动 + 不设 env → active 初始化为 permissive (first boot reset)', async () => {
    const r = await launchAndProbe(makeUserDataDir('perm-A'))
    try {
      const active = await r.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        const res = await api?.permissions?.active?.()
        return res?.data ?? null
      })
      console.log(`  Test A: active.template=${active?.template}, active.id=${active?.id}`)
      expect(active).not.toBeNull()
      expect(active.template, '首次启动 first-boot reset → active=permissive').toBe('permissive')
    } finally {
      await r.app.close().catch(() => {})
    }
  }, { timeout: 60_000 })

  test('B. 重启 (activeSetId 已设) + 不设 env → 跳过 reset, 尊重用户上次选择 (safe)', async () => {
    // 共享 userData: Test B 第一次启动 → setActive safe → 关闭
    //              Test B 第二次启动 → 验证 active=safe (没被覆盖)
    const ud = makeUserDataDir('perm-B')

    // 第一次启动: 把 active 设为 safe (模拟用户已选)
    const r1 = await launchAndProbe(ud)
    try {
      const setRes = await r1.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        return await api?.permissions?.setActive?.('preset_safe')
      })
      console.log(`  Test B run 1: setActive(preset_safe) = ${JSON.stringify(setRes)}`)
      expect(setRes?.success, '应能 setActive preset_safe').toBe(true)
    } finally {
      await r1.app.close().catch(() => {})
    }

    // 第二次启动: 验证 active 仍是 safe (没被 force reset 覆盖)
    const r2 = await launchAndProbe(ud /* no env */)
    try {
      const active = await r2.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        const res = await api?.permissions?.active?.()
        return res?.data ?? null
      })
      console.log(`  Test B run 2 (重启): active.template=${active?.template}, active.id=${active?.id}`)
      // 改前: 每次启动都覆盖为 permissive
      // 改后: 跳过 reset, 保持用户上次的 safe
      expect(active).not.toBeNull()
      expect(active.template, '重启 + 不设 env → 应保持用户上次选的 safe (改前会覆盖)').toBe('safe')
    } finally {
      await r2.app.close().catch(() => {})
    }
  }, { timeout: 120_000 })

  test('C. 重启 + 设 env PIPICLAW_DEV=1 → 强制 reset → active=permissive (dev 模式仍生效)', async () => {
    // 共享 userData: Test C 第一次启动 → setActive safe → 关闭
    //              Test C 第二次启动 + PIPICLAW_DEV=1 → 验证 active=permissive
    const ud = makeUserDataDir('perm-C')

    const r1 = await launchAndProbe(ud)
    try {
      const setRes = await r1.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        return await api?.permissions?.setActive?.('preset_safe')
      })
      console.log(`  Test C run 1: setActive(preset_safe) = ${JSON.stringify(setRes)}`)
    } finally {
      await r1.app.close().catch(() => {})
    }

    const r2 = await launchAndProbe(ud, { PIPICLAW_DEV: '1' })
    try {
      const active = await r2.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        const res = await api?.permissions?.active?.()
        return res?.data ?? null
      })
      console.log(`  Test C run 2 (重启 + PIPICLAW_DEV=1): active.template=${active?.template}, active.id=${active?.id}`)
      expect(active).not.toBeNull()
      expect(active.template, 'PIPICLAW_DEV=1 应触发 force reset → active=permissive').toBe('permissive')
    } finally {
      await r2.app.close().catch(() => {})
    }
  }, { timeout: 120_000 })
})
