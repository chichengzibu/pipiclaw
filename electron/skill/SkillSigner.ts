import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import { createHash, createHmac } from 'node:crypto'

export interface SkillSignature {
  skillName: string
  hash: string
  signature: string
  signedAt: number
  signer: string
}

/**
 * SkillSigner: 给技能签名(W6 stub 版,用本地 HMAC)。
 * W6 阶段:用 HMAC-SHA256 做内容指纹(非真加密,签名可被绕过)
 * W7 阶段:接 Ed25519(node:crypto.generateKeyPairSync)
 * W8 阶段:接入 ClawHub 真实签名
 */
export class SkillSigner {
  private static instance: SkillSigner
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private signatures: Map<string, SkillSignature> = new Map()
  private readonly LOCAL_KEY = 'pipiclaw-local-stub-key-W6-do-not-use-in-prod'

  private constructor() {}

  public static getInstance(): SkillSigner {
    if (!SkillSigner.instance) SkillSigner.instance = new SkillSigner()
    return SkillSigner.instance
  }

  sign(skillName: string, content: string): SkillSignature {
    const hash = createHash('sha256').update(content).digest('hex')
    const signature = createHmac('sha256', this.LOCAL_KEY).update(content).digest('hex')
    const sig: SkillSignature = {
      skillName,
      hash,
      signature,
      signedAt: Date.now(),
      signer: 'local-stub',
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
    const expected = createHmac('sha256', this.LOCAL_KEY).update(content).digest('hex')
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