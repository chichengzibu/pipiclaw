/**
 * PiPiClaw - Agent / ContextCompressor (W5.2.4)
 *
 * Sliding-window compressor with a [compressed] placeholder. W5 does not call
 * the LLM for summarisation; W6 swaps the placeholder for an LLM-generated
 * summary when memory retrieval is wired in.
 */

import { LogManager } from '../core/LogManager'
import type { ThinkingStep } from './AgentTypes'

export interface CompressionOptions {
  maxTokens: number
  /** Fraction of original length to keep (0..1) */
  targetRatio: number
}

const DEFAULT_OPTS: CompressionOptions = { maxTokens: 8000, targetRatio: 0.5 }

export class ContextCompressor {
  private static instance: ContextCompressor
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): ContextCompressor {
    if (!ContextCompressor.instance) ContextCompressor.instance = new ContextCompressor()
    return ContextCompressor.instance
  }

  /** Rough estimate: 4 chars / token. */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  compressHistory(
    history: ThinkingStep[],
    opts: Partial<CompressionOptions> = {},
  ): ThinkingStep[] {
    const cfg: CompressionOptions = { ...DEFAULT_OPTS, ...opts }
    const totalText = history.map((h) => h.content).join('\n')
    const tokens = this.estimateTokens(totalText)
    if (tokens <= cfg.maxTokens) return history
    const target = Math.floor(history.length * cfg.targetRatio)
    if (target >= history.length) return history
    const keepHead = Math.floor(target / 2)
    const keepTail = target - keepHead
    const head = history.slice(0, keepHead)
    const tail = history.slice(history.length - keepTail)
    const placeholder: ThinkingStep = {
      id: 'compressed',
      ts: Date.now(),
      dimension: 'synthesis',
      content: `[compressed] ${history.length - head.length - tail.length} 步被压缩,原长 ${tokens} tokens`,
    }
    return [...head, placeholder, ...tail]
  }
}