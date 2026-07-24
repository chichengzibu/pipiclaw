// 调试 Ollama /v1/chat/completions 实际响应
const BASE = 'http://localhost:11434/v1'
const MODEL = 'qwen3.5:9b'

console.log('=== 1) 非流式 ===')
const r1 = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: '用 10 个字自我介绍' }],
    max_tokens: 100,
    temperature: 0.7,
  }),
})
const d1 = await r1.json()
console.log(JSON.stringify(d1, null, 2).slice(0, 2000))

console.log('\n=== 2) 流式 ===')
const r2 = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: '你好' }],
    stream: true,
    max_tokens: 50,
  }),
})
const reader = r2.body.getReader()
const decoder = new TextDecoder()
let chunkIdx = 0
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  chunkIdx++
  const text = decoder.decode(value, { stream: true })
  for (const line of text.split('\n').filter(Boolean)) {
    if (line.startsWith('data: ')) {
      const payload = line.slice(6)
      if (payload === '[DONE]') continue
      try {
        const j = JSON.parse(payload)
        console.log(`chunk ${chunkIdx}:`, JSON.stringify(j).slice(0, 300))
      } catch (e) {
        console.log(`chunk ${chunkIdx} parse fail:`, line.slice(0, 100))
      }
    }
  }
  if (chunkIdx > 3) break
}
