/**
 * PiPiClaw - Agent 工具基础接口 (M1 v0.1)
 *
 * 跟 ClaudeCode 协议对齐: 每个 tool = { name, description, input_schema, execute() }.
 * 这是 In-process 的实现 (v0.1), 后续 M2 会拆到 MCP server 形式.
 */
import type { ToolMetadata } from '../AgentTypes'

/** 工具执行结果 (与 ToolResult 不同: 这里只覆盖 {ok, result, error}, ToolResult 在 contracts/types 是 ok/data/error 命名) */
export interface ToolExecResult {
  ok: boolean
  /** 人类可读的结果内容,LLM 会读这个 */
  result: string
  /** 错误时填这个,LLM 也会读 */
  error?: string
}

/** 工具接口 */
export interface PiPiTool {
  /** ToolMetadata 用于注册到 ToolRegistry / 透传给 LLM */
  metadata: ToolMetadata
  /** 真实执行, args 由 LLM tool_calls.function.arguments 解码得到 */
  execute(args: Record<string, unknown>): Promise<ToolExecResult>
}
