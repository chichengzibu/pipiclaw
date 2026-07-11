/**
 * PiPiClaw - Agent / ToolRegistry (W5.2.4)
 *
 * In-process registry for LLM-callable tools. Each tool is a name + JSON-Schema
 * description + async handler. Tools declaring `requiresPermission` are gated
 * via PermissionManager.checkPermission before invocation.
 */

import { LogManager } from '../core/LogManager'
import { EventBus } from '../runtime/bridge/EventBus'
import type { ToolCall, ToolResult } from '../contracts/types'
import type { ToolMetadata } from './AgentTypes'
import { PermissionManager } from '../permissions/PermissionManager'
import type { PermissionCheckRequest } from '../permissions/PermissionTypes'
import { randomUUID } from 'node:crypto'

export interface ToolDefinition {
  metadata: ToolMetadata
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

export class ToolRegistry {
  private static instance: ToolRegistry
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private permissionManager = PermissionManager.getInstance()
  private tools: Map<string, ToolDefinition> = new Map()

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) ToolRegistry.instance = new ToolRegistry()
    return ToolRegistry.instance
  }

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.metadata.name)) {
      this.log.warn(`ToolRegistry: ${tool.metadata.name} 已注册,覆盖`)
    }
    this.tools.set(tool.metadata.name, tool)
    this.log.info(`ToolRegistry: 注册 tool ${tool.metadata.name}`)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  list(): ToolMetadata[] {
    return Array.from(this.tools.values()).map((t) => t.metadata)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  async invoke(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return { ok: false, error: `Tool ${call.name} 未注册` }
    }
    if (tool.metadata.requiresPermission) {
      const request: PermissionCheckRequest = {
        category: 'system',
        action: 'execute',
        resource: call.name,
      }
      const result = this.permissionManager.checkPermission(request)
      if (!result.allowed) {
        await this.bus.publish('tool:denied', { name: call.name })
        return { ok: false, error: `Tool ${call.name} 未获权限: ${result.reason ?? ''}` }
      }
    }
    const startMs = Date.now()
    try {
      const data = await tool.handler(call.args)
      void this.bus.publish(
        'tool:result',
        { id: randomUUID(), name: call.name, ok: true, durationMs: Date.now() - startMs },
        'ToolRegistry',
      )
      return { ok: true, data }
    } catch (e) {
      const err = e instanceof Error ? e : String(e)
      void this.bus.publish(
        'tool:result',
        { id: randomUUID(), name: call.name, ok: false, durationMs: Date.now() - startMs, error: String(err) },
        'ToolRegistry',
      )
      return { ok: false, error: String(err) }
    }
  }
}