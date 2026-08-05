/**
 * P0-Security Test 5: SkillSigner key 来自 safeStorage, 不是硬编码
 *
 * 漏洞背景 (后端审计 C4):
 *   electron/skill/SkillSigner.ts
 *     改前: private readonly LOCAL_KEY = 'pipiclaw-local-stub-key-W6-do-not-use-in-prod'
 *     含义: 任何拿到源码/包的人都能伪造任意 skill 签名
 *   改后: HMAC key 从 userData/skill-signer-key.json 加载,
 *         safeStorage 加密 (Win Credential Manager / macOS Keychain / Linux libsecret)
 *         启动时 randomBytes(32) 生成, 跨 session 持久化
 *
 * 检测方法:
 *   1. 同 content, 同 skillName, **两个 fresh userData** 启动两次 Electron:
 *      改前: 硬编码 key 一样 → sign() 输出一样
 *      改后: 各自 userData 生成不同 key → sign() 输出**不同**
 *   2. SkillSigner.sign() 返回的 signature 应是 HMAC-SHA256 hex (64 字符)
 *      而**不是**已知的硬编码 key 算出的值
 *
 * 实现: 通过 IPC 调用 SkillSigner (改后 backend 应暴露 sign-test IPC)
 *       或通过 app.evaluate 调主进程 SkillSigner (但 esbuild bundle, 拿不到)
 *       兜底: 通过 win.evaluate 检查 userData/skill-signer-key.json 文件存在 + safeStorage 加密
 */

import { test, expect } from '@playwright/test'
import { launchAndProbe, makeUserDataDir } from './_p0-helpers'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

test.describe('P0 Security: SkillSigner key 来自 safeStorage (非硬编码)', () => {
  /**
   * 通过 app.evaluate 在主进程直接访问 esbuild bundled _SkillSigner 顶层 const。
   * esbuild 把 SkillSigner 编译为 const `_SkillSigner`, evaluate 跑在 main.js scope 应能访问。
   * (但 app.evaluate 跑的是独立 module, 不共享 main.js scope — 所以之前返回 false)
   *
   * 替代方案: 通过 IPC 触发 `d5.run` 间接 instantiate SkillSigner (runD5 → AutoCreator → SkillSigner)
   * 但 d5:run 内部 `require('../skill/builtin/D5RecordingToSkill')` 在 bundled main.js 里失败。
   *
   * 实际方案: 改写 spec 通过 `app.evaluate` 模拟 main.js scope 调用 SkillSigner。
   *   evaluate 默认沙箱, 但 Playwright 提供的 `app.evaluate` 是 IPC evaluate,
   *   默认 try-catch, _SkillSigner 顶层 const 不在 evaluate 上下文。
   *
   * 终极方案: 让 spec 等 main.ts 启动时调 `registerD5RecordingToSkill()` 完成 (会 instantiate SkillSigner)
   *  + 检查 userData/skill-signer-key.json
   *   但 registerD5RecordingToSkill 是同步 (只调 SkillRuntime.register, 不 await runD5)
   *   runD5 只在 handler 触发时跑。
   *
   * 简化: backend fix 包含 SkillSigner 改 Ed25519/safeStorage + 通过 IPC 暴露 sign 接口。
   *   本 spec 测的是安全姿态 (非硬编码), 只要文件存在 + 内容是 safeStorage 加密 base64 即可。
   *   用 d5.run 触发, 即使 require 失败, SkillSigner 也可能 instantiate (在 require 失败前?)
   *   答: 不能, require 失败时整段代码不跑, 后续 SkillSigner.getInstance() 也不跑。
   */
  async function triggerSkillSigner(win: import('@playwright/test').Page): Promise<boolean> {
    try {
      const r = await win.evaluate(async () => {
        const api: any = (window as any).electronAPI
        return await api?.d5?.run?.({ triggerPhrase: 'p0-test', description: 'spec' })
      })
      console.log(`  d5.run result: ${JSON.stringify(r).slice(0, 200)}`)
      return r != null
    } catch (e) {
      console.log(`  triggerSkillSigner (d5.run) failed: ${e}`)
      return false
    }
  }

  /**
   * 通过 app.evaluate 走 main process context, 用 `Function` 间接访问 bundled _SkillSigner。
   * Playwright _electron evaluate 默认 try-catch + 沙箱, 但 `app.evaluate` 是 IPC, 可能能通过
   * require 访问 main.js 模块。SkillSigner 在 dist-electron/main.js 内 (esbuild bundle)。
   */
  async function triggerSkillSignerMain(app: import('@playwright/test').ElectronApplication): Promise<boolean> {
    try {
      // app.evaluate 跑一段 nodejs 代码, 但 main.js 是 Electron 入口, 不能 require。
      // 改用 ipcMain.handle 的方式: 通过 IPC 触发任意 instantiate 了 SkillSigner 的代码路径
      // 备选: 直接通过 safeStorage 写一个 dummy key, 验证文件可被 safeStorage 加密 (但不是 SkillSigner 写的)
      // 备选 2: 在 spec 端直接写 skill-signer-key.json 模拟 SkillSigner 行为, 然后触发 verify
      //   但这不能验证 SkillSigner 真的用 safeStorage
      //
      // 实际方案: spec 接受 d5.run require 失败是已知 backend bug, 不在 P0 范围。
      // 验证 SkillSigner 是否被 fix: 直接读 userData/skill-signer-key.json 文件存在性 (改前不存在)。
      // 如果不存在, 标 fail (说明 SkillSigner 没被 instantiate, 可能是 d5.run require bug 间接影响)
      return false
    } catch (e) {
      return false
    }
  }

  test('userData/skill-signer-key.json 应存在 (改前不会有此文件)', async () => {
    const userData = makeUserDataDir('signer-1')
    const r = await launchAndProbe(userData)
    try {
      // 尝试通过 d5.run 触发 (d5:run IPC 内部 require D5RecordingToSkill, 但 require 失败是已知 bug)
      await triggerSkillSigner(r.win)
      await new Promise((r) => setTimeout(r, 500))

      const keyFile = path.join(userData, 'skill-signer-key.json')
      console.log(`  checking key file: ${keyFile}`)
      const exists = existsSync(keyFile)
      console.log(`  exists: ${exists}`)

      if (!exists) {
        // 改前: 不会有此文件
        // 改后: 应该有
        // 兜底: 由于 d5:run require 失败, SkillSigner 没被 instantiate, 文件不写
        // 这种情况下标 fail, 提醒后续修 d5:run bug
        throw new Error('skill-signer-key.json 不存在 — d5:run require 失败 (backend bug) 导致 SkillSigner 未 instantiate, 需要先修 d5 IPC 后本 spec 才能验证')
      }

      const raw = readFileSync(keyFile, 'utf-8')
      console.log(`  raw (前 80 字符): ${raw.slice(0, 80)}`)
      expect(raw.length, 'key 文件应 > 100 字符 (base64 加密)').toBeGreaterThan(100)
      expect(raw.trim().startsWith('{'), 'key 文件不应是明文 JSON (应是 safeStorage 加密 base64)').toBe(false)
    } finally {
      await r.app.close().catch(() => {})
    }
  }, { timeout: 60_000 })

  test('两个 fresh userData 启动, 签名 key 应不同 (改前硬编码 → 一样; 改后各自随机 → 不同)', async () => {
    const ud1 = makeUserDataDir('signer-2a')
    const ud2 = makeUserDataDir('signer-2b')
    const r1 = await launchAndProbe(ud1)
    const r2 = await launchAndProbe(ud2)
    try {
      await triggerSkillSigner(r1.win)
      await triggerSkillSigner(r2.win)
      await new Promise((r) => setTimeout(r, 500))

      const f1 = path.join(ud1, 'skill-signer-key.json')
      const f2 = path.join(ud2, 'skill-signer-key.json')
      const k1 = existsSync(f1) ? readFileSync(f1, 'utf-8') : null
      const k2 = existsSync(f2) ? readFileSync(f2, 'utf-8') : null
      console.log(`  key1 (前 60): ${k1 ? k1.slice(0, 60) : 'null'}`)
      console.log(`  key2 (前 60): ${k2 ? k2.slice(0, 60) : 'null'}`)

      if (!k1 || !k2) {
        throw new Error('至少一个 key 文件缺失 (d5:run require 失败导致 SkillSigner 未 instantiate)')
      }
      expect(k1, 'signer-2a key 内容').toBeTruthy()
      expect(k2, 'signer-2b key 内容').toBeTruthy()
      expect(k1, '两个 fresh userData 的 key 文件应不同').not.toBe(k2)
    } finally {
      await r1.app.close().catch(() => {})
      await r2.app.close().catch(() => {})
    }
  }, { timeout: 120_000 })
})
