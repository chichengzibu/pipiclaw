export interface Prioritized<T> {
  readonly value: T
  readonly priority: number
  readonly deadline?: number
  readonly seq: number
}

/**
 * 出队规则:
 * 1. 有 deadline 且已过期的任务,优先级强制为 +Infinity
 * 2. 否则按 priority 倒序
 * 3. 同优先级按 seq(单调递增)升序
 */
export class PriorityQueue<T> {
  private items: Prioritized<T>[] = []
  private seqCounter = 0

  enqueue(value: T, priority = 0, deadline?: number): number {
    this.seqCounter += 1
    const seq = this.seqCounter
    this.items.push({ value, priority, deadline, seq })
    this.items.sort((a, b) => this.compare(a, b))
    return seq
  }

  dequeue(): T | null {
    const item = this.items.shift()
    return item?.value ?? null
  }

  peek(): T | null {
    return this.items[0]?.value ?? null
  }

  size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  clear(): void {
    this.items = []
  }

  private compare(a: Prioritized<T>, b: Prioritized<T>): number {
    const now = Date.now()
    const aExpired = a.deadline !== undefined && a.deadline < now
    const bExpired = b.deadline !== undefined && b.deadline < now
    const pa = aExpired ? Number.POSITIVE_INFINITY : a.priority
    const pb = bExpired ? Number.POSITIVE_INFINITY : b.priority
    if (pa !== pb) return pb - pa
    return a.seq - b.seq
  }
}