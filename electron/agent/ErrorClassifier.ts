/**
 * PiPiClaw - Agent / ErrorClassifier (W5.2.1)
 *
 * Maps unknown errors to a retry policy bucket:
 *  - transient       -> retry (network blips / timeouts)
 *  - rate-limit      -> backoff then retry
 *  - permanent       -> never retry (400/404/422)
 *  - permission      -> never retry (auth missing)
 *  - context-overflow-> retry after compressing
 *  - syntax          -> retry once (LLM bad output)
 *  - unknown         -> do not retry; surface to user
 */

export type ErrorKind =
  | 'transient'
  | 'permanent'
  | 'permission'
  | 'rate-limit'
  | 'context-overflow'
  | 'syntax'
  | 'unknown'

export interface ClassifiedError {
  kind: ErrorKind
  retryable: boolean
  hint?: string
}

export function classifyError(e: unknown): ClassifiedError {
  const msg = e instanceof Error ? e.message : String(e)
  const lower = msg.toLowerCase()
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('unauthorized')) {
    return { kind: 'permission', retryable: false, hint: '需要权限 token 或用户授权' }
  }
  if (lower.includes('rate') || lower.includes('429') || lower.includes('quota')) {
    return { kind: 'rate-limit', retryable: true, hint: '速率限制,backoff 后重试' }
  }
  if (lower.includes('context') || (lower.includes('token') && lower.includes('limit'))) {
    return { kind: 'context-overflow', retryable: true, hint: '上下文超限,先压缩再重试' }
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('syntax')) {
    return { kind: 'syntax', retryable: true, hint: 'LLM 输出格式错,重新生成' }
  }
  if (
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('network') ||
    lower.includes('503')
  ) {
    return { kind: 'transient', retryable: true, hint: '临时错误,重试' }
  }
  if (lower.includes('400') || lower.includes('404') || lower.includes('422')) {
    return { kind: 'permanent', retryable: false, hint: '永久错误,不重试' }
  }
  return { kind: 'unknown', retryable: false, hint: '未知错误,需人工确认' }
}