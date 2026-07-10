/**
 * PiPiClaw - Content Generation 能力域(W3 骨架,具体实现在 W6)
 *
 * 职责:多模态内容生成(图片 / 视频 / 音频 / 文档)。
 * 入口:见 spec 段 4 "关键接口签名"中的内容生成相关条目。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W6):在此目录下创建 ImageGenerator.ts / VideoGenerator.ts / 等。
 */

export const CONTENTGEN_DOMAIN = {
  id: 'contentgen',
  displayName: 'Content Generation',
  description: '多模态内容生成(图片 / 视频 / 音频 / 文档)',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[],
  dependencies: ['agent', 'connector'],
} as const

export type ContentGenDomainId = typeof CONTENTGEN_DOMAIN.id
