/**
 * PiPiClaw - Computer Use 能力域(W3 骨架,具体实现在 W7)
 *
 * 职责:桌面 / 浏览器自动化(Computer Use)。
 * 入口:基于 BrowserManager(electron/browser)扩展。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W7):在此目录下创建 ComputerUseEngine.ts / BrowserAgent.ts / 等。
 */

export const COMPUTERUSE_DOMAIN = {
  id: 'computeruse',
  displayName: 'Computer Use',
  description: '桌面 / 浏览器自动化',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[],
  dependencies: ['agent', 'skill', 'browser'],
} as const

export type ComputerUseDomainId = typeof COMPUTERUSE_DOMAIN.id
