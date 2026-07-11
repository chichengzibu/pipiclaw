/**
 * PiPiClaw - Agent / ToolSandboxAdapter (W5.2.4)
 *
 * Wraps tool calls with a sandbox policy. W5 ships `none` and `process` modes
 * (the latter falls back to `none`); `docker` / `webcontainer` land in W9
 * alongside the P7 sandbox.
 */

import { LogManager } from '../core/LogManager'
import type { ToolCall, ToolResult } from '../contracts/types'

export type SandboxMode = 'none' | 'process' | 'docker' | 'webcontainer'

export interface SandboxedToolOptions {
  mode: SandboxMode
  timeoutMs?: number
  memoryMb?: number
  allowPaths?: string[]
}

export class ToolSandboxAdapter {
  private static instance: ToolSandboxAdapter
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): ToolSandboxAdapter {
    if (!ToolSandboxAdapter.instance) ToolSandboxAdapter.instance = new ToolSandboxAdapter()
    return ToolSandboxAdapter.instance
  }

  async runInSandbox(
    call: ToolCall,
    opts: SandboxedToolOptions = { mode: 'none' },
  ): Promise<ToolResult> {
    if (opts.mode === 'none') {
      this.log.debug(`ToolSandboxAdapter[none]: ${call.name}`)
      return {
        ok: true,
        data: { stub: true, mode: 'none', tool: call.name, args: call.args },
      }
    }
    this.log.warn(
      `ToolSandboxAdapter: mode ${opts.mode} 未实装(W9+ 接入 P7 sandbox),降级为 stub`,
    )
    return {
      ok: true,
      data: { stub: true, mode: opts.mode, deferred: true, tool: call.name },
    }
  }
}