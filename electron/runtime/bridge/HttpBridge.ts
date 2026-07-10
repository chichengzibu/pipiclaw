import { LogManager } from '../../core/LogManager'
import { EventBus } from './EventBus'

const OPENCLAW_DEFAULT_URL = 'http://127.0.0.1:18789'
const HTTP_BRIDGE_TIMEOUT_MS = 30_000

export interface HttpBridgeRequest {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export interface HttpBridgeResponse {
  ok: boolean
  status: number
  data: unknown
  error?: string
}

/**
 * HttpBridge: runtime actor ↔ openclaw HTTP server (18789)
 * 使用 node:http 客户端,避免在 main process 拉额外依赖
 */
export class HttpBridge {
  private static instance: HttpBridge
  private log = LogManager.getInstance()
  private bus = EventBus.getInstance()
  private baseUrl: string

  private constructor(baseUrl = OPENCLAW_DEFAULT_URL) {
    this.baseUrl = baseUrl
  }

  public static getInstance(): HttpBridge {
    if (!HttpBridge.instance) {
      HttpBridge.instance = new HttpBridge()
    }
    return HttpBridge.instance
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  async request(req: HttpBridgeRequest): Promise<HttpBridgeResponse> {
    const url = `${this.baseUrl}${req.path}`
    const method = req.method ?? 'GET'
    this.log.debug(`HttpBridge: ${method} ${url}`)
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...req.headers,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        // @ts-ignore - Node 18+ AbortSignal.timeout
        signal: AbortSignal.timeout(HTTP_BRIDGE_TIMEOUT_MS),
      })
      const text = await res.text()
      let data: unknown = text
      try {
        data = JSON.parse(text)
      } catch {
        // not JSON, keep as text
      }
      await this.bus.publish(`http:${method}:${req.path}`, { status: res.status, data }, 'HttpBridge')
      return { ok: res.ok, status: res.status, data }
    } catch (e) {
      this.log.error(`HttpBridge: ${method} ${url} 失败`, e)
      return { ok: false, status: 0, data: null, error: String(e) }
    }
  }

  async healthCheck(): Promise<boolean> {
    const res = await this.request({ path: '/health', method: 'GET' })
    return res.ok
  }
}