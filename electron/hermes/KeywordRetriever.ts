import { LogManager } from '../core/LogManager'
import type { Memory } from '../contracts/types'

export interface KeywordScore {
  memory: Memory
  score: number
  matchedTerms: string[]
}

const STOP_WORDS = new Set(['的', '了', '在', '是', '我', '你', '他', '她', '它', '和', '与', '或', 'a', 'the', 'is', 'and', 'or', 'but', 'in', 'on', 'at'])

/**
 * KeywordRetriever: 关键词检索(无依赖,TF-style)
 * 命中关键词越多分数越高;停用词过滤
 */
export class KeywordRetriever {
  private static instance: KeywordRetriever
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): KeywordRetriever {
    if (!KeywordRetriever.instance) KeywordRetriever.instance = new KeywordRetriever()
    return KeywordRetriever.instance
  }

  tokenize(text: string): string[] {
    return text
      .split(/[\s\p{P}]+/u)
      .filter(t => t.length > 0 && !STOP_WORDS.has(t.toLowerCase()))
      .map(t => t.toLowerCase())
  }

  search(query: string, memories: Memory[], topK = 5): KeywordScore[] {
    const queryTerms = this.tokenize(query)
    if (queryTerms.length === 0) return []
    const scores: KeywordScore[] = []
    for (const memory of memories) {
      const memoryTerms = this.tokenize(memory.content)
      const termSet = new Set(memoryTerms)
      const matched: string[] = []
      let hit = 0
      for (const qt of queryTerms) {
        if (termSet.has(qt)) {
          hit += 1
          matched.push(qt)
        }
      }
      if (hit > 0) {
        const score = hit / queryTerms.length
        scores.push({ memory, score, matchedTerms: matched })
      }
    }
    scores.sort((a, b) => b.score - a.score)
    return scores.slice(0, topK)
  }
}