// 关闭 thinking 模式测试
const BASE = 'http://localhost:11434/v1'
const MODEL = 'qwen3.5:9b'

// 1) OpenAI-compat 路径 + think: false
console.log('=== qwen3.5:9b + think:false (OpenAI compat) ===')
const t1 = Date.now()
const r1 = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: '你好' }],
    max_tokens: 100,
    think: false,
  }),
})
const d1 = await r1.json()
console.log(`  ${Date.now() - t1}ms, content="${d1.choices?.[0]?.message?.content || ''}"`)
console.log(`  reasoning: ${(d1.choices?.[0]?.message?.reasoning || '').slice(0, 80)}`)

// 2) Native Ollama API + think: false
console.log('\n=== qwen3.5:9b + think:false (Native) ===')
const t2 = Date.now()
const r2 = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: '你好' }],
    stream: false,
    think: false,
  }),
})
const d2 = await r2.json()
console.log(`  ${Date.now() - t2}ms, content="${d2.message?.content || ''}"`)
console.log(`  reasoning: ${(d2.message?.reasoning || '').slice(0, 80)}`)

// 3) qwen3:14b 也试一下
console.log('\n=== qwen3:14b + think:false (Native) ===')
const t3 = Date.now()
const r3 = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3:14b',
    messages: [{ role: 'user', content: '你好' }],
    stream: false,
    think: false,
  }),
})
const d3 = await r3.json()
console.log(`  ${Date.now() - t3}ms, content="${d3.message?.content || ''}"`)
console.log(`  reasoning: ${(d3.message?.reasoning || '').slice(0, 80)}`)

// 4) 不带 think 字段(默认)
console.log('\n=== qwen3:14b 不带 think (默认行为) ===')
const t4 = Date.now()
const r4 = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3:14b',
    messages: [{ role: 'user', content: '你好' }],
    stream: false,
  }),
})
const d4 = await r4.json()
console.log(`  ${Date.now() - t4}ms, content="${d4.message?.content || ''}"`)
console.log(`  reasoning: ${(d4.message?.reasoning || '').slice(0, 80)}`)
