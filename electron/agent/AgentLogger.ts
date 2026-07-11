/**
 * PiPiClaw - Agent / AgentLogger (W5.2.1)
 *
 * Agent-scoped logger. Mirrors entries to LogManager + EventBus so the UI
 * (and tests) can subscribe to agent:* logs without coupling to electron-log.
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'

export type AgentLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AgentLogEntry {
  ts: number
  level: AgentLogLevel
  source: string
  message: string
  context?: Record<string, unknown>
}

export class AgentLogger {
  private static instance: AgentLogger
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private source = 'Agent'

  private constructor() {}

  public static getInstance(): AgentLogger {
    if (!AgentLogger.instance) AgentLogger.instance = new AgentLogger()
    return AgentLogger.instance
  }

  private emit(level: AgentLogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: AgentLogEntry = {
      ts: Date.now(),
      level,
      source: this.source,
      message,
      context,
    }
    this.log[level](`[${this.source}] ${message}`, context)
    void this.bus.publish(`agent:log:${level}`, entry, this.source)
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, context)
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, context)
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.emit('warn', message, context)
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.emit('error', message, context)
  }

  setSource(source: string): void {
    this.source = source
  }
}