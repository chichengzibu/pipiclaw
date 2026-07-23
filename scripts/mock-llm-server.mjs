#!/usr/bin/env node
/**
 * PiPiClaw Mock LLM Server (P1-T1.4)
 *
 * 模拟 OpenAI chat/completions 端点,返回可控响应。
 * 用法:
 *   node scripts/mock-llm-server.mjs [port]
 *   默认端口 9999,可通过 MOCK_LLM_PORT 环境变量覆盖
 *
 * 行为:
 *   - POST /v1/chat/completions:返回 { choices: [{ message: { content: "MOCK_RESPONSE_<ts>" } }] }
 *   - 记录所有请求到 stdout(便于 e2e 验证)
 *   - 健康检查 GET /health:返回 { status: "ok" }
 *
 * 用途:
 *   - E2E 测试"LLM 真回了" — 不用真 OpenAI API
 *   - CI 中无外网时也能跑 LLM 链路验证
 */

import { createServer } from 'node:http'

const port = parseInt(process.env.MOCK_LLM_PORT || process.argv[2] || '9999', 10)
let requestCount = 0

const server = createServer((req, res) => {
  const ts = new Date().toISOString()
  requestCount += 1

  // CORS 允许(测试期间前端可能跨域访问)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ status: 'ok', requestCount, uptime: process.uptime() }))
    return
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = ''
    req.on('data', (chunk) => { body += chunk.toString('utf-8') })
    req.on('end', () => {
      let payload
      try {
        payload = JSON.parse(body)
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: { message: 'invalid JSON' } }))
        return
      }

      // 取出 user message,生成可验证的 echo 响应
      const userMsg = (payload.messages || []).find((m) => m.role === 'user')?.content || ''
      const marker = `MOCK_LLM_OK_${requestCount}_${userMsg.length > 0 ? 'WITH_INPUT' : 'NO_INPUT'}`
      const responseContent = `${marker}: 收到 "${userMsg.slice(0, 50)}"`

      console.log(
        `[${ts}] POST /v1/chat/completions #${requestCount} model=${payload.model} userMsgLen=${userMsg.length} -> ${responseContent.slice(0, 80)}`,
      )

      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          id: `mock-chatcmpl-${requestCount}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: payload.model || 'mock-gpt',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: responseContent },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: userMsg.length, completion_tokens: responseContent.length, total_tokens: userMsg.length + responseContent.length },
        }),
      )
    })
    return
  }

  // 404
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: { message: `not found: ${req.method} ${req.url}` } }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[mock-llm] listening on http://127.0.0.1:${port}`)
  console.log(`[mock-llm] POST /v1/chat/completions -> mock response`)
  console.log(`[mock-llm] GET /health -> ok`)
  console.log(`[mock-llm] press Ctrl+C to stop`)
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[mock-llm] shutting down...')
  server.close(() => process.exit(0))
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
