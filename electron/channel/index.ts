/**
 * PiPiClaw - Channel 域入口 (W7.1)
 */

export { ChannelRouter } from './ChannelRouter'
export type {
  ChannelMetadata,
  ChannelKind,
  RouteRule,
  ChannelAuditEntry,
  ProcessedMessage,
  StoredMessage,
} from './ChannelTypes'
export { IMConfigStore } from './IMConfigStore'
export type { IMConfig } from './IMConfigStore'
export { IMMessageStore } from './IMMessageStore'
export { IMPermissionManager } from './IMPermissionManager'
export { IMSecurityManager } from './IMSecurityManager'
export { IMMessageRouter } from './IMMessageRouter'
export type { RouteDecision } from './IMMessageRouter'