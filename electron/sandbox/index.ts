/**
 * PiPiClaw - P7 Sandbox 能力域(W3 骨架,具体实现在 W9)
 *
 * 职责:代码执行沙箱(Docker / 进程隔离),含预览与审计。
 * 入口:Sandbox(见 spec 段 4 "关键接口签名")。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W9):在此目录下创建 SandboxBuilder.ts / SandboxRunner.ts / 等。
 */

export const SANDBOX_DOMAIN = {
  id: 'sandbox',
  displayName: 'P7 Sandbox',
  description: '代码执行沙箱(Docker / 进程隔离),含预览与审计',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[],
  dependencies: ['agent', 'insight', 'skill', 'permission'],
} as const

export type SandboxDomainId = typeof SANDBOX_DOMAIN.id
