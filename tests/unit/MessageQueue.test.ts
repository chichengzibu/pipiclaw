import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn((k: string) => `/tmp/pipiclaw-mq-${k}`) },
}))

vi.mock('electron-log', () => ({
  default: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    transports: {
      file: { resolvePathFn: () => {}, maxSize: 0, format: '', level: 'info' },
      console: { level: 'info', format: '' },
    },
  },
}))

import { MessageQueue } from '../../electron/runtime/actor/MessageQueue'
import type { ActorMessage } from '../../electron/runtime/actor/Actor'

const msg = (to: string, type: string, priority?: number): ActorMessage => ({
  id: `${to}-${type}-${Math.random()}`,
  to,
  type,
  payload: null,
  priority,
  timestamp: Date.now(),
})

describe('MessageQueue', () => {
  let q: MessageQueue

  beforeEach(() => {
    q = new MessageQueue()
  })

  it('enqueue then dequeue returns message', () => {
    q.enqueue(msg('a', 'ping'))
    const out = q.dequeue()
    expect(out?.type).toBe('ping')
  })

  it('dequeue on empty returns null', () => {
    expect(q.dequeue()).toBeNull()
  })

  it('peek returns head without removing', () => {
    q.enqueue(msg('a', 'one'))
    q.enqueue(msg('a', 'two'))
    const head = q.peek()
    expect(head?.type).toBe('one')
    expect(q.size()).toBe(2)
  })

  it('size and isEmpty track state', () => {
    expect(q.isEmpty()).toBe(true)
    q.enqueue(msg('a', 'ping'))
    expect(q.size()).toBe(1)
    expect(q.isEmpty()).toBe(false)
  })

  it('clear empties the queue', () => {
    q.enqueue(msg('a', 'ping'))
    q.enqueue(msg('a', 'pong'))
    q.clear()
    expect(q.isEmpty()).toBe(true)
    expect(q.dequeue()).toBeNull()
  })

  it('higher priority dequeued first', () => {
    q.enqueue(msg('a', 'low', 1))
    q.enqueue(msg('a', 'high', 10))
    q.enqueue(msg('a', 'mid', 5))
    expect(q.dequeue()?.type).toBe('high')
    expect(q.dequeue()?.type).toBe('mid')
    expect(q.dequeue()?.type).toBe('low')
  })

  it('same priority preserves FIFO order', () => {
    q.enqueue(msg('a', 'first', 5))
    q.enqueue(msg('a', 'second', 5))
    q.enqueue(msg('a', 'third', 5))
    expect(q.dequeue()?.type).toBe('first')
    expect(q.dequeue()?.type).toBe('second')
    expect(q.dequeue()?.type).toBe('third')
  })

  it('types returns current type list', () => {
    q.enqueue(msg('a', 'x'))
    q.enqueue(msg('a', 'y'))
    expect(q.types()).toEqual(['x', 'y'])
  })
})
