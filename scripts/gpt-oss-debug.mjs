// gpt-oss-20B 深度调优 — S2 代码生成失败原因 + S4 多轮对比
const BASE = 'http://localhost:11434/v1'
const MODEL = 'gpt-oss:20b'

async function chat(label, body) {
  const t = Date.now()
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, ...body, temperature: 0.5 }),
  })
  const d = await r.json()
  const c = d.choices?.[0]
  const m = c?.message
  const content = m?.content || ''
  const reasoning = m?.reasoning || ''
  console.log(`\n[${label}] ${Date.now() - t}ms, finish=${c?.finish_reason}`)
  console.log(`  usage: ${JSON.stringify(d.usage)}`)
  console.log(`  reasoning: ${reasoning.length} 字`)
  if (reasoning) console.log(`  reasoning 末尾: ...${reasoning.slice(-100)}`)
  console.log(`  content: ${content.length} 字`)
  if (content) {
    console.log(`  content 头: ${content.slice(0, 200)}`)
    console.log(`  content 尾: ...${content.slice(-100)}`)
  }
  return { content, reasoning, usage: d.usage, finish: c?.finish_reason }
}

// S2 复现: 短 max_tokens → thinking 耗光
console.log('===== S2 复现: max_tokens=800 =====')
const r1 = await chat('S2 短', {
  messages: [{ role: 'user', content: '写一个 Python 快速排序,带详细注释,不超过 30 行' }],
  max_tokens: 800,
})

// 解决:把 max_tokens 提到 2000
console.log('\n===== S2 解决: max_tokens=2000 =====')
const r2 = await chat('S2 长', {
  messages: [{ role: 'user', content: '写一个 Python 快速排序,带详细注释,不超过 30 行' }],
  max_tokens: 2000,
})

// 关掉 thinking
console.log('\n===== S2 关掉 thinking: think:false + max_tokens=800 =====')
const r3 = await chat('S2 不思考', {
  messages: [{ role: 'user', content: '写一个 Python 快速排序,带详细注释,不超过 30 行' }],
  max_tokens: 800,
  think: false,
})

// 解决:提高 max_tokens 同时关闭 thinking
console.log('\n===== S2 终极: think:false + max_tokens=2000 =====')
const r4 = await chat('S2 终极', {
  messages: [{ role: 'user', content: '写一个 Python 快速排序,带详细注释,不超过 30 行' }],
  max_tokens: 2000,
  think: false,
})

// 多轮 S4: qwen3.5 之前失败,看 gpt-oss
console.log('\n===== S4 多轮: gpt-oss 能否记住名字 =====')
const r5a = await chat('S4 T1', {
  messages: [
    { role: 'system', content: '你是 PiPiClaw,简洁回答' },
    { role: 'user', content: '我叫什么?' },
  ],
  max_tokens: 100,
})
const r5b = await chat('S4 T2', {
  messages: [
    { role: 'system', content: '你是 PiPiClaw,简洁回答' },
    { role: 'user', content: '我叫什么?' },
    { role: 'assistant', content: r5a.content },
    { role: 'user', content: '我叫小明,做 Python 后端' },
  ],
  max_tokens: 100,
})
const r5c = await chat('S4 T3', {
  messages: [
    { role: 'system', content: '你是 PiPiClaw,简洁回答' },
    { role: 'user', content: '我叫什么?' },
    { role: 'assistant', content: r5a.content },
    { role: 'user', content: '我叫小明,做 Python 后端' },
    { role: 'assistant', content: r5b.content },
    { role: 'user', content: '你还记得我叫什么?做什么的?' },
  ],
  max_tokens: 200,
})
console.log(`\n  R3 包含"小明": ${r5c.content.includes('小明') ? 'YES' : 'NO'}`)
console.log(`  R3 包含"Python": ${r5c.content.includes('Python') ? 'YES' : 'NO'}`)
console.log(`  R3: ${r5c.content.slice(0, 200)}`)
