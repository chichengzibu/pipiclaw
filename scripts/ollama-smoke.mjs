// Ollama 真链路 smoke test
// 跑 5 个真实场景 + 性能基准

const BASE = 'http://localhost:11434'

async function listModels() {
  const r = await fetch(`${BASE}/api/tags`)
  const data = await r.json()
  return data.models.map((m) => ({
    name: m.name,
    size: Math.round((m.size || 0) / 1024 / 1024) + 'MB',
    params: m.details?.parameter_size || '?',
    family: m.details?.family || '?',
    ctx: m.details?.context_length || '?',
    caps: m.capabilities || [],
  }))
}

async function chat(model, messages, opts = {}) {
  const start = Date.now()
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { num_predict: opts.maxTokens || 256, temperature: opts.temperature ?? 0.7 },
    }),
  })
  const ttfb = Date.now() - start
  const data = await r.json()
  const total = Date.now() - start
  return {
    model,
    content: data.message?.content || '',
    promptTokens: data.prompt_eval_count || 0,
    responseTokens: data.eval_count || 0,
    totalDurationMs: data.total_duration ? Math.round(data.total_duration / 1e6) : null,
    loadDurationMs: data.load_duration ? Math.round(data.load_duration / 1e6) : null,
    promptEvalDurationMs: data.prompt_eval_duration ? Math.round(data.prompt_eval_duration / 1e6) : null,
    evalDurationMs: data.eval_duration ? Math.round(data.eval_duration / 1e6) : null,
    wallMs: total,
    ttfbMs: ttfb,
    tokensPerSec: data.eval_count && data.eval_duration ? data.eval_count / (data.eval_duration / 1e9) : null,
  }
}

async function streamChat(model, messages) {
  const start = Date.now()
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  })
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let firstByte = null
  let chunks = 0
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (firstByte === null) firstByte = Date.now() - start
    chunks++
    const text = decoder.decode(value, { stream: true })
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const json = JSON.parse(line)
        if (json.message?.content) full += json.message.content
        if (json.done) {
          return {
            model,
            content: full,
            chunks,
            firstByteMs: firstByte,
            totalMs: Date.now() - start,
            promptTokens: json.prompt_eval_count,
            responseTokens: json.eval_count,
            tokensPerSec: json.eval_count && json.eval_duration ? json.eval_count / (json.eval_duration / 1e9) : null,
          }
        }
      } catch {}
    }
  }
  return { model, content: full, chunks, firstByteMs: firstByte, totalMs: Date.now() - start }
}

async function main() {
  const model = process.argv[2] || 'qwen3.5:9b'
  console.log('='.repeat(60))
  console.log(`Ollama Real Link Test — model: ${model}`)
  console.log('='.repeat(60))

  // 1. 列出模型,确认 model 存在
  console.log('\n[1] 模型列表:')
  const models = await listModels()
  models.forEach((m) => console.log(`  - ${m.name} (${m.params}, ${m.size}, ctx=${m.ctx})`))
  if (!models.find((m) => m.name === model)) {
    console.log(`\n⚠️  ${model} 不在已下载列表,会自动从 cloud pull`)
  }

  // 2. 基础单轮(英文)
  console.log('\n[2] 单轮对话(英文):')
  console.log('  Q: "用一句话自我介绍"')
  const r1 = await chat(model, [{ role: 'user', content: '用一句话自我介绍,不超过 30 字' }])
  console.log(`  A: ${r1.content}`)
  console.log(`  ⏱  TTFB ${r1.ttfbMs}ms / total ${r1.wallMs}ms / ${r1.tokensPerSec?.toFixed(1)} t/s`)
  console.log(`  📊 prompt ${r1.promptTokens}t → response ${r1.responseTokens}t`)

  // 3. 中文流式
  console.log('\n[3] 流式对话(中文 markdown):')
  console.log('  Q: "写一个 Python 快排,带注释"')
  const r2 = await streamChat(model, [{ role: 'user', content: '写一个 Python 快速排序,带注释' }])
  console.log(`  first byte: ${r2.firstByteMs}ms`)
  console.log(`  total: ${r2.totalMs}ms / ${r2.chunks} chunks / ${r2.tokensPerSec?.toFixed(1)} t/s`)
  console.log('  ---response---')
  console.log(r2.content.slice(0, 500))
  console.log('  ---end---')

  // 4. 多轮上下文
  console.log('\n[4] 多轮上下文(3 轮):')
  const r3a = await chat(model, [
    { role: 'system', content: '你是 PiPiClaw,一个桌面 AI 助手,回答简洁' },
    { role: 'user', content: '我叫什么?' },
  ])
  console.log(`  R1: ${r3a.content}  (${r3a.responseTokens}t / ${r3a.wallMs}ms)`)
  const r3b = await chat(model, [
    { role: 'system', content: '你是 PiPiClaw,一个桌面 AI 助手,回答简洁' },
    { role: 'user', content: '我叫什么?' },
    { role: 'assistant', content: r3a.content },
    { role: 'user', content: '我叫小明,做 Python 开发的' },
  ])
  console.log(`  R2: ${r3b.content}  (${r3b.responseTokens}t / ${r3b.wallMs}ms)`)
  const r3c = await chat(model, [
    { role: 'system', content: '你是 PiPiClaw,一个桌面 AI 助手,回答简洁' },
    { role: 'user', content: '我叫什么?' },
    { role: 'assistant', content: r3a.content },
    { role: 'user', content: '我叫小明,做 Python 开发的' },
    { role: 'assistant', content: r3b.content },
    { role: 'user', content: '你还记得我叫什么吗?' },
  ])
  console.log(`  R3: ${r3c.content}  (${r3c.responseTokens}t / ${r3c.wallMs}ms)`)

  // 5. 工具调用(如果支持)
  console.log('\n[5] 工具调用测试:')
  const r5 = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: '北京今天天气怎么样?' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: '获取指定城市的天气',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string', description: '城市名' } },
              required: ['city'],
            },
          },
        },
      ],
      stream: false,
    }),
  })
  const d5 = await r5.json()
  if (d5.message?.tool_calls) {
    console.log(`  ✓ 模型决定调用工具:`, JSON.stringify(d5.message.tool_calls))
  } else if (d5.message?.content) {
    console.log(`  模型直接回答(没调工具): ${d5.message.content.slice(0, 100)}`)
  } else {
    console.log(`  ✗ 异常响应:`, JSON.stringify(d5).slice(0, 200))
  }

  // 6. 总结
  console.log('\n' + '='.repeat(60))
  console.log('总结:')
  console.log(`  TTFB 平均: ${Math.round((r1.ttfbMs + r3a.wallMs) / 2)}ms`)
  console.log(`  速度: ${r2.tokensPerSec?.toFixed(1)} t/s (9B Q4_K_M @ 本地 CPU/GPU)`)
  console.log(`  工具调用: ${d5.message?.tool_calls ? '✓' : '✗(不调)'}`)
  console.log('='.repeat(60))
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
