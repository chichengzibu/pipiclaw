/**
 * PiPiClaw - SandboxProxy (W11.2)
 *
 * 简单的 HTTP 转发层,供 PortForwarder / iframe 预览用。
 *
 * W11 阶段:stub(返回 200 placeholder)
 * W12+ 接 superagent / undici 真转发
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
    this.log.warn(`SandboxProxy.forward: W11 stub (${req.method} ${req.url} → ${targetUrl})`)
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: `<html><body><h1>W11 stub proxy</h1><p>${req.method} ${req.url}</p></body></html>`,
      durationMs: 0,
    }
  }
}