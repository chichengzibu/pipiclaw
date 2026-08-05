import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface SkillSignature {
  skillName: string
  hash: string
  signature: string
  signedAt: number
  signer: string
}

interface KeyRecord {
  /** hex 编码的 256-bit HMAC 密钥 */
  key: string
  generatedAt: number
  algorithm: 'HMAC-SHA256'
}

const SIGNER_KEY_FILE = 'skill-signer-key.json'

/**
 * 从 userData 加载或生成 HMAC 密钥。
 * - 启动时若文件不存在: randomBytes(32) 生成 256-bit 密钥 → safeStorage 加密 → 写盘
 * - safeStorage 不可用时 (Linux 无 keyring): base64 编码明文 + warn
 * - 文件存在但解密失败: 重新生成 (旧签名全部失效,慎用)
 */
function loadOrCreateKey(log: ReturnType<typeof LogManager.getInstance>): string {
  const keyPath = join(app.getPath('userData'), SIGNER_KEY_FILE)
  // 1. 尝试读取已有 key
  try {
    if (existsSync(keyPath)) {
      const raw = readFileSync(keyPath, 'utf-8')
      let plain: string
      try {
        plain = safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(Buffer.from(raw, 'base64'))
          : raw
      } catch {
        // 解密失败: 可能是旧版明文
        plain = raw
      }
      const parsed = JSON.parse(plain) as KeyRecord
      if (parsed?.key && /^[a-f0-9]{64}$/.test(parsed.key)) {
        return parsed.key
      }
    }
  } catch (e) {
    log.warn('[SkillSigner] 读取 key 文件失败,重新生成', e)
  }
  // 2. 生成新 key
  const newKey = randomBytes(32).toString('hex')
  const record: KeyRecord = { key: newKey, generatedAt: Date.now(), algorithm: 'HMAC-SHA256' }
  try {
    const dir = keyPath.replace(/[\\/][^\\/]+$/, '')
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
    const plain = JSON.stringify(record)
    const buf = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(plain)
      : Buffer.from(plain, 'utf-8')
    writeFileSync(keyPath, buf.toString('base64'))
    log.info('[SkillSigner] 生成新 HMAC key 并持久化', { keyPath, encrypted: safeStorage.isEncryptionAvailable() })
  } catch (e) {
    log.warn('[SkillSigner] key 持久化失败 (仅本次 session 可用)', e)
  }
  return newKey
}

/**
 * SkillSigner: 给技能签名 (W6 强化版)
 *
 * 历史: 之前硬编码 `pipiclaw-local-stub-key-W6-do-not-use-in-prod` 在源码里,
 * 任何拿到包的人都能伪造任意 skill 签名。ClawHub 导入第三方 skill 时
 * 信任链等于崩塌。
 *
 * 现状 (v4.4.1): HMAC 密钥从 userData/skill-signer-key.json 加载,
 * safeStorage 加密 (Win Credential Manager / macOS Keychain / Linux libsecret)。
 * Linux 无 keyring 时降级 base64 + warn,但 key 仍每次启动随机生成。
 *
 * W7+ 计划: Ed25519 公私钥分离,私钥走 OS keychain,导入第三方 skill 时强制 verify。
 */
export class SkillSigner {
  private static instance: SkillSigner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private signatures: Map<string, SkillSignature> = new Map()
  private localKey: string

  private constructor() {
    this.localKey = loadOrCreateKey(this.log)
  }

  public static getInstance(): SkillSigner {
    if (!SkillSigner.instance) SkillSigner.instance = new SkillSigner()
    return SkillSigner.instance
  }

  sign(skillName: string, content: string): SkillSignature {
    const hash = createHash('sha256').update(content).digest('hex')
    const signature = createHmac('sha256', this.localKey).update(content).digest('hex')
    const sig: SkillSignature = {
      skillName,
      hash,
      signature,
      signedAt: Date.now(),
      signer: 'local-hmac',
    }
    this.signatures.set(skillName, sig)
    void this.bus.publish('skill:signed', { skillName, hash: hash.slice(0, 16) })
    return sig
  }

  verify(skillName: string, content: string): boolean {
    const sig = this.signatures.get(skillName)
    if (!sig) return false
    const hash = createHash('sha256').update(content).digest('hex')
    if (hash !== sig.hash) return false
    const expected = createHmac('sha256', this.localKey).update(content).digest('hex')
    return signatureEquals(expected, sig.signature)
  }

  getSignature(skillName: string): SkillSignature | undefined {
    return this.signatures.get(skillName)
  }

  list(): SkillSignature[] {
    return [...this.signatures.values()]
  }
}

function signatureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}