import type { ActorMessage } from './Actor'

/**
 * 优先级队列:数字越大越先出队
 * 同优先级按 FIFO
 */
export class MessageQueue {
  private items: Array<{ msg: ActorMessage; seq: number }> = []
  private seq = 0

  enqueue(msg: ActorMessage): void {
    this.seq += 1
    this.items.push({ msg, seq: this.seq })
    this.items.sort((a, b) => {
      const pa = a.msg.priority ?? 0
      const pb = b.msg.priority ?? 0
      if (pa !== pb) return pb - pa
      return a.seq - b.seq
    })
  }

  dequeue(): ActorMessage | null {
    const item = this.items.shift()
    return item?.msg ?? null
  }

  peek(): ActorMessage | null {
    return this.items[0]?.msg ?? null
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

  types(): string[] {
    return this.items.map(i => i.msg.type)
  }
}