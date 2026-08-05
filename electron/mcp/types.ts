/**
 * PiPiClaw - MCP (Model Context Protocol) 类型定义
 *
 * 参考: https://modelcontextprotocol.io/specification/2025-06-18
 * 实现子集: JSON-RPC 2.0 over stdio + tools/* 核心方法
 * 故意不做: resources/* / prompts/* / sampling (M1 范围外)
 */

// ========== JSON-RPC 2.0 基础类型 ==========

/**
 * JSON-RPC 2.0 request
 * - id: string|number|null (null = notification, 我们不主动发, 也不允许)
 * - method: 必填
 * - params: 可选, object 或 array
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

/**
 * JSON-RPC 2.0 response (成功)
 */
export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

/**
 * JSON-RPC 2.0 response (失败)
 * - code: -32700 (Parse) / -32600 (Invalid Request) / -32601 (Method not found)
 *         / -32602 (Invalid params) / -32603 (Internal error) / 服务端自定义 (-32000..-32099)
 * - message: 简短描述
 * - data: 额外上下文
 */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 notification (无 id, 不期待 response)
 * - 暂不主动发, 但解析子进程消息时要识别
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ========== MCP 工具定义 ==========

/**
 * MCP tool input schema (JSON Schema 子集)
 * 我们只支持 MCP 规范里实际用到的字段
 */
export interface McpToolInputSchema {
  type: 'object';
  properties?: Record<string, McpToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpToolPropertySchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number | boolean)[];
  items?: McpToolPropertySchema;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

/**
 * MCP tool 定义 (符合 tools/list 返回格式)
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

/**
 * MCP tool 执行结果 (符合 tools/call 返回格式)
 * content 数组里目前只生成 text 类型
 */
export interface McpToolResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } }
  >;
  isError?: boolean;
}

/**
 * tools/call request params
 */
export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

// ========== Server 配置 ==========

/**
 * MCP server 启动配置 (用户从 settings 填的)
 */
export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  /** 路径白名单 (filesystem server 专用, 其他 server 忽略) */
  allowedPaths?: string[];
  /** 启动超时 (ms), 默认 15000 */
  startupTimeoutMs?: number;
  /** 调用超时 (ms), 默认 30000 */
  callTimeoutMs?: number;
}

/**
 * MCP server 运行态
 */
export type McpServerState = 'stopped' | 'starting' | 'ready' | 'crashed' | 'stopping';

export interface McpServerStatus {
  name: string;
  state: McpServerState;
  pid: number | null;
  startedAt: number | null;
  lastError: string | null;
  toolCount: number;
}

/**
 * McpManager 暴露给上层的统一结果
 */
export interface McpInvokeResult {
  /** 找到 tool 并执行成功 */
  success: boolean;
  /** tool 返回的内容 (MCP 规范格式) */
  result?: McpToolResult;
  /** 错误信息 (success=false 时必有) */
  error?: string;
  /** 错误码 (JSON-RPC code) */
  errorCode?: number;
  /** 耗时 (ms) */
  durationMs: number;
}

// ========== 内部类型: 等待响应的 pending map ==========

/**
 * 在 transport 内部: 等待某个 id 的响应
 */
export interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  method: string;
}
