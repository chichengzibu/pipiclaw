/**
 * PiPiClaw - Connector 能力域(W3 骨架,具体实现在 W8)
 *
 * 职责:外部服务连接器(MCP / OpenAPI / 数据库 / API 适配)。
 * 入口:Connector(见 spec 段 4 "关键接口签名")。
 *
 * 本期(W3.1):仅建立域根目录与 re-export 入口。
 * 后续(W8):在此目录下创建 McpConnector.ts / OpenApiConnector.ts / 等。
 */

export const CONNECTOR_DOMAIN = {
  id: 'connector',
  displayName: 'Connector',
  description: '外部服务连接器(MCP / OpenAPI / 数据库 / API 适配)',
  version: '0.0.1-w3-skeleton',
  capabilities: [] as readonly string[],
  dependencies: ['agent', 'permission'],
} as const

export type ConnectorDomainId = typeof CONNECTOR_DOMAIN.id
