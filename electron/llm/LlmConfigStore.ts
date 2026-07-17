import { LogManager } from '../core/LogManager'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type { LlmConfig, LlmProvider } from './types'

export class LlmConfigStore {
  private static instance: LlmConfigStore
  private log = LogManager.getInstance()
  private storePath: string
  private configs: Map<string, LlmConfig> = new Map()

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), 'llm-config.json')
    this.loadFromDisk()
  }

  public static getInstance(): LlmConfigStore {
    if (!LlmConfigStore.instance) LlmConfigStore.instance = new LlmConfigStore()
    return LlmConfigStore.instance
  }

  get(provider: LlmProvider): LlmConfig | undefined {
    return this.configs.get(provider)
  }

  set(provider: LlmProvider, patch: Partial<LlmConfig>): void {
    const existing = this.configs.get(provider) ?? { provider, apiKey: '', enabled: false, updatedAt: Date.now() }
    const next: LlmConfig = { ...existing, ...patch, provider, updatedAt: Date.now() }
    this.configs.set(provider, next)
    this.persistToDisk()
    this.log.info(`LlmConfigStore: ${provider} updated (enabled=${next.enabled})`)
  }

  list(): LlmConfig[] {
    return [...this.configs.values()]
  }

  /** 获取当前启用的 provider config(按 enabled 顺序,优先第一个) */
  getActive(): LlmConfig | undefined {
    return [...this.configs.values()].find(c => c.enabled && c.apiKey)
  }

  remove(provider: LlmProvider): boolean {
    const ok = this.configs.delete(provider)
    if (ok) this.persistToDisk()
    return ok
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8')
        const arr = JSON.parse(data) as LlmConfig[]
        for (const c of arr) this.configs.set(c.provider, c)
      }
    } catch (e) {
      this.log.warn('LlmConfigStore: load failed', e)
    }
  }

  private persistToDisk(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true })
      fs.writeFileSync(this.storePath, JSON.stringify([...this.configs.values()], null, 2))
    } catch (e) {
      this.log.warn('LlmConfigStore: persist failed', e)
    }
  }
}
