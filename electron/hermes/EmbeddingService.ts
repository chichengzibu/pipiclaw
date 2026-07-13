import { LogManager } from '../core/LogManager'
import { createHash } from 'node:crypto'
import type { Memory } from '../contracts/types'

export type EmbeddingModel = 'stub-deterministic' | 'ollama-nomic' | 'openai-ada' | 'zhipu-embedding'

export interface EmbeddingOptions {
  model?: EmbeddingModel
  cache?: boolean
}

/**
 * EmbeddingService: 把文本转 64 维向量。
 * W6 阶段:仅 stub-deterministic(用 SHA-256 hash 生成种子,再展开成伪随机向量)
 * W7 阶段:接 Ollama nomic-embed 或 OpenAI text-embedding-3-small
 *
 * 不引入新 npm 依赖。
 */
export class EmbeddingService {
  private static instance: EmbeddingService
  private log = LogManager.getInstance()
  private cache: Map<string, number[]> = new Map()
  private dimension: number = 64

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) EmbeddingService.instance = new EmbeddingService()
    return EmbeddingService.instance
  }

  async embedText(text: string, opts: EmbeddingOptions = {}): Promise<number[]> {
    const model = opts.model ?? 'stub-deterministic'
    const cacheKey = `${model}::${text}`
    if (opts.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    let vector: number[]
    if (model === 'stub-deterministic') {
      vector = this.hashToVector(text)
    } else {
      this.log.warn(`EmbeddingService: model ${model} 未实装,降级 stub-deterministic`)
      vector = this.hashToVector(text)
    }
    if (opts.cache !== false) this.cache.set(cacheKey, vector)
    return vector
  }

  async embedMemory(memory: Memory, opts: EmbeddingOptions = {}): Promise<number[]> {
    return this.embedText(memory.content, opts)
  }

  async embedBatch(texts: string[], opts: EmbeddingOptions = {}): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t, opts)))
  }

  private hashToVector(text: string): number[] {
    const hash = createHash('sha256').update(text).digest()
    const vector: number[] = []
    const hash2 = createHash('sha256').update(hash).digest()
    for (let i = 0; i < this.dimension; i++) {
      const byte = i < hash.length ? hash[i] : hash2[i - hash.length]
      vector.push((byte - 127.5) / 127.5)
    }
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    if (norm > 0) for (let i = 0; i < vector.length; i++) vector[i] = vector[i] / norm
    return vector
  }

  clearCache(): void {
    this.cache.clear()
  }

  cacheSize(): number {
    return this.cache.size
  }
}