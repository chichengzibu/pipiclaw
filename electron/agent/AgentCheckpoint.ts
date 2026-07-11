/**
 * PiPiClaw - Agent / AgentCheckpointStore (W5.2.5)
 *
 * Persists AgentCheckpointState to userData/checkpoints/{id}.json. W6 will
 * also rebuild Hermes memories when restoring; W5 only re-hydrates history.
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import type { AgentCheckpointState } from './AgentTypes'

export class AgentCheckpointStore {
  private static instance: AgentCheckpointStore
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private storeDir: string

  private constructor() {
    this.storeDir = path.join(app.getPath('userData'), 'checkpoints')
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true })
    }
  }

  public static getInstance(): AgentCheckpointStore {
    if (!AgentCheckpointStore.instance) AgentCheckpointStore.instance = new AgentCheckpointStore()
    return AgentCheckpointStore.instance
  }

  async save(state: AgentCheckpointState): Promise<string> {
    const id = `${state.conversationId}-${Date.now()}-${randomUUID().slice(0, 6)}`
    const filePath = path.join(this.storeDir, `${id}.json`)
    try {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2))
      this.log.info(`AgentCheckpoint: saved ${id}`)
      await this.bus.publish(
        'checkpoint:saved',
        { id, conversationId: state.conversationId },
        'AgentCheckpoint',
      )
      return id
    } catch (e) {
      this.log.error(`AgentCheckpoint: save ${id} failed`, e)
      throw e
    }
  }

  async load(id: string): Promise<AgentCheckpointState | null> {
    const filePath = path.join(this.storeDir, `${id}.json`)
    try {
      if (!fs.existsSync(filePath)) return null
      const data = fs.readFileSync(filePath, 'utf-8')
      const state = JSON.parse(data) as AgentCheckpointState
      this.log.info(
        `AgentCheckpoint: loaded ${id}, ${state.history.length} history steps`,
      )
      return state
    } catch (e) {
      this.log.warn(`AgentCheckpoint: load ${id} failed`, e)
      return null
    }
  }

  list(): string[] {
    try {
      return fs
        .readdirSync(this.storeDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
    } catch {
      return []
    }
  }

  delete(id: string): boolean {
    const filePath = path.join(this.storeDir, `${id}.json`)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}