/**
 * P0-Security Test 4: forceResetToPermissive 仅在 dev / 显式 IPC 触发
 *
 * 漏洞背景 (后端审计 C3 / 后端 P0-4):
 *   electron/main.ts:84-86 调 permissionConfig.forceResetToPermissive()
 *     改前: 每次启动强制覆盖 → RBAC 形同虚设
 *     M1 P0-1 修法 (2026-08-05):
 *       - 启动时**不再调用** forceResetToPermissive
 *       - 首次安装默认 safe (least privilege), 不是 permissive
 *       - 满足以下任一才真重置:
 *         1) options.force === true (UI 主动, IPC permissions:reset)
 *         2) PIPICLAW_DEV=1 (dev only)
 *         3) PIPICLAW_RESET_PERMISSIONS=1
 *       - 否则: 跳过, 尊重用户选择
 *       - 每次模式切换进 EventBus 'permission:mode-changed' (审计)
 *
 * 测法:
 *   - Test A: fresh userData 启动 + 不设 env → 默认 safe (least privilege)
 *   - Test B: 同一 userData + 不设 env 重启 → activeSetId 已设 → 跳过 reset → 仍上次选的
 *            流程: 第一次启动调 setActive('preset_unrestricted') → 第二次启动验证 active 保持 unrestricted
 *   - Test C: 第二次启动 + 设 env PIPICLAW_DEV=1 → 启动时仍不自动 reset (M1 新行为)
 *            改测: 显式 IPC `permissions:reset` 仍能切到 unrestricted
 */

import { test, expect } from '@playwright/test'
import { launchAndProbe, makeUserDataDir } from './_p0-helpers'

test.describe('P0 Security: forceResetToPermissive M1 P0-1 重构 — 默认 safe, 不再启动 auto-reset', () => {
  test('A. fresh userData 首次启动 + 不设 env → active 默认为 safe (least privilege)', async () => {
    const r = await launchAndProbe(makeUserDataDir('perm-A'))
    try {
      const active = await r.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        const res = await api?.permissions?.active?.()
        return res?.data ?? null
      })
      console.log(`  Test A: active.template=${active?.template}, active.id=${active?.id}`)
      expect(active).not.toBeNull()
      // M1 P0-1: 默认 safe (不是 permissive)
      expect(active.template, 'M1 P0-1: 首次安装默认 safe (least privilege)').toBe('safe')
    } finally {
      await r.app.close().catch(() => {})
    }
  }, { timeout: 60_000 })

  test('B. 重启 (activeSetId 已设) + 不设 env → 跳过 reset, 尊重用户上次选择', async () => {
    // 共享 userData: Test B 第一次启动 → setActive unrestricted (旧叫 permissive) → 关闭
    //              Test B 第二次启动 → 验证 active 保持 unrestricted (没被覆盖)
    const ud = makeUserDataDir('perm-B')

    // 第一次启动: 默认 safe → 用户主动切到 unrestricted (模拟高级用户场景)
    const r1 = await launchAndProbe(ud)
    try {
      const setRes = await r1.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        return await api?.permissions?.setActive?.('preset_permissive')
      })
      console.log(`  Test B run 1: setActive(preset_permissive) = ${JSON.stringify(setRes)}`)
      expect(setRes?.success, '应能 setActive preset_permissive (unrestricted 模板)').toBe(true)
    } finally {
      await r1.app.close().catch(() => {})
    }

    // 第二次启动: 验证 active 仍是 unrestricted (没被 force reset 覆盖)
    const r2 = await launchAndProbe(ud /* no env */)
    try {
      const active = await r2.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        const res = await api?.permissions?.active?.()
        return res?.data ?? null
      })
      console.log(`  Test B run 2 (重启): active.template=${active?.template}, active.id=${active?.id}`)
      // 改前: 每次启动都覆盖为 permissive
      // M1 P0-1: 跳过 reset, 保持用户上次的 unrestricted
      expect(active).not.toBeNull()
      expect(active.template, '重启 + 不设 env → 应保持用户上次选的 unrestricted (改前会覆盖)').toBe('permissive')
      // 验证展示名是 "无限制模式 ⚠️"
      expect(active.name, 'M1 P0-1: unrestricted 模板展示名带 ⚠️').toContain('无限制')
    } finally {
      await r2.app.close().catch(() => {})
    }
  }, { timeout: 120_000 })

  test('C. 显式 IPC permissions:reset → 仍能切回 unrestricted (force reset 工具保留)', async () => {
    // 共享 userData: Test C 第一次启动 → setActive safe → 关闭
    //              Test C 第二次启动 → 调 permissions:reset (force=true) → active=unrestricted
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

    // 第二次启动: 调 permissions:reset IPC (force=true 内部走 forceResetToPermissive)
    const r2 = await launchAndProbe(ud /* no env */)
    try {
      const resetRes = await r2.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        return await api?.permissions?.reset?.()
      })
      console.log(`  Test C run 2 reset: ${JSON.stringify(resetRes)}`)

      const active = await r2.win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        const res = await api?.permissions?.active?.()
        return res?.data ?? null
      })
      console.log(`  Test C run 2 (after reset): active.template=${active?.template}, active.id=${active?.id}`)
      expect(active).not.toBeNull()
      expect(active.template, 'IPC permissions:reset 应触发 force reset → active=unrestricted').toBe('permissive')
    } finally {
      await r2.app.close().catch(() => {})
    }
  }, { timeout: 120_000 })
})
