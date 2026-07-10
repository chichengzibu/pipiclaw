/**
 * PiPiClaw - Agent 能力域(W3 骨架,具体实现在 W5)
 *
 * 职责:Agent 思维链、并行调度、工具调用循环、子 Agent 派生、上下文压缩等。
 * 入口:AgentBrain(见 spec 段 4 "关键接口签名")。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W5):在此目录下创建 AgentBrain.ts / ParallelScheduler.ts / 等 17 文件。
 */

export const AGENT_DOMAIN = {
  id: 'agent',
  displayName: 'Agent',
  description: '主控 + 思维链 + 工具调用 + 子 Agent 派生',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[],
  dependencies: ['chat', 'memory', 'skill', 'permission', 'task', 'openclaw'],
} as const

export type AgentDomainId = typeof AGENT_DOMAIN.id
