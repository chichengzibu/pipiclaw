/**
 * PiPiClaw - Agent / RetryPolicy (W5.2.1)
 *
 * Exponential-backoff retry loop. Each attempt is classified via ErrorClassifier
 * and only retried when retryable. Bounded by maxAttempts.
 */

import { LogManager } from '../core/LogManager'
import { classifyError, type ClassifiedError } from './ErrorClassifier'

export interface RetryPolicyOptions {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_OPTS: RetryPolicyOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

export class RetryPolicy {
  private log = LogManager.getInstance()
  private opts: RetryPolicyOptions

  constructor(opts: Partial<RetryPolicyOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts }
  }

  /** Run `fn` under the retry policy. */
  async execute<T>(fn: () => Promise<T>, label = 'retry-block'): Promise<T> {
    let attempt = 0
    let lastErr: unknown = null
    while (attempt < this.opts.maxAttempts) {
      attempt += 1
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        const cls: ClassifiedError = classifyError(e)
        if (!cls.retryable || attempt >= this.opts.maxAttempts) {
          this.log.error(`RetryPolicy: ${label} final fail (attempt ${attempt})`, e)
          throw e
        }
        const delay = Math.min(
          this.opts.baseDelayMs * Math.pow(this.opts.backoffMultiplier, attempt - 1),
          this.opts.maxDelayMs,
        )
        this.log.warn(
          `RetryPolicy: ${label} attempt ${attempt} ${cls.kind}, backoff ${delay}ms`,
        )
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw lastErr
  }
}