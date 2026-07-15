/**
 * PiPiClaw - Channel / ChannelTypes (W7.1)
 *
 * 通道域核心类型定义:ChannelKind / ChannelMetadata / RouteRule /
 * ChannelAuditEntry / ProcessedMessage。
 */

import type { ChannelMessage } from '../contracts/types'

/** 通道种类(11 个 IM + 后续可扩展) */
export type ChannelKind =
  | 'im-feishu'
  | 'im-dingtalk'
  | 'im-wechat-work'
  | 'im-wechat'
  | 'im-qq'
  | 'im-telegram'
  | 'im-slack'
  | 'im-discord'
  | 'im-whatsapp'
  | 'im-lark'
  | 'im-rocket'

/** 通道元信息(注册到 ChannelRouter 用) */
export interface ChannelMetadata {
  id: string
  kind: ChannelKind
  displayName: string
  enabled: boolean
  createdAt: number
  /** 该通道的"是否在 routing 时考虑" */
  priority: number
  /** 该通道的鉴权信息(从 IMConfigStore 加载) */
  configRef: string
}

/** 通道路由规则:哪条消息去哪个通道 */
export interface RouteRule {
  id: string
  /** 触发条件:正则匹配消息内容(例如 "日程|schedule") */
  trigger: string
  /** 目标通道种类 */
  targetChannel: ChannelKind
  /** 目标接收者 userId/chatId */
  targetUserId: string
  /** 优先级(0-100) */
  priority: number
  enabled: boolean
}

/** 通道审计日志项 */
export interface ChannelAuditEntry {
  ts: number
  channelId: string
  action: 'send' | 'receive' | 'auth-fail' | 'permission-deny'
  ok: boolean
  detail?: string
}

/** 消息处理结果(通道收到消息后,经 permission + security 后产出) */
export interface ProcessedMessage {
  id: string
  channelId: string
  raw: ChannelMessage
  /** 是否通过 permission 校验 */
  allowed: boolean
  /** 是否通过 security 校验(无恶意) */
  sanitized: boolean
  /** 拒绝原因(若 allowed=false 或 sanitized=false) */
  rejectReason?: string
  /** 已过滤的纯净内容 */
  cleanContent?: string
  ts: number
}