import { LogManager } from '../../core/LogManager'
import type { ActorBehavior, ActorId } from './Actor'

export class ActorRegistry {
  private static instance: ActorRegistry
  private log = LogManager.getInstance()
  private actors: Map<ActorId, ActorBehavior> = new Map()

  private constructor() {}

  public static getInstance(): ActorRegistry {
    if (!ActorRegistry.instance) {
      ActorRegistry.instance = new ActorRegistry()
    }
    return ActorRegistry.instance
  }

  register(actor: ActorBehavior): void {
    if (this.actors.has(actor.id)) {
      this.log.warn(`ActorRegistry: actor ${actor.id} 重复注册,覆盖`)
    }
    this.actors.set(actor.id, actor)
    this.log.debug(`ActorRegistry: 注册 actor ${actor.id} (type=${actor.type})`)
  }

  unregister(id: ActorId): void {
    this.actors.delete(id)
  }

  lookup(id: ActorId): ActorBehavior | undefined {
    return this.actors.get(id)
  }

  list(): ActorBehavior[] {
    return Array.from(this.actors.values())
  }

  listByType(type: string): ActorBehavior[] {
    return this.list().filter(a => a.type === type)
  }

  async stopAll(): Promise<void> {
    for (const a of Array.from(this.actors.values())) {
      await a.stop()
    }
    this.actors.clear()
    this.log.info('ActorRegistry: 全部 actor 已停止')
  }

  reset(): void {
    this.actors.clear()
  }
}