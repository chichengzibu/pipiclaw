import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { Memory } from '../contracts/types'

export interface VectorEntry {
  id: string
  memory: Memory
  vector: number[]
  norm: number
  ts: number
}

/**
 * MemoryVectorStore: 内存版向量检索存储。
 * W6 阶段:Map<id, {memory, vector, norm}>
 * W8 阶段:升级到 sqlite-vss 持久化
 *
 * 不引入新依赖。数值计算纯 JS(因向量数小,< 10000)。
 */
export class MemoryVectorStore {
  private static instance: MemoryVectorStore
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private entries: Map<string, VectorEntry> = new Map()
  private dimension: number = 64

  private constructor() {}

  public static getInstance(): MemoryVectorStore {
    if (!MemoryVectorStore.instance) MemoryVectorStore.instance = new MemoryVectorStore()
    return MemoryVectorStore.instance
  }

  async upsert(memory: Memory, vector: number[]): Promise<void> {
    if (vector.length !== this.dimension) {
      this.log.warn(`MemoryVectorStore: 向量维度 ${vector.length} 与配置 ${this.dimension} 不符,自动补/截断`)
      vector = this.normalizeDim(vector)
    }
    const entry: VectorEntry = {
      id: memory.id,
      memory,
      vector,
      norm: this.l2Norm(vector),
      ts: Date.now(),
    }
    this.entries.set(memory.id, entry)
    void this.bus.publish('vector:upsert', { id: memory.id, dim: vector.length })
  }

  async search(queryVector: number[], topK = 5, minScore = 0.1): Promise<Array<{ entry: VectorEntry; score: number }>> {
    if (queryVector.length !== this.dimension) {
      queryVector = this.normalizeDim(queryVector)
    }
    const queryNorm = this.l2Norm(queryVector)
    if (queryNorm === 0) return []
    const scored: Array<{ entry: VectorEntry; score: number }> = []
    for (const entry of Array.from(this.entries.values())) {
      if (entry.norm === 0) continue
      const dot = this.dotProduct(queryVector, entry.vector)
      const score = dot / (queryNorm * entry.norm)
      if (score >= minScore) {
        scored.push({ entry, score })
      }
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id)
  }

  list(): VectorEntry[] {
    return [...this.entries.values()]
  }

  size(): number {
    return this.entries.size
  }

  private normalizeDim(vec: number[]): number[] {
    if (vec.length === this.dimension) return vec
    if (vec.length > this.dimension) return vec.slice(0, this.dimension)
    return [...vec, ...new Array(this.dimension - vec.length).fill(0)]
  }

  private l2Norm(vec: number[]): number {
    let sum = 0
    for (const v of vec) sum += v * v
    return Math.sqrt(sum)
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
    return sum
  }

  reset(): void {
    this.entries.clear()
  }
}