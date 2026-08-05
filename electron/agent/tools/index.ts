/**
 * PiPiClaw - Agent tools 索引 (M1 v0.1)
 *
 * 5 工具对齐 ClaudeCode: Read / Edit / Bash / Glob / Grep.
 * 导出: 5 个 class + 5 个 metadata + 通用 ToolExecResult / PiPiTool / Tool 接口.
 */
export { ReadTool, ReadToolMetadata } from './ReadTool'
export { EditTool, EditToolMetadata } from './EditTool'
export { BashTool, BashToolMetadata } from './BashTool'
export { GlobTool, GlobToolMetadata } from './GlobTool'
export { GrepTool, GrepToolMetadata } from './GrepTool'
export type { PiPiTool, ToolExecResult } from './Tool'

import { ReadTool } from './ReadTool'
import { EditTool } from './EditTool'
import { BashTool } from './BashTool'
import { GlobTool } from './GlobTool'
import { GrepTool } from './GrepTool'
import type { PiPiTool } from './Tool'

/** 5 工具默认实例数组 — LlmAgentBrain / ToolRegistry 用 */
export const BUILTIN_TOOLS: PiPiTool[] = [
  new ReadTool(),
  new EditTool(),
  new BashTool(),
  new GlobTool(),
  new GrepTool(),
]

/** 把 PiPiTool 列表转成 OpenAI-style LlmTool[] (LlmClient.chat.tools 字段用) */
export function toolsToLlmSchema(tools: PiPiTool[]): Array<{
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}> {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.metadata.name,
      description: t.metadata.description,
      parameters: t.metadata.parametersJson,
    },
  }))
}
