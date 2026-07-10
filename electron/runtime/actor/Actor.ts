import { LogManager } from '../../core/LogManager'

export type ActorId = string

export interface ActorMessage {
  readonly id: string
  readonly from?: ActorId
  readonly to: ActorId
  readonly type: string
  readonly payload: unknown
  readonly priority?: number
  readonly replyTo?: string
  readonly timestamp: number
}

export interface ActorBehavior {
  readonly id: ActorId
  readonly type: string
  send(msg: ActorMessage): Promise<void>
  receive(): Promise<ActorMessage | null>
  spawn(child: ActorBehavior): Promise<ActorId>
  stop(): Promise<void>
  onMessage(handler: (msg: ActorMessage) => Promise<void> | void): void
}

export abstract class BaseActor implements ActorBehavior {
  abstract readonly id: ActorId
  abstract readonly type: string
  protected log = LogManager.getInstance()
  protected children: Map<ActorId, ActorBehavior> = new Map()
  protected handlers: Array<(msg: ActorMessage) => Promise<void> | void> = []
  protected stopped = false

  abstract send(msg: ActorMessage): Promise<void>
  abstract receive(): Promise<ActorMessage | null>

  async spawn(child: ActorBehavior): Promise<ActorId> {
    this.children.set(child.id, child)
    this.log.debug(`Actor ${this.id} spawn child ${child.id}`)
    return child.id
  }

  async stop(): Promise<void> {
    this.stopped = true
    for (const child of Array.from(this.children.values())) {
      await child.stop()
    }
    this.children.clear()
    this.log.debug(`Actor ${this.id} stopped`)
  }

  onMessage(handler: (msg: ActorMessage) => Promise<void> | void): void {
    this.handlers.push(handler)
  }

  protected async dispatch(msg: ActorMessage): Promise<void> {
    for (const h of this.handlers) {
      try {
        await h(msg)
      } catch (e) {
        this.log.error(`Actor ${this.id} handler error`, e)
      }
    }
  }
}