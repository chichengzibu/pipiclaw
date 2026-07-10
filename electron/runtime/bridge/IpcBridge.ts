import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { LogManager } from '../../core/LogManager'
import { EventBus } from './EventBus'
import type { ActorMessage, ActorId } from '../actor/Actor'
import { ActorRegistry } from '../actor/ActorRegistry'
import { randomUUID } from 'node:crypto'

const IPC_BRIDGE_CHANNEL = 'runtime:ipc-bridge'

export interface IpcBridgeMessage {
  from: ActorId
  type: string
  payload: unknown
}

/**
 * IpcBridge: 渲染进程 → 主进程 → runtime actor
 * 渲染进程通过 ipcRenderer.invoke('runtime:ipc-bridge', msg) 发消息
 * 主进程收到后,转发给对应 actor
 */
export class IpcBridge {
  private static instance: IpcBridge
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private registry = ActorRegistry.getInstance()
  private registered = false

  private constructor() {}

  public static getInstance(): IpcBridge {
    if (!IpcBridge.instance) {
      IpcBridge.instance = new IpcBridge()
    }
    return IpcBridge.instance
  }

  registerHandler(): void {
    if (this.registered) return
    ipcMain.handle(IPC_BRIDGE_CHANNEL, async (_: IpcMainInvokeEvent, msg: IpcBridgeMessage) => {
      this.log.debug(`IpcBridge: 收到 ${msg.from} 的 ${msg.type}`)
      await this.bus.publish(`ipc:${msg.type}`, msg.payload, msg.from)
      const actor = this.registry.lookup(msg.from)
      if (actor) {
        const actorMsg: ActorMessage = {
          id: randomUUID(),
          from: msg.from,
          to: msg.from,
          type: msg.type,
          payload: msg.payload,
          timestamp: Date.now(),
        }
        await actor.send(actorMsg)
      }
      return { success: true, bridge: 'ipc', echoed: msg.type }
    })
    this.registered = true
    this.log.info('IpcBridge: 已注册 IPC 监听')
  }

  async sendToRenderer(type: string, payload: unknown, source?: string): Promise<void> {
    await this.bus.publish(`renderer:${type}`, payload, source)
  }

  channel(): string {
    return IPC_BRIDGE_CHANNEL
  }
}