/**
 * PiPiClaw - SandboxProxy (W13 真接)
 *
 * HTTP 转发层,把 renderer iframe 预览请求转发到 sandbox 内端口。
 *
 * - W11 阶段:stub(返回 placeholder HTML)
 * - W13 真接:Node 18+ 原生 fetch 真转发,8s timeout,响应 stream→string
 */

import { LogManager } from '../core/LogManager'

export interface ProxyRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export interface ProxyResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  durationMs: number
  /** W13 真接,失败时为 false;W11 阶段恒 true */
  stub: boolean
}

export class SandboxProxy {
  private static instance: SandboxProxy
  private log = LogManager.getInstance()

  private constructor() {}

  public static getInstance(): SandboxProxy {
    if (!SandboxProxy.instance) SandboxProxy.instance = new SandboxProxy()
    return SandboxProxy.instance
  }

  async forward(req: ProxyRequest, targetUrl: string): Promise<ProxyResponse> {
    const startMs = Date.now()
    const url = targetUrl.replace(/\/$/, '') + (req.url.startsWith('/') ? req.url : '/' + req.url)
    try {
      const fetchInit: RequestInit = {
        method: req.method,
        headers: { ...req.headers, host: new URL(url).host },
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (req.body ?? ''),
      }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      fetchInit.signal = ctrl.signal
      const resp = await fetch(url, fetchInit)
      clearTimeout(timer)
      const body = await resp.text()
      const headers: Record<string, string> = {}
      resp.headers.forEach((v, k) => { headers[k] = v })
      this.log.info(`SandboxProxy.forward: ${req.method} ${url} → ${resp.status} (${Date.now() - startMs}ms)`)
      return { statusCode: resp.status, headers, body, durationMs: Date.now() - startMs, stub: false }
    } catch (e) {
      const err = String((e as Error).message ?? e)
      this.log.warn(`SandboxProxy.forward failed: ${req.method} ${url} (${err})`)
      return {
        statusCode: 502,
        headers: { 'content-type': 'text/html' },
        body: `<html><body><h1>proxy error</h1><p>${req.method} ${req.url} → ${targetUrl}</p><pre>${err}</pre></body></html>`,
        durationMs: Date.now() - startMs,
        stub: false,
      }
    }
  }
}